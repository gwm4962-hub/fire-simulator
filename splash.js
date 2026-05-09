/**
 * splash.js — モード選択スプラッシュ画面のロジック
 * FLOW | 資産シミュレーター
 * ⚠️ DOMContentLoaded前に実行が必要 — <head>末尾でdeferなしで読み込む
 */
(function() {
  // Splash logic — runs before DOMContentLoaded for fast rendering
  function startWithMode(mode) {
    const splash = document.getElementById('mode-splash');
    if (splash) { splash.style.opacity = '0'; splash.style.transition = 'opacity .3s'; setTimeout(() => splash.style.display = 'none', 300); }
    
    // Store chosen mode
    localStorage.setItem('fire_sim_mode', mode);
    localStorage.setItem('splash_seen', '1');
    
    if (mode === 'beginner') {
      // Show wizard — wizard-overlay already visible by default
      if (typeof setMode === 'function') setMode('beginner');
    } else {
      // Hide wizard, go straight to app
      const wiz = document.getElementById('wizard-overlay');
      if (wiz) { wiz.style.display = 'none'; wiz.classList.add('hidden'); wiz.style.pointerEvents = 'none'; }
      const appEl = document.querySelector('.app');
      if (appEl) { appEl.style.filter = 'none'; appEl.style.pointerEvents = 'auto'; }
      if (typeof setMode === 'function') setMode(mode);
    }
  }
  
  function resumeSession() {
    const splash = document.getElementById('mode-splash');
    if (splash) { splash.style.opacity = '0'; splash.style.transition = 'opacity .3s'; setTimeout(() => splash.style.display = 'none', 300); }
    const wiz = document.getElementById('wizard-overlay');
    if (wiz) { wiz.style.display = 'none'; wiz.classList.add('hidden'); wiz.style.pointerEvents = 'none'; }
    const appEl = document.querySelector('.app');
    if (appEl) { appEl.style.filter = 'none'; appEl.style.pointerEvents = 'auto'; }
    const savedMode = localStorage.getItem('fire_sim_mode') || 'normal';
    if (typeof setMode === 'function') setMode(savedMode);
  }
  
  window.startWithMode = startWithMode;
  window.resumeSession = resumeSession;

  // Check on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', function() {
    const hasSave = localStorage.getItem('FIRE_SIM_V4_SETTINGS');
    if (hasSave) {
      const el = document.getElementById('splash-returning');
      if (el) el.style.display = 'block';
    }
    // If already seen splash and wizard was completed, skip splash
    if (localStorage.getItem('splash_seen') && localStorage.getItem('wizard_completed') === 'true') {
      const splash = document.getElementById('mode-splash');
      if (splash) splash.style.display = 'none';
    }
  });
})();
