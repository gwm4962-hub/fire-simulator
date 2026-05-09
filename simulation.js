/**
 * simulation.js — モンテカルロシミュレーション・コアロジック
 * FLOW | 資産シミュレーター
 */
// 1. データの定義（ここがプログラムの実質的なスタート）

     const tmValues = [
        [70, 20, 5, 5],
        [10, 70, 10, 10],
        [15, 30, 50, 5],
        [10, 30, 10, 50]
      ];

// ============================================================
// BigInt 精度ユーティリティ — 整数円単位の計算精度向上
// ============================================================
/**
 * 金融計算における精度保証モジュール
 *
 * JavaScript の Number (float64) は 2^53 ≈ 9007兆円まで整数を正確に
 * 表現できますが、税額・累積収支など整数の加減が何百回も重なる場面では
 * float の丸め誤差が数円〜数十円の誤差を生みます。
 *
 * このモジュールは「円単位の整数演算」を BigInt で行い、
 * 乗算が必要な箇所（リターン率との積など）は Number に変換してから行う
 * ハイブリッド方式を採用します。
 *
 * 用途:
 *   - 税金計算の各ブラケット境界値（整数円）の累積
 *   - 相続金額・年金・児童手当など整数円ベースの収支積算
 *   - 万円→円変換後の端数なし確認
 */

const FinCalc = (() => {
  // 万円（整数）を円の BigInt に変換
  function manToYen(man) {
    return BigInt(Math.round(Number(man))) * 10000n;
  }

  // 円 BigInt → Number（万円・表示用）
  function yenToMan(yenBig) {
    return Number(yenBig) / 10000;
  }

  /**
   * 整数円の累積収支を BigInt で正確に計算する。
   * income / expense は万円単位の Number。
   * @param {number[]} incomesMan  各年の収入（万円、整数）
   * @param {number[]} expensesMan 各年の支出（万円、整数）
   * @returns {{ netYen: bigint, netMan: number }}
   */
  function sumNetCashflow(incomesMan, expensesMan) {
    let total = 0n;
    const len = Math.min(incomesMan.length, expensesMan.length);
    for (let i = 0; i < len; i++) {
      total += manToYen(incomesMan[i]) - manToYen(expensesMan[i]);
    }
    return { netYen: total, netMan: yenToMan(total) };
  }

  /**
   * 昇給後の年収を BigInt 整数円で精確に返す。
   * 昇給率 raiseRate は float のまま乗算し、最終を BigInt に丸める。
   * @param {number} baseYen  基本年収（円）
   * @param {number} raiseRate 昇給率（例: 0.015）
   * @param {number} years    経過年数
   * @returns {bigint}
   */
  function raisedIncomeYen(baseYen, raiseRate, years) {
    // Math.pow は float だが、最後に BigInt へ丸めて整数に固定
    const exact = baseYen * Math.pow(1 + raiseRate, years);
    return BigInt(Math.round(exact));
  }

  /**
   * 税額計算（円単位）を BigInt で累積し端数を除去。
   * 超過累進ブラケットを BigInt で走査して整数誤差をゼロにする。
   * @param {number} taxableYen  課税所得（円）
   * @param {Array}  brackets    [[上限円, 税率], ...] 形式
   * @returns {bigint}  所得税額（円, BigInt）
   */
  function calcProgressiveTaxBigInt(taxableYen, brackets) {
    const taxable = BigInt(Math.round(taxableYen));
    let tax = 0n;
    let prev = 0n;
    for (const [limit, rate] of brackets) {
      if (taxable <= prev) break;
      const cap = limit === Infinity ? taxable : BigInt(Math.round(limit));
      const slice = (taxable < cap ? taxable : cap) - prev;
      // 税率は float → 整数円に丸める
      tax += BigInt(Math.round(Number(slice) * rate));
      prev = cap;
    }
    return tax;
  }

  /**
   * 年金・相続など固定整数収入の検証。
   * スライダー値（万円整数）→円変換の端数がないか BigInt でアサート。
   * 万円単位の整数は 10,000 の倍数になるはずであり、
   * float 乗算で生じた ±1円以内のズレを修正する。
   * @param {number} valueYen Number型の円金額
   * @returns {number} 10,000円単位に丸めた円金額（Number）
   */
  function roundToMan(valueYen) {
    return Number(BigInt(Math.round(valueYen / 10000)) * 10000n);
  }

  return { manToYen, yenToMan, sumNetCashflow, raisedIncomeYen,
           calcProgressiveTaxBigInt, roundToMan };
})();

// ブラウザ・テスト環境の両方から参照できるよう window / globalThis に登録。
// validator_test.js の loadScript は new Function スコープで実行するため、
// const で宣言した FinCalc はそのままではグローバルに露出しない。
// globalThis への明示登録でこの問題を解決する。
(typeof globalThis !== 'undefined' ? globalThis : window).FinCalc = FinCalc;

// ============================================================
// BigInt 精度検証（calcTax 強化）
// ============================================================
/**
 * calcTaxPrecise — calcTax の所得税計算部分を BigInt で再実装し
 * 超過累進税の端数誤差（最大数十円）をゼロにする。
 * 戻り値の構造は calcTax と同一で後方互換。
 */
function calcTaxPrecise(grossYen) {
  if (!grossYen || grossYen <= 0) {
    return { socialIns:0, incomeTax:0, residTax:0, takeHomeYen:0, rate:0, taxable:0 };
  }

  // 社会保険料（上限あり）— FinCalc.roundToMan で万円端数を補正
  const socialIns = FinCalc.roundToMan(Math.min(grossYen * 0.15, 1_400_000));

  // 給与所得控除（法令の閾値は整数円なので BigInt 境界で正確に計算）
  let empDed;
  const g = grossYen;
  if      (g <= 1_625_000)  empDed = 550_000;
  else if (g <= 1_800_000)  empDed = Math.round(g * 0.4) - 100_000;
  else if (g <= 3_600_000)  empDed = Math.round(g * 0.3) + 80_000;
  else if (g <= 6_600_000)  empDed = Math.round(g * 0.2) + 440_000;
  else if (g <= 8_500_000)  empDed = Math.round(g * 0.1) + 1_100_000;
  else                      empDed = 1_950_000;

  const basicDed = 480_000;
  const taxable  = Math.max(0, grossYen - socialIns - empDed - basicDed);

  // 超過累進所得税を BigInt で計算（端数誤差ゼロ）
  const brackets = [
    [1_949_000, 0.05], [3_299_000, 0.10], [6_949_000, 0.20],
    [8_999_000, 0.23], [17_999_000, 0.33], [39_999_000, 0.40], [Infinity, 0.45]
  ];
  const incomeTaxBase = Number(FinCalc.calcProgressiveTaxBigInt(taxable, brackets));
  const incomeTax = Math.round(incomeTaxBase * 1.021); // 復興特別所得税（整数円）

  const residTax    = Math.round(taxable * 0.10);
  const takeHomeYen = grossYen - socialIns - incomeTax - residTax;
  const rate        = takeHomeYen / grossYen;

  return { socialIns, incomeTax, residTax, takeHomeYen, rate, taxable };
}


function addSliderTouchGuard(el) {
  if (el._touchBound) return;
  el._touchBound = true;

  let startX = null, startY = null, dragging = false;

  el.addEventListener('touchstart', e => {
    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    dragging = false;
  }, { passive: true });

  el.addEventListener('touchmove', e => {
    if (startX === null) return;
    const t = e.touches[0];
    const dx = t.clientX - startX;
    const dy = Math.abs(t.clientY - startY);

    if (!dragging && dy > Math.abs(dx)) { startX = null; return; }

    dragging = true;
    e.preventDefault();

    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (t.clientX - rect.left) / rect.width));
    const min = parseFloat(el.min) || 0;
    const max = parseFloat(el.max) || 100;
    const step = parseFloat(el.step) || 1;

    let newVal = min + ratio * (max - min);
    newVal = Math.round((newVal - min) / step) * step + min;
    newVal = Math.min(max, Math.max(min, newVal));

    if (newVal !== parseFloat(el.value)) {
      el.value = newVal;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, { passive: false });

  el.addEventListener('touchend', () => {
    if (dragging) el.dispatchEvent(new Event('change', { bubbles: true }));
    startX = null; startY = null; dragging = false;
  }, { passive: true });
}

// 全スライダーに適用
function applyTouchToAllSliders() {
  document.querySelectorAll('input[type="range"]').forEach(addSliderTouchGuard);
}
applyTouchToAllSliders();

// 動的生成スライダー（TMマトリクス等）にも自動適用
(new MutationObserver(mutations => {
  mutations.forEach(m => m.addedNodes.forEach(node => {
    if (node.nodeType !== 1) return;
    if (node.matches && node.matches('input[type="range"]')) addSliderTouchGuard(node);
    if (node.querySelectorAll) node.querySelectorAll('input[type="range"]').forEach(addSliderTouchGuard);
  }));
})).observe(document.body, { childList: true, subtree: true });

// ============================================================
// Slider helper
// ============================================================
function bindSlider(id, dispId, fmt) {
  const s=document.getElementById(id), d=document.getElementById(dispId);
  if (!s) return; // slider not found, skip silently
  if (d) d.textContent=fmt(s.value);
  s.addEventListener('input',()=>{ if(d) d.textContent=fmt(s.value); });
  addSliderTouchGuard(s);
}
const manFmt=v=>{ const n=Number(v); return n>=10000?`${(n/10000).toFixed(1)}億円`:`${n.toLocaleString()}万円`; };

bindSlider('start-age',     'val-start-age',     v=>`${v}歳`);
bindSlider('fire-threshold','val-fire-threshold', manFmt);
bindSlider('income',        'val-income',         v=>`${Number(v).toLocaleString()}万円`);
bindSlider('take-home',     'val-take-home',      v=>`${v}%`);
bindSlider('raise',         'val-raise',          v=>`${Number(v).toFixed(1)}%`);
bindSlider('income-b',      'val-income-b',       v=>`${Number(v).toLocaleString()}万円`);
bindSlider('raise-b',       'val-raise-b',        v=>`${Number(v).toFixed(1)}%`);
bindSlider('pension',       'val-pension',        v=>`${v}万円`);
bindSlider('inheritance',   'val-inheritance',    manFmt);
bindSlider('base-infl',     'val-base-infl',      v=>`${Number(v).toFixed(1)}%`);
// exp-active / exp-mid は廃止 → ライフステージシステムに統合
bindSlider('w-working',     'val-w-working',      v=>`${v}%`);
bindSlider('w-retired',     'val-w-retired',      v=>`${v}%`);
bindSlider('tdof',          'val-tdof',           v=>Number(v)>=30?'ほぼ正規分布':`t(df=${v})`);
bindSlider('med-adv',       'sim-med-val',        v=>`${Number(v).toFixed(1)}%`);
bindSlider('nsims', 'val-nsims', v => {
  const n = Number(v).toLocaleString();
  const el = document.getElementById('run-nsims-display');
  if (el) el.textContent = n;
  return `${n}回`;
});
// 「現在の資産」の連動は下部のIIFEで一元管理

// ============================================================
// LIFE-STAGE EXPENSE SYSTEM
// ============================================================
const STAGE_COLORS = [
  '#00d4ff','#a8ff78','#ffd166','#ff6eb4','#b388ff','#ff9a3c','#4ecdc4','#f7c59f'
];

let expStages = [];
let stageIdCounter = 0;

const EXP_PRESETS = {
  single: [
    { label:'一人暮らし（若手）', from:22, to:34, exp:240 },
    { label:'一人暮らし（中堅）', from:35, to:49, exp:300 },
    { label:'プレ老後',           from:50, to:64, exp:240 },
    { label:'老後',               from:65, to:90, exp:200 },
  ],
  couple: [
    { label:'共働き（初期）',    from:25, to:34, exp:300 },
    { label:'共働き（中期）',    from:35, to:49, exp:420 },
    { label:'プレ老後',          from:50, to:64, exp:320 },
    { label:'老後（二人）',      from:65, to:90, exp:280 },
  ],
  family: [
    { label:'夫婦2人',           from:25, to:29, exp:300 },
    { label:'子育て初期',        from:30, to:39, exp:480 },
    { label:'子育て＋住宅ローン',from:32, to:51, exp:650 },
    { label:'ローン完済後',      from:52, to:59, exp:320 },
    { label:'老後（夫婦）',      from:60, to:90, exp:280 },
  ],
};

function getStartAge() {
  return parseInt(document.getElementById('start-age').value) || 30;
}

function stageColor(idx) {
  return STAGE_COLORS[idx % STAGE_COLORS.length];
}

// ============================================================
// セキュリティユーティリティ
// ============================================================
/**
 * escapeHTML — innerHTML に埋め込む前にユーザー入力を必ずサニタイズ。
 * XSS (DOM-based) 防止のため、ユーザーが自由入力できる文字列は
 * すべてこの関数を通してからテンプレートリテラルに渡すこと。
 */
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderTimeline() {
  const bar = document.getElementById('expense-timeline-bar');
  if (!expStages.length) { bar.innerHTML = ''; return; }

  const sorted = [...expStages].sort((a,b)=>a.from-b.from);
  const minAge = Math.min(...sorted.map(s=>s.from));
  const maxAge = Math.max(...sorted.map(s=>s.to));
  const span   = Math.max(1, maxAge - minAge);

  // Build non-overlapping segments: advance cursor, clip overlapping stages
  let html = `<div class="tl-bar">`;
  let cursor = minAge;
  sorted.forEach((s) => {
    const segStart = Math.max(s.from, cursor);
    const segEnd   = s.to;
    if (segEnd <= segStart) return; // fully overlapped, skip

    if (segStart > cursor) {
      // gap segment
      const gw = ((segStart - cursor) / span * 100).toFixed(1);
      html += `<div class="tl-seg" style="width:${gw}%;background:var(--surface3);opacity:.4;font-size:8px;flex-shrink:0;">…</div>`;
    }
    const w = ((segEnd - segStart) / span * 100).toFixed(1);
    const col = stageColor(expStages.indexOf(s));
    // ユーザー入力の s.label を title 属性・テキストに安全に埋め込む
    const safeLabel = escapeHTML(s.label);
    const safeExp   = Number(s.exp); // 数値のみなのでそのまま
    html += `<div class="tl-seg" style="width:${w}%;background:${col}22;border-left:2px solid ${col};flex-shrink:0;" title="${safeLabel} (${s.from}〜${s.to}歳): ${safeExp}万円/年">
      <span style="color:${col};padding:0 3px;font-size:8px;white-space:nowrap;overflow:hidden;">${safeExp}万</span>
    </div>`;
    cursor = segEnd;
  });
  html += `</div>`;

  // Age labels: start / half / end（数値のみ — XSSリスクなし）
  const mid = Math.round(minAge + span * 0.5);
  html += `<div class="tl-labels"><span>${minAge}歳</span><span>${mid}歳</span><span>${maxAge}歳</span></div>`;
  bar.innerHTML = html;
}

// Track collapsed state for edu group
let _eduGroupCollapsed = true;

function renderStages() {
  const container = document.getElementById('expense-stages');
  container.innerHTML = '';

  const normalStages = expStages.filter(s => !s._autoEdu);
  const eduStages    = expStages.filter(s =>  s._autoEdu);

  // Render normal stages
  normalStages.forEach((s) => {
    const idx = expStages.indexOf(s);
    const col = stageColor(idx);
    const card = document.createElement('div');
    card.className = 'stage-card';
    card.dataset.id = s.id;
    // innerHTML でカードの骨格を生成（ユーザー入力はこの後 DOM API で安全に設定）
    card.innerHTML = `
      <div class="stage-card-top">
        <div class="stage-color-bar" style="background:${col};box-shadow:0 0 8px ${col}55;"></div>
        <input class="stage-label-input" placeholder="ステージ名"
               autocomplete="off" aria-label="ステージ名"
               data-stage-id="${s.id}" data-field="label">
        <button class="stage-delete-btn" data-stage-id="${s.id}" title="このステージを削除" aria-label="ステージを削除">×</button>
      </div>
      <div class="stage-fields">
        <div class="stage-field">
          <label>開始年齢</label>
          <input type="number" min="0" max="120" step="1"
                 autocomplete="off" aria-label="開始年齢"
                 data-stage-id="${s.id}" data-field="from">
        </div>
        <div class="stage-field">
          <label>終了年齢</label>
          <input type="number" min="1" max="120" step="1"
                 autocomplete="off" aria-label="終了年齢"
                 data-stage-id="${s.id}" data-field="to">
        </div>
        <div class="stage-field">
          <label>年間支出(万)</label>
          <input type="number" min="0" max="5000" step="10"
                 autocomplete="off" aria-label="年間支出（万円）"
                 data-stage-id="${s.id}" data-field="exp">
        </div>
      </div>
    `;
    // ユーザー入力値は textContent / value プロパティで安全に設定（XSS回避）
    const labelInp = card.querySelector('.stage-label-input');
    if (labelInp) labelInp.value = s.label; // input.value はHTMLエスケープ不要

    const numInputs = card.querySelectorAll('input[type="number"]');
    numInputs.forEach(inp => {
      const field = inp.dataset.field;
      if (field === 'from') inp.value = s.from;
      else if (field === 'to') inp.value = s.to;
      else if (field === 'exp') inp.value = s.exp;
    });

    // イベント委任（oninput属性を使わずaddEventListenerで登録）
    card.querySelectorAll('[data-stage-id]').forEach(el => {
      const stageId = parseInt(el.dataset.stageId);
      const field   = el.dataset.field;
      if (!field) {
        // 削除ボタン
        if (el.classList.contains('stage-delete-btn')) {
          el.addEventListener('click', () => deleteStage(stageId));
        }
        return;
      }
      el.addEventListener('input', () => {
        const val = field === 'label' ? el.value
                  : field === 'from'  ? parseInt(el.value)
                  : field === 'to'    ? parseInt(el.value)
                  :                     parseInt(el.value);
        updateStage(stageId, field, val);
      });
    });

    container.appendChild(card);
  });

  // Render education stages as a collapsible group
  if (eduStages.length > 0) {
    const totalEduCost = eduStages.reduce((sum, s) => sum + (s.exp * (s.to - s.from)), 0);
    const groupDiv = document.createElement('div');
    groupDiv.style.cssText = 'border:1px solid rgba(0,212,255,.2);border-radius:8px;margin-bottom:8px;overflow:hidden;';
    
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:rgba(0,212,255,.06);cursor:pointer;user-select:none;';
    header.innerHTML = `
      <span style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;color:var(--accent);">
        <span id="edu-group-arrow" style="display:inline-block;transition:transform .2s;transform:${_eduGroupCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)'};">▾</span>
        🎓 子ども教育費ステージ（${eduStages.length}件）
      </span>
      <span style="font-size:11px;color:var(--text-dim);">合計約 ${totalEduCost}万円</span>
    `;
    header.addEventListener('click', () => {
      _eduGroupCollapsed = !_eduGroupCollapsed;
      const arrow = document.getElementById('edu-group-arrow');
      const body  = document.getElementById('edu-group-body');
      if (arrow) arrow.style.transform = _eduGroupCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
      if (body)  body.style.display = _eduGroupCollapsed ? 'none' : 'block';
    });
    groupDiv.appendChild(header);

    const body = document.createElement('div');
    body.id = 'edu-group-body';
    body.style.display = _eduGroupCollapsed ? 'none' : 'block';

    eduStages.forEach((s) => {
      const idx = expStages.indexOf(s);
      const col = stageColor(idx);
      const card = document.createElement('div');
      card.style.cssText = 'border-top:1px solid rgba(0,212,255,.1);padding:10px 12px;';
      card.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <div style="width:3px;height:16px;border-radius:2px;background:${col};flex-shrink:0;"></div>
          <span style="font-size:12px;font-weight:600;color:var(--text);flex:1;">${escapeHTML(s.label)}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
          <div style="font-size:11px;color:var(--text-dim);">開始: <b style="color:var(--text-mid);">${s.from}歳</b></div>
          <div style="font-size:11px;color:var(--text-dim);">終了: <b style="color:var(--text-mid);">${s.to}歳</b></div>
          <div style="font-size:11px;color:var(--text-dim);">年間: <b style="color:var(--accent);">${s.exp}万円</b></div>
        </div>
      `;
      body.appendChild(card);
    });
    groupDiv.appendChild(body);
    container.appendChild(groupDiv);
  }

  renderTimeline();
}

function updateStage(id, field, val) {
  const s = expStages.find(s=>s.id===id);
  if (s) { s[field] = val; renderTimeline(); }
}

function deleteStage(id) {
  expStages = expStages.filter(s=>s.id!==id);
  renderStages();
}

function addExpStage(label="", start="", end="", exp="") {
  const fromVal = start !== "" ? parseInt(start) : (getStartAge() || 30);
  const toVal   = end   !== "" ? parseInt(end)   : fromVal + 10;
  const expVal  = exp   !== "" ? parseInt(exp)   : 300;
  expStages.push({
    id:    ++stageIdCounter,
    label: label || "新しいステージ",
    from:  fromVal,
    to:    toVal,
    exp:   expVal,
  });
  renderStages();
}

function applyExpPreset(key) {
  const preset = EXP_PRESETS[key];
  if (!preset) return;
  const base = getStartAge();
  expStages = preset.map(p => ({
    id: ++stageIdCounter,
    label: p.label,
    from: p.from,
    to:   p.to,
    exp:  p.exp,
  }));
  renderStages();
}

/** シミュレーションから呼ぶ: 指定年齢の年間支出(円)を返す */
function getExpenseForAge(age) {
  // ソートして最初にマッチしたステージを返す
  const sorted = [...expStages].sort((a,b)=>a.from-b.from);
  for (const s of sorted) {
    if (age >= s.from && age < s.to) return s.exp * 10000;
  }
  // 範囲外は最後のステージの支出を返す（フォールバック）
  if (sorted.length) {
    if (age < sorted[0].from)  return sorted[0].exp * 10000;
    return sorted[sorted.length-1].exp * 10000;
  }
  return 2400000; // デフォルト240万
}

// 開始年齢変更時にタイムライン再描画
document.getElementById('start-age').addEventListener('input', renderTimeline);

// 初期プリセット適用（初期化なのでscheduleSaveさせない）
_isLoading = true;
applyExpPreset('family');
_isLoading = false;
/**
 * プリセットボタン専用のハンドラ
 * 見た目のハイライト処理と、データの適用を同時に行います
 */
function handlePresetClick(btn, type) {
    // 1. 全てのプリセットボタンのスタイルをリセット
    document.querySelectorAll('.preset-btn').forEach(b => {
        b.style.borderColor = '';
        b.style.background = '';
        b.style.color = '';
        b.style.boxShadow = '';
        b.style.transform = '';
        b.classList.remove('active-preset');
    });

    // 2. クリックされたボタンをアクティブにする
    if (btn) {
        btn.classList.add('active-preset');
    }

    // 3. 既存のロジックでデータを反映
    applyExpPreset(type);
}

// 初期化時に「子育て世帯(family)」のボタンを光らせるための処理
window.addEventListener('DOMContentLoaded', () => {
  // setTimeout(0) での setDifficulty('normal') 初期化が終わった後に実行
  setTimeout(() => {
    // 1. 保存済み設定を復元（_isLoadingフラグで誤保存を防ぐ）
    const restored = loadParameters();

    // 1b. URLパラメータから設定を読み込む（URL共有機能）
    const urlLoaded = loadFromUrl();

    // 2. 保存データもURLもない場合のみ、初期プリセットを適用
    if (!restored && !urlLoaded) {
      const familyBtn = document.querySelector('button[onclick*="family"]');
      if (familyBtn) {
        _isLoading = true;
        handlePresetClick(familyBtn, 'family');
        _isLoading = false;
      }
    }

    // 3. イベント委任リスナーを登録（復元後なのでscheduleSaveが安全に動く）
    registerAutoSaveListeners();

    // ★ 新機能の初期化（DOM確定後に実行）
    updateTaxDisplay();
    if (typeof _simCallbacks.renderRegimeDashboard === 'function') _simCallbacks.renderRegimeDashboard();
    if (typeof _simCallbacks.updateRegimeTable     === 'function') _simCallbacks.updateRegimeTable();
    initVolatilityDragExplorer();
    // Canvasチャートは200ms遅延させてスマホでのDOMサイズ確定を待つ
    setTimeout(() => {
      initFatTailAnalyzer();
      initMarkovVisualizer();
      drawRegimeSwitchChart();
    }, 200);

    // ── アコーディオン初期化 ──
    document.querySelectorAll('.param-section-label').forEach(label => {
      // param-section-labelの次の兄弟要素をbodyとしてwrap
      const section = label.parentElement;
      if (!section || !section.classList.contains('param-section')) return;
      // ラベル以外の子要素をparam-section-bodyで包む
      const children = Array.from(section.children).filter(c => !c.classList.contains('param-section-label'));
      if (children.length === 0) return;
      const body = document.createElement('div');
      body.className = 'param-section-body';
      children.forEach(c => body.appendChild(c));
      section.appendChild(body);
      // クリックで開閉
      label.addEventListener('click', () => {
        section.classList.toggle('collapsed');
      });
    });

    // ── フローティングSIMULATEボタン（スクロール制御） ──
    const floatBtn = document.getElementById('floating-simulate');
    const mainBtn  = document.getElementById('run-btn');
    function updateFloatBtn() {
      if (!floatBtn || !mainBtn) return;
      const rect = mainBtn.getBoundingClientRect();
      // メインボタンが画面外に出たらフローティングを表示
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        floatBtn.classList.remove('hidden');
      } else {
        floatBtn.classList.add('hidden');
      }
    }
    window.addEventListener('scroll', updateFloatBtn, { passive:true });
    updateFloatBtn();

    // ── 設定完了度インジケーター ──
    function updateSetupProgress() {
      const checks = [
        document.getElementById('start-age')?.value > 0,
        document.getElementById('initial-assets')?.value > 0,
        document.getElementById('fire-threshold')?.value > 0,
        document.getElementById('income')?.value > 0,
        document.getElementById('pension')?.value > 0,
        document.getElementById('w-working')?.value > 0,
      ];
      const done = checks.filter(Boolean).length;
      const pct  = Math.round(done / checks.length * 100);
      const fill = document.getElementById('setup-progress-bar-fill');
      const pctEl = document.getElementById('setup-pct');
      if (fill)  fill.style.width = pct + '%';
      if (pctEl) pctEl.textContent = pct + '%';
      if (pctEl) pctEl.style.color = pct >= 80 ? '#a8ff78' : pct >= 50 ? '#ffd166' : 'var(--text-dim)';
    }
    document.querySelectorAll('input[type="range"], input[type="number"]').forEach(el => {
      el.addEventListener('input', updateSetupProgress);
    });
    updateSetupProgress();

    // ★ 収入スライダーに税金計算を連動
    ['income','income-b','raise','raise-b'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => { updateTaxDisplay(); });
    });

    // ★ 遷移行列スライダー変更時に定常分布を更新
    document.addEventListener('input', e => {
      if (e.target.classList.contains('tm-sl')) {
        if (typeof _simCallbacks.renderRegimeDashboard === 'function') _simCallbacks.renderRegimeDashboard();
        if (typeof _simCallbacks.updateRegimeTable     === 'function') _simCallbacks.updateRegimeTable();
      }
    });

  }, 50);
});



// ============================================================
// Gender selector
// ============================================================
// Gompertz-Makeham parameters calibrated to Japan Life Tables 2022
// h(x) = alpha * exp(beta * x) + gamma
// Male:   mean ≈ 81y, modal age of death ≈ 87y
// Female: mean ≈ 87y, modal age of death ≈ 93y
const MORTALITY = {
  male:   { alpha:4.5e-5, beta:0.091, gamma:6.0e-4,
            desc:'平均寿命 約81歳 / 最頻死亡年齢 約87歳',
            params:'$$h(x) = \\alpha e^{\\beta x} + \\gamma$$, α=4.5×10⁻⁵, β=0.091, γ=6.0×10⁻⁴' },
  female: { alpha:1.5e-5, beta:0.096, gamma:2.5e-4,
            desc:'平均寿命 約87歳 / 最頻死亡年齢 約93歳',
            params:'$$h(x) = \\alpha e^{\\beta x} + \\gamma$$, α=1.5×10⁻⁵, β=0.096, γ=2.5×10⁻⁴' },
};
// グローバル変数：選択中の性別
let selectedGender = 'male';

// ============================================================
// Transition Matrix UI
// ============================================================
const RNAMES=['強気','通常','弱気','インフレ'];
const REMOJI=['🐂','📈','🐻','🔥'];
const RCOLORS=['bull','normal','bear','infla'];

function buildTM() {
  const outer=document.getElementById('tm-outer');
  outer.innerHTML='';
  tmValues.forEach((row,ri)=>{
    const block=document.createElement('div'); block.className='tm-row-block';
    const hdr=document.createElement('div'); hdr.className='tm-row-header';
    hdr.innerHTML=`<div class="tm-row-name" style="color:var(--${RCOLORS[ri]})">${REMOJI[ri]} ${RNAMES[ri]} から</div>
                   <div class="tm-row-sum-badge ok" id="tmsum-${ri}">100%</div>`;
    block.appendChild(hdr);
    const grid=document.createElement('div'); grid.className='tm-sliders-grid';
    row.forEach((val,ci)=>{
      const col=document.createElement('div'); col.className='tm-col';
      col.innerHTML=`<div class="tm-col-label" style="color:var(--${RCOLORS[ci]})">${REMOJI[ci]} ${RNAMES[ci]}</div>
        <div class="tm-col-val" id="tmv-${ri}-${ci}" style="color:var(--${RCOLORS[ci]})">${val}%</div>
        <input type="range" class="tm-sl c-${RCOLORS[ci]}" id="tms-${ri}-${ci}" min="0" max="100" step="1" value="${val}">`;
      grid.appendChild(col);
    });
    block.appendChild(grid);
    outer.appendChild(block);
    row.forEach((_,ci)=>{
      const sl=document.getElementById(`tms-${ri}-${ci}`);
      sl.addEventListener('input',function(){
        tmValues[ri][ci]=parseInt(this.value);
        document.getElementById(`tmv-${ri}-${ci}`).textContent=this.value+'%';
        updateSum(ri);
        scheduleSave();
      });
      addSliderTouchGuard(sl);
    });
    updateSum(ri);
  });
}
function updateSum(ri){
  const sum=tmValues[ri].reduce((a,b)=>a+b,0);
  const el=document.getElementById(`tmsum-${ri}`);
  el.textContent=sum+'%'; el.className='tm-row-sum-badge '+(sum===100?'ok':'warn');
}
function normalizeAll(){
  tmValues.forEach((row,ri)=>{
    const sum=row.reduce((a,b)=>a+b,0);
    if(sum===0){tmValues[ri]=[25,25,25,25];}
    else{
      const n=row.map(v=>Math.round(v/sum*100));
      const diff=100-n.reduce((a,b)=>a+b,0);
      n[n.indexOf(Math.max(...n))]+=diff;
      n.forEach((v,ci)=>{ tmValues[ri][ci]=v; });
    }
    tmValues[ri].forEach((v,ci)=>{
      const s=document.getElementById(`tms-${ri}-${ci}`), d=document.getElementById(`tmv-${ri}-${ci}`);
      if(s) s.value=v; if(d) d.textContent=v+'%';
    });
    updateSum(ri);
  });
}
buildTM();
// 初期難易度を「普通」で設定（ロード前の初期化なのでscheduleSaveさせない）
setTimeout(() => {
  _isLoading = true;
  setDifficulty('normal');
  _isLoading = false;
}, 0);

// ============================================================
// Random number generators
// ============================================================

// Box-Muller N(0,1)
function normalRandom() {
  let u=0,v=0;
  while(u===0) u=Math.random();
  while(v===0) v=Math.random();
  return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);
}

// Student t(df) sample, scaled to unit variance
// Method: t = Z / sqrt(Chi²(df)/df)
// Variance of t(df) = df/(df-2) for df>2, so we divide by sqrt(df/(df-2)) to normalise to Var=1
// This means mu/sigma parameters in REGIMES keep their original interpretation.
function tRandom(df) {
  if (df >= 120) return normalRandom(); // effectively normal
  let chi2;
  if (df >= 30) {
    // Wilson-Hilferty approximation for Chi²(df)
    const z=normalRandom(), a=1-2/(9*df), b=Math.sqrt(2/(9*df));
    chi2=Math.max(df*Math.pow(a+b*z,3), 0.01);
  } else {
    chi2=0;
    for(let k=0;k<df;k++){const n=normalRandom();chi2+=n*n;}
  }
  const raw=normalRandom()/Math.sqrt(chi2/df);
  // Normalise variance: Var(t_df) = df/(df-2)  →  divide by sqrt(df/(df-2))
  const scale=(df>2)?Math.sqrt(df/(df-2)):1;
  return raw/scale;
}

// ============================================================
// 多変量t分布サンプラー（2変数 Cholesky 分解ベース）
//
// 既存コードの「zBondCorr = corr * zStock + sqrt(1-corr²) * zBond」は
// 2×2 Cholesky 分解と等価だが、以下の関数で明示的に実装することで
// ① テスト可能な純粋関数として切り出す
// ② 将来的に N 変数への拡張が容易になる
// ③ zStock / zBond の自由度を個別制御できる
//
// 引数:
//   { mu: [μ₁, μ₂], sigma: [σ₁, σ₂], corr: ρ, df: 自由度 }
//   すべて変量は「単位分散 t(df) に正規化済み」を仮定。
//   corr は [-1, 1] の相関係数。
//
// 戻り値: [r₁, r₂]  各資産クラスの年間リターン（小数）
// ============================================================
function samplingFromBivariateT({ mu, sigma, corr, df }) {
  // --- Step 1: 独立した t(df) ショック 2 本を生成 ---
  const z1 = tRandom(df);
  const z2 = tRandom(df);

  // --- Step 2: Cholesky 分解で相関を注入 ---
  // 2×2 相関行列 [[1, ρ], [ρ, 1]] の Cholesky 因子:
  //   L = [[1, 0], [ρ, sqrt(1-ρ²)]]
  // → z_corr = L × [z1, z2]ᵀ
  const rho   = Math.max(-0.999, Math.min(0.999, corr ?? 0));
  const z1c   = z1;                                             // 1列目はそのまま
  const z2c   = rho * z1 + Math.sqrt(Math.max(0, 1 - rho * rho)) * z2;

  // --- Step 3: μ + σ × z でリターンを生成 ---
  const r1 = mu[0] + sigma[0] * z1c;
  const r2 = mu[1] + sigma[1] * z2c;

  return [r1, r2];
}


// ============================================================
// 一時イベント（タイムライン）管理システム
//
// expStages が「期間ベースの継続支出」を管理するのに対し、
// oneTimeEvents は「特定年だけ発生する一時収支」を管理する。
//
// データ構造:
//   { id, age, amount, type, label }
//   - age:    発生年齢（整数）
//   - amount: 収支金額（万円、正=収入、負=支出）
//   - type:   'income' | 'expense' | 'asset'（資産増減）
//   - label:  UI 表示名
//
// 利用例:
//   住宅購入（-3,000万円、40歳）
//   退職金受取（+1,500万円、60歳）
//   大規模修繕（-800万円、55歳）
//   相続（+2,000万円、55歳）
// ============================================================
let oneTimeEvents = [];
let oneTimeEventIdCounter = 0;

/**
 * 指定年齢の一時キャッシュフロー合計を円で返す。
 * simulation.js の年次ループから呼ばれる純粋関数。
 * @param {number} age  シミュレーション中の現在年齢
 * @param {Array}  evs  oneTimeEvents 配列（デフォルトはグローバル変数）
 * @returns {number}    円単位のキャッシュフロー（正=収入、負=支出）
 */
function getOneTimeEventCashflow(age, evs = oneTimeEvents) {
  return evs
    .filter(e => e.age === age)
    .reduce((sum, e) => sum + e.amount * 10_000, 0); // 万円→円
}

/**
 * 一時イベントを追加する。
 * @param {{ age, amount, type, label }} ev
 * @returns {number}  新しいイベントの id
 */
function addOneTimeEvent(ev = {}) {
  const id = ++oneTimeEventIdCounter;
  oneTimeEvents.push({
    id,
    age:    parseInt(ev.age)    || 45,
    amount: parseFloat(ev.amount) || 0,
    type:   ev.type  || 'expense',
    label:  ev.label || '一時イベント',
  });
  renderOneTimeEventList();
  return id;
}

/**
 * 一時イベントを削除する。
 * @param {number} id
 */
function removeOneTimeEvent(id) {
  oneTimeEvents = oneTimeEvents.filter(e => e.id !== id);
  renderOneTimeEventList();
}

/**
 * 一時イベントの一覧を id="one-time-event-list" に描画する。
 * HTMLに要素がなければ何もしない（安全なスタブ）。
 */
function renderOneTimeEventList() {
  const el = document.getElementById('one-time-event-list');
  if (!el) return;

  if (oneTimeEvents.length === 0) {
    el.innerHTML = `<div style="font-size:11px;color:var(--text-dim);padding:8px 0;">
      一時イベントはまだ追加されていません。<br>
      住宅購入・退職金・相続など特定年のみ発生する収支を追加できます。
    </div>`;
    return;
  }

  const typeIcon  = { income: '💰', expense: '💸', asset: '🏦' };
  const typeColor = { income: '#a8ff78', expense: '#ff4757', asset: '#00d4ff' };
  const typeLabel = { income: '収入', expense: '支出', asset: '資産変動' };

  el.innerHTML = oneTimeEvents
    .sort((a, b) => a.age - b.age)
    .map(e => {
      const color   = typeColor[e.type]  || 'var(--text-mid)';
      const icon    = typeIcon[e.type]   || '📌';
      const tLabel  = typeLabel[e.type]  || e.type;
      const amtStr  = (e.amount >= 0 ? '+' : '') + e.amount.toLocaleString() + '万円';
      const safeLabel = escapeHTML ? escapeHTML(e.label) : String(e.label);
      return `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;
                    background:var(--surface2);border-radius:6px;border:1px solid var(--border);
                    margin-bottom:6px;" data-ote-id="${e.id}">
          <span style="font-size:16px;flex-shrink:0;">${icon}</span>
          <div style="flex:1;min-width:0;">
            <div style="font-size:12px;font-weight:600;color:var(--text);
                        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${safeLabel}
            </div>
            <div style="font-size:11px;color:var(--text-dim);font-family:var(--font-mono);">
              ${e.age}歳 ／ <span style="color:${color};">${amtStr}</span>
              <span style="color:var(--text-dim);"> (${tLabel})</span>
            </div>
          </div>
          <button onclick="removeOneTimeEvent(${e.id})"
                  aria-label="${safeLabel}を削除"
                  style="background:none;border:none;color:var(--text-dim);
                         cursor:pointer;font-size:16px;padding:4px;
                         border-radius:4px;flex-shrink:0;line-height:1;"
                  onmouseover="this.style.color='var(--danger)'"
                  onmouseout="this.style.color='var(--text-dim)'">×</button>
        </div>`;
    })
    .join('');
}

// ============================================================
// 多変量t分布サンプラー（2変数 Cholesky 分解ベース）
//
// 既存コードの「zBondCorr = corr * zStock + sqrt(1-corr²) * zBond」は
// 2×2 Cholesky 分解と等価だが、以下の関数で明示的に実装することで
// ① テスト可能な純粋関数として切り出す
// ② 将来的に N 変数への拡張が容易になる
// ③ zStock / zBond の自由度を個別制御できる
//
// 引数:
//   { mu: [μ₁, μ₂], sigma: [σ₁, σ₂], corr: ρ, df: 自由度 }
//   すべて変量は「単位分散 t(df) に正規化済み」を仮定。
//   corr は [-1, 1] の相関係数。
//
// 戻り値: [r₁, r₂]  各資産クラスの年間リターン（小数）
// ============================================================
function samplingFromBivariateT({ mu, sigma, corr, df }) {
  // --- Step 1: 独立した t(df) ショック 2 本を生成 ---
  const z1 = tRandom(df);
  const z2 = tRandom(df);

  // --- Step 2: Cholesky 分解で相関を注入 ---
  // 2×2 相関行列 [[1, ρ], [ρ, 1]] の Cholesky 因子:
  //   L = [[1, 0], [ρ, sqrt(1-ρ²)]]
  // → z_corr = L × [z1, z2]ᵀ
  const rho   = Math.max(-0.999, Math.min(0.999, corr ?? 0));
  const z1c   = z1;                                             // 1列目はそのまま
  const z2c   = rho * z1 + Math.sqrt(Math.max(0, 1 - rho * rho)) * z2;

  // --- Step 3: μ + σ × z でリターンを生成 ---
  const r1 = mu[0] + sigma[0] * z1c;
  const r2 = mu[1] + sigma[1] * z2c;

  return [r1, r2];
}


// ============================================================
// 一時イベント（タイムライン）管理システム
//
// expStages が「期間ベースの継続支出」を管理するのに対し、
// oneTimeEvents は「特定年だけ発生する一時収支」を管理する。
//
// データ構造:
//   { id, age, amount, type, label }
//   - age:    発生年齢（整数）
//   - amount: 収支金額（万円、正=収入、負=支出）
//   - type:   'income' | 'expense' | 'asset'（資産増減）
//   - label:  UI 表示名
//
// 利用例:
//   住宅購入（-3,000万円、40歳）
//   退職金受取（+1,500万円、60歳）
//   大規模修繕（-800万円、55歳）
//   相続（+2,000万円、55歳）
// ============================================================
let oneTimeEvents = [];
let oneTimeEventIdCounter = 0;

/**
 * 指定年齢の一時キャッシュフロー合計を円で返す。
 * simulation.js の年次ループから呼ばれる純粋関数。
 * @param {number} age  シミュレーション中の現在年齢
 * @param {Array}  evs  oneTimeEvents 配列（デフォルトはグローバル変数）
 * @returns {number}    円単位のキャッシュフロー（正=収入、負=支出）
 */
function getOneTimeEventCashflow(age, evs = oneTimeEvents) {
  return evs
    .filter(e => e.age === age)
    .reduce((sum, e) => sum + e.amount * 10_000, 0); // 万円→円
}

/**
 * 一時イベントを追加する。
 * @param {{ age, amount, type, label }} ev
 * @returns {number}  新しいイベントの id
 */
function addOneTimeEvent(ev = {}) {
  const id = ++oneTimeEventIdCounter;
  oneTimeEvents.push({
    id,
    age:    parseInt(ev.age)    || 45,
    amount: parseFloat(ev.amount) || 0,
    type:   ev.type  || 'expense',
    label:  ev.label || '一時イベント',
  });
  renderOneTimeEventList();
  return id;
}

/**
 * 一時イベントを削除する。
 * @param {number} id
 */
function removeOneTimeEvent(id) {
  oneTimeEvents = oneTimeEvents.filter(e => e.id !== id);
  renderOneTimeEventList();
}

/**
 * 一時イベントの一覧を id="one-time-event-list" に描画する。
 * HTMLに要素がなければ何もしない（安全なスタブ）。
 */
function renderOneTimeEventList() {
  const el = document.getElementById('one-time-event-list');
  if (!el) return;

  if (oneTimeEvents.length === 0) {
    el.innerHTML = `<div style="font-size:11px;color:var(--text-dim);padding:8px 0;">
      一時イベントはまだ追加されていません。<br>
      住宅購入・退職金・相続など特定年のみ発生する収支を追加できます。
    </div>`;
    return;
  }

  const typeIcon  = { income: '💰', expense: '💸', asset: '🏦' };
  const typeColor = { income: '#a8ff78', expense: '#ff4757', asset: '#00d4ff' };
  const typeLabel = { income: '収入', expense: '支出', asset: '資産変動' };

  el.innerHTML = oneTimeEvents
    .sort((a, b) => a.age - b.age)
    .map(e => {
      const color   = typeColor[e.type]  || 'var(--text-mid)';
      const icon    = typeIcon[e.type]   || '📌';
      const tLabel  = typeLabel[e.type]  || e.type;
      const amtStr  = (e.amount >= 0 ? '+' : '') + e.amount.toLocaleString() + '万円';
      const safeLabel = escapeHTML ? escapeHTML(e.label) : String(e.label);
      return `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;
                    background:var(--surface2);border-radius:6px;border:1px solid var(--border);
                    margin-bottom:6px;" data-ote-id="${e.id}">
          <span style="font-size:16px;flex-shrink:0;">${icon}</span>
          <div style="flex:1;min-width:0;">
            <div style="font-size:12px;font-weight:600;color:var(--text);
                        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${safeLabel}
            </div>
            <div style="font-size:11px;color:var(--text-dim);font-family:var(--font-mono);">
              ${e.age}歳 ／ <span style="color:${color};">${amtStr}</span>
              <span style="color:var(--text-dim);"> (${tLabel})</span>
            </div>
          </div>
          <button onclick="removeOneTimeEvent(${e.id})"
                  aria-label="${safeLabel}を削除"
                  style="background:none;border:none;color:var(--text-dim);
                         cursor:pointer;font-size:16px;padding:4px;
                         border-radius:4px;flex-shrink:0;line-height:1;"
                  onmouseover="this.style.color='var(--danger)'"
                  onmouseout="this.style.color='var(--text-dim)'">×</button>
        </div>`;
    })
    .join('');
}

// Gompertz-Makeham annual death probability at given age
// h(x) = alpha * exp(beta * x) + gamma   (continuous hazard)
// P(die this year) = 1 - exp(-h(x))
// medAdvRate: fractional reduction in hazard per year elapsed (compound)
function deathProb(age, yearsElapsed, gender, medAdvRate) {
  const m=MORTALITY[gender];
  const h=(m.alpha*Math.exp(m.beta*age)+m.gamma)*Math.pow(1-medAdvRate, yearsElapsed);
  return Math.min(1-Math.exp(-h), 1.0);
}

function chooseRegime(probs) {
  let r=Math.random(),s=0;
  for(let i=0;i<probs.length;i++){s+=probs[i];if(r<s)return i;}
  return probs.length-1;
}

// ============================================================
// Simulation
// ============================================================
let chartInstance=null;
let lastMedianFireAge=null; // runSimulation完了後にFIRE年齢中央値を保持
let lastFinalAssets=null;   // runSimulation完了後の死亡時最終資産（昇順ソート済み、円単位）
function getAgeAtSurvivalRate(targetPercent, params, currentAge, medicalAdv) {
    const { alpha, beta, gamma } = params;
    let low = currentAge;
    let high = 130;
    for (let i = 0; i < 20; i++) {
        let mid = (low + high) / 2;
        let cumulativeHazard = 0;
        for (let age = currentAge; age < mid; age++) {
            const yearIdx = age - currentAge;
            const decay = Math.pow(1 - medicalAdv / 100, yearIdx);
            const hazard = (alpha * Math.exp(beta * age) + gamma) * decay;
            cumulativeHazard += hazard;
        }
        let survivalRate = Math.exp(-cumulativeHazard);
        if (survivalRate > targetPercent) low = mid; else high = mid;
    }
    return Math.ceil(high);
}


// ============================================================
// GOAL GAUGE & RETIRE CHECKLIST renderers
// ============================================================
function renderGoalGauge({ currentAssets, fireThr, assets65, needAt65, surplus65, startAge, fireAgeMed, lifeExp }) {
  const el = document.getElementById('goal-body');
  const fmt = v => {
    if (Math.abs(v) >= 1e8) return (v/1e8).toFixed(1) + '億円';
    return Math.round(v/1e4).toLocaleString() + '万円';
  };

  // ゲージ計算（現在資産→FIRE目標→老後必要額を含む最大値）
  const maxV = Math.max(fireThr, assets65, needAt65, currentAssets) * 1.15;
  const pct = v => Math.min(100, Math.max(0, v / maxV * 100));

  const milestones = [
    { label: '現在の資産',   value: currentAssets, color: '#00d4ff', icon: '💰' },
    { label: 'FIRE 目標額',  value: fireThr,        color: '#ffd166', icon: '🎯' },
    { label: '65歳 中央値',  value: assets65,        color: '#b388ff', icon: '🏦' },
    { label: '老後 必要額',  value: needAt65,        color: surplus65>=0?'#a8ff78':'#ff4757', icon: surplus65>=0?'✅':'⚠️' },
  ].sort((a,b) => a.value - b.value);

  // サマリー文
  const yearsToFire = fireAgeMed ? fireAgeMed - startAge : null;
  const summaryColor = surplus65 >= 0 ? '#a8ff78' : '#ffd166';
  const summaryMsg = surplus65 >= 0
    ? `老後資金は<b style="color:#a8ff78">${fmt(surplus65)}</b>の余裕があります 🎉`
    : `老後資金が<b style="color:#ff4757">${fmt(-surplus65)}</b>不足する可能性があります ⚠️`;

  el.innerHTML = `
    <div style="margin-bottom:18px;padding:14px 16px;border-radius:6px;background:${surplus65>=0?'rgba(168,255,120,.07)':'rgba(255,71,87,.07)'};border:1px solid ${surplus65>=0?'rgba(168,255,120,.2)':'rgba(255,71,87,.2)'};">
      <div style="font-size:13px;line-height:1.8;">${summaryMsg}</div>
      ${yearsToFire !== null ? `<div style="font-size:11px;color:var(--text-dim);margin-top:4px;">📅 中央値シナリオでは <b style="color:var(--warning);">${yearsToFire}年後（${fireAgeMed}歳）</b> に FIRE 達成見込み。寿命中央値 ${lifeExp}歳まで約${lifeExp-65}年の老後。</div>` : ''}
    </div>

    <!-- ゲージバー -->
    <div style="position:relative;height:48px;background:var(--surface2);border-radius:8px;overflow:visible;margin-bottom:24px;border:1px solid var(--border);">
      ${milestones.map(m => `
        <div style="position:absolute;left:${pct(m.value)}%;top:0;bottom:0;width:2px;background:${m.color};box-shadow:0 0 8px ${m.color}88;transform:translateX(-50%);z-index:2;"></div>
        <div style="position:absolute;left:${pct(m.value)}%;top:calc(100% + 6px);transform:translateX(-50%);text-align:center;z-index:3;min-width:70px;">
          <div style="font-size:9px;color:${m.color};font-family:var(--font-mono);white-space:nowrap;">${m.icon} ${m.label}</div>
          <div style="font-size:10px;color:${m.color};font-weight:700;font-family:var(--font-mono);white-space:nowrap;">${fmt(m.value)}</div>
        </div>
      `).join('')}
      <!-- 現在資産の塗り -->
      <div style="position:absolute;left:0;top:0;bottom:0;width:${pct(currentAssets)}%;background:linear-gradient(90deg,rgba(0,212,255,.3),rgba(0,212,255,.1));border-radius:8px 0 0 8px;z-index:1;"></div>
      <!-- 目盛り -->
      <div style="position:absolute;inset:0;display:flex;align-items:center;padding:0 12px;z-index:0;">
        <div style="font-size:8px;color:var(--text-dim);font-family:var(--font-mono);">0円</div>
        <div style="flex:1;"></div>
        <div style="font-size:8px;color:var(--text-dim);font-family:var(--font-mono);">${fmt(maxV)}</div>
      </div>
    </div>
    <div style="height:52px;"></div>

    <!-- 3ステップ -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-top:4px;">
      ${[
        { step:'STEP 1', icon:'💰', label:'今すぐ貯める', desc:`目標 FIRE まで ${fmt(Math.max(0,fireThr-currentAssets))} 不足`, color:'#00d4ff' },
        { step:'STEP 2', icon:'🎯', label:'FIRE 達成', desc:`${yearsToFire ? yearsToFire+'年後' : '—'}（${fireAgeMed ? fireAgeMed+'歳' : '—'}）`, color:'#ffd166' },
        { step:'STEP 3', icon:'🏦', label:'老後を安心に', desc:`65歳時${surplus65>=0?'余裕':'不足'} ${fmt(Math.abs(surplus65))}`, color: surplus65>=0?'#a8ff78':'#ff4757' },
      ].map(s=>`
        <div style="background:var(--surface2);border:1px solid ${s.color}33;border-radius:6px;padding:12px;text-align:center;">
          <div style="font-size:8px;color:${s.color};font-family:var(--font-mono);letter-spacing:2px;margin-bottom:4px;">${s.step}</div>
          <div style="font-size:20px;margin-bottom:4px;">${s.icon}</div>
          <div style="font-size:11px;font-weight:700;color:var(--text);margin-bottom:4px;">${s.label}</div>
          <div style="font-size:10px;color:var(--text-dim);">${s.desc}</div>
        </div>
      `).join('')}
    </div>
  `;
}

// ============================================================
// シミュレーション条件サマリー
// ============================================================
function renderSimConditionSummary({ startAge, initAssets, fireThr, annualIncome, annualIncomeB, isDual,
    wWork, wRetire, baseInfl, monthlyPension, N, successRate, fireAgeMed, currentDifficulty,
    children, expStages }) {

  const panel = document.getElementById('sim-condition-panel');
  const body  = document.getElementById('sim-condition-body');
  const ts    = document.getElementById('sim-cond-timestamp');
  if (!panel || !body) return;

  panel.style.display = 'block';
  const now = new Date();
  if (ts) ts.textContent = now.toLocaleTimeString('ja-JP', {hour:'2-digit',minute:'2-digit'});

  const fmt万 = v => {
    const n = Math.round(v / 10000);
    return n >= 10000 ? (n/10000).toFixed(1) + '億円' : n.toLocaleString() + '万円';
  };

  const diffLabels = { hard:'💀 ハード', normal:'📊 普通', easy:'🌈 楽観' };
  const diffLabel  = diffLabels[currentDifficulty] || currentDifficulty;

  const successColor = successRate >= 0.8 ? '#a8ff78' : successRate >= 0.6 ? '#ffd166' : '#ff4757';
  const fireAgeText  = fireAgeMed ? fireAgeMed + '歳' : '未達成';

  const eduStages = (expStages||[]).filter(function(s){ return s._autoEdu; });
  const childText = children && children.length > 0
    ? children.length + '人（' + eduStages.length + 'ステージ）'
    : 'なし';

  var workStages   = (expStages||[]).filter(function(s){ return !s._autoEdu && s.from < (fireAgeMed || 60); });
  var retireStages = (expStages||[]).filter(function(s){ return !s._autoEdu && s.from >= (fireAgeMed || 60); });
  var workExp   = workStages.length   ? Math.round(workStages.reduce(function(a,s){return a+s.exp;},0)/workStages.length)   : null;
  var retireExp = retireStages.length ? Math.round(retireStages.reduce(function(a,s){return a+s.exp;},0)/retireStages.length) : null;

  var items = [
    { icon:'🎂', label:'現在年齢',     value: startAge + '歳',         color:'var(--accent)' },
    { icon:'💰', label:'現在の資産',   value: fmt万(initAssets),        color:'var(--accent)' },
    { icon:'🎯', label:'FIRE目標額',   value: fmt万(fireThr),           color:'#ffd166' },
    { icon:'💼', label:'年収（額面）', value: isDual ? fmt万(annualIncome) + '＋' + fmt万(annualIncomeB) : fmt万(annualIncome), color:'var(--accent3)' },
    { icon:'📈', label:'株式比率',     value: '現役' + Math.round(wWork*100) + '% / FIRE後' + Math.round(wRetire*100) + '%', color:'var(--text-mid)' },
    { icon:'💹', label:'インフレ率',   value: (baseInfl*100).toFixed(1) + '%/年', color:'var(--text-mid)' },
    { icon:'👴', label:'月額年金',     value: Math.round(monthlyPension/10000) + '万円/月', color:'#b388ff' },
    { icon:'🏫', label:'子ども教育費', value: childText,                color:'var(--text-mid)' },
    { icon:'🏠', label:'現役時支出',   value: workExp !== null ? '約' + workExp + '万円/年' : '—', color:'var(--text-mid)' },
    { icon:'🌴', label:'FIRE後支出',   value: retireExp !== null ? '約' + retireExp + '万円/年' : '—', color:'var(--text-mid)' },
    { icon:'⚙️', label:'市場シナリオ', value: diffLabel,               color:'var(--text-mid)' },
    { icon:'🔁', label:'試行回数',     value: N.toLocaleString() + '回', color:'var(--text-dim)' },
  ];

  var adviceText = successRate >= 0.9 ? '✅ 非常に安全な計画です。このまま続けましょう。'
    : successRate >= 0.8 ? '👍 概ね良好な計画です。支出管理を意識して継続を。'
    : successRate >= 0.7 ? '⚠️ やや不安定。収入増・支出削減・FIRE目標の見直しを検討してください。'
    : successRate >= 0.5 ? '🔴 成功率が低めです。設定を見直し、貯蓄率の向上が必要です。'
    : '💀 計画の大幅な見直しが必要です。';

  var bgColor = successRate >= 0.8 ? 'rgba(168,255,120,.07)' : successRate >= 0.6 ? 'rgba(255,209,102,.07)' : 'rgba(255,71,87,.07)';

  body.innerHTML =
    '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin-bottom:14px;">' +
    items.map(function(it) {
      return '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface2);border-radius:8px;border:1px solid var(--border);">' +
        '<span style="font-size:20px;flex-shrink:0;line-height:1;">' + it.icon + '</span>' +
        '<div style="min-width:0;">' +
          '<div style="font-size:11px;color:var(--text-dim);letter-spacing:.3px;margin-bottom:3px;line-height:1.3;">' + it.label + '</div>' +
          '<div style="font-size:14px;font-weight:700;color:' + it.color + ';font-family:var(--font-mono);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.2;">' + it.value + '</div>' +
        '</div></div>';
    }).join('') +
    '</div>' +
    '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:14px 16px;border-radius:10px;background:' + bgColor + ';border:1px solid ' + successColor + '44;">' +
      '<div style="text-align:center;min-width:70px;">' +
        '<div style="font-size:26px;font-weight:700;font-family:var(--font-mono);color:' + successColor + ';line-height:1;">' + (successRate*100).toFixed(1) + '%</div>' +
        '<div style="font-size:11px;color:var(--text-dim);margin-top:4px;">FIRE成功率</div>' +
      '</div>' +
      '<div style="width:1px;height:40px;background:var(--border);flex-shrink:0;"></div>' +
      '<div style="text-align:center;min-width:70px;">' +
        '<div style="font-size:26px;font-weight:700;font-family:var(--font-mono);color:#ffd166;line-height:1;">' + fireAgeText + '</div>' +
        '<div style="font-size:11px;color:var(--text-dim);margin-top:4px;">FIRE年齢（中央値）</div>' +
      '</div>' +
      '<div style="flex:1;min-width:180px;font-size:13px;color:var(--text-mid);line-height:1.8;padding-left:4px;">' + adviceText + '</div>' +
    '</div>';
}


function renderRetireChecklist({ assets65, needAt65, surplus65, pensionAnnual, expAt65, retireYears, monthlyRetire }) {
  const el = document.getElementById('retire-checklist');
  const fmt万 = v => Math.abs(v) >= 1e8 ? (v/1e8).toFixed(1)+'億' : Math.round(v/1e4).toLocaleString()+'万';

  const checks = [
    {
      ok: assets65 >= needAt65,
      title: '老後資金が確保できている',
      detail: `65歳時 ${fmt万(assets65)} ÷ 必要額 ${fmt万(needAt65)}`,
    },
    {
      ok: pensionAnnual > 0,
      title: '年金収入がある',
      detail: `月${Math.round(pensionAnnual/12/1e4)}万円（年${Math.round(pensionAnnual/1e4)}万円）`,
    },
    {
      ok: expAt65 <= (assets65 / Math.max(1, retireYears) + pensionAnnual),
      title: '老後の年間支出を年金＋運用でカバーできる',
      detail: `支出見込み ${fmt万(expAt65)}/年 vs 収入 ${fmt万(assets65/Math.max(1,retireYears)+pensionAnnual)}/年`,
    },
    {
      ok: monthlyRetire >= 20,
      title: '月20万円以上の生活水準を維持できる',
      detail: `月 ${monthlyRetire.toLocaleString()}万円 使える見込み`,
    },
    {
      ok: surplus65 >= 1000 * 1e4,
      title: '老後に1,000万円以上の余裕がある',
      detail: `余裕額 ${fmt万(surplus65)}（医療費・介護費バッファ）`,
    },
  ];

  el.innerHTML = checks.map(c => `
    <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);">
      <div style="font-size:18px;flex-shrink:0;margin-top:1px;">${c.ok ? '✅' : '⚠️'}</div>
      <div>
        <div style="font-size:11px;font-weight:600;color:${c.ok?'var(--text)':'var(--warning)'};">${c.title}</div>
        <div style="font-size:10px;color:var(--text-dim);margin-top:2px;font-family:var(--font-mono);">${c.detail}</div>
      </div>
    </div>
  `).join('') + `
    <div style="margin-top:10px;font-size:9px;color:var(--text-dim);">
      ※ インフレ調整済み。65歳以降の資産運用益は含まず保守的に計算。
    </div>
  `;
}


// ============================================================
// シミュレーション結果の解説文を生成・表示
// ============================================================
function renderSimCommentary({
  successRate, bankruptRate, fireRate,
  fireAgeMed, startAge, lifeExp,
  assets65, needAt65, surplus65, monthlyRetire,
  initAssets, fireThr, mf,
}) {
  const panel = document.getElementById('sim-commentary-panel');
  const body  = document.getElementById('sim-commentary-body');
  if (!panel || !body) return;
  panel.style.display = 'block';

  const fmt万 = v => Math.abs(v) >= 1e8
    ? (v/1e8).toFixed(1)+'億円'
    : Math.round(v/1e4).toLocaleString()+'万円';
  const pct = v => (v*100).toFixed(1)+'%';
  const today = new Date();
  const dateStr = `${today.getFullYear()}年${today.getMonth()+1}月${today.getDate()}日`;

  // ── 総合評価 ──
  let grade, gradeColor, gradeIcon, gradeText;
  if      (successRate >= 0.90) { grade='S'; gradeColor='#a8ff78'; gradeIcon='🏆'; gradeText='非常に堅牢'; }
  else if (successRate >= 0.75) { grade='A'; gradeColor='#00d4ff'; gradeIcon='✅'; gradeText='良好'; }
  else if (successRate >= 0.55) { grade='B'; gradeColor='#ffd166'; gradeIcon='⚠️'; gradeText='要改善'; }
  else if (successRate >= 0.30) { grade='C'; gradeColor='#ff9a3c'; gradeIcon='🔴'; gradeText='リスク高'; }
  else                           { grade='D'; gradeColor='#ff4757'; gradeIcon='💀'; gradeText='要根本見直し'; }

  // ── アクションプラン生成（成功率に応じて分岐）──
  const actions = [];

  if (successRate >= 0.90) {
    // 過剰貯蓄の可能性
    const extraSpend = Math.round((successRate - 0.85) * 200); // 万円/月 目安
    actions.push({
      icon:'💸', color:'#a8ff78', title:'過剰貯蓄の可能性',
      body:`現在の成功率は ${pct(successRate)} と非常に高水準です。月支出を <b>+${Math.max(3, extraSpend)}万円程度増やしても</b>安全圏を維持できる可能性があります。生活の質の向上や体験への投資を検討してください。`,
    });
    actions.push({
      icon:'🎁', color:'#b388ff', title:'資産承継の検討タイミング',
      body:`死亡時の中央値資産が${fmt万(mf*1e8)}と潤沢です。暦年贈与（年110万円非課税）または相続時精算課税制度の活用を税理士に相談してください。`,
    });
  } else if (successRate >= 0.80) {
    actions.push({
      icon:'📉', color:'#00d4ff', title:'暴落耐性の補強',
      body:`成功率 ${pct(successRate)} は良好ですが、暴落直後の取り崩しリスクが残ります。<b>生活費${Math.round((1-successRate+0.1)*10)+1}〜2年分の現金バッファ</b>を別途確保すると、シーケンス・オブ・リターン・リスクを大幅に軽減できます。`,
    });
    actions.push({
      icon:'⏱️', color:'#ffd166', title:'FIRE時期の微調整',
      body:fireAgeMed
        ? `現在の中央値FIRE年齢は ${fireAgeMed} 歳です。<b>${Math.min(fireAgeMed+3, 65)} 歳まで就労を延長</b>すると、資産蓄積と社会保険加入期間が伸び、成功率が大幅に改善します。`
        : '就労期間を2〜3年延長することで成功率を大きく改善できます。',
    });
  } else if (successRate >= 0.50) {
    actions.push({
      icon:'🔒', color:'#ff9a3c', title:'支出の緊急見直し',
      body:`破綻率が ${pct(bankruptRate)} と高めです。月支出を <b>3〜5万円削減（年${Math.round(3*12/10)*10}〜${Math.round(5*12/10)*10}万円）</b>すると成功率が大幅改善します。通信費・保険・サブスクの固定費見直しから始めてください。`,
    });
    actions.push({
      icon:'📆', color:'#ff9a3c', title:'FIRE時期の延期を検討',
      body:fireAgeMed
        ? `目標FIRE年齢を <b>${Math.min(fireAgeMed+5, 65)} 歳に延期</b>することで、年金受給額の増加と資産蓄積の両立が期待できます。早期退職への固執がリスクの主因です。`
        : 'FIREの目標時期を5年延期することで成功率が劇的に改善します。',
    });
    if (surplus65 < 0) {
      actions.push({
        icon:'🏦', color:'#b388ff', title:'年金の繰り下げ受給',
        body:`65歳時点での老後資金が ${fmt万(Math.abs(surplus65))} 不足しています。年金を <b>70歳まで繰り下げる</b>と月額が <b>+42%増</b>（75歳なら+84%）になり、長寿リスクを大幅にヘッジできます。`,
      });
    }
  } else {
    // 失敗率高 → 根本的な診断
    const inflCause = bankruptRate > 0.40;
    actions.push({
      icon:'🚨', color:'#ff4757', title:'プランの根本的見直しが必要',
      body:`現在の設定では ${pct(bankruptRate)} のシナリオで資産が枯渇します。${inflCause ? '<b>インフレ負けが主因</b>の可能性があります。期待リターンを高めるか、住居費などの大きな固定費を見直してください。' : 'FIRE目標資産の大幅引き下げ、または収入・貯蓄率の抜本的改善が必要です。'}`,
    });
    if (fireThr > initAssets * 1.5) {
      const realisticTarget = Math.round(fireThr * 0.7 / 1e4) * 1e4;
      actions.push({
        icon:'🎯', color:'#ffd166', title:'FIRE目標の現実化',
        body:`現在の目標資産（${fmt万(fireThr)}）は現状の資産から乖離しすぎています。まず <b>${fmt万(realisticTarget)}（現在の70%）</b>を中間目標に設定し、段階的にFIREを実現するアプローチを検討してください。`,
      });
    }
  }

  // 改善アドバイス（tips、従来の補足）
  // ── 総合評価 ──
  let overallGrade, overallColor, overallIcon, overallText;
  if (successRate >= 0.90) {
    overallGrade='S';overallColor='#a8ff78';overallIcon='🏆';
    overallText='非常に堅牢なプランです。95歳まで資産が持続する確率が90%を超えており、どんな市場環境でも安心できる水準です。';
  } else if (successRate >= 0.75) {
    overallGrade='A';overallColor='#00d4ff';overallIcon='✅';
    overallText='良好なプランです。成功率75%以上は長期投資として十分な水準です。いくつかの改善余地があります。';
  } else if (successRate >= 0.55) {
    overallGrade='B';overallColor='#ffd166';overallIcon='⚠️';
    overallText='改善余地があります。約半数のシナリオで資産が持続しますが、市場悪化時のリスクが残ります。支出削減や収入増強を検討してください。';
  } else if (successRate >= 0.30) {
    overallGrade='C';overallColor='#ff9a3c';overallIcon='🔴';
    overallText='リスクが高いプランです。過半数のシナリオで資産が枯渇する可能性があります。大幅な見直しが必要です。';
  } else {
    overallGrade='D';overallColor='#ff4757';overallIcon='💀';
    overallText='このまま続けると資産枯渇のリスクが非常に高いです。支出の大幅削減・FIRE目標の延期・収入増を強く推奨します。';
  }

  // ── FIREシナリオ解説 ──
  let fireText = '';
  if (fireRate >= 0.8) {
    fireText = `試行の${pct(fireRate)}でFIREを達成できる見込みです。`;
    if (fireAgeMed) fireText += `中央値では<b>${fireAgeMed}歳</b>（あと${fireAgeMed - startAge}年）でFIRE達成が見込まれます。`;
  } else if (fireRate >= 0.3) {
    fireText = `FIRE達成率は${pct(fireRate)}です。`;
    if (fireAgeMed) fireText += `達成できるシナリオでは<b>${fireAgeMed}歳</b>が中央値です。`;
    fireText += '市場環境次第で達成時期が大きく変わります。';
  } else if (fireRate > 0) {
    fireText = `FIRE達成率は${pct(fireRate)}と低水準です。現在の設定では大多数のシナリオでFIRE目標資産への到達が困難です。`;
    const gap = fireThr - initAssets;
    if (gap > 0) fireText += `目標資産まで<b>${fmt万(gap)}</b>の不足があります。`;
  } else {
    fireText = '現在の設定ではFIRE達成が非常に困難です。目標資産額の引き下げ、または収入・貯蓄率の大幅改善が必要です。';
  }

  // ── 老後シナリオ解説 ──
  let retireText = '';
  if (surplus65 >= 5000 * 1e4) {
    retireText = `65歳時点で必要老後資金を<b>${fmt万(surplus65)}</b>上回る見込みです。医療費・介護費の備えも十分で、資産の一部を子世代に残せる可能性があります。`;
  } else if (surplus65 >= 1000 * 1e4) {
    retireText = `老後資金は<b>${fmt万(surplus65)}</b>の余裕があります。月${monthlyRetire}万円の生活水準を維持できる見込みです。`;
  } else if (surplus65 >= 0) {
    retireText = `老後資金はギリギリ確保できる見込みですが、余裕は${fmt万(surplus65)}と小さいです。予期せぬ医療費・介護費に備え、月支出の節約を心がけてください。`;
  } else {
    retireText = `65歳時点で老後資金が<b>${fmt万(Math.abs(surplus65))}</b>不足する見込みです。年金だけでは生活費をカバーできない可能性があります。`;
  }

  // ── 破綻リスク解説 ──
  let bankruptText = '';
  if (bankruptRate < 0.05) {
    bankruptText = `生前の資産枯渇リスクは${pct(bankruptRate)}と極めて低く、優れた水準です。`;
  } else if (bankruptRate < 0.20) {
    bankruptText = `破綻率${pct(bankruptRate)}は許容範囲ですが、ゼロではありません。市場暴落が長期続いた場合のシナリオを念頭に置いてください。`;
  } else if (bankruptRate < 0.40) {
    bankruptText = `破綻率${pct(bankruptRate)}はやや高めです。支出削減・FIRE後の株式比率調整・年金の繰り下げ受給などを検討してください。`;
  } else {
    bankruptText = `破綻率${pct(bankruptRate)}は非常に高い水準です。現在のプランには根本的な見直しが必要です。`;
  }

  // ── 改善アドバイス（状況に応じて最大5件）──
  const tips = [];

  // 1. 支出削減
  if (successRate < 0.75 && monthlyRetire < 25) {
    tips.push('💡 <b>支出削減</b>：月支出を3万円削減すると年36万円の効果。長期複利で成功率が数十ポイント改善することがあります。固定費（通信費・保険）の見直しから始めましょう。');
  }

  // 2. FIRE後株式比率
  if (bankruptRate > 0.15) {
    tips.push('💡 <b>FIRE後の株式比率調整</b>：リタイア後の株式比率を現在より10〜20pt下げると、シーケンス・オブ・リターン・リスク（暴落直後の取り崩し）を軽減できます。ヒートマップ分析で最適比率を確認してください。');
  }

  // 3. 年金繰り下げ
  if (surplus65 < 3000 * 1e4 && assets65 > 0) {
    tips.push('💡 <b>年金の繰り下げ受給</b>：65歳受給を70歳まで繰り下げると月額が<b>42%増</b>、75歳まで繰り下げると<b>84%増</b>になります。70歳時点で資産があるなら強力な老後リスクヘッジになります。');
  }

  // 4. FIRE目標資産の引き下げ
  if (fireRate < 0.5 && fireThr > initAssets) {
    const realisticTarget = Math.round(fireThr * 0.8 / 1e4) * 1e4;
    const realisticFmt = realisticTarget >= 1e8
      ? (realisticTarget/1e8).toFixed(1)+'億円'
      : Math.round(realisticTarget/1e4).toLocaleString()+'万円';
    tips.push(`💡 <b>FIRE目標資産の現実化</b>：現在の目標資産を20%引き下げた<b>${realisticFmt}</b>に設定すると、FIRE達成率が大幅に改善する可能性があります。生活費の見直しと合わせて検討してください。`);
  }

  // 5. 贈与税非課税枠（資産潤沢時）
  if (mf > 1.0 && successRate >= 0.85) {
    tips.push('💡 <b>生前贈与の活用</b>：死亡時の中央値資産が1億円超です。暦年贈与の年間非課税枠（110万円）を活用した資産移転、または相続時精算課税制度（2,500万円まで非課税）の活用を税理士にご相談ください。');
  }

  // 成功パターンの激励
  if (tips.length === 0 && successRate >= 0.90) {
    tips.push('✨ 現在のプランは非常に優秀です！このまま継続しましょう。市場環境が想定外に悪化した場合の備えとして、生活費の10〜20%を現金で保有しておくとさらに安心です。');
  }

  body.innerHTML = `
    <!-- 総合評価 -->
    <div style="display:flex;align-items:center;gap:16px;padding:16px;background:var(--surface3);border-radius:8px;margin-bottom:16px;border:1px solid ${overallColor}33;">
      <div style="text-align:center;flex-shrink:0;">
        <div style="font-size:11px;color:var(--text-dim);font-family:var(--font-mono);margin-bottom:4px;">総合評価</div>
        <div style="font-size:48px;font-weight:700;font-family:var(--font-mono);color:${overallColor};line-height:1;text-shadow:0 0 20px ${overallColor}66;">${overallGrade}</div>
      </div>
      <div>
        <div style="font-size:13px;font-weight:700;color:${overallColor};margin-bottom:6px;">${overallIcon} FIRE成功率 ${pct(successRate)}</div>
        <div style="font-size:13px;color:var(--text);line-height:1.8;">${overallText}</div>
      </div>
    </div>

    <!-- 3列インサイト -->
    <div style="display:grid;grid-template-columns:1fr;gap:12px;margin-bottom:16px;">
      <div style="background:var(--surface2);border-radius:6px;padding:14px;border-left:3px solid #00d4ff;">
        <div style="font-size:11px;color:var(--accent);font-family:var(--font-mono);letter-spacing:1px;margin-bottom:8px;">🎯 FIREシナリオ</div>
        <div style="font-size:13px;color:var(--text);line-height:1.8;">${fireText}</div>
      </div>
      <div style="background:var(--surface2);border-radius:6px;padding:14px;border-left:3px solid #b388ff;">
        <div style="font-size:11px;color:#b388ff;font-family:var(--font-mono);letter-spacing:1px;margin-bottom:8px;">🏦 老後シナリオ</div>
        <div style="font-size:13px;color:var(--text);line-height:1.8;">${retireText}</div>
      </div>
      <div style="background:var(--surface2);border-radius:6px;padding:14px;border-left:3px solid ${bankruptRate > 0.2 ? '#ff4757' : '#ffd166'};">
        <div style="font-size:11px;color:${bankruptRate > 0.2 ? '#ff4757' : '#ffd166'};font-family:var(--font-mono);letter-spacing:1px;margin-bottom:8px;">⚠️ リスク評価</div>
        <div style="font-size:13px;color:var(--text);line-height:1.8;">${bankruptText}</div>
      </div>
    </div>

    <!-- 改善アドバイス -->
    ${tips.length > 0 ? `
    <div style="background:rgba(0,212,255,0.05);border:1px solid rgba(0,212,255,0.2);border-radius:6px;padding:14px;">
      <div style="font-size:11px;color:var(--accent);font-family:var(--font-mono);letter-spacing:1px;margin-bottom:10px;">📌 改善アドバイス</div>
      ${tips.map(t=>`<div style="font-size:13px;color:var(--text);line-height:1.8;margin-bottom:6px;">${t}</div>`).join('')}
    </div>` : ''}
  `;
}

// ============================================================
// ★ 実質価値（購買力）トグル
// ============================================================
let _realValueOn = false;

function toggleRealValue() {
  _realValueOn = !_realValueOn;
  const bg    = document.getElementById('real-toggle-bg');
  const knob  = document.getElementById('real-toggle-knob');
  const kpi   = document.getElementById('purchasing-power-kpi');
  const wrap  = document.getElementById('real-toggle-wrap');

  if (bg)   bg.style.background   = _realValueOn ? 'var(--accent)' : 'var(--border)';
  if (knob) knob.style.transform  = _realValueOn ? 'translateX(16px)' : 'translateX(0)';
  if (kpi)  kpi.style.display     = _realValueOn ? 'block' : 'none';
  if (wrap) wrap.setAttribute('aria-checked', String(_realValueOn));

  // Chart.jsのデータセット表示切替
  if (chartInstance) {
    const datasets = chartInstance.data.datasets;
    const realIdx = datasets.findIndex(d => d.label && d.label.includes('実質価値'));
    if (realIdx >= 0) {
      const meta = chartInstance.getDatasetMeta(realIdx);
      meta.hidden = !_realValueOn;
      chartInstance.update();
    }
  }
}

function updatePurchasingPowerKPI(baseInfl, T, startAge) {
  const el = document.getElementById('purchasing-power-text');
  if (!el) return;

  const inf = (isFinite(baseInfl) ? baseInfl : 0.01);
  const yr30 = Math.round(1 / Math.pow(1 + inf, 30) * 100) / 100;
  const yr20 = Math.round(1 / Math.pow(1 + inf, 20) * 100) / 100;

  el.innerHTML = `
    インフレ率 <b style="color:#ffd166;">${(inf*100).toFixed(1)}%</b> が続くと…<br>
    ・20年後の <b style="color:var(--text);">1億円</b> の現在価値 → <b style="color:#ff9a3c;">${(yr20*100).toFixed(0)}%（${(yr20).toFixed(2)}億円相当）</b><br>
    ・30年後の <b style="color:var(--text);">1億円</b> の現在価値 → <b style="color:#ff4757;">${(yr30*100).toFixed(0)}%（${(yr30).toFixed(2)}億円相当）</b><br>
    <span style="font-size:11px;color:var(--text-dim);">グラフの黄色破線（実質価値）は名目資産をこのインフレ率で割り引いた「今のお金の価値」で表示しています。</span>
  `;
}
// ============================================================
// アクションプラン：成功率90%への改善シミュレーター
// ============================================================
function renderActionPlan({ successRate, bankruptRate, fireAgeMed, startAge, surplus65, expAt65, pensionAnnual, assets65, needAt65, fireThr, initAssets, monthlyRetire }) {
  const panel = document.getElementById('action-plan-panel');
  const body  = document.getElementById('action-plan-body');
  if (!panel || !body) return;
  panel.style.display = 'block';

  // NaN/undefined ガード
  successRate   = isFinite(successRate)   ? successRate   : 0;
  bankruptRate  = isFinite(bankruptRate)  ? bankruptRate  : 0;
  surplus65     = isFinite(surplus65)     ? surplus65     : 0;
  expAt65       = isFinite(expAt65)       ? expAt65       : 0;
  pensionAnnual = isFinite(pensionAnnual) ? pensionAnnual : 0;
  assets65      = isFinite(assets65)      ? assets65      : 0;
  needAt65      = isFinite(needAt65)      ? needAt65      : 0;
  monthlyRetire = isFinite(monthlyRetire) ? monthlyRetire : 0;

  const fmt万 = v => Math.abs(v) >= 1e8 ? (v/1e8).toFixed(1)+'億円' : Math.round(v/1e4).toLocaleString()+'万円';
  const pct   = v => (v*100).toFixed(1) + '%';

  const target = 0.90;
  const gap    = Math.max(0, target - successRate);
  const isOk   = successRate >= target;

  // ── トレードオフ試算 ──
  // 1. 節約効果：月5万円節約で成功率+7pt程度（近似）
  const savingMonthly = gap > 0 ? Math.ceil(gap * 100 / 7) * 5 : 0; // 万円/月
  const savingAnnual  = savingMonthly * 12;

  // 2. FIRE延期効果：1年延期≒+4pt（近似）
  const delayYears = gap > 0 ? Math.ceil(gap * 100 / 4) : 0;
  const newFireAge = fireAgeMed ? fireAgeMed + delayYears : null;

  // 3. 収入増：月3万円増≒+5pt
  const incomeIncrease = gap > 0 ? Math.ceil(gap * 100 / 5) * 3 : 0;

  // 成功率のカラー
  const successColor = successRate >= 0.90 ? '#a8ff78' : successRate >= 0.70 ? '#ffd166' : '#ff4757';

  // シナリオ比較テーブルデータ
  const scenarios = [
    { label: '現在の設定', rate: pct(successRate), note: '現在のパラメータ', color: successColor },
    { label: `月${savingMonthly}万円節約`, rate: gap > 0 ? '≈' + pct(Math.min(1, successRate + 0.07*(savingMonthly/5))) : '—', note: '支出削減シナリオ', color: '#00d4ff' },
    { label: `${delayYears}年FIRE延期`, rate: gap > 0 ? '≈' + pct(Math.min(1, successRate + 0.04*delayYears)) : '—', note: newFireAge ? `${newFireAge}歳FIRE` : '—', color: '#ffd166' },
  ];

  let html = '';

  if (isOk) {
    html = `
      <div style="padding:14px 16px;border-radius:8px;background:rgba(168,255,120,.07);border:1px solid rgba(168,255,120,.2);margin-bottom:14px;display:flex;align-items:center;gap:12px;">
        <span style="font-size:28px;">🏆</span>
        <div>
          <div style="font-size:14px;font-weight:700;color:#a8ff78;margin-bottom:4px;">成功率 ${pct(successRate)} — すでに90%超の堅牢プラン</div>
          <div style="font-size:11px;color:var(--text-mid);line-height:1.7;">
            現在の設定は非常に安全な水準です。さらに生活の質を高める、または遺産・資産承継を検討するフェーズに入れます。
          </div>
        </div>
      </div>
      <div style="font-size:12px;color:var(--text-mid);line-height:1.8;padding:12px 14px;background:rgba(0,212,255,.04);border:1px solid rgba(0,212,255,.15);border-radius:6px;">
        💡 過剰貯蓄の可能性もあります。月支出を増やしても目標水準を維持できるか、<b style="color:var(--accent);">ヒートマップ分析</b>で最適化してください。
      </div>
    `;
  } else {
    html = `
      <!-- 現状ギャップ表示 -->
      <div style="margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="font-size:11px;color:var(--text-dim);font-family:var(--font-mono);">現在の成功率</span>
          <span style="font-size:11px;color:var(--text-dim);font-family:var(--font-mono);">目標 90%</span>
        </div>
        <div style="position:relative;height:20px;background:var(--border);border-radius:10px;overflow:hidden;">
          <div style="position:absolute;left:0;top:0;bottom:0;width:${(successRate*100).toFixed(1)}%;background:linear-gradient(90deg,${successColor},${successColor}99);border-radius:10px;transition:width .8s;"></div>
          <div style="position:absolute;left:90%;top:0;bottom:0;width:2px;background:rgba(168,255,120,.6);box-shadow:0 0 6px #a8ff78;"></div>
          <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:11px;font-family:var(--font-mono);font-weight:700;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.8);">${pct(successRate)} → 目標 90%（あと +${(gap*100).toFixed(1)}pt）</div>
        </div>
      </div>

      <!-- トレードオフ3択 -->
      <div style="font-size:10px;color:var(--text-dim);letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;font-family:var(--font-mono);">── 成功率を 90% に引き上げる3つの方法</div>
      
      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px;">
        <!-- 案1：節約 -->
        <div class="action-item" style="background:rgba(0,212,255,.06);border:1px solid rgba(0,212,255,.2);">
          <div style="position:absolute;left:0;top:0;bottom:0;width:3px;background:#00d4ff;border-radius:3px 0 0 3px;"></div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <span style="font-size:18px;">💳</span>
            <span style="font-size:12px;font-weight:700;color:#00d4ff;">月支出を約 ${savingMonthly}万円削減する</span>
          </div>
          <div style="font-size:11px;color:var(--text-mid);line-height:1.7;padding-left:26px;">
            年間 <b style="color:var(--text);">${fmt万(savingAnnual*10000)}</b> の節約で成功率が概算 +${Math.round(gap*100/7*7)}pt程度改善します。<br>
            📌 固定費（通信費・保険・サブスク）の見直しから始めると達成しやすいです。
          </div>
        </div>

        <!-- 案2：FIRE延期 -->
        <div class="action-item" style="background:rgba(255,209,102,.06);border:1px solid rgba(255,209,102,.2);">
          <div style="position:absolute;left:0;top:0;bottom:0;width:3px;background:#ffd166;border-radius:3px 0 0 3px;"></div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <span style="font-size:18px;">⏳</span>
            <span style="font-size:12px;font-weight:700;color:#ffd166;">FIRE時期を ${delayYears}年 遅らせる</span>
          </div>
          <div style="font-size:11px;color:var(--text-mid);line-height:1.7;padding-left:26px;">
            ${newFireAge ? `<b style="color:var(--text);">${newFireAge}歳FIRE</b>（現在の中央値より${delayYears}年遅延）にシフトすることで` : '就労期間を延長することで'} 資産積み上げ期間が増え、成功率が大幅に改善します。<br>
            📌 社会保険加入期間の延長で年金受給額も増加します。
          </div>
        </div>

        <!-- 案3：収入増 -->
        <div class="action-item" style="background:rgba(168,255,120,.06);border:1px solid rgba(168,255,120,.2);">
          <div style="position:absolute;left:0;top:0;bottom:0;width:3px;background:#a8ff78;border-radius:3px 0 0 3px;"></div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <span style="font-size:18px;">💰</span>
            <span style="font-size:12px;font-weight:700;color:#a8ff78;">月収入を約 ${incomeIncrease}万円 増やす</span>
          </div>
          <div style="font-size:11px;color:var(--text-mid);line-height:1.7;padding-left:26px;">
            副業・スキルアップによる収入増、または配偶者の就労促進でも同等の効果が見込めます。<br>
            📌 節約より収入増の方が精神的負担が少なく持続しやすい傾向があります。
          </div>
        </div>
      </div>

      <!-- シナリオ比較サマリー -->
      <div style="font-size:10px;color:var(--text-dim);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px;font-family:var(--font-mono);">── シナリオ別 概算成功率</div>
      <div class="scenario-compare">
        ${scenarios.map(s => `
          <div class="compare-cell">
            <div class="c-label">${s.label}</div>
            <div class="c-val" style="color:${s.color};">${s.rate}</div>
            <div class="c-sub">${s.note}</div>
          </div>
        `).join('')}
      </div>
      <div style="font-size:9px;color:var(--text-dim);margin-top:8px;text-align:center;">※概算値。実際の改善幅はシミュレーターで確認してください</div>
    `;
  }

  body.innerHTML = html;
}

// ============================================================
// 安全キャッシュバッファ評価
// ============================================================
function renderCashBuffer({ assets65, expAt65, surplus65, successRate, bankruptRate, monthlyRetire, pensionAnnual }) {
  const panel = document.getElementById('cash-buffer-panel');
  const body  = document.getElementById('cash-buffer-body');
  if (!panel || !body) return;
  panel.style.display = 'block';

  const monthlyExpense = expAt65 / 12; // 月支出（円）
  const monthlyNet     = monthlyExpense - (pensionAnnual / 12); // 年金引後の月純支出
  const bufferNeeded3  = Math.max(0, monthlyNet) * 3;   // 3ヶ月分
  const bufferNeeded6  = Math.max(0, monthlyNet) * 6;   // 6ヶ月分
  const bufferNeeded12 = Math.max(0, monthlyNet) * 12;  // 12ヶ月分

  // 現在の余剰資産から推計
  const availBuffer = Math.max(0, surplus65);
  const months = monthlyNet > 0 ? Math.floor(availBuffer / monthlyNet) : 999;
  const monthsCapped = Math.min(months, 36);

  const fmt万 = v => Math.round(v/1e4).toLocaleString() + '万円';

  // 安全水準判定
  let bufferGrade, bufferColor, bufferIcon, bufferMsg;
  if (months >= 24) {
    bufferGrade = '非常に安全';    bufferColor = '#a8ff78'; bufferIcon = '🛡️';
    bufferMsg = '24ヶ月以上の安全資金があります。暴落が長期化しても生活水準を維持できます。';
  } else if (months >= 12) {
    bufferGrade = '安全圏';        bufferColor = '#00d4ff'; bufferIcon = '✅';
    bufferMsg = '12ヶ月以上の安全資金があります。1年程度の暴落・無収入期間に耐えられます。';
  } else if (months >= 6) {
    bufferGrade = '最低ライン';    bufferColor = '#ffd166'; bufferIcon = '⚠️';
    bufferMsg = '6〜12ヶ月分の安全資金です。生活費の変動リスクがあるため、固定費削減を検討してください。';
  } else if (months >= 3) {
    bufferGrade = '要注意';        bufferColor = '#ff9a3c'; bufferIcon = '🔴';
    bufferMsg = '3〜6ヶ月分しかありません。急な出費や暴落に弱い状態です。生活防衛資金の積み増しを優先してください。';
  } else {
    bufferGrade = '危険水準';      bufferColor = '#ff4757'; bufferIcon = '💀';
    bufferMsg = '3ヶ月分未満です。暴落直後に資産を売却せざるを得ないリスクが高い状態です。';
  }

  const fillPct = Math.min(100, (monthsCapped / 36) * 100);

  body.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding:14px;background:rgba(${bufferColor.startsWith('#a8') ? '168,255,120' : bufferColor.startsWith('#00') ? '0,212,255' : bufferColor.startsWith('#ff') && bufferColor.includes('4757') ? '255,71,87' : '255,209,102'},.06);border:1px solid ${bufferColor}33;border-radius:8px;">
      <span style="font-size:28px;">${bufferIcon}</span>
      <div>
        <div style="font-size:13px;font-weight:700;color:${bufferColor};margin-bottom:4px;">${bufferGrade}：約 ${months < 999 ? months + 'ヶ月分' : '36ヶ月以上'} の安全資金</div>
        <div style="font-size:11px;color:var(--text-mid);line-height:1.6;">${bufferMsg}</div>
      </div>
    </div>

    <!-- バッファゲージ -->
    <div style="margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-dim);font-family:var(--font-mono);margin-bottom:6px;">
        <span>安全資金の充足度（月数）</span>
        <span style="color:${bufferColor};">${months < 999 ? months + 'ヶ月' : '36ヶ月超'}</span>
      </div>
      <div class="buffer-gauge">
        <div class="buffer-fill" style="width:${fillPct.toFixed(1)}%;background:linear-gradient(90deg,${bufferColor}aa,${bufferColor});"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:9px;color:var(--text-dim);margin-top:4px;">
        <span>0ヶ月</span>
        <span style="color:#ffd166;">⚠️ 6ヶ月</span>
        <span style="color:#00d4ff;">✅ 12ヶ月</span>
        <span style="color:#a8ff78;">🛡️ 24ヶ月</span>
        <span>36ヶ月</span>
      </div>
    </div>

    <!-- 詳細数値 -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px;">
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:10px;text-align:center;">
        <div style="font-size:9px;color:var(--text-dim);margin-bottom:4px;font-family:var(--font-mono);">月純支出（年金後）</div>
        <div style="font-size:15px;font-weight:700;font-family:var(--font-mono);color:var(--text);">${fmt万(Math.max(0, monthlyNet))}</div>
      </div>
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:10px;text-align:center;">
        <div style="font-size:9px;color:var(--text-dim);margin-bottom:4px;font-family:var(--font-mono);">推奨安全資金（12ヶ月）</div>
        <div style="font-size:15px;font-weight:700;font-family:var(--font-mono);color:#00d4ff;">${fmt万(bufferNeeded12)}</div>
      </div>
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:10px;text-align:center;">
        <div style="font-size:9px;color:var(--text-dim);margin-bottom:4px;font-family:var(--font-mono);">現在の余裕資産</div>
        <div style="font-size:15px;font-weight:700;font-family:var(--font-mono);color:${surplus65 >= 0 ? bufferColor : '#ff4757'};">${surplus65 >= 0 ? fmt万(surplus65) : '▲'+fmt万(-surplus65)}</div>
      </div>
    </div>

    <div style="font-size:11px;color:var(--text-dim);line-height:1.7;padding:10px 12px;background:rgba(0,0,0,.15);border-radius:6px;">
      💡 <b style="color:var(--text);">シーケンス・オブ・リターン・リスク対策：</b>
      FIRE直後に暴落が起きた場合でも投資資産を売却せずに生活できるよう、別口座に現金バッファを確保することが推奨されています。
      最低でも <b style="color:#ffd166;">6ヶ月分</b>、理想は <b style="color:#a8ff78;">12〜24ヶ月分</b> を目安にしてください。
    </div>
  `;
}

// ページ読み込み完了後、またはグラフ作成後に実行
// 見た目と中身を強制的に同期させる
toggleRealValue(); // 1回目は !_realValueOn で false になるので、直前に _realValueOn = false; にしておくか、関数を微調整してください
// ============================================================
// 難易度モード定義
// ============================================================
const DIFFICULTY_MODES = {
  hard: {
    label: '💀 ハードモード',
    desc:  '暴落・長期低迷が多発。弱気相場への遷移確率が高く、株式リターンも低め。最悪シナリオへの耐性を確認したい場合に。',
    regimes: [
      // 強気: リターン低め・ボラ高め
      {mu:[0.09, 0.01], sigma:[0.20, 0.04], corr:0.2,  inf: 0.01},
      // 通常: ほぼ横ばい
      {mu:[0.04, 0.01], sigma:[0.18, 0.03], corr:0.1,  inf: 0.00},
      // 弱気: 暴落大
      {mu:[-0.15,0.00], sigma:[0.30, 0.06], corr:0.3,  inf:-0.01},
      // インフレ: スタグフレーション
      {mu:[0.00, 0.02], sigma:[0.22, 0.06], corr:0.4,  inf: 0.03},
    ],
    // 遷移確率 [強気→, 通常→, 弱気→, インフレ→] 各行合計100
    tm: [
      [60, 20, 10, 10],  // 強気から
      [15, 50, 20, 15],  // 通常から
      [10, 30, 45, 15],  // 弱気から
      [10, 20, 20, 50],  // インフレから
    ],
  },
  normal: {
    label: '📊 普通モード',
    desc:  '歴史的な市場平均に基づく標準設定。長期的な株式投資の期待値に近い前提。',
    regimes: [
      {mu:[0.15, 0.02], sigma:[0.18, 0.03], corr:0.1,  inf: 0.01},
      {mu:[0.11, 0.01], sigma:[0.18, 0.02], corr:0.0,  inf: 0.00},
      {mu:[-0.05,0.01], sigma:[0.25, 0.04], corr:0.2,  inf:-0.01},
      {mu:[0.06, 0.00], sigma:[0.22, 0.05], corr:0.4,  inf: 0.01},
    ],
    tm: [
      [75, 15,  5,  5],
      [15, 70, 10,  5],
      [ 5, 45, 40, 10],
      [ 5, 15, 10, 70],
    ],
  },
  easy: {
    label: '🌈 楽観モード',
    desc:  '強気相場が長続きしやすく、暴落が少ない楽観シナリオ。右肩上がりを想定した場合の最大ポテンシャルを確認できます。',
    regimes: [
      {mu:[0.15, 0.03], sigma:[0.12, 0.02], corr:0.05, inf: 0.01},
      {mu:[0.10, 0.02], sigma:[0.12, 0.02], corr:0.0,  inf: 0.00},
      {mu:[-0.03,0.01], sigma:[0.08, 0.03], corr:0.1,  inf:-0.01},
      {mu:[0.05, 0.01], sigma:[0.08, 0.04], corr:0.2,  inf: 0.01},
    ],
    tm: [
      [80, 15,  3,  2],
      [25, 65,  5,  5],
      [15, 55, 20, 10],
      [10, 30, 10, 50],
    ],
  },
};

let currentDifficulty = 'normal';

function setDifficulty(mode) {
  currentDifficulty = mode;
  const def = DIFFICULTY_MODES[mode];

  // 1. REGIMES グローバルを上書き
  def.regimes.forEach((r, i) => { Object.assign(REGIMES[i], r); });

  // 2. tmValues を上書き
  def.tm.forEach((row, ri) => { row.forEach((v, ci) => { tmValues[ri][ci] = v; }); });

  // 3. TM UI を再描画
  buildTM();

  // 4. レジームカードの表示を更新
  updateRegimeCards();

  // 5. ボタンのアクティブ状態を更新
  ['hard','normal','easy'].forEach(m => {
    document.getElementById(`diff-${m}`).classList.toggle('diff-btn-active', m === mode);
  });

  // 6. 説明文を更新
  document.getElementById('difficulty-desc').textContent = def.desc;

  // 7. df値と遷移行列スライダー制御（コールバック経由でui.jsの関数を呼ぶ）
  if (typeof _simCallbacks !== 'undefined' && typeof _simCallbacks.setDifficultyEnhanced === 'function') {
    _simCallbacks.setDifficultyEnhanced(mode);
  } else if (typeof setDifficultyEnhanced === 'function') {
    // フォールバック: ui.jsがグローバルに定義されている場合
    setDifficultyEnhanced(mode);
  }

  // 8. 定常分布の再計算
  if (typeof _simCallbacks.renderRegimeDashboard === 'function') _simCallbacks.renderRegimeDashboard();
  if (typeof _simCallbacks.updateRegimeTable     === 'function') _simCallbacks.updateRegimeTable();

  // 9. 保存（ロード中は除く）
  scheduleSave();
}

function updateRegimeCards() {
  const labels  = ['🐂 強気', '📈 通常', '🐻 弱気', '🔥 インフレ'];
  const colors  = ['var(--bull)', 'var(--normal)', 'var(--bear)', 'var(--infla)'];
  const sigStr  = v => (v*100).toFixed(0);
  const muStr   = v => (v >= 0 ? '+' : '') + (v*100).toFixed(0) + '%';
  const cards   = document.querySelectorAll('.regime-card');
  REGIMES.forEach((rg, i) => {
    if (!cards[i]) return;
    cards[i].innerHTML = `
      <div style="font-size:9px;font-family:var(--font-mono);color:${colors[i]};text-transform:uppercase;letter-spacing:1.5px;margin-bottom:7px;">${labels[i]}</div>
      <div style="font-size:11px;line-height:2;color:var(--text-mid);">
        株式: <b style="color:${colors[i]};">${muStr(rg.mu[0])}</b> σ=${sigStr(rg.sigma[0])}%<br>
        債券: ${muStr(rg.mu[1])} σ=${sigStr(rg.sigma[1])}%<br>
        インフレ超過: <b style="color:var(--text);">${muStr(rg.inf)}</b>
      </div>
    `;
  });
}

// ============================================================
// グローバル定数：レジーム定義（runSimulation・ヒートマップ共用）
// ============================================================
const REGIMES = [
  {mu:[0.10, 0.02], sigma:[0.15, 0.03], corr:0.1,  inf: 0.01}, // 強気
  {mu:[0.08, 0.01], sigma:[0.15, 0.02], corr:0.0,  inf: 0.00}, // 通常
  {mu:[-0.07,0.01], sigma:[0.10, 0.04], corr:0.2,  inf:-0.01}, // 弱気
  {mu:[0.02, 0.00], sigma:[0.10, 0.05], corr:0.4,  inf: 0.01}, // インフレ
];

async function runSimulation() {
  // ── 入力バリデーション（validator.js の UIValidator 層に委譲）──────────
  // window.UIValidator を明示参照することで、スクリプト読み込み順に依らず
  // グローバルオブジェクトから確実に取得する。
  // validator.js が未ロードの場合は旧来の簡易チェックにフォールバック。
  if (typeof window.UIValidator !== 'undefined' && typeof window.UIValidator.validateAll === 'function') {
    const { valid } = window.UIValidator.validateAll();
    if (!valid) {
      // バナーはすでに UIValidator.validateAll() 内で表示済み。
      // run-btn を赤くして注目させる。
      const btn2 = document.getElementById('run-btn');
      if (btn2) {
        btn2.style.background = 'linear-gradient(135deg,#ff4757,#cc2233)';
        btn2.style.boxShadow = '0 4px 20px rgba(255,71,87,.5)';
        setTimeout(() => { btn2.style.background = ''; btn2.style.boxShadow = ''; }, 1500);
      }
      return;
    }
  } else {
    // フォールバック: validator.js が読み込まれていない場合の最低限チェック
    const _age    = parseInt(document.getElementById('start-age').value);
    const _income = parseInt(document.getElementById('income').value);
    const _assets = parseInt(document.getElementById('initial-assets').value);
    const _fire   = parseInt(document.getElementById('fire-threshold').value);
    const legacyErrors = [];
    if (isNaN(_age)    || _age    < 20 || _age > 70) legacyErrors.push('・開始年齢が異常です（20〜70歳の範囲で設定してください）');
    if (isNaN(_income) || _income <= 0)               legacyErrors.push('・額面年収を入力してください');
    if (isNaN(_assets) || _assets <  0)               legacyErrors.push('・現在の資産が異常です');
    if (isNaN(_fire)   || _fire   <= 0)               legacyErrors.push('・FIRE達成目標資産を設定してください');
    if (legacyErrors.length > 0) {
      const btn2 = document.getElementById('run-btn');
      if (btn2) {
        btn2.style.background = 'linear-gradient(135deg,#ff4757,#cc2233)';
        btn2.style.boxShadow = '0 4px 20px rgba(255,71,87,.5)';
        setTimeout(() => { btn2.style.background = ''; btn2.style.boxShadow = ''; }, 1500);
      }
      alert('⚠️ 入力エラー\n\n' + legacyErrors.join('\n'));
      return;
    }
  }

  // Validate TM
  if(tmValues.some(row=>row.reduce((a,b)=>a+b,0)!==100)){
    if(!confirm('遷移確率の合計が100%でない行があります。自動正規化してから実行しますか？')) return;
    normalizeAll();
  }
// --- 計算開始と同時に現在の設定を確実に保存 ---
  saveParameters();

  const btn=document.getElementById('run-btn'); btn.disabled=true;
  btn.textContent = '⏳ 計算中...';
  const badge=document.getElementById('status-badge');

  try {
  badge.textContent='RUNNING';
  badge.style.cssText='display:inline-flex;align-items:center;gap:6px;background:rgba(0,212,255,.12);border:1px solid rgba(0,212,255,.3);color:var(--accent);font-size:10px;font-family:var(--font-mono);padding:5px 12px;border-radius:3px;letter-spacing:1.5px;';
  const pBar=document.getElementById('progress-bar'), pFill=document.getElementById('progress-fill');
  pBar.style.display='block'; pFill.style.width='0%';

  // --- Read params ---
  const startAge      =parseInt(document.getElementById('start-age').value);
  const initAssets    =parseInt(document.getElementById('initial-assets').value)*10000;
  const fireThr       =parseInt(document.getElementById('fire-threshold').value)*10000;
  const annualIncome  =parseInt(document.getElementById('income').value)*10000;
  const isDual        = currentHousehold === 'dual';
  const annualIncomeB = isDual ? parseInt(document.getElementById('income-b').value||0)*10000 : 0;
  const raiseRate     =parseFloat(document.getElementById('raise').value)/100;
  const raiseRateB    = isDual ? parseFloat(document.getElementById('raise-b').value||1)/100 : 0;
  // 税金計算エンジンで実効手取り率を算出
  const taxA = calcTaxPrecise(annualIncome);
  const taxB = isDual ? calcTaxPrecise(annualIncomeB) : { rate: 0 };
  const takeHomeA = taxA.rate;
  const takeHomeB = taxB.rate;
  // 教育費（子ステージが expStages に含まれているため getExpenseForAge で自動反映）
  const childBenefitAnnual = calcChildBenefitAnnual() * 10000; // 万→円
  const monthlyPension=parseInt(document.getElementById('pension').value)*10000;
  const inheritAmt    =parseInt(document.getElementById('inheritance').value)*10000;
  const baseInfl      =parseFloat(document.getElementById('base-infl').value)/100;
  // expActive / expMid は廃止 → getExpenseForAge() を使用
  const wWork         =parseInt(document.getElementById('w-working').value)/100;
  const wRetire       =parseInt(document.getElementById('w-retired').value)/100;
  const tDof          =parseInt(document.getElementById('tdof').value);
  const medAdv        =parseFloat(document.getElementById('med-adv').value)/100;
  const N             =parseInt(document.getElementById('nsims').value);
  const gender        =selectedGender;
  const T             =80; // up to startAge+80 (max ~135), death via Gompertz

  const TM=tmValues.map(row=>{ const s=row.reduce((a,b)=>a+b,0); return row.map(v=>v/s); });

  // REGIMES はグローバル定数を使用

  // Typed arrays for performance
  const assets     =new Float64Array(N).fill(initAssets);
  const cashBuf    =new Float64Array(N).fill(0);
  const cumInf     =new Float64Array(N).fill(1.0);
  const retired    =new Uint8Array(N).fill(0);
  const regArr     =new Int32Array(N).fill(1);
  const dead       =new Uint8Array(N).fill(0);
  const bankrupt   =new Uint8Array(N).fill(0);
  const fireAge    =new Int32Array(N).fill(-1);
  const deathAt    =new Int32Array(N).fill(-1);
  const inheritA   =new Int32Array(N*2);
  for(let i=0;i<N;i++){
    inheritA[i*2]  =Math.round(55+Math.random()*15);
    inheritA[i*2+1]=Math.round(55+Math.random()*15);
  }

  const CP  =Math.min(200,N);
  const cidx=Array.from({length:CP},()=>Math.floor(Math.random()*N));
  const pH  =new Float64Array(CP*T);
  const pHReal=new Float64Array(CP*T); // 実質価値パス（インフレ調整後）
  const med =new Float64Array(T);
  const p25 =new Float64Array(T);
  const p75 =new Float64Array(T);
  const p10 =new Float64Array(T);
  const p90 =new Float64Array(T);
  const medReal=new Float64Array(T); // 実質価値 中央値

  for(let t=0;t<T;t++){
    if(t%5===0){
      pFill.style.width=`${(t/T*100).toFixed(0)}%`;
      await new Promise(r=>setTimeout(r,0));
    }
    const age=startAge+t;

    for(let i=0;i<N;i++){
      if(dead[i]) continue;

      // ---- Stochastic death (Gompertz-Makeham) ----
      // Evaluated before financials; final-year assets still processed
      const dp=deathProb(age, t, gender, medAdv);
      if(Math.random()<dp || age>=115){
        assets[i]=Math.max(0, assets[i]-3_000_000); // terminal costs
        deathAt[i]=age;
        dead[i]=1;
        // Record chart path for this last year then skip further logic
        // (fall through to end of iteration — already marked dead, loop skips next time)
      }

if(dead[i]) continue; // skip financials if died this step

      const rg=REGIMES[regArr[i]];
      const w =retired[i]?wRetire:wWork;

      // ---- 1. Returns & Rebalancing ----
      // samplingFromBivariateT で相関付き2変量t分布からリターンをサンプリング。
      // 引数の corr はレジームごとに定義された株式・債券間の相関係数。
      // tDof は UI スライダーで制御可能な自由度パラメータ。
      // samplingFromBivariateT で相関付き2変量t分布からリターンをサンプリング。
      // 引数の corr はレジームごとに定義された株式・債券間の相関係数。
      // tDof は UI スライダーで制御可能な自由度パラメータ。
      let stockPart = assets[i] * w;
      let bondPart  = assets[i] * (1 - w);

      const [retS, retB] = samplingFromBivariateT({
        mu:    rg.mu,
        sigma: rg.sigma,
        corr:  rg.corr,
        df:    tDof,
      });
      const [retS, retB] = samplingFromBivariateT({
        mu:    rg.mu,
        sigma: rg.sigma,
        corr:  rg.corr,
        df:    tDof,
      });

      // それぞれにリターンを適用して合算する
      stockPart *= (1 + retS);
      bondPart  *= (1 + retB);
      assets[i] = stockPart + bondPart;

      // ---- 2. FIRE check ----
      if(!retired[i]&&(assets[i]+cashBuf[i])>=fireThr){
        retired[i]=1; fireAge[i]=age;
        const buf=Math.min(assets[i],15_000_000);
        cashBuf[i]+=buf; assets[i]-=buf;
      }
      // ---- 2b. 初心者モード：60歳で強制退職 ----
      if(!retired[i] && age >= 60 && fireThr >= 999990000) {
        // fireThr が99999万円（≒初心者モードのダミー値）なら60歳で退職
        retired[i]=1; fireAge[i]=60;
      }

      // ---- 3. Income ----
      let income=0;
      if(!retired[i]&&age<60) {
        income += annualIncome * takeHomeA * Math.pow(1+raiseRate, t);
        if (isDual) income += annualIncomeB * takeHomeB * Math.pow(1+raiseRateB, t);
      }
      if(age>=65) income+=(monthlyPension*12)*0.85*Math.pow(1.005,age-65);
      if(age===inheritA[i*2])   income+=inheritAmt;
      if(age===inheritA[i*2+1]) income+=inheritAmt;
      // ---- 一時イベント（タイムライン）キャッシュフロー ----
      // oneTimeEvents 配列に登録された特定年のみ発生する収支（住宅購入・退職金・修繕費など）
      // 全シミュ経路で同一適用（確定イベント）。正=収入、負=費用として income に加算する。
      income += getOneTimeEventCashflow(age);
      // ---- 一時イベント（タイムライン）キャッシュフロー ----
      // oneTimeEvents 配列に登録された特定年のみ発生する収支（住宅購入・退職金・修繕費など）
      // 全シミュ経路で同一適用（確定イベント）。正=収入、負=費用として income に加算する。
      income += getOneTimeEventCashflow(age);
      // 児童手当（シミュ年ごとに子どもの年齢を動的計算・2024年改正対応）
      if (children.length > 0) {
        const simYear = new Date().getFullYear() + t;
        let benefitAnnual = 0;
        children.forEach((child, idx) => {
          const cAge = simYear - child.birthYear;
          if (cAge < 0 || cAge > 18) return;
          let monthly = 0;
          if (cAge < 3) {
            monthly = 15000;           // 3歳未満: 15,000円
          } else {
            monthly = (idx >= 2) ? 30000 : 10000; // 第3子以降3万/第1・2子1万
          }
          benefitAnnual += monthly * 12;
        });
        income += benefitAnnual;
      }

      // ---- 4. Expenses (ライフステージ別) ----
      const baseExp = getExpenseForAge(age);
      const expMod  = (retired[i] && regArr[i]>=2) ? 0.80 : 1.0;
      let expense = baseExp * cumInf[i] * expMod;
      if(age>=80){
        const r2=Math.random();
        if(r2<0.10) expense+=2_500_000;
        else if(r2<0.40) expense+=1_000_000;
      }

      // ---- 5. Cash flow ----
      const netCF=income-expense;
      if(retired[i]&&regArr[i]>=2&&cashBuf[i]>0){
        cashBuf[i]+=netCF;
        if(cashBuf[i]<0){assets[i]+=cashBuf[i];cashBuf[i]=0;}
      } else {
        assets[i]+=netCF;
      }
      if(assets[i]<0) assets[i]=0;

      // ---- 6. Bankruptcy ----
      if(!bankrupt[i]&&(assets[i]+cashBuf[i])<=0) bankrupt[i]=1;

      // ---- 7. Inflation & regime transition ----
      cumInf[i]*=(1+baseInfl+rg.inf);
      regArr[i]=chooseRegime(TM[regArr[i]]);
    }

    // Chart path recording
    for(let ci=0;ci<CP;ci++) {
      pH[ci*T+t]=(assets[cidx[ci]]+cashBuf[cidx[ci]])/1e8;
      // 実質価値: 名目資産 / 累積インフレ率
      pHReal[ci*T+t]=(assets[cidx[ci]]+cashBuf[cidx[ci]])/(cumInf[cidx[ci]]||1)/1e8;
    }

    // Percentiles (alive only)
    const alive=[];
    const aliveReal=[];
    for(let i=0;i<N;i++) if(!dead[i]) {
      alive.push(assets[i]+cashBuf[i]);
      aliveReal.push((assets[i]+cashBuf[i])/(cumInf[i]||1));
    }
    alive.sort((a,b)=>a-b);
    aliveReal.sort((a,b)=>a-b);
    if(alive.length>0){
      const pc=p=>alive[Math.floor(p/100*alive.length)]/1e8;
      p10[t]=pc(10);p25[t]=pc(25);med[t]=pc(50);p75[t]=pc(75);p90[t]=pc(90);
      medReal[t]=aliveReal[Math.floor(0.5*aliveReal.length)]/1e8;
    }
  }
  pFill.style.width='100%';

  // ---- Compute stats ----
  let nB=0,nS=0,nFS=0;
  const farr=[],darr=[],finalA=[];
  for(let i=0;i<N;i++){
    if(bankrupt[i]) nB++; else { nS++; if(fireAge[i]>=0) nFS++; }
    if(fireAge[i]>=0) farr.push(fireAge[i]);
    if(deathAt[i]>=0){ darr.push(deathAt[i]); finalA.push(assets[i]+cashBuf[i]); }
  }
  farr.sort((a,b)=>a-b); darr.sort((a,b)=>a-b); finalA.sort((a,b)=>a-b);

  // グローバルに保存（トルネード分析で下位10%を参照するため）
  lastFinalAssets = finalA.slice();

  const pfa=p=>farr.length===0?'未達成':farr[Math.floor(p/100*farr.length)]+'歳';
  const mf =finalA.length>0?finalA[Math.floor(finalA.length*.5)]/1e8:0;
  const mda=darr.length>0?darr[Math.floor(darr.length*.5)]+'歳':'—';

  // ヒートマップ用にFIRE年齢中央値を保持（未達成なら null）
  lastMedianFireAge=farr.length>0?farr[Math.floor(farr.length*.5)]:null;

  // ---- Compute extra stats ----
  // 65歳時の資産中央値
  const age65idx = Math.max(0, 65 - startAge);
  const assets65 = age65idx < T ? (med[age65idx] * 1e8) : 0; // 億→円

  // 65歳時の必要老後資産（年金控除後の支出 × 余命）
  const lifeExp = darr.length > 0 ? darr[Math.floor(darr.length * .5)] : 85;
  const retireYears = Math.max(0, lifeExp - 65);
  const pensionAnnual = monthlyPension * 12; // 円/年
  const expAt65 = getExpenseForAge(65) * Math.pow(1 + baseInfl, Math.max(0, 65 - startAge));
  const needAt65 = Math.max(0, (expAt65 - pensionAnnual) * retireYears);

  // 余裕額
  const surplus65 = assets65 - needAt65;

  // 月あたり使える額（65歳資産 ÷ 余命月数 + 年金）
  const monthlyRetire = retireYears > 0
    ? Math.round((assets65 / (retireYears * 12) + pensionAnnual / 12) / 10000)
    : 0;

  // FIREまでの資産ギャップ
  const medFireAge = farr.length > 0 ? farr[Math.floor(farr.length * .5)] : null;
  const currentAssets = initAssets;
  const fireGap = Math.max(0, fireThr - currentAssets);

  // ---- Update KPIs ----
  const successRate100 = nS/N*100;
  document.getElementById('kpi-success').textContent   = successRate100.toFixed(1) + '%';
  document.getElementById('kpi-bankrupt').textContent  = (nB/N*100).toFixed(1) + '%';
  document.getElementById('kpi-median').textContent    = mf.toFixed(1) + '億';
  document.getElementById('kpi-fire-age').textContent  = pfa(50);
  document.getElementById('kpi-death-age').textContent = mda;

  // 成功率KPIカードの色を動的に変更（85%超→緑 / 70-85%→黄 / 70%未満→赤）
  const successCard = document.getElementById('kpi-success')?.closest('.kpi-card');
  if (successCard) {
    successCard.classList.remove('success', 'danger', 'warning');
    if (successRate100 >= 85) {
      successCard.classList.add('success');
    } else if (successRate100 >= 70) {
      successCard.classList.add('warning');
    } else {
      successCard.classList.add('danger');
    }
  }
  // 破産率KPIカードの色を動的に変更
  const bankruptCard = document.getElementById('kpi-bankrupt')?.closest('.kpi-card');
  if (bankruptCard) {
    bankruptCard.classList.remove('success', 'danger', 'warning');
    const bRate = nB/N*100;
    if (bRate <= 5) bankruptCard.classList.add('success');
    else if (bRate <= 15) bankruptCard.classList.add('warning');
    else bankruptCard.classList.add('danger');
  }

  // FIRE残り年数
  const fireAgeMed = medFireAge;
  document.getElementById('kpi-fire-sub').textContent =
    fireAgeMed ? `現在${startAge}歳 → あと${fireAgeMed - startAge}年` : '目標資産到達年齢';

  // FIREまでの資産ギャップ
  const gapEl = document.getElementById('kpi-fire-gap');
  if (fireGap <= 0) {
    gapEl.textContent = '達成済み！';
    gapEl.style.color = 'var(--success)';
  } else {
    gapEl.textContent = (fireGap/1e8).toFixed(2) + '億';
    gapEl.style.color = 'var(--warning)';
  }
  document.getElementById('kpi-fire-gap-sub').textContent =
    `目標 ${(fireThr/1e4).toLocaleString()}万 − 現在 ${(currentAssets/1e4).toLocaleString()}万`;

  // 老後KPI
  const fmt万 = v => {
    if (Math.abs(v) >= 1e8) return (v/1e8).toFixed(1) + '億';
    return Math.round(v/1e4).toLocaleString() + '万';
  };
  document.getElementById('kpi-age65').textContent = fmt万(assets65);
  document.getElementById('kpi-need65').textContent = fmt万(needAt65);
  document.getElementById('kpi-need65-sub').textContent =
    `年支出${Math.round(expAt65/1e4)}万 − 年金${Math.round(pensionAnnual/1e4)}万 × ${retireYears}年`;

  const surplusEl = document.getElementById('kpi-retire-surplus');
  surplusEl.textContent = (surplus65 >= 0 ? '+' : '') + fmt万(surplus65);
  surplusEl.style.color = surplus65 >= 0 ? '#b388ff' : 'var(--danger)';
  surplusEl.style.textShadow = surplus65 >= 0
    ? '0 0 20px rgba(179,136,255,.4)' : '0 0 20px rgba(255,71,87,.35)';

  document.getElementById('kpi-monthly-retire').textContent = monthlyRetire.toLocaleString() + '万/月';

  // kpi-sectionはnormal/proモード時のみ表示（setModeと同じロジック）
  const kpiSec2 = document.getElementById('kpi-section');
  const bSumm2  = document.getElementById('beginner-summary');
  const mode2   = document.body.getAttribute('data-mode') || 'beginner';
  if (kpiSec2) kpiSec2.style.display = (mode2 === 'normal' || mode2 === 'pro') ? 'block' : 'none';
  if (bSumm2)  bSumm2.style.display  = mode2 === 'beginner' ? 'block' : 'none';

  // ---- FIRE Age table ----
  const pctiles = [10, 25, 50, 75, 90];
  ['p10','p25','p50','p75','p90'].forEach((k, idx) => {
    const age = farr.length === 0 ? null : farr[Math.floor(pctiles[idx]/100 * farr.length)];
    document.getElementById(`fire-${k}`).textContent = age ? age + '歳' : '未達成';
    const yEl = document.getElementById(`fire-${k}-y`);
    if (yEl) yEl.textContent = age ? `あと${age - startAge}年` : '—';
  });
  document.getElementById('fire-never').textContent = ((1 - farr.length/N)*100).toFixed(1) + '%';

  // ---- Distribution bar ----
  const pF  = (nFS/N*100).toFixed(1);
  const pSN = ((nS-nFS)/N*100).toFixed(1);
  const pBk = (nB/N*100).toFixed(1);
  [['fire',pF],['early',pSN],['bankrupt',pBk]].forEach(([k,v]) => {
    const el = document.getElementById(`dist-${k}`);
    el.style.width = v + '%';
    el.textContent = Number(v) > 5 ? v + '%' : '';
    const pctEl = document.getElementById(`dist-${k}-pct`);
    if (pctEl) pctEl.textContent = v + '%';
  });

  // ---- Goal ゲージ ----
  renderGoalGauge({ currentAssets, fireThr, assets65, needAt65, surplus65, startAge, fireAgeMed, lifeExp });

  // ---- シミュレーション条件サマリー ----
  renderSimConditionSummary({
    startAge, initAssets, fireThr, annualIncome, annualIncomeB, isDual,
    wWork, wRetire, baseInfl, monthlyPension, N,
    successRate: nS/N, fireAgeMed, currentDifficulty,
    children, expStages,
  });

  // ---- 老後チェックリスト ----
  renderRetireChecklist({ assets65, needAt65, surplus65, pensionAnnual, expAt65, retireYears, monthlyRetire });

  // ---- シミュレーション結果 解説 ----
  renderSimCommentary({
    successRate: nS/N, bankruptRate: nB/N, fireRate: nFS/N,
    fireAgeMed, startAge, lifeExp,
    assets65, needAt65, surplus65, monthlyRetire,
    initAssets, fireThr, annualIncome: annualIncome*(isDual?1:1),
    N, mf,
  });

  // ---- アクションプラン（成功率90%への改善案）----
  renderActionPlan({
    successRate: nS/N,
    bankruptRate: nB/N,
    fireAgeMed,
    startAge,
    surplus65,
    expAt65,
    pensionAnnual,
    assets65,
    needAt65,
    fireThr,
    initAssets,
    monthlyRetire,
  });

  // ---- 安全キャッシュバッファ評価 ----
  renderCashBuffer({
    assets65,
    expAt65,
    surplus65,
    successRate: nS/N,
    bankruptRate: nB/N,
    monthlyRetire,
    pensionAnnual,
  });

  // ---- Chart ----
  const cont=document.getElementById('chart-container');
  cont.innerHTML=`
    <div style="position:relative;">
      <div class="chart-wrapper"><canvas id="myChart"></canvas></div>
      <button class="chart-camera-btn" onclick="saveChartPNG()" title="グラフを画像として保存" style="top:10px;right:50px;">📷</button>
      <button class="chart-camera-btn" onclick="exportSimCSV()" title="シミュレーション結果をCSVでエクスポート" style="top:10px;right:10px;">📊</button>
    </div>
    <div id="minimap-container" class="visible">
      <canvas id="minimapCanvas"></canvas>
      <div id="minimap-viewport"></div>
      <div class="minimap-label">全体俯瞰</div>
      <div class="minimap-hint">← スライドでその年齢を確認 →</div>
    </div>
  `;

  // Clean up any old portal
  const oldPortal = document.getElementById('chart-zoom-portal');
  if (oldPortal) oldPortal.remove();
// 1. まず ages を宣言して中身を作る（ここで宣言！）
  const ages = Array.from({length: T}, (_, i) => startAge + i);
  
  // 実質価値データをグローバルに保存（トグル用）
  window._lastPHReal = pHReal;
  window._lastMedReal = medReal;
  window._lastT = T;
  window._lastCP = CP;
  window._lastAges = ages;
  window._lastBaseInfl = baseInfl;
  window._lastStartAge = startAge;

  if(chartInstance){chartInstance.destroy();chartInstance=null;}
  
  // Re-create canvas to avoid stale dimensions on mobile (fixes chart glitch/corruption bug)
  const chartWrapper = document.querySelector('#chart-container .chart-wrapper');
  if (chartWrapper) {
    const oldCanvas = document.getElementById('myChart');
    if (oldCanvas) {
      const newCanvas = document.createElement('canvas');
      newCanvas.id = 'myChart';
      oldCanvas.replaceWith(newCanvas);
    }
  }

  const pathDS=[];
  for(let ci=0;ci<Math.min(80,CP);ci++){
    pathDS.push({data:Array.from({length:T},(_,t)=>pH[ci*T+t]),borderColor:'rgba(0,180,255,.09)',borderWidth:.8,pointRadius:0,fill:false,tension:.3});
  }

  // Y-axis max = P90 peak + 10% headroom (ignores outlier paths)

// --- ここから入れ替え ---
  // 表示する年齢（x軸の右端）までのデータだけを取り出し、その範囲の最大値をy軸の基準にする
  const displayLimit = getAgeAtSurvivalRate(0.1, MORTALITY[selectedGender], parseInt(document.getElementById('start-age').value), parseFloat(document.getElementById('med-adv').value)) - parseInt(document.getElementById('start-age').value);

  // yMax: P90ではなく「中央値のピーク × 2.0」を上限にして中央値が潰れないようにする
  // P90が極端に大きい（外れ値パス由来）場合でも中央値が読みやすい縦軸を維持
  const medVisible  = Array.from(med).slice(0, displayLimit + 1).filter(v => isFinite(v) && v > 0);
  const p90Visible  = Array.from(p90).slice(0, displayLimit + 1).filter(v => isFinite(v) && v > 0);
  const medPeak     = medVisible.length > 0 ? Math.max(...medVisible) : 1;
  const p90Peak     = p90Visible.length > 0 ? Math.max(...p90Visible) : medPeak;
  // 中央値ピークの2倍とP90ピークの1.1倍の小さい方を上限にし、中央値が常に上半分に収まるようにする
  const yMaxCandidate1 = medPeak * 2.2;
  const yMaxCandidate2 = p90Peak * 1.1;
  const yMaxRaw = Math.min(yMaxCandidate1, yMaxCandidate2);
  // 最低でも中央値ピーク×1.4は確保（P90が小さい場合の下限）
  const yMax = Math.max(yMaxRaw, medPeak * 1.4);
  // 小数点1桁に丸める
  const yMaxFinal = Math.ceil(yMax * 10) / 10;
  // --- ここまで入れ替え ---

  // x軸ラベル配列（年齢の文字列）から65歳のインデックスを算出
  // アノテーションのxMin/xMaxはカテゴリ軸ではラベル文字列を使う
  const age65label  = String(65);
  const fireAgeLabel = lastMedianFireAge ? String(lastMedianFireAge) : null;


  document.getElementById('chart-legend-note').textContent =
    `${N.toLocaleString()}回試行 | パスは最大80本表示`;

  chartInstance=new Chart(document.getElementById('myChart').getContext('2d'),{
    type:'line',
    data:{
      labels:ages,
      datasets:[
        ...pathDS,
        {label:'P90',         data:Array.from(p90),borderColor:'rgba(168,255,120,.55)',borderWidth:1.5,borderDash:[4,3],pointRadius:0,fill:false,tension:.3},
        {label:'P75',         data:Array.from(p75),borderColor:'rgba(0,212,255,0)',backgroundColor:'rgba(0,212,255,.07)',borderWidth:0,pointRadius:0,fill:'+1',tension:.3},
        {label:'中央値(P50)', data:Array.from(med), borderColor:'#00d4ff',borderWidth:3,pointRadius:0,fill:false,tension:.3},
        {label:'P25',         data:Array.from(p25),borderColor:'rgba(0,212,255,0)',backgroundColor:'rgba(0,212,255,.07)',borderWidth:0,pointRadius:0,fill:false,tension:.3},
        {label:'P10（リスク）',data:Array.from(p10),borderColor:'#ff6b35',borderWidth:2,borderDash:[6,3],pointRadius:0,fill:false,tension:.3},
        {label:'📉 中央値実質価値（インフレ調整後）',data:Array.from(medReal),borderColor:'#ffd166',borderWidth:2,borderDash:[3,3],pointRadius:0,fill:false,tension:.3,hidden:false},
      ]
    },
    options:{
      animation:{duration:700},responsive:true,maintainAspectRatio:false,
      plugins:{
        legend:{display:true,position:'top',labels:{color:'#6b7a99',font:{size:10},
          filter:it=>it.text&&!it.text.startsWith('undefined')&&it.text!=='P75'&&it.text!=='P25',
          boxWidth:18,padding:10}},
        annotation:{
          annotations:{
            fireLine: fireAgeLabel && lastMedianFireAge >= startAge ? {
              type:'line',xMin:fireAgeLabel,xMax:fireAgeLabel,
              borderColor:'rgba(255,209,102,.8)',borderWidth:2,borderDash:[5,3],
              label:{content:'🎯 FIRE達成',display:true,color:'#ffd166',font:{size:10,weight:'bold'},
                     position:'start',backgroundColor:'rgba(20,30,50,.85)',padding:{x:6,y:3},
                     borderRadius:4},
            } : undefined,
            age65Line: 65 >= startAge ? {
              type:'line',xMin:age65label,xMax:age65label,
              borderColor:'rgba(179,136,255,.7)',borderWidth:1.5,borderDash:[4,3],
              label:{content:'🏦 年金開始(65)',display:true,color:'#b388ff',font:{size:9},
                     position:'start',backgroundColor:'rgba(20,30,50,.85)',padding:{x:4,y:2},
                     borderRadius:4},
            } : undefined,
            // 資産中央値の最高値（ピーク点）
            peakAnnotation: (() => {
              const peakIdx = Array.from(med).reduce((bestIdx, v, idx) => (isFinite(v) && v > (isFinite(med[bestIdx]) ? med[bestIdx] : 0)) ? idx : bestIdx, 0);
              const peakAge = startAge + peakIdx;
              const peakVal = med[peakIdx];
              if (!isFinite(peakVal) || peakVal <= 0) return undefined;
              return {
                type: 'point',
                xValue: String(peakAge),
                yValue: peakVal,
                backgroundColor: 'rgba(168,255,120,.25)',
                borderColor: '#a8ff78',
                borderWidth: 2,
                radius: 6,
                label: { content: `▲ピーク`, display: true, color: '#a8ff78', font: {size:9}, position: 'start', backgroundColor:'rgba(20,30,50,.85)', padding:{x:4,y:2}, borderRadius:4, yAdjust:-18 },
              };
            })(),
            // 資産中央値のトラフ（底打ち点） - FIREより後
            troughAnnotation: (() => {
              if (!lastMedianFireAge) return undefined;
              const fireIdx = lastMedianFireAge - startAge;
              const subMed  = Array.from(med).slice(fireIdx);
              const troughLocal = subMed.reduce((bestIdx, v, idx) => (isFinite(v) && v < (isFinite(subMed[bestIdx]) ? subMed[bestIdx] : Infinity)) ? idx : bestIdx, 0);
              const troughIdx   = fireIdx + troughLocal;
              const troughAge   = startAge + troughIdx;
              const troughVal   = med[troughIdx];
              if (!isFinite(troughVal) || troughVal <= 0 || troughLocal === 0) return undefined;
              return {
                type: 'point',
                xValue: String(troughAge),
                yValue: troughVal,
                backgroundColor: 'rgba(255,71,87,.2)',
                borderColor: '#ff4757',
                borderWidth: 2,
                radius: 5,
                label: { content: '▼底打ち', display: true, color: '#ff6b6b', font: {size:9}, position: 'end', backgroundColor:'rgba(20,30,50,.85)', padding:{x:4,y:2}, borderRadius:4, yAdjust:18 },
              };
            })(),
          }
        },
        tooltip:{mode:'index',intersect:false,backgroundColor:'#111827',borderColor:'#1e2d45',borderWidth:1,
          titleColor:'#00d4ff',bodyColor:'#e8edf5',padding:10,
          callbacks:{
            title:items=>`年齢: ${items[0].label}歳`,
            label:it=>{if(it.dataset.label&&!it.dataset.label.startsWith('undefined'))return ` ${it.dataset.label}: ${Number(it.raw).toFixed(2)}億円`;return null;}
          }}
      },
      scales:{
        x:{
max: getAgeAtSurvivalRate(0.1, MORTALITY[selectedGender], parseInt(document.getElementById('start-age').value), parseFloat(document.getElementById('med-adv').value)),
grid:{color:'rgba(30,45,69,.5)',lineWidth:.5},ticks:{color:'#6b7a99',font:{size:10},maxTicksLimit:12},
           title:{display:true,text:'年齢',color:'#6b7a99',font:{size:11}}},
        y:{min:0,max:yMaxFinal,grid:{color:'rgba(30,45,69,.5)',lineWidth:.5},
           ticks:{color:'#6b7a99',font:{size:10},callback:v=>v.toFixed(1)+'億'},
           title:{display:true,text:'総資産（億円）',color:'#6b7a99',font:{size:11}}}
      }
    }
  });

  // Store simulation data globally for post-render features
  window._lastSimData = { med: Array.from(med), p90: Array.from(p90), p10: Array.from(p10), p75: Array.from(p75), p25: Array.from(p25), ages, startAge, lastMedianFireAge, yMaxFinal };

  // Minimap
  setTimeout(() => {
    buildMinimap(Array.from(med), ages, startAge);
    updateMinimapViewport(chartInstance);
  }, 200);

  // Update URL share
  setTimeout(updateShareUrl, 50);

  badge.textContent='DONE ✓';
  badge.style.cssText='display:inline-flex;align-items:center;gap:6px;background:rgba(168,255,120,.1);border:1px solid rgba(168,255,120,.3);color:#a8ff78;font-size:10px;font-family:var(--font-mono);padding:5px 12px;border-radius:3px;letter-spacing:1.5px;';
  btn.disabled=false;
  btn.textContent = '▶ もう一度シミュレーション';
  pBar.style.display='none';
  // シム回数バッジを更新
  const simBadge = document.getElementById('sim-count-badge');
  if (simBadge) { simBadge.textContent = N.toLocaleString() + '回試算済'; simBadge.style.display = 'inline'; }
  // ページタイトルにFIRE成功率を反映
  const successEl = document.getElementById('kpi-success');
  if (successEl && successEl.textContent !== '—') {
    document.title = `FLOW | 成功率 ${successEl.textContent} | 資産シミュレーター`;
  }

  // 購買力KPIを更新
  updatePurchasingPowerKPI(baseInfl, T, startAge);

  // 初心者モードサマリーを更新
  updateBeginnerSummary({
    med, assets65, expAt65, pensionAnnual, successRate: nS/N,
    startAge, T, baseInfl, monthlyRetire
  });

  // チャートのアクセシブルテキストサマリーを更新（charts.js）
  if (typeof updateChartA11ySummary === 'function') {
    const age65idx = Math.max(0, 65 - startAge);
    updateChartA11ySummary({
      startAge,
      successRate:        nS / N,
      bankruptRate:       nB / N,
      medianFireAge:      farr.length > 0 ? farr[Math.floor(farr.length * .5)] + '歳' : '未達成',
      medianFinalAssets:  mf,
      medianDeathAge:     mda,
      medAt65:            age65idx < T ? med[age65idx] : 0,
      pct10At65:          age65idx < T ? p10[age65idx] : 0,
      pct90At65:          age65idx < T ? p90[age65idx] : 0,
    });
  }

  // チャートのアクセシブルテキストサマリーを更新（charts.js）
  if (typeof updateChartA11ySummary === 'function') {
    const age65idx = Math.max(0, 65 - startAge);
    updateChartA11ySummary({
      startAge,
      successRate:        nS / N,
      bankruptRate:       nB / N,
      medianFireAge:      farr.length > 0 ? farr[Math.floor(farr.length * .5)] + '歳' : '未達成',
      medianFinalAssets:  mf,
      medianDeathAge:     mda,
      medAt65:            age65idx < T ? med[age65idx] : 0,
      pct10At65:          age65idx < T ? p10[age65idx] : 0,
      pct90At65:          age65idx < T ? p90[age65idx] : 0,
    });
  }

  // 結果エリアへスムーズスクロール（スマホで特に有効）
  setTimeout(() => {
    const isBeginner = document.body.getAttribute('data-mode') === 'beginner';
    const target = isBeginner
      ? (document.getElementById('beginner-summary') || document.getElementById('chart-container'))
      : (document.getElementById('kpi-section') || document.getElementById('goal-panel'));
    if (target) target.scrollIntoView({ behavior:'smooth', block:'start' });
    // KPIカードにアニメーション付与
    document.querySelectorAll('.kpi-card').forEach((c,i) => {
      c.classList.remove('revealed');
      setTimeout(() => c.classList.add('revealed'), i * 60);
    });
  }, 100);

  } catch(err) {
    console.error('[FLOW] シミュレーションエラー:', err);
    btn.disabled = false;
    btn.textContent = '▶ シミュレーションを実行する';
    const pBar2 = document.getElementById('progress-bar');
    if (pBar2) pBar2.style.display = 'none';
    badge.textContent = 'ERROR';
    badge.style.cssText = 'display:inline-flex;align-items:center;gap:6px;background:rgba(255,71,87,.12);border:1px solid rgba(255,71,87,.3);color:#ff4757;font-size:10px;font-family:var(--font-mono);padding:5px 12px;border-radius:3px;letter-spacing:1.5px;';
    setTimeout(() => {
      badge.textContent = 'READY';
      badge.style.cssText = '';
    }, 4000);
    alert('⚠️ シミュレーション中にエラーが発生しました。\nページを再読み込みしてもう一度お試しください。\n\n' + (err?.message || err));
  }
}

// ============================================================
// initSimCallbacks — simulation.js のコールバック注入口
//
// app.js から呼ばれ、ui.js / charts.js など他モジュールの
// 関数を受け取る。これにより simulation → ui の直接依存を排除。
// ============================================================
let _simCallbacks = {};

function initSimCallbacks(callbacks) {
  _simCallbacks = callbacks || {};
}

// ── 一時イベント・バリデーター関連のグローバル公開 ──────────────
// app.js の expose リストへの追加も忘れずに（下記は直接登録）
window.addOneTimeEvent         = addOneTimeEvent;
window.removeOneTimeEvent      = removeOneTimeEvent;
window.renderOneTimeEventList  = renderOneTimeEventList;
// samplingFromBivariateT と getOneTimeEventCashflow はテストから参照されるため公開
window.samplingFromBivariateT  = samplingFromBivariateT;
window.getOneTimeEventCashflow = getOneTimeEventCashflow;
// FinCalc もブラウザ環境向けに window に登録（globalThis 登録と二重保険）
window.FinCalc                 = FinCalc;
