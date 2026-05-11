/**
 * validator.js — スキーマベースのバリデーター層
 * FLOW | 資産シミュレーター
 *
 * 役割:
 *   - 単一フィールド検証（型・範囲・必須）
 *   - フィールド間の論理矛盾検知（クロスフィールド検証）
 *   - UI へのエラー表示制御
 *   - wizard.js / simulation.js / storage.js から共通利用
 *
 * 読み込み順: app.js より前（または同タイミング）に <script> で読む。
 * 依存: なし（純粋関数のみ。DOM 操作は UIValidator 層のみ）
 */

// ============================================================
// § 1. プリミティブ型バリデーター
// ============================================================

/**
 * 単一値のスキーマ検証。
 * @param {*} value  検証する値
 * @param {object} schema  { type, min, max, required, label }
 * @returns {{ ok: boolean, message: string|null }}
 */
function validateField(value, schema) {
  const { type = 'number', min, max, required = true, label = 'この項目' } = schema;

  // 必須チェック
  if (required && (value === '' || value === null || value === undefined)) {
    return { ok: false, message: `${label}は必須です。` };
  }

  if (type === 'number') {
    const n = Number(value);
    if (isNaN(n)) return { ok: false, message: `${label}は数値で入力してください。` };
    if (min !== undefined && n < min)
      return { ok: false, message: `${label}は ${min} 以上で入力してください。` };
    if (max !== undefined && n > max)
      return { ok: false, message: `${label}は ${max} 以下で入力してください。` };
  }

  if (type === 'integer') {
    const n = parseInt(value, 10);
    if (isNaN(n) || !Number.isFinite(n))
      return { ok: false, message: `${label}は整数で入力してください。` };
    if (min !== undefined && n < min)
      return { ok: false, message: `${label}は ${min} 以上で入力してください。` };
    if (max !== undefined && n > max)
      return { ok: false, message: `${label}は ${max} 以下で入力してください。` };
  }

  if (type === 'select') {
    const { options = [] } = schema;
    if (!options.includes(value))
      return { ok: false, message: `${label}の選択値が不正です。` };
  }

  return { ok: true, message: null };
}


// ============================================================
// § 2. パラメータスキーマ定義
//   各フィールドの「正当な範囲」を一か所で管理する。
//   simulation.js / wizard.js / storage.js が参照する唯一の真実。
// ============================================================
// var を使用し、再宣言エラーを防ぐ（スクリプトが複数回評価された場合の安全策）
var PARAM_SCHEMA = window.PARAM_SCHEMA || {
  'start-age':       { type: 'integer', min: 18,    max: 70,    label: '開始年齢' },
  'initial-assets':  { type: 'integer', min: 0,     max: 100000,label: '現在の資産（万円）' },
  'fire-threshold':  { type: 'integer', min: 100,   max: 500000,label: 'FIRE目標資産（万円）' },
  'income':          { type: 'integer', min: 50,    max: 10000, label: '額面年収（万円）' },
  'income-b':        { type: 'integer', min: 0,     max: 10000, label: '配偶者年収（万円）' },
  'raise':           { type: 'number',  min: -5,    max: 10,    label: '昇給率（%）' },
  'raise-b':         { type: 'number',  min: -5,    max: 10,    label: '配偶者昇給率（%）' },
  'pension':         { type: 'integer', min: 0,     max: 100,   label: '月額年金（万円）' },
  'inheritance':     { type: 'integer', min: 0,     max: 100000,label: '相続想定額（万円）' },
  'base-infl':       { type: 'number',  min: -2,    max: 10,    label: 'インフレ率（%）' },
  'w-working':       { type: 'integer', min: 0,     max: 100,   label: '現役時株式比率（%）' },
  'w-retired':       { type: 'integer', min: 0,     max: 100,   label: 'FIRE後株式比率（%）' },
  'tdof':            { type: 'integer', min: 3,     max: 120,   label: 't分布自由度' },
  'med-adv':         { type: 'number',  min: 0,     max: 3,     label: '医療進歩率（%）' },
  'nsims':           { type: 'integer', min: 100,   max: 10000, label: 'シミュレーション回数' },
};


// ============================================================
// § 3. フィールド間論理矛盾チェック（クロスフィールド検証）
//
//   単一フィールドのバリデーションでは検知できない「設定の矛盾」を
//   まとめて洗い出して返す。
// ============================================================

/**
 * シミュレーション実行前の総合検証。
 *
 * @param {object} params  { startAge, initAssets, fireThr, annualIncome,
 *                           annualIncomeB, isDual, wWork, wRetire,
 *                           monthlyPension, baseInfl, expStages, children }
 * @returns {{ errors: string[], warnings: string[] }}
 *   errors   — 実行を止めるべき致命的な矛盾
 *   warnings — ユーザーに確認を促す注意事項
 */
function validateSimParams(params) {
  const errors   = [];
  const warnings = [];
  const {
    startAge, initAssets, fireThr, annualIncome,
    annualIncomeB = 0, isDual = false,
    wWork, wRetire,
    monthlyPension, baseInfl,
    expStages = [],
    children = [],
  } = params;

  // ── 3-1. 年齢の論理チェック ──────────────────────────────
  if (startAge >= 65) {
    warnings.push('開始年齢が65歳以上です。年金受給開始と同時に計算が始まります。');
  }
  if (startAge > 60) {
    warnings.push('開始年齢が60歳超です。FIRE達成判定（60歳強制退職）が即時適用されます。');
  }

  // ── 3-2. 資産 vs FIRE目標の論理チェック ─────────────────
  if (initAssets >= fireThr && fireThr < 999990000) {
    // fireThr が 999,990,000 万 = 初心者モードのダミー値は除外
    warnings.push('現在の資産がすでにFIRE目標資産を上回っています。目標額を再設定するか、シミュレーションの前提を確認してください。');
  }

  // ── 3-3. 収入 vs 支出の論理チェック ──────────────────────
  if (expStages.length > 0) {
    // 現役ステージの年間支出を推計（startAge〜59歳の範囲で最初のステージ）
    const workingStage = expStages.find(s => s.from <= startAge && s.to > startAge)
      || expStages[0];
    if (workingStage) {
      const annualExpYen = workingStage.exp * 10_000; // 万円→円

      // 手取り年収（概算: 額面 × 0.75）
      const netIncomeYen = (annualIncome + (isDual ? annualIncomeB : 0)) * 0.75;

      if (annualExpYen > netIncomeYen * 1.5) {
        errors.push(
          `現役期の年間支出（約${workingStage.exp}万円）が` +
          `推定手取り年収の150%を超えています。` +
          `支出設定かライフステージを見直してください。`
        );
      } else if (annualExpYen > netIncomeYen) {
        warnings.push(
          `現役期の年間支出（約${workingStage.exp}万円）が` +
          `推定手取り年収を超えています。` +
          `資産取り崩しが前提となりますが、意図的な設定でなければ確認してください。`
        );
      }
    }
  }

  // ── 3-4. 株式比率の論理チェック ──────────────────────────
  if (wRetire > wWork + 20) {
    warnings.push(
      `FIRE後の株式比率（${wRetire}%）が現役時（${wWork}%）より大幅に高くなっています。` +
      `退職後は一般的にリスクを下げる設定が推奨されます。`
    );
  }

  // ── 3-5. インフレ率と期待リターンのチェック ──────────────
  if (baseInfl > 5) {
    warnings.push(`インフレ率が${baseInfl}%と高めです。ハイパーインフレシナリオとなります。`);
  }

  // ── 3-6. 年金の妥当性チェック ───────────────────────────
  const monthlyPensionMan = monthlyPension / 10_000;
  if (monthlyPensionMan > 40) {
    warnings.push(
      `月額年金が${monthlyPensionMan}万円と高めです。` +
      `厚生年金モデルの上限は約36万円（夫婦）です。`
    );
  }

  // ── 3-7. ライフステージの連続性チェック ──────────────────
  if (expStages.length > 1) {
    const sorted = [...expStages].sort((a, b) => a.from - b.from);
    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = sorted[i + 1].from - sorted[i].to;
      if (gap > 5) {
        warnings.push(
          `ライフステージ「${sorted[i].label}」（〜${sorted[i].to}歳）と` +
          `「${sorted[i + 1].label}」（${sorted[i + 1].from}歳〜）の間に` +
          `${gap}年のギャップがあります。この期間は最後のステージの支出で補完されます。`
        );
      }
    }
  }

  // ── 3-8. 子ども設定の年齢チェック ────────────────────────
  children.forEach(child => {
    const birthYear = child.birthYear || child.born;
    if (!birthYear) return;
    const childAge = new Date().getFullYear() - birthYear;
    if (childAge < -2 || childAge > 25) {
      warnings.push(
        `子ども（${birthYear}年生まれ）の設定が不自然です。` +
        `生まれ年を再確認してください。`
      );
    }
  });

  return { errors, warnings };
}


// ============================================================
// § 4. 一時イベント（タイムライン）バリデーター
// ============================================================

/**
 * 一時イベントエントリのスキーマ検証。
 * @param {object} event { age, amount, type, label }
 * @returns {{ ok: boolean, messages: string[] }}
 */
function validateOneTimeEvent(event) {
  const messages = [];
  const { age, amount, type, label } = event;

  const ageResult = validateField(age, { type: 'integer', min: 18, max: 115, label: 'イベント年齢' });
  if (!ageResult.ok) messages.push(ageResult.message);

  const amtResult = validateField(amount, { type: 'number', min: -100000, max: 100000, label: '金額（万円）' });
  if (!amtResult.ok) messages.push(amtResult.message);

  const validTypes = ['income', 'expense', 'asset'];
  if (!validTypes.includes(type)) {
    messages.push(`イベント種別（${type}）が不正です。income / expense / asset のいずれかを指定してください。`);
  }

  if (!label || String(label).trim() === '') {
    messages.push('イベント名は必須です。');
  }

  return { ok: messages.length === 0, messages };
}


// ============================================================
// § 5. DOM 連携 — UI バリデーションレイヤー
//   純粋関数層（§1〜§4）の上に DOM 操作を薄くラップする。
// ============================================================

// var を使うことでスクリプトトップレベルの関数スコープになり
// window.UIValidator と同一の参照になる（const/let はブロックスコープのため不可）
var UIValidator = (() => {
  // エラーメッセージ表示用コンテナを取得 or 生成する
  function getOrCreateErrorBox(id) {
    const inputEl = document.getElementById(id);
    if (!inputEl) return null;

    const containerId = `vld-err-${id}`;
    let box = document.getElementById(containerId);
    if (!box) {
      box = document.createElement('div');
      box.id = containerId;
      box.setAttribute('role', 'alert');
      box.setAttribute('aria-live', 'polite');
      box.style.cssText = [
        'font-size:11px',
        'color:var(--danger,#ff4757)',
        'margin-top:3px',
        'min-height:16px',
        'transition:opacity .2s',
        'font-family:var(--font-body)',
      ].join(';');
      inputEl.parentNode?.insertBefore(box, inputEl.nextSibling);
    }
    return box;
  }

  /**
   * 単一フィールドをリアルタイム検証してエラーを DOM に表示する。
   * @param {string} id   input 要素の id
   * @returns {boolean}   valid なら true
   */
  function validateAndShow(id) {
    const schema = PARAM_SCHEMA[id];
    if (!schema) return true; // スキーマ未定義は通過

    const el = document.getElementById(id);
    if (!el) return true;

    const result = validateField(el.value, schema);
    const box = getOrCreateErrorBox(id);

    if (!result.ok) {
      if (box) box.textContent = result.message;
      el.setAttribute('aria-invalid', 'true');
      el.style.borderColor = 'rgba(255,71,87,.6)';
      el.style.boxShadow   = '0 0 0 2px rgba(255,71,87,.15)';
    } else {
      if (box) box.textContent = '';
      el.removeAttribute('aria-invalid');
      el.style.borderColor = '';
      el.style.boxShadow   = '';
    }

    return result.ok;
  }

  /**
   * シミュレーション実行前に全パラメータを読み取って
   * クロスフィールド検証を実行し、UI に警告/エラーを表示する。
   *
   * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
   */
  function validateAll() {
    // --- DOM から値を読み取る ---
    const g = id => {
      const el = document.getElementById(id);
      return el ? el.value : '';
    };

    const startAge     = parseInt(g('start-age'), 10)     || 30;
    const initAssets   = parseInt(g('initial-assets'), 10) || 0;
    const fireThr      = parseInt(g('fire-threshold'), 10) || 10000;
    const annualIncome = parseInt(g('income'), 10)         || 0;
    const annualIncomeB= parseInt(g('income-b'), 10)       || 0;
    const wWork        = parseInt(g('w-working'), 10)      || 60;
    const wRetire      = parseInt(g('w-retired'), 10)      || 40;
    const monthlyPension= parseInt(g('pension'), 10) * 10000 || 0;
    const baseInfl     = parseFloat(g('base-infl'))        || 1;

    // isDual: 共働き判定（グローバル変数 currentHousehold が参照可能な場合は利用）
    const isDual = (typeof currentHousehold !== 'undefined')
      ? currentHousehold === 'dual'
      : (document.getElementById('hh-dual')?.classList.contains('diff-btn-active') ?? false);

    // expStages, children はグローバル変数を参照（フォールバックは空配列）
    const expStagesRef = (typeof expStages !== 'undefined') ? expStages : [];
    const childrenRef  = (typeof children  !== 'undefined') ? children  : [];

    // 各フィールド単体チェック
    let allFieldsOk = true;
    Object.keys(PARAM_SCHEMA).forEach(id => {
      // income-b, raise-b は単身時はスキップ
      if ((id === 'income-b' || id === 'raise-b') && !isDual) return;
      if (!validateAndShow(id)) allFieldsOk = false;
    });

    // クロスフィールドチェック
    const { errors, warnings } = validateSimParams({
      startAge,
      initAssets:     initAssets * 10000, // 万円→円
      fireThr:        fireThr    * 10000,
      annualIncome:   annualIncome * 10000,
      annualIncomeB:  annualIncomeB * 10000,
      isDual,
      wWork, wRetire,
      monthlyPension,
      baseInfl,
      expStages:  expStagesRef,
      children:   childrenRef,
    });

    // --- エラー/警告バナーを表示 ---
    showValidationBanner(errors, warnings);

    return {
      valid: allFieldsOk && errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * バナーでエラー・警告を表示する。
   * id="validation-banner" が存在すれば使う。なければ動的生成。
   */
  function showValidationBanner(errors, warnings) {
    // ── インラインバナー（通常モード・プロモード）──────────────────────
    let banner = document.getElementById('validation-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'validation-banner';
      banner.setAttribute('role', 'status');
      banner.setAttribute('aria-live', 'polite');
      banner.style.cssText = 'margin:12px 0;border-radius:6px;overflow:hidden;font-size:12px;line-height:1.8;';
      const runBtn = document.getElementById('run-btn');
      if (runBtn) runBtn.parentNode?.insertBefore(banner, runBtn);
    }

    if (errors.length === 0 && warnings.length === 0) {
      banner.innerHTML = '';
      banner.style.display = 'none';
      _hideValidationToast();
      return;
    }

    // ── トーストポップアップ（全モード共通・目立つ）──────────────────────
    if (errors.length > 0) {
      _showValidationToast(errors, warnings);
    }

    // インラインバナーも維持（プロモードの詳細表示用）
    banner.style.display = 'block';
    let html = '';
    if (errors.length > 0) {
      html += `<div style="padding:10px 14px;background:rgba(255,71,87,.1);border:1px solid rgba(255,71,87,.3);border-radius:6px;margin-bottom:6px;">
        <div style="font-size:11px;color:#ff4757;font-family:var(--font-mono);letter-spacing:1px;margin-bottom:4px;">⛔ 設定エラー</div>
        ${errors.map(e => `<div style="color:var(--danger,#ff4757);">• ${e}</div>`).join('')}
      </div>`;
    }
    if (warnings.length > 0) {
      html += `<div style="padding:10px 14px;background:rgba(255,209,102,.07);border:1px solid rgba(255,209,102,.25);border-radius:6px;">
        <div style="font-size:11px;color:#ffd166;font-family:var(--font-mono);letter-spacing:1px;margin-bottom:4px;">⚠️ 注意事項</div>
        ${warnings.map(w => `<div style="color:var(--warning,#ffd166);">• ${w}</div>`).join('')}
      </div>`;
    }
    banner.innerHTML = html;
  }

  /** トーストポップアップを表示 */
  let _toastTimer = null;
  function _showValidationToast(errors, warnings) {
    let toast = document.getElementById('validation-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'validation-toast';
      toast.style.cssText = [
        'position:fixed','top:0','left:0','right:0','z-index:9999',
        'transform:translateY(-100%)','transition:transform .35s cubic-bezier(.4,0,.2,1)',
        'pointer-events:auto',
      ].join(';');
      document.body.appendChild(toast);
    }

    const errCount = errors.length;
    const mainMsg  = errors[0] || '';
    const extraCount = errCount - 1;

    toast.innerHTML = `
      <div style="
        background:linear-gradient(135deg,#1a0a0a,#2d0f0f);
        border-bottom:2px solid #ff4757;
        padding:14px 16px;
        display:flex;align-items:flex-start;gap:12px;
        box-shadow:0 4px 30px rgba(255,71,87,.4);
        font-family:'Noto Sans JP',sans-serif;
      ">
        <span style="font-size:22px;flex-shrink:0;margin-top:1px;">⛔</span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:14px;font-weight:700;color:#ff4757;margin-bottom:4px;">設定エラーがあります</div>
          <div style="font-size:13px;color:rgba(255,200,200,.85);line-height:1.6;">${mainMsg}</div>
          ${extraCount > 0 ? `<div style="font-size:11px;color:rgba(255,200,200,.5);margin-top:4px;">他 ${extraCount} 件のエラーがあります</div>` : ''}
          ${warnings.length > 0 ? `<div style="font-size:11px;color:#ffd166;margin-top:4px;">⚠️ 警告: ${warnings[0]}</div>` : ''}
        </div>
        <button onclick="document.getElementById('validation-toast') && (document.getElementById('validation-toast').style.transform='translateY(-100%)')"
          style="background:none;border:none;color:rgba(255,200,200,.5);font-size:20px;cursor:pointer;flex-shrink:0;padding:0 4px;line-height:1;">×</button>
      </div>`;

    // アニメーションで下に出す
    requestAnimationFrame(() => {
      toast.style.transform = 'translateY(0)';
    });

    // 6秒後に自動で消す
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => _hideValidationToast(), 6000);
  }

  function _hideValidationToast() {
    const toast = document.getElementById('validation-toast');
    if (toast) toast.style.transform = 'translateY(-100%)';
  }

  /**
   * スキーマに登録されている全 input にリアルタイムバリデーションを付与する。
   * DOMContentLoaded 後に一度だけ呼ぶ。
   */
  function attachRealtimeValidation() {
    Object.keys(PARAM_SCHEMA).forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('blur', () => validateAndShow(id));
      el.addEventListener('change', () => validateAndShow(id));
    });
  }

  return { validateAndShow, validateAll, showValidationBanner, attachRealtimeValidation };
})();


// ============================================================
// § 6. ウィザード入力バリデーション（wizard.js と共用）
// ============================================================

/**
 * ウィザードの各ステップで呼ぶ軽量バリデーター。
 * @param {string} inputId  対象 input の id
 * @param {{ min?: number, max?: number, label?: string }} opts
 * @returns {boolean}
 */
function validateWizardInput(inputId, opts = {}) {
  const el = document.getElementById(inputId);
  if (!el) return true;

  const schema = {
    type: 'number',
    min: opts.min,
    max: opts.max,
    label: opts.label || 'この項目',
  };
  const result = validateField(el.value, schema);

  if (!result.ok) {
    el.style.borderColor = 'var(--danger,#ff4757)';
    el.style.boxShadow   = '0 0 0 4px rgba(255,71,87,.15)';
    el.setAttribute('aria-invalid', 'true');
    // エラーメッセージを aria-describedby で連携
    let errEl = document.getElementById(`${inputId}-err`);
    if (!errEl) {
      errEl = document.createElement('div');
      errEl.id = `${inputId}-err`;
      errEl.setAttribute('role', 'alert');
      errEl.style.cssText = 'font-size:11px;color:var(--danger,#ff4757);margin-top:4px;';
      el.parentNode?.appendChild(errEl);
      el.setAttribute('aria-describedby', `${inputId}-err`);
    }
    errEl.textContent = result.message;
    setTimeout(() => {
      el.style.borderColor = '';
      el.style.boxShadow   = '';
    }, 800);
    el.focus();
    return false;
  }

  el.removeAttribute('aria-invalid');
  const errEl = document.getElementById(`${inputId}-err`);
  if (errEl) errEl.textContent = '';
  return true;
}


// ============================================================
// § 7. グローバル公開（app.js の expose リストへの追加は任意）
// ============================================================
window.PARAM_SCHEMA       = PARAM_SCHEMA;
window.validateField      = validateField;
window.validateSimParams  = validateSimParams;
window.validateOneTimeEvent = validateOneTimeEvent;
window.validateWizardInput  = validateWizardInput;
window.UIValidator          = UIValidator;

// DOMContentLoaded 後にリアルタイムバリデーションを自動起動
document.addEventListener('DOMContentLoaded', () => {
  UIValidator.attachRealtimeValidation();
});

// ============================================================
// § 8. ES Modules 移行準備
//
// 現在はグローバルスクリプトとして動作しているが、将来的に
// <script type="module"> へ移行する際に使う export 宣言を
// 条件付きで提供する。
//
// 移行ステップ:
//   1. index.html の <script src="./validator.js"> を
//      <script type="module" src="./validator.js"> に変更
//   2. simulation.js 等で:
//      import { validateField, validateSimParams, UIValidator } from './validator.js';
//   3. 下記の window.xxx = xxx 行（§7）は削除できる
//
// 現時点では type="module" ではないため、typeof exports でガードして
// グローバル動作を維持しつつ export も宣言する。
// ============================================================

// Node.js / Jest 環境向け CommonJS export（ブラウザでは無視）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PARAM_SCHEMA,
    validateField,
    validateSimParams,
    validateOneTimeEvent,
    validateWizardInput,
    UIValidator,
  };
}

// ESM 環境向け（将来: type="module" 時に有効化）
// export { PARAM_SCHEMA, validateField, validateSimParams, validateOneTimeEvent, validateWizardInput, UIValidator };
