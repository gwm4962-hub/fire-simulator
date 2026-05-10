/**
 * wizard.js — 初心者ウィザード (Beginner Wizard v19)
 * FLOW | 資産シミュレーター
 */
/* =====================================================
   BEGINNER WIZARD (v19) — 初心者モード専用
   ===================================================== */
(function() {

  // ── 政府統計データによるデフォルト値 ──────────────────
  const GOV_DEFAULTS = {
    // 国税庁2023年・厚労省・金融広報中央委員会・総務省家計調査データ
    inflation:        1.5,   // インフレ率 %（2024年実績ベース・総務省CPI）
    raiseRate:        2.0,   // 昇給率 %/年（2024年春闘平均5.1%→定昇込み実態2%）
    savingsRateRatio: 0.15,  // 手取りの15%を貯蓄
    expenseRatio:     0.70,  // 手取りの70%を生活費（額面年収換算で約50%）
    postRetireRatio:  0.80,  // 定年後の支出は現役比80%
    pension: {
      // 厚労省モデル年金（2024年度）
      // 夫婦（片方専業）= 23.0万/月、単身 = 約16.4万（男性平均）
      single: 16,
      couple: 23,
      dual:   28,  // 共働き（二人合算の厚生年金）目安
    },
    retireAge:        60,    // 定年年齢（固定）
    inheritance:      500,   // 相続想定額（国税庁：相続財産中央値は1,000〜2,000万、受け取り確率考慮）
    investRatio:      0.0,   // 現役中の株式比率（初期値0%・比較機能で変更）
    investRatioPost:  0.0,   // 退職後の株式比率（初期値0%）
    fireThreshold:    99999, // 初心者モードではFIREしない（大きな値にして到達しないようにする）
    children: {
      // 文部科学省「子供の学習費調査」+ 日本政策金融公庫「教育費負担の実態調査」
      eduCostPublic:  900,  // 公立ルート1人あたり幼〜大学 万円（約900万円）
      eduCostPrivate: 1800, // 私立ルート 約1,800万円
    },
  };

  // ── ウィザード状態 ───────────────────────────────────
  let wizHouseholdType = 'single'; // 'single' | 'single-spouse' | 'dual'
  let wizChildren = 0;
  let currentStep = 0;

  // ステップ定義（dual時はstep2を挿入、それ以外はskip）
  function getSteps() {
    const base = ['wstep-0', 'wstep-1'];
    if (wizHouseholdType === 'dual') base.push('wstep-2');
    base.push('wstep-3', 'wstep-4');
    return base;
  }

  function getEl(id) { return document.getElementById(id); }

  function updateDots(step) {
    const steps = getSteps();
    const total = steps.length;
    for (let i = 0; i < 5; i++) {
      const dot = getEl('wdot-' + i);
      if (!dot) continue;
      if (i >= total) { dot.style.display = 'none'; continue; }
      dot.style.display = '';
      dot.className = 'wiz-dot' + (i < step ? ' done' : '') + (i === step ? ' active' : '');
    }
  }

  function goToStep(nextIdx) {
    const steps = getSteps();
    const currId = steps[currentStep];
    const curr = getEl(currId);
    if (curr) { curr.classList.add('out'); }
    setTimeout(() => {
      if (curr) { curr.style.display = 'none'; curr.classList.remove('out'); }
      currentStep = nextIdx;
      const nxtId = steps[currentStep];
      const nxt = getEl(nxtId);
      if (nxt) {
        nxt.style.display = 'block';
        nxt.style.animation = 'none';
        void nxt.offsetWidth;
        nxt.style.animation = '';
        // Update step label
        updateStepLabel(nxtId, currentStep, steps.length);
        // Focus first input if present
        const inp = nxt.querySelector('input');
        if (inp) { setTimeout(() => { inp.focus(); inp.select(); }, 50); }
      }
      updateDots(currentStep);
    }, 280);
  }

  function updateStepLabel(stepId, idx, total) {
    const el = getEl(stepId)?.querySelector('.wiz-step-label');
    if (el) el.textContent = `Step ${idx + 1} / ${total} — 基本診断`;
  }

  // ── 世帯タイプ選択 ────────────────────────────────────
  window.selectHouseholdType = function(type) {
    wizHouseholdType = type;
    ['single','single-spouse','dual'].forEach(t => {
      const btn = getEl('wiz-type-' + t);
      if (btn) btn.classList.toggle('selected', t === type);
    });
    // ちょっと待ってから次へ
    setTimeout(() => goToStep(1), 300);
  };

  // ── 子供人数選択 ─────────────────────────────────────
  window.selectChildren = function(n) {
    wizChildren = n;
    document.querySelectorAll('.wiz-num-btn').forEach((btn, i) => {
      btn.classList.toggle('selected', i === n || (n >= 3 && i === 3));
    });
    setTimeout(() => advanceStep(), 300);
  };

  // ── テキスト入力の次へ ────────────────────────────────
  function advanceStep() {
    const steps = getSteps();
    if (currentStep < steps.length - 1) {
      goToStep(currentStep + 1);
    } else {
      finishWizard();
    }
  }

  window.validateCurrentInput = function validateCurrentInput() {
    const steps = getSteps();
    const stepId = steps[currentStep];
    const inp = getEl(stepId)?.querySelector('input[type="number"]');
    if (!inp) { advanceStep(); return; } // 選択ステップはボタン押下で進む
    const v = parseFloat(inp.value);
    if (!inp.value || isNaN(v) || v < parseFloat(inp.min || 0)) {
      inp.style.borderColor = 'var(--danger)';
      inp.style.boxShadow = '0 0 0 4px rgba(255,71,87,.15)';
      setTimeout(() => { inp.style.borderColor = ''; inp.style.boxShadow = ''; }, 600);
      inp.focus(); return;
    }
    advanceStep();
  }

  // ── ウィザード完了 → パラメータ設定 ─────────────────────
  function finishWizard() {
    const age     = parseFloat(getEl('w-age')?.value)     || 35;
    const income  = parseFloat(getEl('w-income')?.value)  || 450;
    const incomeB = parseFloat(getEl('w-income-b')?.value)|| 280;
    const ageB    = parseFloat(getEl('w-age-b')?.value)   || (age - 2);
    const savings = parseFloat(getEl('w-savings')?.value) || 150;

    // Loading アニメーション
    getEl('wiz-cards').style.display = 'none';
    getEl('wiz-dots-wrap').style.display = 'none';
    const skipBtn = document.querySelector('.wiz-skip');
    if (skipBtn) skipBtn.style.display = 'none';
    const loadingEl = getEl('wiz-loading');
    loadingEl.style.display = 'flex';
    // nsims スライダーの値を反映
    const nsimsEl = document.getElementById('nsims');
    const nsimsVal = nsimsEl ? parseInt(nsimsEl.value).toLocaleString() : '2,000';
    const subEl = getEl('wiz-loading-sub');
    if (subEl) subEl.textContent = nsimsVal + 'パターンの人生を試算しています';

    const msgs = [
      '統計データで自動設定中...',
      '税金・手取り率を計算中...',
      '老後の支出パターンを推計中...',
      '2,000パターンの人生を試算中...',
      '老後の安全度を分析中...',
    ];
    let mi = 0;
    const msgEl = getEl('wiz-loading-msg');
    const ticker = setInterval(() => { msgEl.textContent = msgs[++mi % msgs.length]; }, 700);

    setTimeout(() => {
      clearInterval(ticker);

      const isDual = wizHouseholdType === 'dual';
      const hasSpouse = wizHouseholdType !== 'single';

      // 税金計算
      const taxA = typeof calcTaxPrecise === 'function' ? calcTaxPrecise(income * 10000) : { rate: 0.78 };
      const taxB = (isDual && typeof calcTaxPrecise === 'function') ? calcTaxPrecise(incomeB * 10000) : { rate: 0.78 };

      // 月々の生活費推定（手取り × 62% ÷ 12ヶ月）
      const netAnnualA = income * taxA.rate;
      const netAnnualB = isDual ? incomeB * taxB.rate : 0;
      const netAnnual = netAnnualA + netAnnualB;
      const monthlyExp = Math.round(netAnnual * GOV_DEFAULTS.expenseRatio / 12);
      const monthlyRetireExp = Math.round(monthlyExp * GOV_DEFAULTS.postRetireRatio);

      // 子供の教育費をステージに追加（子供は今年生まれたと仮定）
      const childEduTotal = wizChildren * GOV_DEFAULTS.children.eduCostPublic;

      // 年金：世帯タイプ別（厚労省2024年度モデル年金）
      const pension = isDual ? GOV_DEFAULTS.pension.dual
        : (wizHouseholdType === 'single-spouse' ? GOV_DEFAULTS.pension.couple
        : GOV_DEFAULTS.pension.single);

      // FIRE目標は到達しない大きな値（定年まで働くモード）
      const fireThreshold = 99999;

      function setSlider(id, val) {
        const el = getEl(id); if (!el) return;
        el.value = val; el.dispatchEvent(new Event('input', { bubbles: true }));
      }
      function setNumber(id, val) {
        const el = getEl(id); if (!el) return;
        el.value = val; el.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // ── 基本設定 ──
      setSlider('start-age', Math.min(Math.max(age, 25), 55));
      setNumber('num-initial-assets', savings);
      setSlider('initial-assets', savings);
      setSlider('fire-threshold', fireThreshold);
      setSlider('income', income);
      setSlider('raise', GOV_DEFAULTS.raiseRate);
      setSlider('pension', pension);
      setSlider('base-infl', GOV_DEFAULTS.inflation);
      setSlider('w-working',  Math.round(GOV_DEFAULTS.investRatio * 100));
      setSlider('w-retired',  Math.round(GOV_DEFAULTS.investRatioPost * 100));
      setSlider('inheritance', GOV_DEFAULTS.inheritance);

      // 共働き設定（世帯タイプ別）
      if (typeof setHousehold === 'function') {
        if (isDual) {
          setHousehold('dual');
          setSlider('income-b', incomeB);
          setSlider('raise-b', GOV_DEFAULTS.raiseRate);
        } else {
          setHousehold(wizHouseholdType === 'single-spouse' ? 'single-spouse' : 'single');
        }
      }

      // ライフステージ支出（定年まで → 定年後）
      // ステージ0: 現役（現在〜60歳）, ステージ1以降: 定年後
      const stageEls0 = getEl('stage-exp-0');
      const stageEls1 = getEl('stage-exp-1');
      const stageEls2 = getEl('stage-exp-2');
      const stageEls3 = getEl('stage-exp-3');
      [stageEls0, stageEls1].forEach(el => { if (el) { el.value = monthlyExp; el.dispatchEvent(new Event('input',{bubbles:true})); } });
      [stageEls2, stageEls3].forEach(el => { if (el) { el.value = monthlyRetireExp; el.dispatchEvent(new Event('input',{bubbles:true})); } });

      // 子供追加
      if (wizChildren > 0 && typeof addChild === 'function') {
        const currentYear = new Date().getFullYear();
        for (let i = 0; i < Math.min(wizChildren, 3); i++) {
          addChild();
          // 最後に追加した子供の生まれ年を設定（5歳差）
          const childList = document.querySelectorAll('.child-row');
          const last = childList[childList.length - 1];
          if (last) {
            const byEl = last.querySelector('input[type="number"]');
            if (byEl) { byEl.value = currentYear - i * 3; byEl.dispatchEvent(new Event('input',{bubbles:true})); }
          }
        }
      }

      // ウィザードを閉じる
      const ov = getEl('wizard-overlay');
      ov.classList.add('hidden');
      ov.style.display = 'none';
      ov.style.pointerEvents = 'none';
      document.querySelector('.app').style.filter = 'none';
      document.querySelector('.app').style.pointerEvents = 'auto';

      if (typeof _isLoading !== 'undefined') _isLoading = false;
      localStorage.setItem('wizard_completed', 'true');

      // 初心者モードを確実にセット
      if (typeof setMode === 'function') setMode('beginner');

      setTimeout(() => {
        if (typeof runSimulation === 'function') {
          runSimulation().then(() => {
            // シミュレーション完了後、チャートまでスクロール
            setTimeout(() => {
              const target = document.getElementById('chart-container') || document.getElementById('beginner-summary');
              if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 400);
          }).catch(() => {});
        }
      }, 300);

    }, 1800);
  }

  // ── skipWizard ────────────────────────────────────────
  function skipWizard() {
    const ov = getEl('wizard-overlay');
    ov.classList.add('hidden');
    ov.style.display = 'none';
    ov.style.pointerEvents = 'none';
    document.querySelector('.app').style.filter = '';
    document.querySelector('.app').style.pointerEvents = 'auto';
  }
  window.skipWizard = skipWizard;

  // ── キーボード ─────────────────────────────────────────
  document.addEventListener('keydown', function(e) {
    if (getEl('wizard-overlay')?.classList.contains('hidden')) return;
    if (e.key === 'Enter') { e.preventDefault(); validateCurrentInput(); }
    if (e.key === 'Escape') skipWizard();
  });

  // ── 各stepのinput Enterキー ────────────────────────────
  ['w-age','w-income','w-age-b','w-income-b','w-savings'].forEach(id => {
    const inp = document.getElementById(id);
    if (!inp) return;
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); validateCurrentInput(); }
    });
  });

  // ── DOM ready ─────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    updateDots(0);
    // Focus first element
    const firstInp = getEl('wstep-0')?.querySelector('button');
    // No auto-focus for choice buttons
  });

  window.addEventListener('DOMContentLoaded', () => {
    const isCompleted = localStorage.getItem('wizard_completed');
    if (isCompleted === 'true') {
      const ov = getEl('wizard-overlay');
      if (ov) { ov.style.display = 'none'; ov.classList.add('hidden'); ov.style.pointerEvents = 'none'; }
      const appEl = document.querySelector('.app');
      if (appEl) { appEl.style.filter = 'none'; appEl.style.pointerEvents = 'auto'; }
      // Also hide splash since returning user
      const splash = document.getElementById('mode-splash');
      if (splash) splash.style.display = 'none';
      if (typeof loadParameters === 'function') loadParameters();
      if (typeof _isLoading !== 'undefined') _isLoading = false;
      if (typeof runSimulation === 'function') runSimulation();
    } else {
      updateDots(0);
    }
  });

})(); // end IIFE
