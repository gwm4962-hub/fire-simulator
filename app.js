/**
 * app.js — グローバルエラーハンドリング・モジュール初期化エントリーポイント
 * FLOW | 資産シミュレーター
 *
 * 読み込み順: app.js(1番最初) → storage.js → simulation.js → charts.js → ui.js → wizard.js → pwa.js
 *
 * 循環依存の解決方針（コールバック注入パターン）:
 *   変換前: storage ↔ simulation ↔ charts ↔ ui（4方向循環）
 *   変換後（一方向のみ）:
 *     storage.js     ─ 依存なし（コールバックを受け取るだけ）
 *     simulation.js  → storage.js
 *     charts.js      → storage.js, simulation.js
 *     ui.js          → storage.js, simulation.js, charts.js
 *     app.js         → 全モジュール（エントリーポイント）
 *     wizard.js      → storage.js, simulation.js, charts.js, ui.js
 *     splash.js      → charts.js
 */

// ============================================================
// グローバルエラーハンドリング
// ============================================================
const _origError = window.onerror;
window.onerror = function(msg, src, line, col, err) {
  if (typeof msg === 'string' && msg.includes('ResizeObserver loop')) return true;
  if (_origError) return _origError(msg, src, line, col, err);
};

window.addEventListener('error', function(e) {
  if (e && e.message && e.message.includes('ResizeObserver loop')) {
    e.stopImmediatePropagation();
    e.preventDefault();
    return true;
  }
}, true);

window.addEventListener('unhandledrejection', e => {
  const btn = document.getElementById('run-btn');
  if (btn) { btn.disabled = false; }
  const badge = document.getElementById('status-badge');
  if (badge) {
    badge.textContent = 'ERROR';
    badge.style.color = 'var(--danger)';
  }
  console.error('[FLOW] 未処理のエラー:', e.reason);
});

// ============================================================
// Advanced Settings Accordion（後方互換: ui.js でも定義済み）
// ============================================================
function toggleAdv(sectionId) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  const btn  = section.querySelector('.adv-toggle');
  const body = section.querySelector('.adv-body');
  const isOpen = body.classList.contains('open');
  if (isOpen) {
    body.classList.remove('open');
    btn.classList.remove('open');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  } else {
    body.classList.add('open');
    btn.classList.add('open');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    section.querySelectorAll('input[type="range"]').forEach(s => updateSliderFill(s));
  }
}

// ============================================================
// Dynamic slider gradient（後方互換: ui.js でも定義済み）
// ============================================================
function updateSliderFill(slider) {
  const min = parseFloat(slider.min) || 0;
  const max = parseFloat(slider.max) || 100;
  const val = parseFloat(slider.value);
  const pct = ((val - min) / (max - min) * 100).toFixed(1);
  slider.style.setProperty('--pct', pct + '%');
}
document.querySelectorAll('input[type="range"]').forEach(s => {
  updateSliderFill(s);
  s.addEventListener('input', () => updateSliderFill(s));
});

// ============================================================
// モジュール初期化（DOMContentLoaded 後に全モジュールが読み込まれた
// タイミングでコールバックを注入する）
// ============================================================
window.addEventListener('load', function initModules() {
  // --- storage.js へのコールバック注入 ---
  // storage が各モジュールのグローバル変数・関数に直接アクセスせず
  // ここ経由でアクセスするようにすることで循環依存を断ち切る
  if (typeof initStorage === 'function') {
    initStorage({
      getREGIMES:           () => typeof REGIMES       !== 'undefined' ? REGIMES       : null,
      getTmValues:          () => typeof tmValues      !== 'undefined' ? tmValues      : null,
      getExpStages:         () => typeof expStages     !== 'undefined' ? expStages     : null,
      setExpStages:         (v) => { if (typeof expStages !== 'undefined') expStages = v; },
      getStageIdCounter:    () => typeof stageIdCounter !== 'undefined' ? stageIdCounter : 0,
      setStageIdCounter:    (v) => { if (typeof stageIdCounter !== 'undefined') stageIdCounter = v; },
      renderStages:         () => typeof renderStages         === 'function' && renderStages(),
      updateRegimeCards:    () => typeof updateRegimeCards    === 'function' && updateRegimeCards(),
      setDifficulty:        (m) => typeof setDifficulty       === 'function' && setDifficulty(m),
      setGender:            (g) => typeof setGender            === 'function' && setGender(g),
      updateSum:            (ri)=> typeof updateSum            === 'function' && updateSum(ri),
      getCurrentDifficulty: () => typeof currentDifficulty !== 'undefined' ? currentDifficulty : 'normal',
    });
  }

  // --- simulation.js へのコールバック注入 ---
  // setDifficulty / DOMContentLoaded 初期化 / TMスライダーから ui.js の関数を
  // 安全に呼べるようにする。これにより simulation → ui の直接依存を断ち切る。
  if (typeof initSimCallbacks === 'function') {
    initSimCallbacks({
      setDifficultyEnhanced: (mode) => typeof setDifficultyEnhanced === 'function' && setDifficultyEnhanced(mode),
      updateRegimeCards:     ()     => typeof updateRegimeCards      === 'function' && updateRegimeCards(),
      // renderRegimeDashboard は charts.js で定義（updateRegimeTable のエイリアス）。
      // simulation.js から直接参照できないためここで橋渡し。
      renderRegimeDashboard: ()     => typeof renderRegimeDashboard  === 'function' && renderRegimeDashboard(),
      // updateRegimeTable は charts.js で定義。
      updateRegimeTable:     ()     => typeof updateRegimeTable       === 'function' && updateRegimeTable(),
    });
  }

  // --- charts.js へのコールバック注入 ---
  if (typeof initChartsCallbacks === 'function') {
    initChartsCallbacks({
      calcTaxPrecise:          (y) => typeof calcTaxPrecise          === 'function' && calcTaxPrecise(y),
      computeStationaryDist:   (tm)=> typeof computeStationaryDist   === 'function' && computeStationaryDist(tm),
    });
  }

  // --- ui.js へのコールバック注入 ---
  if (typeof initUiCallbacks === 'function') {
    initUiCallbacks({
      runSimulation:  () => typeof runSimulation  === 'function' && runSimulation(),
      saveParameters: () => typeof saveParameters === 'function' && saveParameters(),
      scheduleSave:   () => typeof scheduleSave   === 'function' && scheduleSave(),
    });
  }

  // --- HTML onclick 用にグローバル公開 ---
  // index.html の onclick 属性から呼ばれる関数を window に登録
  const expose = [
    'runSimulation', 'saveParameters', 'loadParameters', 'clearLocalData',
    'setMode', 'setGender', 'setDifficulty', 'setHousehold',
    'addChild', 'removeChild', 'updateChild',
    'applyExpPreset', 'addExpStage', 'handlePresetClick',
    'openModal', 'closeModal',
    'toggleAdv', 'updateSliderFill',
    'vizTogglePlay', 'vizReset',
    'runTornadoAnalysis',
    'toggleRealValue', 'toggleGuidePanel',
    'normalizeAll', 'buildTM',
    'copyShareUrl', 'shareToX',
    'saveChartPNG', 'exportSimCSV',
    'startWithMode', 'resumeSession', 'skipWizard',
    'selectHouseholdType', 'selectChildren', 'validateCurrentInput',
    'pwaTriggerInstall', 'pwaDismissBanner', 'pwaCloseIosModal', 'pwaStep5Install',
    // ui.js で定義。simulation.js からコールバック経由で呼ぶために window にも公開。
    'renderRegimeDashboard', 'updateRegimeTable',
    // validator.js — バリデーター層
    'validateField', 'validateSimParams', 'validateOneTimeEvent',
    'validateWizardInput', 'UIValidator',
    // simulation.js — 一時イベントタイムライン
    'addOneTimeEvent', 'removeOneTimeEvent', 'renderOneTimeEventList',
  ];
  expose.forEach(name => {
    if (typeof window[name] === 'undefined' && typeof eval(name) !== 'undefined') {
      try { window[name] = eval(name); } catch(e) {}
    }
  });
});
