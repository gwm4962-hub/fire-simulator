/**
 * storage.js — 設定の自動保存・復元システム
 * FLOW | 資産シミュレーター
 */
// ============================================================
// 設定の自動保存・復元システム
// ============================================================
const STORAGE_KEY = "FIRE_SIM_V4_SETTINGS";

/**
 * プライバシー保護について
 * ---------------------------------------------------------------------------
 * 保存するデータ: 年齢・資産額・収入・支出など本ツール内の設定値のみ。
 * 保存先: localStorage（お使いのブラウザ内のみ。外部サーバーには送信しない）。
 * 削除方法: 下記 clearLocalData() 関数を呼び出すか、ブラウザの
 *   「サイトのデータを消去」からいつでも削除できます。
 *
 * localStorage と sessionStorage の選択について
 *   本ツールはシミュレーターの性質上、複数セッションを跨いで設定を
 *   復元することをユーザーが期待しているため localStorage を採用しています。
 *   「セッション終了時に消えてよい」用途には sessionStorage が適切ですが、
 *   本ツールでは「前回の設定を続きから使いたい」ニーズを優先しています。
 * ---------------------------------------------------------------------------
 */

/**
 * clearLocalData — ユーザー要求に応じてすべての保存データを削除する。
 * プライバシーポリシーや設定画面から呼び出してください。
 */
function clearLocalData() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('wizard_completed');
    localStorage.removeItem('fire_sim_mode');
    localStorage.removeItem('splash_seen');
    localStorage.removeItem('pwa_banner_dismissed');
    flashBadge('CLEARED ✓', 'var(--warning)');
    console.info('[FLOW] ローカルデータを削除しました。');
  } catch (e) {
    console.warn('[FLOW] データ削除失敗:', e);
  }
}

// 保存対象のスライダー／数値入力ID一覧
const PARAM_INPUT_IDS = [
  "start-age", "num-initial-assets", "initial-assets", "fire-threshold",
  "income", "take-home", "raise", "pension", "inheritance", "base-infl",
  "w-working", "w-retired", "tdof", "med-adv", "nsims"
];

// ロード中フラグ（ロード中はscheduleSaveを無視する）
let _isLoading = false;
let _saveTimer = null;

// ---- デバウンス ----
function scheduleSave() {
  if (_isLoading) return; // ロード中は保存しない
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(saveParameters, 500);
}

// ---- バッジ表示 ----
let _badgeTimer = null;
function flashBadge(text, color) {
  const badge = document.getElementById("status-badge");
  if (!badge || badge.textContent === 'RUNNING') return;
  clearTimeout(_badgeTimer);
  const prevText = badge.textContent;
  const prevStyle = badge.style.cssText;
  badge.textContent = text;
  badge.style.color = color || 'var(--accent3)';
  // 保存時刻を更新
  if (text.startsWith('SAVED')) {
    const now = new Date();
    const timeStr = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
    const el = document.getElementById('last-saved-time');
    const wrap = document.getElementById('last-saved-label');
    if (el) el.textContent = timeStr;
    if (wrap) wrap.style.display = 'block';
  }
  _badgeTimer = setTimeout(() => {
    badge.textContent = prevText;
    badge.style.cssText = prevStyle;
  }, 1500);
}

// ---- 保存 ----
function saveParameters() {
  const s = {};

  // スライダー・数値入力
  PARAM_INPUT_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) s[id] = el.value;
  });

  // 性別
  const maleBtn = document.getElementById("btn-male");
  s.gender = (maleBtn && maleBtn.classList.contains("active-m")) ? "male" : "female";

  // 難易度
  s.difficulty = (typeof currentDifficulty !== 'undefined') ? currentDifficulty : 'normal';

  // 遷移行列
  if (typeof tmValues !== 'undefined') {
    s.tmValues = JSON.stringify(tmValues);
  }

  // REGIMES
  if (typeof REGIMES !== 'undefined') {
    s.regimes = JSON.stringify(REGIMES);
  }

  // ライフステージ
  if (typeof expStages !== 'undefined') {
    s.expenseStages = JSON.stringify(expStages);
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    flashBadge('SAVED ✓', 'var(--accent3)');
  } catch(e) {
    console.warn('[FLOW] 保存失敗:', e);
  }
}

// ---- 復元 ----
function loadParameters() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;

  let s;
  try { s = JSON.parse(raw); }
  catch(e) { console.warn('[FLOW] 読み込み失敗:', e); return false; }

  _isLoading = true; // ← 復元中はscheduleSaveを止める

  try {
    // スライダー・数値入力（dispatchEventしてラベル表示も更新）
    PARAM_INPUT_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (el && s[id] !== undefined) {
        el.value = s[id];
        el.dispatchEvent(new Event('input'));
      }
    });

    // 性別
    if (s.gender && typeof setGender === 'function') {
      setGender(s.gender);
    }

    // 難易度（TM・REGIMESより先に適用してから後で上書き）
    if (s.difficulty && typeof setDifficulty === 'function') {
      setDifficulty(s.difficulty);
    }

    // 遷移行列（難易度のデフォルト値を上書き）
    if (s.tmValues && typeof tmValues !== 'undefined') {
      try {
        const loaded = JSON.parse(s.tmValues);
        loaded.forEach((row, ri) => {
          row.forEach((v, ci) => {
            tmValues[ri][ci] = v;
            const sl   = document.getElementById(`tms-${ri}-${ci}`);
            const disp = document.getElementById(`tmv-${ri}-${ci}`);
            if (sl)   sl.value = v;
            if (disp) disp.textContent = v + '%';
          });
          if (typeof updateSum === 'function') updateSum(ri);
        });
      } catch(e) { console.warn('[FLOW] TM復元失敗:', e); }
    }

    // REGIMES
    if (s.regimes && typeof REGIMES !== 'undefined') {
      try {
        const loaded = JSON.parse(s.regimes);
        loaded.forEach((r, i) => Object.assign(REGIMES[i], r));
        if (typeof updateRegimeCards === 'function') updateRegimeCards();
      } catch(e) { console.warn('[FLOW] REGIMES復元失敗:', e); }
    }

    // ライフステージ
    if (s.expenseStages && typeof expStages !== 'undefined') {
      try {
        const loaded = JSON.parse(s.expenseStages);
        if (Array.isArray(loaded) && loaded.length > 0) {
          expStages = loaded;
          stageIdCounter = Math.max(...loaded.map(st => st.id || 0), 0);
          if (typeof renderStages === 'function') renderStages();
        }
      } catch(e) { console.warn('[FLOW] ライフステージ復元失敗:', e); }
    }

  } finally {
    _isLoading = false; // ← 必ずフラグを戻す
  }
  return true;
}

// ---- イベント委任（動的要素にも対応） ----
function registerAutoSaveListeners() {
  document.addEventListener('input', e => {
    if (e.target.matches('input, textarea')) scheduleSave();
  });
  document.addEventListener('change', e => {
    if (e.target.matches('input, select, textarea')) scheduleSave();
  });
}

// ---- 後方互換 ----
const saveAllSettings = saveParameters;
const loadAllSettings = loadParameters;
  
  // ... 以降、既存のロジック ...
