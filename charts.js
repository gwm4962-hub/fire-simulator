/**
 * charts.js — Chart.js描画・ミニマップ・ヒートマップ・分布アナライザー
 * FLOW | 資産シミュレーター
 */
// ============================================================
// ★ V19 BEGINNER SUMMARY
// ============================================================

function updateBeginnerSummary({ med, assets65, expAt65, pensionAnnual, successRate, startAge, T, baseInfl, monthlyRetire }) {
  const el = document.getElementById('beginner-summary');
  if (!el) return;

  // --- 単位を万円に統一 ---
  // med[i]: 億円  → 万円: *10000
  // expAt65: 円/年 → 万円/年: /10000
  // pensionAnnual: 円/年 → 万円/年: /10000
  // assets65: 円 → 万円: /10000

  // 60歳時の中央値資産（万円）
  const age60idx = 60 - startAge;
  const asset60Man = (age60idx >= 0 && age60idx < med.length)
    ? Math.round(med[age60idx] * 10000)   // 億→万
    : Math.round((assets65 || 0) / 10000); // 円→万

  // 65歳時資産（万円）
  const asset65Man = Math.round((assets65 || 0) / 10000);

  // 年支出（万円/年）・年金（万円/年）
  const annualExpMan   = Math.round((expAt65 || 0) / 10000);
  const pensionAnnMan  = Math.round((pensionAnnual || 0) / 10000);

  // 60歳〜寿命（86歳）まで必要な純支出（年金控除後）を合計（万円）
  const lifeExpectancy = 86;
  const yearsAfter60 = lifeExpectancy - 60;
  // 純年支出 = 年支出 - 年金（65歳から受給）
  // 60〜64歳: 年金なし  65〜86歳: 年金あり
  const needBefore65 = annualExpMan * 5;                              // 60-64歳（5年）
  const needAfter65  = Math.max(0, annualExpMan - pensionAnnMan) * (yearsAfter60 - 5); // 65〜86歳
  const needTotalMan = Math.round(needBefore65 + needAfter65);

  const fmt = v => {
    const av = Math.abs(v);
    if (av >= 10000) return (v / 10000).toFixed(1) + '億円';
    return Math.round(v).toLocaleString() + '万円';
  };

  // OK/NG判定
  const isOK = successRate >= 0.7;
  const okEl = document.getElementById('bsumm-ok');
  const ngEl = document.getElementById('bsumm-ng');
  if (okEl) okEl.style.display = isOK ? 'block' : 'none';
  if (ngEl) ngEl.style.display = isOK ? 'none' : 'block';

  const okTxt = document.getElementById('bsumm-ok-text');
  const ngTxt = document.getElementById('bsumm-ng-text');
  if (okTxt) okTxt.innerHTML = `60歳定年後も<br><b style="color:#a8ff78;font-size:14px;">${(successRate*100).toFixed(0)}%</b>の確率で<br>資産が持続します`;
  if (ngTxt) ngTxt.innerHTML = `${((1-successRate)*100).toFixed(0)}%の確率で<br>老後に資金が<br>不足するリスクがあります`;

  const a60El = document.getElementById('bsumm-asset60');
  if (a60El) a60El.textContent = fmt(asset60Man);

  const needEl = document.getElementById('bsumm-need');
  if (needEl) needEl.textContent = fmt(needTotalMan);

  const survEl = document.getElementById('bsumm-survival');
  if (survEl) survEl.textContent = (successRate * 100).toFixed(0) + '%';

  const monthlyEl = document.getElementById('bsumm-monthly');
  if (monthlyEl) monthlyEl.textContent = (monthlyRetire || 0) + '万円/月';

  // アドバイス
  const advEl = document.getElementById('bsumm-advice');
  if (advEl) {
    const gap = asset60Man - needTotalMan;
    let advice = '';
    if (isOK && gap > 500) {
      advice = `💡 <b style="color:#a8ff78;">老後資金は十分です。</b>60歳時点で老後に必要な額を${fmt(gap)}上回る見込みです。このまま現役時代の貯蓄習慣を続ければ安心です。`;
    } else if (isOK) {
      advice = `💡 <b style="color:#ffd166;">ほぼ問題ありませんが</b>、余裕は少ない状況です。毎月の貯蓄をもう少し増やすか、資産運用の比率を見直すと安全度が高まります。`;
    } else {
      const shortfall = needTotalMan - asset60Man;
      advice = `⚠️ <b style="color:#ff9a9a;">老後資金が約${fmt(shortfall)}不足する可能性があります。</b>今から月々の貯蓄を増やすか、投資信託などの運用を始めることを検討してください。「通常モード」で詳しく分析できます。`;
    }
    advEl.innerHTML = advice;
  }

  el.style.display = 'block';
  el.querySelectorAll('.kpi-card').forEach((c, i) => {
    c.classList.remove('revealed');
    setTimeout(() => c.classList.add('revealed'), i * 80);
  });
}

// ============================================================
// ★ V17 NEW FEATURES
// ============================================================

// ---- 1. MODE SWITCHER ----
let currentMode = 'beginner';
const MODE_DESCS = {
  beginner: '🌱 初心者モード：難しい設定は自動。老後の安全度だけ確認できます。',
  normal:   '📊 通常モード：グラフ＋主要指標＋ライフステージを自由に設定できます。',
  pro:      '🔬 プロモード：感度分析・遷移行列・t分布など全機能が使えます。'
};

function setMode(mode) {
  currentMode = mode;
  document.body.setAttribute('data-mode', mode);
  ['beginner','normal','pro'].forEach(m => {
    document.getElementById('modeBtn-' + m).classList.toggle('active', m === mode);
  });
  document.getElementById('mode-desc').textContent = MODE_DESCS[mode];
  localStorage.setItem('fire_sim_mode', mode);

  // KPIセクション表示切り替え（シミュレーション済みの場合）
  const kpiSec = document.getElementById('kpi-section');
  const bSumm  = document.getElementById('beginner-summary');
  const hasResult = document.getElementById('kpi-success')?.textContent !== '—';

  if (kpiSec) {
    kpiSec.style.display = (mode === 'normal' || mode === 'pro') && hasResult ? 'block' : 'none';
  }
  if (bSumm) {
    bSumm.style.display = mode === 'beginner' && hasResult ? 'block' : 'none';
  }

  // 初心者ステージパネルの表示切り替え
  const bStagePanel = document.getElementById('beginner-stage-panel');
  if (bStagePanel) {
    const wizCompleted = localStorage.getItem('wizard_completed') === 'true';
    bStagePanel.style.display = (mode === 'beginner' && wizCompleted) ? 'block' : 'none';
  }

  // pro モードに切り替わった時にグラフを初期化／リサイズ
  // （pro-only パネルが display:none → block になるため、
  //   canvas の offsetWidth が 0 から正常値に変わるのを待って描画する）
  if (mode === 'pro') {
    // requestAnimationFrame で DOM レイアウト確定後に実行
    requestAnimationFrame(() => {
      initFatTailAnalyzer();
      initVolatilityDragExplorer();
    });
  }
}

// Initialize mode from storage
(function initMode(){
  const saved = localStorage.getItem('fire_sim_mode') || 'beginner';
  document.addEventListener('DOMContentLoaded', () => setMode(saved));
})();

// ---- 2. URL SHARE (Base64 + Versioning + Debounce) ----
const SHARE_VERSION = 'v1';
const SHARE_PARAM_IDS = [
  'start-age','initial-assets','fire-threshold','income','raise',
  'pension','inheritance','base-infl','w-working','w-retired','nsims','tdof','med-adv'
];

function getShareState() {
  const obj = { _v: SHARE_VERSION };
  SHARE_PARAM_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) obj[id] = el.value;
  });
  obj.gender = (typeof selectedGender !== 'undefined') ? selectedGender : 'male';
  obj.difficulty = (typeof currentDifficulty !== 'undefined') ? currentDifficulty : 'normal';
  return obj;
}

function encodeShareState(obj) {
  try {
    const json = JSON.stringify(obj);
    const b64 = btoa(encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (m, p1) => String.fromCharCode(parseInt(p1, 16))));
    return SHARE_VERSION + '_' + b64;
  } catch(e) { return ''; }
}

function decodeShareState(encoded) {
  try {
    if (!encoded.startsWith(SHARE_VERSION + '_')) return null;
    const b64 = encoded.slice(SHARE_VERSION.length + 1);
    const json = decodeURIComponent(Array.from(atob(b64)).map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    return JSON.parse(json);
  } catch(e) { return null; }
}

function updateShareUrl() {
  const state = getShareState();
  const encoded = encodeShareState(state);
  if (!encoded) return;
  const url = location.href.split('?')[0] + '?s=' + encoded;
  const el = document.getElementById('share-url-display');
  if (el) el.value = url;
}

function copyShareUrl() {
  const el = document.getElementById('share-url-display');
  if (!el) return;
  navigator.clipboard.writeText(el.value).then(() => {
    const badge = document.getElementById('share-copied-badge');
    if (badge) {
      badge.style.display = 'inline';
      clearTimeout(badge._t);
      badge._t = setTimeout(() => { badge.style.display = 'none'; }, 2000);
    }
  }).catch(() => {
    el.select(); document.execCommand('copy');
  });
}

function shareToX() {
  const urlEl = document.getElementById('share-url-display');
  const url = urlEl?.value || location.href;
  const successEl = document.getElementById('kpi-success');
  const rate = successEl && successEl.textContent !== '—' ? `FIRE成功率 ${successEl.textContent} ` : '';
  const text = encodeURIComponent(`${rate}| FLOWで資産シミュレーションしました 📊\n`);
  const encodedUrl = encodeURIComponent(url);
  window.open(`https://x.com/intent/tweet?text=${text}&url=${encodedUrl}`, '_blank', 'noopener');
}

// Load from URL on init
function loadFromUrl() {
  const params = new URLSearchParams(location.search);
  const s = params.get('s');
  if (!s) return false;
  const state = decodeShareState(s);
  if (!state) return false;
  SHARE_PARAM_IDS.forEach(id => {
    if (state[id] === undefined) return;
    const el = document.getElementById(id);
    if (el) { el.value = state[id]; el.dispatchEvent(new Event('input')); }
  });
  if (state.gender && typeof setGender === 'function') setGender(state.gender);
  if (state.difficulty && typeof setDifficulty === 'function') setDifficulty(state.difficulty);
  return true;
}

// Debounced URL update on slider input
let _shareDebounce = null;
document.addEventListener('input', e => {
  if (!e.target.matches('input[type="range"]')) return;
  clearTimeout(_shareDebounce);
  _shareDebounce = setTimeout(updateShareUrl, 200);
});

// ---- 3. CHART HELPERS (no zoom) ----
let _sigmaBandsOn = false;

// ---- 4. MINIMAP with drag-to-pan ----
let minimapCtx = null;
let _minimapDragging = false;
let _minimapDragStartX = 0;
let _minimapDragStartViewMin = 0;

function buildMinimap(med, ages, startAge) {
  const canvas = document.getElementById('minimapCanvas');
  if (!canvas) return;
  // Ensure proper pixel dimensions
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width > 0 ? rect.width : 600;
  canvas.height = rect.height > 0 ? rect.height : 64;
  minimapCtx = canvas.getContext('2d');
  drawMinimap(med, ages);
  setupMinimapDrag();
}

function drawMinimap(med, ages) {
  if (!minimapCtx) return;
  const c = minimapCtx;
  const W = c.canvas.width, H = c.canvas.height;
  c.clearRect(0, 0, W, H);

  // Background grid lines
  c.strokeStyle = 'rgba(30,48,74,0.6)';
  c.lineWidth = 0.5;
  [0.25, 0.5, 0.75].forEach(f => {
    c.beginPath(); c.moveTo(0, H * (1 - f)); c.lineTo(W, H * (1 - f)); c.stroke();
  });

  const maxV = Math.max(...med.filter(v => isFinite(v) && v > 0));
  if (!maxV) return;

  // Fill area under curve
  c.beginPath();
  med.forEach((v, i) => {
    if (!isFinite(v) || v < 0) v = 0;
    const x = i / (med.length - 1) * W;
    const y = H - (v / maxV) * (H - 6) - 3;
    i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
  });
  c.lineTo(W, H); c.lineTo(0, H); c.closePath();
  c.fillStyle = 'rgba(0,212,255,0.06)';
  c.fill();

  // Line
  c.beginPath();
  med.forEach((v, i) => {
    if (!isFinite(v) || v < 0) v = 0;
    const x = i / (med.length - 1) * W;
    const y = H - (v / maxV) * (H - 6) - 3;
    i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
  });
  c.strokeStyle = 'rgba(0,212,255,0.7)';
  c.lineWidth = 1.5;
  c.stroke();
}

function updateMinimapViewport(chart) {
  if (!window._lastSimData) return;
  const { med, ages } = window._lastSimData;
  drawMinimap(med, ages);
  // With no zoom plugin, the full chart is always visible → viewport = 100%
  const vp = document.getElementById('minimap-viewport');
  if (vp) {
    vp.style.left = '0%';
    vp.style.width = '100%';
  }
}

// Keep old name as alias for compatibility
function updateMinimap(chart) { updateMinimapViewport(chart); }

function setupMinimapDrag() {
  const container = document.getElementById('minimap-container');
  if (!container) return;

  // Re-attach listeners by cloning
  const fresh = container.cloneNode(true);
  container.replaceWith(fresh);
  const mc = document.getElementById('minimap-container');
  if (!mc) return;

  // Cursor indicator line
  let cursorLine = mc.querySelector('.minimap-cursor');
  if (!cursorLine) {
    cursorLine = document.createElement('div');
    cursorLine.className = 'minimap-cursor';
    cursorLine.style.cssText = 'position:absolute;top:0;bottom:0;width:2px;background:rgba(255,209,102,.8);pointer-events:none;display:none;';
    mc.appendChild(cursorLine);
  }

  function getXFraction(e) {
    const rect = mc.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }

  function highlightAge(frac) {
    if (!chartInstance || !window._lastSimData) return;
    const { ages } = window._lastSimData;
    const ageIdx = Math.round(frac * (ages.length - 1));
    const targetAge = ages[ageIdx];

    // Move cursor line
    cursorLine.style.left = (frac * 100) + '%';
    cursorLine.style.display = 'block';

    // Trigger chart tooltip at that data index
    const xScale = chartInstance.scales.x;
    if (!xScale) return;
    try {
      const xPx = xScale.getPixelForValue(targetAge);
      const chartArea = chartInstance.chartArea;
      const yMid = (chartArea.top + chartArea.bottom) / 2;
      chartInstance.tooltip.setActiveElements(
        chartInstance.data.datasets.map((_, di) => ({ datasetIndex: di, index: ageIdx })),
        { x: xPx, y: yMid }
      );
      chartInstance.update('none');
    } catch(e) {}
  }

  function clearHighlight() {
    cursorLine.style.display = 'none';
    if (chartInstance) {
      try {
        chartInstance.tooltip.setActiveElements([], {x:0,y:0});
        chartInstance.update('none');
      } catch(e) {}
    }
    _minimapDragging = false;
  }

  mc.addEventListener('mousedown', e => { _minimapDragging = true; highlightAge(getXFraction(e)); e.preventDefault(); });
  mc.addEventListener('mousemove', e => { if (_minimapDragging) { highlightAge(getXFraction(e)); e.preventDefault(); } });
  mc.addEventListener('mouseup',   clearHighlight);
  mc.addEventListener('mouseleave',() => { if (_minimapDragging) clearHighlight(); });
  mc.addEventListener('touchstart', e => { _minimapDragging = true; highlightAge(getXFraction(e)); e.preventDefault(); }, { passive: false });
  mc.addEventListener('touchmove',  e => { if (_minimapDragging) { highlightAge(getXFraction(e)); e.preventDefault(); } }, { passive: false });
  mc.addEventListener('touchend',   clearHighlight);
}

// ---- 5. PNG SAVE WITH PARAMS ----
function saveChartPNG() {
  if (!chartInstance) { alert('先にシミュレーションを実行してください'); return; }
  const canvas = document.getElementById('myChart');
  if (!canvas) return;

  // Create offscreen canvas with params text
  const margin = 120;
  const oc = document.createElement('canvas');
  oc.width = canvas.width;
  oc.height = canvas.height + margin;
  const ctx = oc.getContext('2d');

  // Background
  ctx.fillStyle = '#050810';
  ctx.fillRect(0, 0, oc.width, oc.height);

  // Chart image
  ctx.drawImage(canvas, 0, 0);

  // Parameter text
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '11px monospace';
  const params = [
    `年齢: ${document.getElementById('start-age')?.value}歳`,
    `資産: ${document.getElementById('initial-assets')?.value}万円`,
    `FIRE目標: ${document.getElementById('fire-threshold')?.value}万円`,
    `年収: ${document.getElementById('income')?.value}万円`,
    `難易度: ${typeof currentDifficulty !== 'undefined' ? currentDifficulty : '-'}`,
    `試行数: ${document.getElementById('nsims')?.value}`,
    `生成: ${new Date().toLocaleString('ja-JP')}`,
    `FIREシミュレーター v17`
  ];
  params.forEach((p, i) => {
    ctx.fillText(p, 12 + (i % 4) * (oc.width / 4), canvas.height + 16 + Math.floor(i / 4) * 20);
  });

  const link = document.createElement('a');
  link.download = `fire_sim_${Date.now()}.png`;
  link.href = oc.toDataURL('image/png');
  link.click();
}

// ---- CSV EXPORT ----
function exportSimCSV() {
  if (!window._lastSimData) {
    alert('先にシミュレーションを実行してください。');
    return;
  }
  const { med, p10, p25, p75, p90, ages, label } = window._lastSimData;
  const rows = [['年齢', '10パーセンタイル(億)', '25パーセンタイル(億)', '中央値(億)', '75パーセンタイル(億)', '90パーセンタイル(億)']];
  const toOku = v => (v / 1e8).toFixed(4);
  if (ages && med) {
    for (let i = 0; i < ages.length; i++) {
      rows.push([
        ages[i],
        toOku(p10?.[i] ?? 0),
        toOku(p25?.[i] ?? 0),
        toOku(med[i] ?? 0),
        toOku(p75?.[i] ?? 0),
        toOku(p90?.[i] ?? 0),
      ]);
    }
  }
  const csv = rows.map(r => r.join(',')).join('\n');
  const bom = '\uFEFF'; // Excel対応UTF-8 BOM
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fire_sim_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  flashBadge('CSV出力 ✓', '#a8ff78');
}
let _sigmaBandDatasets = [];
function toggleSigmaBands() {
  const btn = document.getElementById('chart-sigma-btn');
  _sigmaBandsOn = !_sigmaBandsOn;
  if (btn) btn.classList.toggle('active', _sigmaBandsOn);

  if (!chartInstance || !window._lastSimData) return;
  const { p90, p10, p75, p25, ages } = window._lastSimData;

  if (_sigmaBandsOn) {
    // Add ±1σ approximation bands
    const p10DS = { label: '▼ P10シャドウ', data: Array.from(p10), borderColor: 'transparent', backgroundColor: 'rgba(255,71,87,0.08)', borderWidth: 0, pointRadius: 0, fill: '+1', tension: 0.3, _sigma: true };
    const p90DS = { label: '▲ P90シャドウ', data: Array.from(p90), borderColor: 'transparent', backgroundColor: 'rgba(168,255,120,0.06)', borderWidth: 0, pointRadius: 0, fill: false, tension: 0.3, _sigma: true };
    chartInstance.data.datasets.push(p10DS, p90DS);
    chartInstance.update('none');
  } else {
    chartInstance.data.datasets = chartInstance.data.datasets.filter(d => !d._sigma);
    chartInstance.update('none');
  }
}

// ---- 7. SPECULATIVE RENDERING (fast preview during slider drag) ----
let _sliderDragActive = false;
let _sliderDebounce = null;
let _baselineMedian = null;

document.addEventListener('mousedown', e => {
  if (e.target.type === 'range') _sliderDragActive = true;
});
document.addEventListener('mouseup', () => { _sliderDragActive = false; });
document.addEventListener('touchstart', e => {
  if (e.target.type === 'range') _sliderDragActive = true;
}, { passive: true });
document.addEventListener('touchend', () => { _sliderDragActive = false; });

// Quick preview: update chart line color/label only while dragging
document.addEventListener('input', e => {
  if (!e.target.matches('input[type="range"]') || !chartInstance || !window._lastSimData) return;
  // Store baseline on first drag
  if (!_baselineMedian) _baselineMedian = [...window._lastSimData.med];

  // Show delta tooltip
  showSliderDelta(e.target);
});

function showSliderDelta(slider) {
  const tt = document.getElementById('slider-delta-tooltip');
  if (!tt || !_baselineMedian || !window._lastSimData) return;
  const curMed = window._lastSimData.med;
  if (!curMed || !curMed.length) return;
  const midIdx = Math.floor(curMed.length / 2);
  const delta = ((curMed[midIdx] || 0) - (_baselineMedian[midIdx] || 0)) * 10000;
  const sign = delta >= 0 ? '+' : '';
  tt.textContent = `中間期差分: ${sign}${Math.round(delta).toLocaleString()}万円`;
  tt.classList.add('show');
  const rect = slider.getBoundingClientRect();
  tt.style.left = (rect.left + rect.width / 2 - 60) + 'px';
  tt.style.top = (rect.top - 44 + window.scrollY) + 'px';
  clearTimeout(tt._t);
  tt._t = setTimeout(() => tt.classList.remove('show'), 2000);
}

// ============================================================
// スライダーと数値入力ボックスを完全に連動させる
(function() {
  const MIN = 0, MAX = 10000, STEP = 10;
  const rangeEl = document.getElementById('initial-assets');
  const numEl   = document.getElementById('num-initial-assets');
  const hiddenEl = document.getElementById('val-initial-assets');

  function clamp(v) {
    v = Math.round(v / STEP) * STEP;
    return Math.min(MAX, Math.max(MIN, v));
  }

  function sync(val) {
    val = clamp(val);
    rangeEl.value   = val;
    numEl.value     = val;
    hiddenEl.textContent = val;
    // スライダーの塗りも更新
    const pct = ((val - MIN) / (MAX - MIN) * 100).toFixed(1);
    rangeEl.style.setProperty('--pct', pct + '%');
  }

  // スライダー操作
  rangeEl.addEventListener('input', () => sync(parseInt(rangeEl.value)));

  // 数値ボックス：入力中はスライダーだけ追従（確定はしない）
  numEl.addEventListener('input', () => {
    const v = parseInt(numEl.value);
    if (!isNaN(v) && v >= MIN && v <= MAX) {
      const snapped = clamp(v);
      rangeEl.value = snapped;
      hiddenEl.textContent = snapped;
      const pct = ((snapped - MIN) / (MAX - MIN) * 100).toFixed(1);
      rangeEl.style.setProperty('--pct', pct + '%');
    }
  });

  // フォーカスを外した時に値を確定・補正
  numEl.addEventListener('blur', () => {
    const v = parseInt(numEl.value);
    sync(isNaN(v) ? MIN : v);
  });

  // Enterキーでも確定
  numEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') numEl.blur();
  });

  sync(parseInt(rangeEl.value)); // 初期同期
})();


// 感度分析（ヒートマップ）実行関数
// 修正版：感度分析実行関数
// 1. まず計算表を更新する関数を「独立」して定義する
function updateRegimeTable() {
  const grid   = document.getElementById('regime-cards-grid');
  const footer = document.getElementById('regime-table-footer');
  if (!grid) return;

  const meta = [
    { emoji:'🐂', label:'強気相場',    color:'#a8ff78', border:'rgba(168,255,120,0.3)', bg:'rgba(168,255,120,0.06)' },
    { emoji:'📈', label:'通常相場',    color:'#00d4ff', border:'rgba(0,212,255,0.3)',   bg:'rgba(0,212,255,0.06)'   },
    { emoji:'🐻', label:'弱気相場',    color:'#ff4757', border:'rgba(255,71,87,0.3)',   bg:'rgba(255,71,87,0.06)'   },
    { emoji:'🔥', label:'インフレ相場', color:'#ffd166', border:'rgba(255,209,102,0.3)', bg:'rgba(255,209,102,0.06)' },
  ];

  // 定常分布
  let stDist = [0.25, 0.25, 0.25, 0.25];
  try {
    const raw = computeStationaryDist(tmValues);
    const sum = raw.reduce((a,b)=>a+b,0);
    stDist = raw.map(v=>v/sum);
  } catch(e) {}

  const p  = v => (v*100).toFixed(1)+'%';
  const pp = v => (v>=0?'+':'')+(v*100).toFixed(1)+'%';
  const col = v => v>=0.05?'#a8ff78':v>=0?'#ffd166':'#ff4757';

  grid.innerHTML = '';

  REGIMES.forEach((rg, i) => {
    const m    = meta[i];
    const muS  = rg.mu[0];
    const sigS = rg.sigma[0];
    const gs   = muS - sigS*sigS/2;
    const gb   = rg.mu[1] - rg.sigma[1]*rg.sigma[1]/2;
    const prem = gs - gb;
    const inf  = rg.inf || 0;
    const wt   = stDist[i];

    const card = document.createElement('div');
    card.style.cssText = `
      background:${m.bg};
      border:1px solid ${m.border};
      border-radius:8px;
      padding:12px 10px;
      font-family:var(--font-mono);
      min-width:0;
    `;
    card.innerHTML = `
      <!-- ヘッダー -->
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;border-bottom:1px solid ${m.border};padding-bottom:8px;">
        <span style="font-size:20px;">${m.emoji}</span>
        <div>
          <div style="font-size:13px;font-weight:700;color:${m.color};">${m.label}</div>
          <div style="font-size:11px;color:var(--text-dim);margin-top:1px;">定常確率 <b style="color:${m.color};">${(wt*100).toFixed(0)}%</b></div>
        </div>
      </div>
      <!-- 指標グリッド -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
        <div style="background:rgba(0,0,0,0.2);border-radius:4px;padding:6px 8px;">
          <div style="font-size:10px;color:var(--text-dim);margin-bottom:3px;">株式G★</div>
          <div style="font-size:16px;font-weight:700;color:${col(gs)};">${p(gs)}</div>
        </div>
        <div style="background:rgba(0,0,0,0.2);border-radius:4px;padding:6px 8px;">
          <div style="font-size:10px;color:var(--text-dim);margin-bottom:3px;">σ（ボラ）</div>
          <div style="font-size:16px;font-weight:700;color:var(--text);">${p(sigS)}</div>
        </div>
        <div style="background:rgba(0,0,0,0.2);border-radius:4px;padding:6px 8px;">
          <div style="font-size:10px;color:var(--text-dim);margin-bottom:3px;">プレミアム</div>
          <div style="font-size:14px;font-weight:700;color:${col(prem)};">${pp(prem)}</div>
        </div>
        <div style="background:rgba(0,0,0,0.2);border-radius:4px;padding:6px 8px;">
          <div style="font-size:10px;color:var(--text-dim);margin-bottom:3px;">インフレ超過</div>
          <div style="font-size:14px;font-weight:700;color:${inf>0.005?'#ff9a3c':inf<-0.005?'#00d4ff':'var(--text-dim)'};">${pp(inf)}</div>
        </div>
      </div>
      <!-- μ補足 -->
      <div style="margin-top:8px;font-size:10px;color:var(--text-dim);text-align:right;">μ(算術)=${p(muS)} / 債券G=${p(gb)}</div>
    `;
    grid.appendChild(card);
  });

  // 長期期待値（加重平均）
  let wGS=0, wGB=0, wPrem=0, wSig=0, wInf=0;
  REGIMES.forEach((rg,i)=>{
    const w  = stDist[i];
    const gs = rg.mu[0] - rg.sigma[0]*rg.sigma[0]/2;
    const gb = rg.mu[1] - rg.sigma[1]*rg.sigma[1]/2;
    wGS   += w*gs;
    wGB   += w*gb;
    wPrem += w*(gs-gb);
    wSig  += w*rg.sigma[0];
    wInf  += w*(rg.inf||0);
  });

  if (footer) {
    footer.innerHTML = `
      <div style="font-size:12px;font-weight:700;color:var(--accent);margin-bottom:8px;">⚖️ 長期期待値（定常分布で加重平均）</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:8px;margin-bottom:8px;">
        <div style="text-align:center;">
          <div style="font-size:10px;color:var(--text-dim);">株式G（幾何）</div>
          <div style="font-size:18px;font-weight:700;color:${col(wGS)};">${p(wGS)}</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:10px;color:var(--text-dim);">σ（ボラ）</div>
          <div style="font-size:18px;font-weight:700;color:var(--text);">${p(wSig)}</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:10px;color:var(--text-dim);">株式プレミアム</div>
          <div style="font-size:18px;font-weight:700;color:${col(wPrem)};">${pp(wPrem)}</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:10px;color:var(--text-dim);">インフレ超過</div>
          <div style="font-size:18px;font-weight:700;color:var(--text-dim);">${pp(wInf)}</div>
        </div>
      </div>
      <div style="font-size:11px;color:var(--text-dim);border-top:1px solid var(--border);padding-top:8px;">
        💡 <b style="color:var(--accent);">株式G★</b> = μ − σ²/2。複利効果でσが大きいほど算術平均より低くなります。例えばμ=10%・σ=15%なら G≈${p(0.10-0.15*0.15/2)}。長期投資の実績はこちらで評価してください。
      </div>
    `;
  }
}

/**
 * renderRegimeDashboard — updateRegimeTable のエイリアス。
 *
 * simulation.js は _simCallbacks.renderRegimeDashboard() 経由でこの関数を呼ぶ。
 * app.js の initSimCallbacks に渡す際、ui.js 側に実装がなかった経緯から
 * charts.js で updateRegimeTable と同一の処理として定義する。
 * 将来 ui.js でより高機能な実装に差し替える場合はこの関数を上書きすること。
 */
function renderRegimeDashboard() {
  updateRegimeTable();
}

  // 定常分布を取得（なければ均等分布）
  let stDist = [0.25, 0.25, 0.25, 0.25];
  try {
    stDist = computeStationaryDist(tmValues);
    const sum = stDist.reduce((a,b)=>a+b,0);
    stDist = stDist.map(v=>v/sum);
  } catch(e) {}

// 2. 感度分析実行関数
// ============================================================
// ヒートマップ感度分析
// ============================================================
let heatmapChartInstance = null;

async function runSensitivityAnalysis() {
  const btn          = document.getElementById('btn-heat-analysis');
  const progWrap     = document.getElementById('heat-progress-container');
  const progBar      = document.getElementById('heat-progress-bar');
  const progPct      = document.getElementById('heat-progress-pct');
  const heatWrap     = document.getElementById('heatmap-wrap');
  const insightBox   = document.getElementById('heatmap-insight-box');

  btn.disabled = true;
  btn.textContent = '⏳ 計算中…';
  progWrap.style.display = 'block';
  progBar.style.width = '0%';
  if (progPct) progPct.textContent = '0%';
  heatWrap.style.display = 'none';
  insightBox.style.display = 'none';

  // 現在の設定をバックアップ
  const curWork = parseInt(document.getElementById('w-working').value);
  const curRet  = parseInt(document.getElementById('w-retired').value);

  const ratioSteps = [0, 20, 40, 60, 80, 100]; // %表示
  const n = ratioSteps.length;
  // grid[i][j] = 現役i% × FIRE後j% の成功率
  const grid = Array.from({length:n}, ()=>new Array(n).fill(0));

  const total = n * n;
  let done = 0;

  try {
    for (let i=0; i<n; i++) {
      for (let j=0; j<n; j++) {
        grid[i][j] = await runLightweightSim(ratioSteps[i]/100, ratioSteps[j]/100);
        done++;
        const pct = Math.round(done/total*100);
        progBar.style.width = pct + '%';
        if (progPct) progPct.textContent = pct + '%';
        await new Promise(r=>setTimeout(r,0));
      }
    }

    // Chart.js でヒートマップ描画
    drawHeatmapChart(ratioSteps, grid, curWork, curRet);
    heatWrap.style.display = 'block';

    // インサイト表示
    displayHeatmapInsight(ratioSteps, grid, curWork, curRet);
    insightBox.style.display = 'block';

  } catch(e) {
    console.error('ヒートマップエラー:', e);
    const container = document.getElementById('heatmap-canvas-container');
    if (container) {
      container.innerHTML = `<div style="padding:24px;text-align:center;color:var(--danger);font-family:var(--font-mono);font-size:12px;">
        ⚠️ ヒートマップ計算エラー<br><span style="color:var(--text-dim);font-size:11px;">${e.message || e}</span>
      </div>`;
    }
  } finally {
    btn.disabled = false;
    btn.textContent = '🔥 再実行';
    setTimeout(()=>{ progWrap.style.display='none'; }, 600);
  }
}

function drawHeatmapChart(ratioSteps, grid, curWork, curRet) {
  // 既存インスタンスを破棄して canvas を作り直す
  if (heatmapChartInstance) { heatmapChartInstance.destroy(); heatmapChartInstance = null; }
  const old = document.getElementById('sensitivityHeatmap');
  if (old) old.remove();
  const canvas = document.createElement('canvas');
  canvas.id = 'sensitivityHeatmap';
  const container = document.getElementById('heatmap-canvas-container');
  if (!container) { console.error('heatmap-canvas-container not found'); return; }
  container.appendChild(canvas);

  const n = ratioSteps.length;

  const containerWidth = container.offsetWidth || 300;
  const bubbleR = Math.max(12, Math.min(20, Math.floor(containerWidth / (n * 2.5))));

  const bubbleData = [];
  for (let i=0; i<n; i++) {
    for (let j=0; j<n; j++) {
      bubbleData.push({
        x: ratioSteps[j],
        y: ratioSteps[i],
        r: bubbleR,
        val: grid[i][j],
      });
    }
  }

  const rateToColor = (v, alpha=0.85) => {
    const h = Math.round(v * 120);
    return `hsla(${h},70%,45%,${alpha})`;
  };

  // 現在のユーザー設定が格子点と一致しているか
  const isExact = ratioSteps.includes(curWork) && ratioSteps.includes(curRet);

  heatmapChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'bubble',
    data: {
      datasets: [{
        data: bubbleData,
        backgroundColor: bubbleData.map(d=>rateToColor(d.val)),
        borderColor:     bubbleData.map(d=>rateToColor(d.val, 1)),
        borderWidth: 1,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 1.05,
      layout: { padding: { top:8, right:8, bottom:4, left:4 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: ()=>'',
            label: ctx => {
              const d = ctx.raw;
              return [
                `現役時: ${d.y}%  /  FIRE後: ${d.x}%`,
                `FIRE成功率: ${(d.val*100).toFixed(1)}%`,
              ];
            },
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          min: -10,
          max: 110,
          border: { display: true, color: '#3a5070', width: 1 },
          grid: {
            display: true,
            drawOnChartArea: true,
            drawTicks: true,
            color: ctx => ratioSteps.includes(ctx.tick?.value) ? 'rgba(58,80,112,0.8)' : 'transparent',
            lineWidth: 1,
          },
          ticks: {
            stepSize: 20,
            color: '#8a9fba',
            font: { size: 11, family: 'Space Mono, monospace' },
            callback: v => ratioSteps.includes(v) ? v + '%' : '',
          },
          title: {
            display: true,
            text: '← FIRE後 株式比率 →',
            color: '#8a9fba',
            font: { size: 12, family: 'Space Mono, monospace' },
            padding: { top: 8 },
          },
        },
        y: {
          type: 'linear',
          min: -10,
          max: 110,
          border: { display: true, color: '#3a5070', width: 1 },
          grid: {
            display: true,
            drawOnChartArea: true,
            drawTicks: true,
            color: ctx => ratioSteps.includes(ctx.tick?.value) ? 'rgba(58,80,112,0.8)' : 'transparent',
            lineWidth: 1,
          },
          ticks: {
            stepSize: 20,
            color: '#8a9fba',
            font: { size: 11, family: 'Space Mono, monospace' },
            callback: v => ratioSteps.includes(v) ? v + '%' : '',
            maxTicksLimit: 8,
          },
          title: {
            display: true,
            text: '← 現役時 株式比率 →',
            color: '#8a9fba',
            font: { size: 11, family: 'Space Mono, monospace' },
            padding: { bottom: 4 },
          },
        },
      },
    },
    plugins: [
      {
        // セル内に成功率テキストを描画
        id: 'cellLabels',
        afterDatasetsDraw(chart) {
          const {ctx} = chart;
          const fontSize = Math.max(9, Math.min(12, bubbleR - 3));
          chart.getDatasetMeta(0).data.forEach((pt, idx) => {
            const d = bubbleData[idx];
            const text = `${(d.val*100).toFixed(0)}%`;
            ctx.save();
            ctx.font = `bold ${fontSize}px 'Space Mono', monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = d.val > 0.5 ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.9)';
            ctx.fillText(text, pt.x, pt.y);
            ctx.restore();
          });
        },
      },
      {
        // 現在のユーザー設定位置にマーカーを描画
        id: 'userMarker',
        afterDatasetsDraw(chart) {
          const { ctx, scales } = chart;
          if (curWork == null || curRet == null) return;
          const px = scales.x.getPixelForValue(curRet);  // X = FIRE後
          const py = scales.y.getPixelForValue(curWork);  // Y = 現役
          ctx.save();

          if (isExact) {
            // 格子点と一致 → 白い輪郭リング
            ctx.beginPath();
            ctx.arc(px, py, 22, 0, Math.PI*2);
            ctx.strokeStyle = 'rgba(255,255,255,0.9)';
            ctx.lineWidth = 2.5;
            ctx.setLineDash([]);
            ctx.stroke();
          } else {
            // 格子点外 → 破線の十字マーカー
            const arm = 16;
            ctx.strokeStyle = 'rgba(255,255,255,0.85)';
            ctx.lineWidth = 2;
            ctx.setLineDash([4,3]);
            // 横線
            ctx.beginPath(); ctx.moveTo(px-arm, py); ctx.lineTo(px+arm, py); ctx.stroke();
            // 縦線
            ctx.beginPath(); ctx.moveTo(px, py-arm); ctx.lineTo(px, py+arm); ctx.stroke();
            ctx.setLineDash([]);
            // 中心の小円
            ctx.beginPath();
            ctx.arc(px, py, 4, 0, Math.PI*2);
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.fill();
            // 近似格子点への破線矢印
            const getNearStep = val => ratioSteps.reduce((p,c,i) =>
              Math.abs(c-val)<Math.abs(ratioSteps[p]-val)?i:p, 0);
            const nearRet  = ratioSteps[getNearStep(curRet)];
            const nearWork = ratioSteps[getNearStep(curWork)];
            const npx = scales.x.getPixelForValue(nearRet);
            const npy = scales.y.getPixelForValue(nearWork);
            ctx.strokeStyle = 'rgba(255,209,102,0.6)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3,4]);
            ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(npx, npy); ctx.stroke();
            ctx.setLineDash([]);
          }

          // 「現在の設定」ラベル
          ctx.font = `bold 10px 'Space Mono', monospace`;
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.textAlign = 'center';
          ctx.fillText('現在', px, py + 30);
          ctx.restore();
        },
      },
    ],
  });
}

function displayHeatmapInsight(ratioSteps, grid, curWork, curRet) {
  const n = ratioSteps.length;
  const ticks = ratioSteps; // [0,20,40,60,80,100]

  // 最高・最低成功率のセルを探す
  let maxVal=-1, minVal=2, bestW=0, bestR=0, worstW=0, worstR=0;
  for (let i=0; i<n; i++) {
    for (let j=0; j<n; j++) {
      if (grid[i][j] > maxVal) { maxVal=grid[i][j]; bestW=ticks[i]; bestR=ticks[j]; }
      if (grid[i][j] < minVal) { minVal=grid[i][j]; worstW=ticks[i]; worstR=ticks[j]; }
    }
  }

  // ── 近似値判定ロジック ──
  const getNearIdx = val => ticks.reduce((prev,curr,idx) =>
    Math.abs(curr-val) < Math.abs(ticks[prev]-val) ? idx : prev, 0);
  const wIdx = getNearIdx(curWork);
  const rIdx = getNearIdx(curRet);
  const isExact = ticks.includes(curWork) && ticks.includes(curRet);
  const nearWork = ticks[wIdx];
  const nearRet  = ticks[rIdx];
  const nearVal  = grid[wIdx][rIdx];

  // 現在の設定の成功率（格子点に一致していれば直接、でなければ近似値）
  const wi = ticks.indexOf(curWork);
  const ri = ticks.indexOf(curRet);
  const curVal = isExact ? grid[wi][ri] : nearVal;

  // 傾向分析
  const highEquityAvg = (grid[4][3]+grid[4][4]+grid[5][4]+grid[5][5])/4;
  const lowEquityAvg  = (grid[0][0]+grid[0][1]+grid[1][0]+grid[1][1])/4;

  // 推奨アドバイス
  let advice = '';
  if (curVal >= maxVal * 0.97) {
    advice = '✅ 現在の設定は統計的にほぼ最適です。このまま進めてください。';
  } else {
    const diff = ((maxVal - curVal)*100).toFixed(1);
    advice = `現在の設定は成功率 ${(curVal*100).toFixed(1)}%。`
           + `最適設定（現役${bestW}% / FIRE後${bestR}%）に変更すると約 <b>+${diff}pt</b> 改善できます。`;
  }

  // 近似値別の動的アドバイス
  let approxAdvice = '';
  if (nearVal > 0.90) {
    approxAdvice = `現在のリスク許容度は非常に安全圏にあります。暴落時（t分布の影響）を考慮しても、資産維持の可能性が極めて高い設定です。`;
  } else if (nearVal > 0.70) {
    approxAdvice = `標準的な成功率です。株式比率をあと20%下げても成功率が維持できるか、ヒートマップの左下方向を確認してください。`;
  } else {
    approxAdvice = `成功率が低下しています。ヒートマップで<b>緑色が濃いエリア</b>（一般的には現役時比率を高く維持する領域）へのシフトを検討してください。`;
  }

  const pctColor = v => v >= 0.8 ? '#a8ff78' : v >= 0.6 ? '#ffd166' : '#ff4757';

  const box = document.getElementById('heatmap-insight-box');
  box.innerHTML = `
    <div style="background:var(--surface2);border:1px solid var(--accent);border-radius:8px;padding:18px;animation:fadeIn .5s ease;">
      <div style="color:var(--accent);font-family:var(--font-mono);font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-bottom:14px;display:flex;align-items:center;gap:8px;">
        <span style="font-size:18px;">💡</span> 分析結果のインサイト
      </div>

      <!-- 3カラム KPI -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:16px;">
        <div style="background:var(--surface3);border-radius:6px;padding:12px;text-align:center;">
          <div style="font-size:10px;color:var(--text-dim);margin-bottom:4px;">最高成功率</div>
          <div style="font-size:22px;font-weight:700;font-family:var(--font-mono);color:#a8ff78;">${(maxVal*100).toFixed(0)}%</div>
          <div style="font-size:10px;color:var(--text-dim);margin-top:2px;">現役${bestW}% / 後${bestR}%</div>
        </div>
        <div style="background:var(--surface3);border-radius:6px;padding:12px;text-align:center;position:relative;">
          <div style="font-size:10px;color:var(--text-dim);margin-bottom:4px;">現在の設定${isExact?'':' ≈近似'}</div>
          <div style="font-size:22px;font-weight:700;font-family:var(--font-mono);color:${pctColor(curVal)};">${(curVal*100).toFixed(0)}%</div>
          <div style="font-size:10px;color:var(--text-dim);margin-top:2px;">現役${curWork}% / 後${curRet}%</div>
          ${!isExact ? `<div style="font-size:9px;color:var(--warning);margin-top:3px;">※近似点 (${nearWork}%/${nearRet}%)</div>` : ''}
        </div>
        <div style="background:var(--surface3);border-radius:6px;padding:12px;text-align:center;">
          <div style="font-size:10px;color:var(--text-dim);margin-bottom:4px;">最低成功率</div>
          <div style="font-size:22px;font-weight:700;font-family:var(--font-mono);color:#ff4757;">${(minVal*100).toFixed(0)}%</div>
          <div style="font-size:10px;color:var(--text-dim);margin-top:2px;">現役${worstW}% / 後${worstR}%</div>
        </div>
      </div>

      <!-- 近似値の注記（格子外の場合のみ） -->
      ${!isExact ? `
      <div style="padding:10px 12px;background:rgba(255,209,102,0.07);border:1px solid rgba(255,209,102,0.3);border-radius:6px;font-size:12px;color:var(--warning);margin-bottom:14px;line-height:1.8;">
        ⚠️ <b>近似値を参照しています</b><br>
        現在の設定（現役: <b>${curWork}%</b> / FIRE後: <b>${curRet}%</b>）はヒートマップの格子点（20%刻み）の間に位置するため、
        最も近い格子点（現役: <b>${nearWork}%</b> / FIRE後: <b>${nearRet}%</b>）のデータを参照しています。
        ヒートマップ上では破線の十字（✕）が現在の設定位置を示しています。
      </div>` : ''}

      <!-- テキストインサイト -->
      <div style="font-size:13px;line-height:1.9;color:var(--text);margin-bottom:14px;">
        <p style="margin-bottom:8px;">
          ${bestR < bestW
            ? '📉 <b>リタイア後は株式比率を下げる</b>ディフェンシブ戦略が有利です。引き出し期のシーケンス・オブ・リターン・リスクを抑制するためです。'
            : '📈 <b>リタイア後も高い株式比率</b>が有利です。長期的な資産成長がリスクを上回る設定になっています。'}
        </p>
        <p style="margin-bottom:8px;">
          ${highEquityAvg > lowEquityAvg
            ? `📊 全体的に<b>高株式比率エリア（80%+）</b>の成功率（平均 ${(highEquityAvg*100).toFixed(0)}%）が低株式比率（平均 ${(lowEquityAvg*100).toFixed(0)}%）を上回っています。`
            : `📊 全体的に<b>低株式比率エリア</b>の成功率（平均 ${(lowEquityAvg*100).toFixed(0)}%）が高株式比率（平均 ${(highEquityAvg*100).toFixed(0)}%）を上回っています。支出水準に対して安定性が優先される設定です。`}
        </p>
      </div>

      <!-- パーソナライズ・アドバイス -->
      <div style="padding:12px 14px;background:rgba(0,212,255,0.05);border:1px solid rgba(0,212,255,0.2);border-radius:6px;font-size:12px;line-height:1.8;color:var(--text);margin-bottom:10px;">
        <b style="color:var(--accent);">📊 パーソナライズ・アドバイス</b><br>
        ${!isExact ? `近似点（現役${nearWork}% / FIRE後${nearRet}%）でのFIRE成功率は <b style="color:${pctColor(nearVal)};font-size:15px;">${(nearVal*100).toFixed(1)}%</b>。<br>` : ''}
        ${approxAdvice}
      </div>

      <!-- 最適設定へのアドバイス -->
      <div style="padding:12px 14px;background:rgba(168,255,120,0.05);border:1px solid rgba(168,255,120,0.2);border-radius:6px;font-size:12px;line-height:1.8;color:var(--text);">
        <b style="color:#a8ff78;">現在の設定へのアドバイス：</b><br>
        ${advice}
      </div>
    </div>
  `;
}

// 旧drawHeatmap（canvas版）は互換性のため残す
function drawHeatmap(ctx, results, xLabels, yLabels) {}

// 感度分析用の進捗バー更新関数（互換）
function updateHeatProgress(current, total) {
  const pct = (current / total * 100);
  const bar = document.getElementById('heat-progress-bar');
  if (bar) bar.style.width = pct + '%';
  const el = document.getElementById('heat-progress-pct');
  if (el) el.textContent = Math.round(pct) + '%';
}
async function runLightweightSim(wWork, wRet) {
    // UI から最新値を取得（単位: スライダー値は「万円」なので ×10000 で円換算）
    const startAge       = parseInt(document.getElementById('start-age').value)        || 30;
    const initAssets     = parseInt(document.getElementById('initial-assets').value)   * 10000;
    const annualIncome   = parseInt(document.getElementById('income').value)            * 10000;
    // 税金計算エンジンで実効手取り率を算出（旧スライダー参照を廃止）
    const takeHome       = calcTax(annualIncome).rate;
    const raiseRate      = parseFloat(document.getElementById('raise').value)           / 100;
    const baseInfl       = parseFloat(document.getElementById('base-infl').value)       / 100;
    const monthlyPension = parseInt(document.getElementById('pension').value)            * 10000;
    const fireThr        = parseInt(document.getElementById('fire-threshold').value)    * 10000;
    const tDof           = parseInt(document.getElementById('tdof').value)               || 5;

    // FIRE達成後の退職年齢（メインシム実行済みなら中央値、未実行なら+20年）
    const retireAge = (lastMedianFireAge !== null) ? lastMedianFireAge : startAge + 20;

    const TM_local = tmValues.map(row => {
        const s = row.reduce((a,b) => a+b, 0) || 1;
        return row.map(v => v / s);
    });
    const REGIMES_local = REGIMES; // グローバル定数を参照



    const N = 200;
    let successCount = 0;

    for (let n = 0; n < N; n++) {
        let assets   = initAssets;
        let regIdx   = 1;  // 通常相場スタート
        let retired  = false;
        let bankrupt = false;
        let cumInf   = 1.0;

        for (let age = startAge; age <= 95; age++) {
            const t  = age - startAge;
            const rg = REGIMES_local[regIdx];
            const w  = retired ? wRet : wWork;

            // 1. 運用リターン（リバランス込み）
            const zS     = tRandom(tDof);
            const zB     = normalRandom();
            const zBcorr = rg.corr * zS + Math.sqrt(Math.max(0, 1 - rg.corr * rg.corr)) * zB;
            const retS   = rg.mu[0] + rg.sigma[0] * zS;
            const retB   = rg.mu[1] + rg.sigma[1] * zBcorr;
            assets *= (w * (1 + retS) + (1 - w) * (1 + retB));

            // 2. FIRE 判定
            if (!retired && assets >= fireThr) retired = true;

            // 3. 収入
            let income = 0;
            if (!retired && age < 60) {
                income = annualIncome * takeHome * Math.pow(1 + raiseRate, t);
            }
            if (age >= 65) {
                income += monthlyPension * 12 * 0.85; // 年金（手取り85%）
            }

            // 4. 支出（ライフステージ別 × インフレ累積）
            cumInf *= (1 + baseInfl + rg.inf);
            const expense = getExpenseForAge(age) * cumInf;

            // 5. 純キャッシュフロー反映
            assets += income - expense;

            // 6. レジーム遷移
            let r = Math.random(), s = 0;
            for (let ri = 0; ri < TM_local[regIdx].length; ri++) {
                s += TM_local[regIdx][ri];
                if (r < s) { regIdx = ri; break; }
            }

            if (assets <= 0) { bankrupt = true; break; }
        }
        if (!bankrupt) successCount++;
    }
    return successCount / N;
}



// グリッドサーチ実行と描画の統括（旧版・未使用）
async function executeGridSearch() {
    const steps = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
    let gridResults = [];
    const canvasEl = document.getElementById('heatmapCanvas');
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d');

    for (let i = 0; i < steps.length; i++) {
        for (let j = 0; j < steps.length; j++) {
            const wWork = steps[i];
            const wRet = steps[j];
            const sr = await runLightweightSim(wWork, wRet);
            gridResults.push({
                xIdx: j, // X軸：リタイア後
                yIdx: i, // Y軸：現役
                val: sr
            });
        }
    }
    drawHeatmap(ctx, gridResults, steps, steps);
}

// 描画関数のラベル更新
// 感度分析用の進捗バー更新関数（互換）
function updateHeatProgress(current, total) {
  const pct = (current / total * 100);
  const bar = document.getElementById('heat-progress-bar');
  if (bar) bar.style.width = pct + '%';
  const el = document.getElementById('heat-progress-pct');
  if (el) el.textContent = Math.round(pct) + '%';
}
//////////



// ============================================================
// ★ Fat-tail リスクアナライザー
// ============================================================
let ftChart = null;

function initFatTailAnalyzer() {
  const slider  = document.getElementById('ft-df-slider');
  const canvas  = document.getElementById('ft-chart');
  if (!slider || !canvas) return;
  if (ftChart) { ftChart.destroy(); ftChart = null; }

  // canvasにサイズを明示指定（スマホでoffsetWidth=0になる問題を防ぐ）
  // parentの実際の幅を使い、0なら600pxにフォールバック
  const ftParentW = canvas.parentElement?.offsetWidth || 600;
  canvas.width  = ftParentW > 0 ? ftParentW : 600;
  canvas.height = 280;
  canvas.style.width  = '100%';
  canvas.style.height = '240px';

  function lngamma(z) {
    return (z-0.5)*Math.log(z) - z + 0.5*Math.log(2*Math.PI);
  }
  function tPDF(x, df) {
    const t1 = Math.exp(lngamma((df+1)/2) - lngamma(df/2));
    const t2 = Math.sqrt(df * Math.PI);
    const t3 = Math.pow(1 + x*x/df, -(df+1)/2);
    return (t1/t2)*t3;
  }
  function normalPDF(x) {
    return Math.exp(-0.5*x*x) / Math.sqrt(2*Math.PI);
  }

  const xs      = Array.from({length:101}, (_,i) => -5 + i*0.1);
  const xlabels = xs.map(x => x.toFixed(1));
  const normData = xs.map(x => normalPDF(x));

  ftChart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: xlabels,
      datasets: [
        {
          label: 't分布（現実的リスク）',
          data: [],
          borderColor: '#00d4ff',
          borderWidth: 2.5,
          backgroundColor: 'rgba(0,212,255,0.07)',
          fill: true,
          pointRadius: 0,
          tension: 0.3,
        },
        {
          label: '正規分布（楽観的）',
          data: normData,
          borderColor: '#5a7090',
          borderWidth: 1.5,
          borderDash: [5,4],
          pointRadius: 0,
          fill: false,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 150 },
      plugins: {
        legend: { labels:{ color:'#8a9fba', font:{size:11} } },
        tooltip: { enabled: false },
      },
      scales: {
        x: {
          grid: { color:'rgba(26,45,74,0.6)' },
          ticks: {
            color:'#5a7090', font:{size:10}, maxTicksLimit:11,
            callback: (_, i) => i%10===0 ? xs[i].toFixed(0) : '',
          },
          title: { display:true, text:'変動の大きさ（σ）', color:'#5a7090', font:{size:11} },
        },
        y: {
          max: 0.42,
          grid: { color:'rgba(26,45,74,0.6)' },
          ticks: { display:false },
        },
      },
    },
  });

  function updateFT() {
    const df = parseFloat(slider.value);
    document.getElementById('ft-df-display').textContent = df.toFixed(1);
    ftChart.data.datasets[0].data = xs.map(x => tPDF(x, df));
    ftChart.update('none');
    const typeEl = document.getElementById('ft-dist-type');
    if (df < 4) {
      typeEl.textContent = 'Extreme Fat-tail 💀'; typeEl.style.color = '#ff4757';
    } else if (df < 10) {
      typeEl.textContent = 'Moderate Fat-tail 📉'; typeEl.style.color = '#ffd166';
    } else if (df < 20) {
      typeEl.textContent = 'Mild Fat-tail 📊'; typeEl.style.color = '#00d4ff';
    } else {
      typeEl.textContent = 'Near Normal ✅'; typeEl.style.color = '#a8ff78';
    }
  }

  // 重複登録を防ぐため一度解除してから再登録
  slider.removeEventListener('input', slider._ftHandler);
  slider._ftHandler = updateFT;
  slider.addEventListener('input', updateFT);
  updateFT();
}


// ============================================================
// ★ ボラティリティ・ドラッグ体験ツール
// ============================================================
let vdChart = null;

function initVolatilityDragExplorer() {
  const muEl    = document.getElementById('vd-mu');
  const sigmaEl = document.getElementById('vd-sigma');
  const canvas  = document.getElementById('vd-chart');
  if (!muEl || !sigmaEl || !canvas) return;

  if (vdChart) { vdChart.destroy(); vdChart = null; }

  // canvasにサイズを明示指定
  const vdParentW = canvas.parentElement?.offsetWidth || 600;
  canvas.width  = vdParentW > 0 ? vdParentW : 600;
  canvas.height = 200;
  canvas.style.width  = '100%';
  canvas.style.height = '200px';

  const years = Array.from({length:21}, (_,i) => i);

  vdChart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: years,
      datasets: [
        {
          label: '算術平均ベース（幻の成長）',
          borderColor: '#5a7090',
          backgroundColor: 'transparent',
          borderDash: [5,3],
          borderWidth: 1.5,
          data: [],
          pointRadius: 0,
          tension: 0.1,
        },
        {
          label: '幾何平均ベース（実際の成長）★',
          borderColor: '#00d4ff',
          backgroundColor: 'rgba(0,212,255,0.08)',
          borderWidth: 2,
          data: [],
          pointRadius: 0,
          fill: true,
          tension: 0.1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 200 },
      plugins: {
        legend: { labels: { color:'#8a9fba', font:{size:11}, boxWidth:20 } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}万円`,
          },
        },
      },
      scales: {
        x: {
          grid: { color:'rgba(26,45,74,0.6)' },
          ticks: { color:'#5a7090', font:{size:10} },
          title: { display:true, text:'経過年数', color:'#5a7090', font:{size:11} },
        },
        y: {
          grid: { color:'rgba(26,45,74,0.6)' },
          ticks: { color:'#5a7090', font:{size:10}, callback: v => v+'万' },
          title: { display:true, text:'資産（初期100万円）', color:'#5a7090', font:{size:11} },
        },
      },
    },
  });

  function updateVD() {
    const mu    = parseFloat(muEl.value) / 100;
    const sigma = parseFloat(sigmaEl.value) / 100;
    const gs    = mu - sigma*sigma/2;
    const drag  = mu - gs;

    // 表示更新
    document.getElementById('vd-mu-val').textContent    = (mu*100).toFixed(1)+'%';
    document.getElementById('vd-sigma-val').textContent = (sigma*100).toFixed(1)+'%';
    document.getElementById('vd-arithmetic').textContent= (mu*100).toFixed(2)+'%';
    document.getElementById('vd-geometric').textContent = (gs*100).toFixed(2)+'%';
    document.getElementById('vd-geometric').style.color = gs >= 0.03 ? '#a8ff78' : gs >= 0 ? '#ffd166' : '#ff4757';
    document.getElementById('vd-formula').textContent   =
      `${(mu*100).toFixed(1)}% − (${(sigma*100).toFixed(1)}%²/2) = ${(gs*100).toFixed(2)}%`;
    document.getElementById('vd-drag-val').textContent  = `−${(drag*100).toFixed(2)}%`;
    const barPct = Math.min(100, drag/0.15*100);
    document.getElementById('vd-drag-bar').style.width  = Math.max(0, barPct)+'%';

    // グラフデータ
    const arithmetic = years.map(i => 100 * Math.pow(1+mu, i));
    const geometric  = years.map(i => 100 * Math.pow(1+gs, i));
    vdChart.data.datasets[0].data = arithmetic;
    vdChart.data.datasets[1].data = geometric;
    vdChart.update();
  }

  // 重複登録を防ぐため一度解除してから再登録
  muEl.removeEventListener('input', muEl._vdHandler);
  sigmaEl.removeEventListener('input', sigmaEl._vdHandler);
  muEl._vdHandler    = updateVD;
  sigmaEl._vdHandler = updateVD;
  muEl.addEventListener('input', updateVD);
  sigmaEl.addEventListener('input', updateVD);
  updateVD();
}


// ============================================================
// initChartsCallbacks — charts.js のコールバック注入口
// ============================================================
let _chartsCallbacks = {};

function initChartsCallbacks(callbacks) {
  _chartsCallbacks = callbacks || {};
}


// ============================================================
// updateChartA11ySummary — チャートのアクセシブルテキストサマリー
//
// スクリーンリーダー利用者がチャートの内容を音声で把握できるよう、
// シミュレーション結果をテキストで要約して
// id="chart-a11y-summary" に挿入する。
//
// Chart.js の chart.canvas に aria-label + role="img" を付与し、
// <figure> の figcaption として詳細を提供するアプローチをとる。
//
// 引数:
//   stats — runSimulation が計算する統計オブジェクト:
//   {
//     startAge:       number,   // シミュ開始年齢
//     successRate:    number,   // 破綻しない確率（0〜1）
//     bankruptRate:   number,   // 破綻確率（0〜1）
//     medianFireAge:  string,   // FIRE中央値年齢文字列 or '未達成'
//     medianFinalAssets: number,// 死亡時資産中央値（億円）
//     medianDeathAge: string,   // 死亡年齢中央値文字列
//     pct10At65:      number,   // 65歳時 10パーセンタイル資産（億円）
//     pct90At65:      number,   // 65歳時 90パーセンタイル資産（億円）
//     medAt65:        number,   // 65歳時 中央値資産（億円）
//   }
// ============================================================
function updateChartA11ySummary(stats) {
  const el = document.getElementById('chart-a11y-summary');
  if (!el) return;

  const {
    startAge       = '—',
    successRate    = 0,
    bankruptRate   = 0,
    medianFireAge  = '—',
    medianFinalAssets = 0,
    medianDeathAge = '—',
    pct10At65      = 0,
    pct90At65      = 0,
    medAt65        = 0,
  } = stats;

  const pct  = v => (v * 100).toFixed(1) + '%';
  const oku  = v => {
    if (Math.abs(v) >= 1) return v.toFixed(2) + '億円';
    return Math.round(v * 10000).toLocaleString() + '万円';
  };

  const summaryText = [
    `シミュレーション開始年齢: ${startAge}歳。`,
    `老後破綻なしの確率（成功率）: ${pct(successRate)}。`,
    `破綻リスク: ${pct(bankruptRate)}。`,
    `FIRE達成年齢の中央値: ${medianFireAge}。`,
    `65歳時の資産中央値: ${oku(medAt65)}（悲観シナリオ10%: ${oku(pct10At65)}、楽観90%: ${oku(pct90At65)}）。`,
    `シミュレーション上の死亡年齢中央値: ${medianDeathAge}。`,
    `死亡時の資産中央値（遺産）: ${oku(medianFinalAssets)}。`,
  ].join(' ');

  // <details><summary> 形式で折り畳み表示
  el.innerHTML = `
    <details>
      <summary>グラフのテキストサマリー（スクリーンリーダー用）</summary>
      <p style="margin-top:8px;color:var(--text-mid);font-size:11px;line-height:1.8;">
        ${summaryText}
      </p>
    </details>`;
  el.style.display = 'block';

  // チャート canvas にも aria-label を付与（role="img" は Chart.js が自動設定）
  const canvas = document.getElementById('main-chart');
  if (canvas) {
    canvas.setAttribute('aria-label',
      `資産推移チャート。成功率 ${pct(successRate)}、65歳時中央値資産 ${oku(medAt65)}。`
    );
  }
}

// グローバル公開（app.js の expose リストへの追加は任意）
window.updateChartA11ySummary = updateChartA11ySummary;

// ============================================================
// ★ Fat-tail / Volatility-drag グラフ 初期化エントリーポイント
//
// 呼び出しタイミングが 3 つある:
//   1. DOMContentLoaded 時に保存モードが pro なら即時初期化
//   2. setMode('pro') が呼ばれた時（上記 setMode 内）
//   3. IntersectionObserver でキャンバスが画面内に入った時（遅延表示対策）
// ============================================================
(function setupFatTailAndVDInit() {
  // ── 初期化済みフラグ（二重初期化防止）──────────────────────
  // initFatTailAnalyzer / initVolatilityDragExplorer 内部で既に
  // ftChart / vdChart を null に destroy してから作り直すため、
  // 呼び出し回数が多くても問題ないが、不要な再生成を抑制する。

  // ── 1. DOMContentLoaded 時 ──────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    const savedMode = localStorage.getItem('fire_sim_mode') || 'beginner';
    if (savedMode === 'pro') {
      // setMode が同タイミングで呼ばれるため、1フレーム後に実行
      requestAnimationFrame(() => {
        initFatTailAnalyzer();
        initVolatilityDragExplorer();
      });
    }
  });

  // ── 2. window.load 後（スクリプト全読み込み完了後の保険）──
  window.addEventListener('load', () => {
    const savedMode = localStorage.getItem('fire_sim_mode') || 'beginner';
    if (savedMode === 'pro') {
      requestAnimationFrame(() => {
        initFatTailAnalyzer();
        initVolatilityDragExplorer();
      });
    }
  });

  // ── 3. IntersectionObserver（スクロールで表示された瞬間に描画）
  // pro-only パネルが画面外にある間は offsetWidth=0 になる場合があるため、
  // 実際に viewport に入ったタイミングで（再）初期化する。
  if (typeof IntersectionObserver !== 'undefined') {
    const targets = [
      { id: 'ft-chart',  fn: () => initFatTailAnalyzer() },
      { id: 'vd-chart',  fn: () => initVolatilityDragExplorer() },
    ];
    targets.forEach(({ id, fn }) => {
      const el = document.getElementById(id);
      if (!el) {
        // DOMContentLoaded 後に要素が存在しない場合は load 後に再試行
        window.addEventListener('load', () => {
          const el2 = document.getElementById(id);
          if (el2) observe(el2, fn);
        });
        return;
      }
      observe(el, fn);
    });

    function observe(el, fn) {
      let initialized = false;
      const obs = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            // 初回表示時に初期化（以降は setMode 内の呼び出しに任せる）
            fn();
            initialized = true;
            // 初回後も監視を続け、再表示時にリサイズ対応
          }
        });
      }, { threshold: 0.1 });
      obs.observe(el);
    }
  }
})();

// グローバル公開（index.html onclick や app.js expose から直接呼べるように）
window.initFatTailAnalyzer      = initFatTailAnalyzer;
window.initVolatilityDragExplorer = initVolatilityDragExplorer;
