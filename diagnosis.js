/**
 * diagnosis.js — 家計タイプ診断エンジン
 * FLOW | 資産シミュレーター
 *
 * 戦略: simulation.js の結果から「家計タイプ」を判定し、
 *       ・タイプ名・キャラクター説明・SNS共有テキストを生成
 *       ・「寿命延長カード」UI（タップして改善効果をリアルタイム表示）
 *       ・初心者/通常モードの結果エリアを置き換える
 */
(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════
  // 1. 家計タイプ定義（5タイプ）
  // ═══════════════════════════════════════════════════════════
  const HOUSEHOLD_TYPES = [
    {
      id: 'escape',
      name: '逃げ切り成功型',
      emoji: '🏆',
      tag: '余裕の隠居予備軍',
      color: '#a8ff78',
      glow: 'rgba(168,255,120,.4)',
      desc: '資産管理が優秀で、老後も十分な余裕があります。このまま維持すれば100歳まで安心。',
      share: '私の家計タイプは【逃げ切り成功型🏆】でした！\n老後も余裕の資産設計。このまま継続するだけでOK。',
      condition: (r) => r.successRate >= 0.88 && r.surplus65Man > 500,
    },
    {
      id: 'steady',
      name: '堅実長寿型',
      emoji: '🔒',
      tag: '計算高い安定志向',
      color: '#00d4ff',
      glow: 'rgba(0,212,255,.4)',
      desc: '着実な積立と節約で老後設計は良好。少しの改善でさらに安心度が上がります。',
      share: '私の家計タイプは【堅実長寿型🔒】でした！\n地道に積み上げる堅実派。あと少しで完璧な老後設計に。',
      condition: (r) => r.successRate >= 0.70,
    },
    {
      id: 'late',
      name: '遅咲き大器晩成型',
      emoji: '🌱',
      tag: '将来の大器晩成タイプ',
      color: '#b388ff',
      glow: 'rgba(179,136,255,.4)',
      desc: 'まだ若い段階で対策を始めれば十分間に合います。時間を味方につけましょう。',
      share: '私の家計タイプは【遅咲き大器晩成型🌱】でした！\n今からでも遅くない。複利の力で将来は大器晩成タイプに。',
      condition: (r) => r.startAge <= 38 && r.successRate >= 0.50,
    },
    {
      id: 'spender',
      name: '高収入浪費型',
      emoji: '🌊',
      tag: '穴の空いたバケツ状態',
      color: '#ffd166',
      glow: 'rgba(255,209,102,.4)',
      desc: '収入は高いのに老後資金が不十分。支出の見直しで劇的に改善できます。',
      share: '私の家計タイプは【高収入浪費型🌊】でした！\n稼いでいるのに老後が不安…支出を見直すだけで大逆転できるらしい。',
      condition: (r) => r.successRate < 0.70 && r.monthlyRetire >= 20,
    },
    {
      id: 'gambler',
      name: '一発逆転依存型',
      emoji: '🎲',
      tag: 'リスクを取りすぎな博打打ち',
      color: '#ff4757',
      glow: 'rgba(255,71,87,.4)',
      desc: '資産が少なく高リターン狙い。堅実な積立に切り替えることが最優先です。',
      share: '私の家計タイプは【一発逆転依存型🎲】でした！\n老後が危険ゾーン…でも今から堅実な積立に切り替えれば逆転可能らしい。',
      condition: () => true, // フォールバック
    },
  ];

  function getHouseholdType(result) {
    return HOUSEHOLD_TYPES.find(t => t.condition(result)) || HOUSEHOLD_TYPES[HOUSEHOLD_TYPES.length - 1];
  }

  // ═══════════════════════════════════════════════════════════
  // 2. 資産寿命計算（シンプル版）
  // ═══════════════════════════════════════════════════════════
  function calcAssetLifeAge(result) {
    // successRate から「資産が何歳まで持つか」を推定
    // 100% = 120歳、0% = 65歳 の線形補間（大まかな目安）
    const sr = result.successRate ?? 0;
    if (sr >= 0.95) return '100歳以上';
    if (sr >= 0.85) return Math.round(90 + sr * 10) + '歳';
    if (sr >= 0.70) return Math.round(80 + sr * 12) + '歳';
    if (sr >= 0.50) return Math.round(72 + sr * 14) + '歳';
    return Math.round(65 + sr * 14) + '歳';
  }

  // ═══════════════════════════════════════════════════════════
  // 3. 寿命延長カード定義
  // ═══════════════════════════════════════════════════════════
  const LIFE_CARDS = [
    {
      id: 'nisa',
      icon: '💹',
      title: 'NISA積立を月3万円増やす',
      sub: '新NISAの非課税枠を活用',
      effect: '+12年',
      effectPts: 12,
      pctBoost: 0.12,
      color: '#a8ff78',
      detail: '年利5%複利で30年運用した場合の試算。非課税メリットで実質利回りがさらにアップ。',
    },
    {
      id: 'expense',
      icon: '✂️',
      title: '固定費を月1万円削減',
      sub: 'サブスク・通信費を見直す',
      effect: '+5年',
      effectPts: 5,
      pctBoost: 0.06,
      color: '#00d4ff',
      detail: '月1万円 × 12ヶ月 × 30年 = 360万円の効果。固定費削減は最も確実な資産増加策。',
    },
    {
      id: 'retire',
      icon: '🕐',
      title: '定年を2年延ばす',
      sub: '65歳まで現役で収入延長',
      effect: '+5年',
      effectPts: 5,
      pctBoost: 0.07,
      color: '#b388ff',
      detail: '収入延長＋年金増額のダブル効果。2年の延長で老後資産が大幅に改善。',
    },
    {
      id: 'side',
      icon: '💻',
      title: '副業で月3万円追加',
      sub: 'スキル活用・フリーランス',
      effect: '+8年',
      effectPts: 8,
      pctBoost: 0.09,
      color: '#ffd166',
      detail: '月3万円の副業収入を全額投資した場合の試算。スキルアップと収入増の一石二鳥。',
    },
    {
      id: 'ideco',
      icon: '🏛️',
      title: 'iDeCoを満額拠出',
      sub: '所得控除で節税しながら積立',
      effect: '+7年',
      effectPts: 7,
      pctBoost: 0.08,
      color: '#ff6eb4',
      detail: '節税効果（所得税+住民税）と複利運用のダブル効果。会社員なら月2.3万円まで。',
    },
    {
      id: 'realestate',
      icon: '🏠',
      title: '家賃収入を得る',
      sub: '不動産投資・賃貸運用',
      effect: '+10年',
      effectPts: 10,
      pctBoost: 0.11,
      color: '#a8ff78',
      detail: '安定した不動産収入は老後の大きな支えに。ただし物件選定リスクに注意。',
    },
  ];

  // ═══════════════════════════════════════════════════════════
  // 4. 診断結果パネル描画
  // ═══════════════════════════════════════════════════════════
  let _activeCards = new Set(); // 選択中カード
  let _baseSuccessRate = 0;
  let _baseLifeAge = '';
  let _currentType = null;

  function renderDiagnosisPanel(result) {
    const container = document.getElementById('diagnosis-panel');
    if (!container) return;

    const type = getHouseholdType(result);
    _currentType = type;
    _baseSuccessRate = result.successRate ?? 0;
    _baseLifeAge = calcAssetLifeAge(result);
    _activeCards.clear();

    const pct = Math.round(_baseSuccessRate * 100);

    container.innerHTML = `
      <div class="diag-wrap" id="diag-wrap">

        <!-- ━━ タイプ診断メインカード ━━ -->
        <div class="diag-type-card" style="--type-color:${type.color};--type-glow:${type.glow}">
          <div class="diag-type-header">
            <span class="diag-type-tag">🔍 あなたの家計タイプ診断</span>
            <span class="diag-age-badge">${result.startAge ?? '—'}歳</span>
          </div>

          <div class="diag-type-main">
            <div class="diag-type-emoji">${type.emoji}</div>
            <div class="diag-type-info">
              <div class="diag-type-name" style="color:${type.color}">${type.name}</div>
              <div class="diag-type-tag-label">${type.tag}</div>
            </div>
          </div>

          <div class="diag-life-gauge">
            <div class="diag-life-label">💰 お金の寿命（推定）</div>
            <div class="diag-life-age" id="diag-life-age" style="color:${type.color}">${_baseLifeAge}</div>
          </div>

          <div class="diag-score-bar-wrap">
            <div class="diag-score-bar-track">
              <div class="diag-score-bar-fill" id="diag-score-fill"
                style="width:${pct}%;background:${type.color};box-shadow:0 0 12px ${type.glow}">
              </div>
            </div>
            <div class="diag-score-nums">
              <span style="color:${type.color};font-size:28px;font-weight:800;font-family:'Space Mono',monospace"
                id="diag-pct-num">${pct}</span>
              <span style="font-size:14px;color:var(--text-dim);margin-left:2px">%</span>
              <span style="font-size:12px;color:var(--text-dim);margin-left:10px">老後安心スコア</span>
            </div>
          </div>

          <div class="diag-type-desc">${type.desc}</div>
        </div>

        <!-- ━━ 寿命延長カード ━━ -->
        <div class="diag-cards-section">
          <div class="diag-cards-title">
            <span>🃏 寿命延長カードを選んで装備しよう</span>
            <span class="diag-cards-hint">タップして資産寿命がのびる！</span>
          </div>
          <div class="diag-cards-grid" id="diag-life-cards">
            ${LIFE_CARDS.map(card => `
              <div class="diag-life-card" id="lcard-${card.id}"
                   onclick="toggleLifeCard('${card.id}')"
                   data-pts="${card.effectPts}"
                   data-boost="${card.pctBoost}">
                <div class="dlc-icon">${card.icon}</div>
                <div class="dlc-body">
                  <div class="dlc-title">${card.title}</div>
                  <div class="dlc-sub">${card.sub}</div>
                </div>
                <div class="dlc-effect" style="color:${card.color}">
                  <span class="dlc-effect-val">${card.effect}</span>
                </div>
                <div class="dlc-check" id="lcard-check-${card.id}">✓</div>
              </div>
            `).join('')}
          </div>

          <!-- 改善後スコア表示 -->
          <div class="diag-boost-result" id="diag-boost-result" style="display:none">
            <div class="dbr-inner">
              <div class="dbr-label">カードを装備した場合の推定スコア</div>
              <div class="dbr-score-row">
                <span class="dbr-before" id="dbr-before">${pct}%</span>
                <span class="dbr-arrow">→</span>
                <span class="dbr-after" id="dbr-after" style="color:${type.color}">—</span>
              </div>
              <div class="dbr-life-row">
                <span class="dbr-life-label">📅 資産寿命</span>
                <span class="dbr-life-val" id="dbr-life-val" style="color:${type.color}">—</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ━━ SNSシェアセクション ━━ -->
        <div class="diag-share-section">
          <div class="diag-share-title">📱 診断結果をシェアしよう</div>
          <div class="diag-share-preview" id="diag-share-preview">
            <div class="dsp-type" style="color:${type.color}">${type.emoji} ${type.name}</div>
            <div class="dsp-text">${type.share.replace(/\n/g, '<br>')}</div>
            <div class="dsp-tag" style="color:var(--text-dim)">#家計タイプ診断 #FLOW資産シミュレーター</div>
          </div>
          <button class="diag-share-x-btn" onclick="shareDiagnosisToX()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.261 5.632L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/>
            </svg>
            Xにシェアする
          </button>
          <button class="diag-share-copy-btn" onclick="copyDiagnosisText()" id="diag-copy-btn">
            📋 テキストをコピー
          </button>
        </div>

      </div>
    `;

    // スタイル注入
    injectDiagnosisStyles();
  }

  // ━━ 寿命延長カード トグル ━━
  window.toggleLifeCard = function (cardId) {
    const card = LIFE_CARDS.find(c => c.id === cardId);
    if (!card) return;

    const el = document.getElementById('lcard-' + cardId);
    const checkEl = document.getElementById('lcard-check-' + cardId);

    if (_activeCards.has(cardId)) {
      _activeCards.delete(cardId);
      el.classList.remove('dlc-active');
    } else {
      _activeCards.add(cardId);
      el.classList.add('dlc-active');
    }

    // スコア再計算
    _updateBoostDisplay();
  };

  function _updateBoostDisplay() {
    const boostEl = document.getElementById('diag-boost-result');
    const afterEl = document.getElementById('dbr-after');
    const lifeEl  = document.getElementById('dbr-life-val');
    const fillEl  = document.getElementById('diag-score-fill');
    const pctEl   = document.getElementById('diag-pct-num');
    const lifeAgeEl = document.getElementById('diag-life-age');

    if (_activeCards.size === 0) {
      if (boostEl) boostEl.style.display = 'none';
      if (fillEl) fillEl.style.width = Math.round(_baseSuccessRate * 100) + '%';
      if (pctEl)  pctEl.textContent  = Math.round(_baseSuccessRate * 100);
      if (lifeAgeEl) lifeAgeEl.textContent = _baseLifeAge;
      return;
    }

    // 合算ブースト（上限0.98）
    let totalBoost = 0;
    _activeCards.forEach(id => {
      const c = LIFE_CARDS.find(x => x.id === id);
      if (c) totalBoost += c.pctBoost;
    });
    const newRate = Math.min(0.98, _baseSuccessRate + totalBoost);
    const newPct  = Math.round(newRate * 100);
    const newLife = calcAssetLifeAge({ successRate: newRate, startAge: _currentType?.startAge });
    const delta   = newPct - Math.round(_baseSuccessRate * 100);

    if (boostEl) boostEl.style.display = 'block';
    if (afterEl) afterEl.textContent   = newPct + '%  (+' + delta + 'pt)';
    if (lifeEl)  lifeEl.textContent    = newLife;
    if (fillEl)  fillEl.style.width    = newPct + '%';
    if (pctEl)   pctEl.textContent     = newPct;
    if (lifeAgeEl) lifeAgeEl.textContent = newLife;
  }

  // ━━ X シェア ━━
  window.shareDiagnosisToX = function () {
    const result = window._lastSimResult;
    if (!result) return;
    const type = getHouseholdType(result);
    const life = calcAssetLifeAge(result);
    const pct  = Math.round((result.successRate ?? 0) * 100);

    // カード装備中なら改善後テキスト
    let cardText = '';
    if (_activeCards.size > 0) {
      let totalBoost = 0;
      _activeCards.forEach(id => {
        const c = LIFE_CARDS.find(x => x.id === id);
        if (c) totalBoost += c.pctBoost;
      });
      const newPct = Math.round(Math.min(0.98, (result.successRate ?? 0) + totalBoost) * 100);
      cardText = `\n改善策を実践すれば → ${newPct}% に！`;
    }

    const text = [
      `【FLOW 家計タイプ診断】`,
      `私の家計タイプは「${type.emoji} ${type.name}」でした！`,
      `資産寿命: ${life} / 老後安心スコア: ${pct}%`,
      cardText,
      `#家計タイプ診断 #FLOW資産シミュレーター`,
    ].filter(Boolean).join('\n');

    const url = encodeURIComponent(location.href.split('?')[0]);
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${url}`, '_blank', 'noopener,width=600,height=400');
  };

  window.copyDiagnosisText = function () {
    const result = window._lastSimResult;
    if (!result) return;
    const type = getHouseholdType(result);
    const life = calcAssetLifeAge(result);
    const pct  = Math.round((result.successRate ?? 0) * 100);
    const text = `【FLOW 家計タイプ診断】\n私の家計タイプは「${type.emoji} ${type.name}」でした！\n資産寿命: ${life} / 老後安心スコア: ${pct}%\n#家計タイプ診断 #FLOW資産シミュレーター`;
    navigator.clipboard?.writeText(text).then(() => {
      const btn = document.getElementById('diag-copy-btn');
      if (btn) { btn.textContent = '✅ コピーしました！'; setTimeout(() => { btn.textContent = '📋 テキストをコピー'; }, 2000); }
    });
  };

  // ═══════════════════════════════════════════════════════════
  // 5. sim:done を受け取って描画
  // ═══════════════════════════════════════════════════════════
  window.addEventListener('sim:done', function (e) {
    if (e.detail) {
      const mode = document.body.getAttribute('data-mode');
      if (mode === 'beginner' || mode === 'normal') {
        renderDiagnosisPanel(e.detail);
        const panel = document.getElementById('diagnosis-panel');
        if (panel) {
          panel.style.display = 'block';
          setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
        }
      }
    }
  });

  // ═══════════════════════════════════════════════════════════
  // 6. スタイル注入
  // ═══════════════════════════════════════════════════════════
  function injectDiagnosisStyles() {
    if (document.getElementById('diagnosis-styles')) return;
    const style = document.createElement('style');
    style.id = 'diagnosis-styles';
    style.textContent = `
/* ═══════ 家計タイプ診断パネル ═══════ */
.diag-wrap {
  display: flex;
  flex-direction: column;
  gap: 16px;
  font-family: 'Noto Sans JP', sans-serif;
}

/* ─ タイプ診断メインカード ─ */
.diag-type-card {
  background: linear-gradient(135deg,
    rgba(var(--type-color-rgb, 168,255,120), .06) 0%,
    var(--surface, #0b1220) 60%);
  border: 1px solid color-mix(in srgb, var(--type-color, #a8ff78) 40%, transparent);
  border-radius: 16px;
  padding: 20px 20px 18px;
  position: relative;
  overflow: hidden;
  box-shadow: 0 0 40px var(--type-glow, rgba(168,255,120,.2));
  transition: box-shadow .4s;
}
.diag-type-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 60% 40% at 80% 20%,
    var(--type-glow, rgba(168,255,120,.12)) 0%, transparent 70%);
  pointer-events: none;
}
.diag-type-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.diag-type-tag {
  font-size: 11px;
  color: var(--text-dim, #7a9bbf);
  font-family: 'Space Mono', monospace;
  letter-spacing: 1px;
}
.diag-age-badge {
  font-size: 11px;
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.12);
  padding: 3px 10px;
  border-radius: 20px;
  color: var(--text-mid, #9ab0c8);
}
.diag-type-main {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 18px;
}
.diag-type-emoji {
  font-size: 52px;
  line-height: 1;
  filter: drop-shadow(0 0 12px var(--type-glow, rgba(168,255,120,.5)));
}
.diag-type-name {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: .5px;
  line-height: 1.2;
  margin-bottom: 4px;
}
.diag-type-tag-label {
  font-size: 13px;
  color: var(--text-mid, #9ab0c8);
}

/* ─ 資産寿命ゲージ ─ */
.diag-life-gauge {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: rgba(0,0,0,.25);
  border-radius: 10px;
  margin-bottom: 14px;
}
.diag-life-label {
  font-size: 12px;
  color: var(--text-dim, #7a9bbf);
}
.diag-life-age {
  font-size: 28px;
  font-weight: 800;
  font-family: 'Space Mono', monospace;
  transition: all .5s cubic-bezier(.4,0,.2,1);
}

/* ─ スコアバー ─ */
.diag-score-bar-wrap { margin-bottom: 14px; }
.diag-score-bar-track {
  height: 10px;
  background: rgba(255,255,255,.07);
  border-radius: 5px;
  overflow: hidden;
  margin-bottom: 8px;
}
.diag-score-bar-fill {
  height: 100%;
  border-radius: 5px;
  transition: width .8s cubic-bezier(.4,0,.2,1);
}
.diag-score-nums { display: flex; align-items: baseline; }
.diag-type-desc {
  font-size: 13px;
  color: var(--text-mid, #9ab0c8);
  line-height: 1.8;
  border-top: 1px solid rgba(255,255,255,.06);
  padding-top: 12px;
}

/* ─ 寿命延長カードセクション ─ */
.diag-cards-section {
  background: var(--surface, #0b1220);
  border: 1px solid var(--border, #1c3050);
  border-radius: 14px;
  padding: 16px;
}
.diag-cards-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text, #e2eef8);
}
.diag-cards-hint {
  font-size: 10px;
  color: var(--text-dim, #7a9bbf);
  font-weight: 400;
  animation: diag-hint-pulse 2s ease-in-out infinite;
}
@keyframes diag-hint-pulse {
  0%,100% { opacity: .6; }
  50%      { opacity: 1; }
}
.diag-cards-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.diag-life-card {
  background: var(--surface2, #0f1a2c);
  border: 1px solid var(--border, #1c3050);
  border-radius: 10px;
  padding: 10px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all .2s cubic-bezier(.4,0,.2,1);
  position: relative;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.diag-life-card:hover {
  border-color: var(--accent, #00d4ff);
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0,212,255,.15);
}
.diag-life-card.dlc-active {
  border-color: var(--accent3, #a8ff78);
  background: rgba(168,255,120,.08);
  box-shadow: 0 0 16px rgba(168,255,120,.2);
}
.diag-life-card.dlc-active .dlc-effect { opacity: 1; }
.diag-life-card.dlc-active::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 10px;
  background: rgba(168,255,120,.04);
}
.dlc-check {
  display: none;
  position: absolute;
  top: 6px; right: 6px;
  font-size: 12px;
  color: var(--accent3, #a8ff78);
  background: rgba(168,255,120,.15);
  border-radius: 50%;
  width: 18px; height: 18px;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}
.dlc-active .dlc-check { display: flex; }
.dlc-icon { font-size: 22px; flex-shrink: 0; }
.dlc-body { flex: 1; min-width: 0; }
.dlc-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--text, #e2eef8);
  line-height: 1.3;
}
.dlc-sub {
  font-size: 10px;
  color: var(--text-dim, #7a9bbf);
  margin-top: 2px;
}
.dlc-effect {
  font-size: 13px;
  font-weight: 800;
  font-family: 'Space Mono', monospace;
  flex-shrink: 0;
  opacity: .6;
  transition: opacity .2s;
}

/* ─ 改善後スコア ─ */
.diag-boost-result {
  margin-top: 12px;
  background: linear-gradient(135deg, rgba(168,255,120,.08), rgba(0,212,255,.06));
  border: 1px solid rgba(168,255,120,.25);
  border-radius: 10px;
  padding: 14px 16px;
  animation: diag-boost-in .4s ease-out;
}
@keyframes diag-boost-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.dbr-inner { display: flex; flex-direction: column; gap: 8px; }
.dbr-label { font-size: 11px; color: var(--text-dim, #7a9bbf); }
.dbr-score-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.dbr-before {
  font-size: 20px;
  font-family: 'Space Mono', monospace;
  color: var(--text-dim, #7a9bbf);
}
.dbr-arrow {
  font-size: 16px;
  color: var(--accent3, #a8ff78);
}
.dbr-after {
  font-size: 26px;
  font-weight: 800;
  font-family: 'Space Mono', monospace;
  transition: all .4s;
}
.dbr-life-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}
.dbr-life-label { color: var(--text-dim, #7a9bbf); }
.dbr-life-val { font-weight: 700; font-family: 'Space Mono', monospace; }

/* ─ SNSシェア ─ */
.diag-share-section {
  background: var(--surface, #0b1220);
  border: 1px solid var(--border, #1c3050);
  border-radius: 14px;
  padding: 16px;
}
.diag-share-title {
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 12px;
  color: var(--text, #e2eef8);
}
.diag-share-preview {
  background: rgba(255,255,255,.03);
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 12px;
  font-size: 12px;
  line-height: 1.8;
}
.dsp-type {
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 4px;
}
.dsp-text { color: var(--text-mid, #9ab0c8); }
.dsp-tag { margin-top: 6px; font-size: 11px; }
.diag-share-x-btn {
  width: 100%;
  padding: 14px;
  background: #000;
  border: 1px solid rgba(255,255,255,.2);
  border-radius: 10px;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 8px;
  transition: all .2s;
  font-family: 'Noto Sans JP', sans-serif;
}
.diag-share-x-btn:hover {
  background: rgba(255,255,255,.1);
  box-shadow: 0 4px 20px rgba(255,255,255,.1);
}
.diag-share-copy-btn {
  width: 100%;
  padding: 11px;
  background: rgba(255,255,255,.05);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 8px;
  color: var(--text-mid, #9ab0c8);
  font-size: 13px;
  cursor: pointer;
  transition: all .2s;
  font-family: 'Noto Sans JP', sans-serif;
}
.diag-share-copy-btn:hover { background: rgba(255,255,255,.1); }

/* ─ モバイル対応 ─ */
@media (max-width: 480px) {
  .diag-cards-grid { grid-template-columns: 1fr; }
  .diag-type-emoji { font-size: 40px; }
  .diag-type-name  { font-size: 20px; }
  .diag-life-age   { font-size: 22px; }
}
    `;
    document.head.appendChild(style);
  }

  // 初期スタイルを先に注入
  injectDiagnosisStyles();

})();
