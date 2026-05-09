/**
 * app.js — グローバルエラーハンドリング・UI基盤関数
 * FLOW | 資産シミュレーター
 * 読み込み順: app.js(1番最初) → storage.js → simulation.js → charts.js → ui.js → wizard.js → pwa.js
 */
// ============================================================
// グローバルエラーハンドリング
// ============================================================
// Suppress ResizeObserver loop limit exceeded error (common Chart.js mobile issue)
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
// ============================================================
// Advanced Settings Accordion
// ============================================================
function toggleAdv(sectionId) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  const btn = section.querySelector('.adv-toggle');
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
    // Re-init sliders inside if needed
    section.querySelectorAll('input[type="range"]').forEach(s => updateSliderFill(s));
  }
}

// ============================================================
// Dynamic slider gradient (shows fill progress)
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

// Touch guard — prevents sliders from moving during vertical scroll
// ============================================================


