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

  // 遷移行列（コールバック優先、フォールバックでグローバル参照）
  const _tmValues = _cb('getTmValues') ?? (typeof tmValues !== 'undefined' ? tmValues : null);
  if (_tmValues) s.tmValues = JSON.stringify(_tmValues);

  // REGIMES
  const _REGIMES = _cb('getREGIMES') ?? (typeof REGIMES !== 'undefined' ? REGIMES : null);
  if (_REGIMES) s.regimes = JSON.stringify(_REGIMES);

  // ライフステージ
  const _expStages = _cb('getExpStages') ?? (typeof expStages !== 'undefined' ? expStages : null);
  if (_expStages) s.expenseStages = JSON.stringify(_expStages);

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
    if (s.gender) {
      const _setGender = _cb('setGender') ?? (typeof setGender === 'function' ? setGender : null);
      if (_setGender) _setGender(s.gender);
    }

    // 難易度（TM・REGIMESより先に適用してから後で上書き）
    if (s.difficulty) {
      const _setDifficulty = _cb('setDifficulty') ?? (typeof setDifficulty === 'function' ? setDifficulty : null);
      if (_setDifficulty) _setDifficulty(s.difficulty);
    }

    // 遷移行列（難易度のデフォルト値を上書き）
    const _tmValues = _cb('getTmValues') ?? (typeof tmValues !== 'undefined' ? tmValues : null);
    if (s.tmValues && _tmValues) {
      try {
        const loaded = JSON.parse(s.tmValues);
        loaded.forEach((row, ri) => {
          row.forEach((v, ci) => {
            _tmValues[ri][ci] = v;
            const sl   = document.getElementById(`tms-${ri}-${ci}`);
            const disp = document.getElementById(`tmv-${ri}-${ci}`);
            if (sl)   sl.value = v;
            if (disp) disp.textContent = v + '%';
          });
          const _updateSum = _cb('updateSum') ?? (typeof updateSum === 'function' ? updateSum : null);
          if (_updateSum) _updateSum(ri);
        });
      } catch(e) { console.warn('[FLOW] TM復元失敗:', e); }
    }

    // REGIMES
    const _REGIMES = _cb('getREGIMES') ?? (typeof REGIMES !== 'undefined' ? REGIMES : null);
    if (s.regimes && _REGIMES) {
      try {
        const loaded = JSON.parse(s.regimes);
        loaded.forEach((r, i) => Object.assign(_REGIMES[i], r));
        const _updateRegimeCards = _cb('updateRegimeCards') ?? (typeof updateRegimeCards === 'function' ? updateRegimeCards : null);
        if (_updateRegimeCards) _updateRegimeCards();
      } catch(e) { console.warn('[FLOW] REGIMES復元失敗:', e); }
    }

    // ライフステージ
    if (s.expenseStages) {
      try {
        const loaded = JSON.parse(s.expenseStages);
        if (Array.isArray(loaded) && loaded.length > 0) {
          const _setExpStages = _cb('setExpStages') ?? null;
          const _setStageIdCounter = _cb('setStageIdCounter') ?? null;
          if (_setExpStages) {
            _setExpStages(loaded);
          } else if (typeof expStages !== 'undefined') {
            // フォールバック
            expStages = loaded;
          }
          const maxId = Math.max(...loaded.map(st => (typeof st.id === 'number' ? st.id : 0)), 0);
          if (_setStageIdCounter) {
            _setStageIdCounter(maxId);
          } else if (typeof stageIdCounter !== 'undefined') {
            stageIdCounter = maxId;
          }
          const _renderStages = _cb('renderStages') ?? (typeof renderStages === 'function' ? renderStages : null);
          if (_renderStages) _renderStages();
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

// ============================================================
// initStorage — コールバック注入パターンで循環依存を解消
//
// simulation.js / ui.js 側の状態や関数を直接 import する代わりに、
// app.js が「コールバックオブジェクト」として渡す。
// これにより storage → simulation の依存が消え、依存グラフが一方向になる。
//
// 引数 callbacks の形:
// {
//   getREGIMES:          () => REGIMES,       // グローバル配列の参照を返す
//   getTmValues:         () => tmValues,       // 遷移行列
//   getExpStages:        () => expStages,      // ライフステージ配列
//   setExpStages:        (v) => { expStages=v },
//   getStageIdCounter:   () => stageIdCounter,
//   setStageIdCounter:   (v) => { stageIdCounter=v },
//   renderStages:        () => renderStages(),
//   updateRegimeCards:   () => updateRegimeCards(),
//   setDifficulty:       (m) => setDifficulty(m),
//   setGender:           (g) => setGender(g),
//   updateSum:           (ri) => updateSum(ri),
//   getCurrentDifficulty:() => currentDifficulty,
// }
// ============================================================
let _storageCallbacks = null;

function initStorage(callbacks) {
  _storageCallbacks = callbacks;
}

// REGIMES/tmValues/expStages を安全に取得するヘルパー
function _cb(name, ...args) {
  if (_storageCallbacks && typeof _storageCallbacks[name] === 'function') {
    return _storageCallbacks[name](...args);
  }
  // フォールバック: グローバル変数を直接参照（モジュール化前の後方互換）
  return undefined;
}
