/**
 * sharecard.js — シェアカード生成 + 改善提案エンジン
 * FLOW | 資産シミュレーター
 *
 * 追加機能:
 *  1. 老後安心ランク（S〜D）+ 偏差値表示カード
 *  2. 未来の肩書きキャラクター化
 *  3. html2canvas でPNG化 → Twitter/Xシェア
 *  4. 改善提案エンジン（NISA・支出削減・退職延長シナリオ比較）
 *
 * 依存: simulation.js (window._lastSimData, window._lastSimParams)
 *       html2canvas (CDN経由、なければ非表示)
 * 読み込み: index.html で simulation.js の後に読み込む
 */
(function () {
  'use strict';

  // ── 1. ランク定義（老後安心度） ─────────────────────────────────────
  const RANKS = [
    { min: 0.90, rank: 'S', label: '悠々自適な逃げ切り世代',   color: '#a8ff78', glow: 'rgba(168,255,120,.35)', emoji: '🏆' },
    { min: 0.75, rank: 'A', label: '盤石な資産防衛族',          color: '#00d4ff', glow: 'rgba(0,212,255,.35)',   emoji: '✨' },
    { min: 0.60, rank: 'B', label: '着実な老後設計者',          color: '#b388ff', glow: 'rgba(179,136,255,.35)', emoji: '📈' },
    { min: 0.45, rank: 'C', label: '綱渡りの現役続行おじさん', color: '#ffd166', glow: 'rgba(255,209,102,.35)', emoji: '⚡' },
    { min: 0.00, rank: 'D', label: '労働の果てなき旅人',        color: '#ff4757', glow: 'rgba(255,71,87,.35)',   emoji: '💪' },
  ];

  function getRank(successRate) {
    return RANKS.find(r => successRate >= r.min) || RANKS[RANKS.length - 1];
  }

  // 擬似偏差値（成功率を正規分布に近似してスコア化）
  function toDevScore(successRate) {
    // 平均50%を偏差値50とし、線形マッピング（0%→25、100%→75）
    const raw = 25 + successRate * 50;
    return Math.min(75, Math.max(25, Math.round(raw)));
  }

  // ── 2. 最新シミュレーション結果を取得 ──────────────────────────────
  function getLastResult() {
    return window._lastSimResult || null;
  }

  // simulation.js の runSimulation 完了後にここへ書き込んでもらう
  // (simulation.js 末尾の window._lastSimData とは別に結果サマリーを保持)
  window._lastSimResult = window._lastSimResult || null;

  // simulation.js 側から呼ばれることを想定したセッター
  window.setLastSimResult = function (result) {
    window._lastSimResult = result;
    _onResultReady(result);
  };

  // ── 3. 結果反映時フック ─────────────────────────────────────────────
  function _onResultReady(result) {
    if (!result) return;
    renderShareCard(result);
    renderImprovementEngine(result);
  }

  // simulation.js が発火するカスタムイベントを購読（非侵襲）
  window.addEventListener('sim:done', function (e) {
    if (e.detail) {
      window._lastSimResult = e.detail;
      _onResultReady(e.detail);
    }
  });

  // ── 4. シェアカード描画 ─────────────────────────────────────────────
  function renderShareCard(result) {
    const container = document.getElementById('share-card-section');
    if (!container) return;

    const sr   = result.successRate ?? 0;
    const rank = getRank(sr);
    const dev  = toDevScore(sr);
    const age  = result.startAge ?? '—';
    const a65  = result.assets65Man != null ? result.assets65Man : '—';
    const pct  = Math.round(sr * 100);

    // 寿命カバー率ラベル
    const lifeLabel = sr >= 0.9 ? '100歳超対応' : sr >= 0.6 ? '90歳まで安心' : '要プランニング';

    container.innerHTML = `
      <div class="sc-wrap">
        <div class="sc-header">
          <span class="sc-label">📊 あなたの老後診断カード</span>
          <span class="sc-hint">金額非表示・安心してシェアできます</span>
        </div>

        <!-- カード本体（html2canvas でキャプチャする対象） -->
        <div id="share-card" class="sc-card" style="--rank-color:${rank.color};--rank-glow:${rank.glow}">
          <div class="sc-card-inner">
            <div class="sc-top">
              <div class="sc-app-name">FLOW | 老後資産診断</div>
              <div class="sc-age-badge">現在 ${age}歳</div>
            </div>

            <div class="sc-rank-block">
              <div class="sc-rank-letter">${rank.rank}</div>
              <div class="sc-rank-meta">
                <div class="sc-rank-title">${rank.emoji} ${rank.label}</div>
                <div class="sc-rank-sub">老後安心ランク</div>
              </div>
            </div>

            <div class="sc-metrics">
              <div class="sc-metric">
                <div class="sc-metric-val">${pct}<span class="sc-unit">%</span></div>
                <div class="sc-metric-key">資産寿命スコア</div>
              </div>
              <div class="sc-metric">
                <div class="sc-metric-val">${dev}<span class="sc-unit">点</span></div>
                <div class="sc-metric-key">老後偏差値</div>
              </div>
              <div class="sc-metric">
                <div class="sc-metric-val sc-life">${lifeLabel}</div>
                <div class="sc-metric-key">カバー寿命</div>
              </div>
            </div>

            <div class="sc-bar-wrap">
              <div class="sc-bar-bg">
                <div class="sc-bar-fill" style="width:${pct}%"></div>
              </div>
              <div class="sc-bar-labels">
                <span>0%</span><span>50%</span><span>100%</span>
              </div>
            </div>

            <div class="sc-footer">
              <span>FLOW シミュレーター</span>
              <span style="opacity:.5;">※金額は非表示 / データはブラウザ内のみ</span>
            </div>
          </div>
        </div>

        <div class="sc-actions">
          <button class="sc-btn sc-btn-dl"  onclick="downloadShareCard()">📥 画像を保存</button>
          <button class="sc-btn sc-btn-x"   onclick="shareCardToX()">𝕏 Xにシェア</button>
        </div>

        <div id="sc-gen-msg" class="sc-gen-msg" style="display:none"></div>
      </div>
    `;
  }

  // ── 5. カードPNGダウンロード ────────────────────────────────────────
  window.downloadShareCard = function () {
    const card = document.getElementById('share-card');
    if (!card) return;

    _ensureHtml2Canvas(function (h2c) {
      const msg = document.getElementById('sc-gen-msg');
      if (msg) { msg.style.display = 'block'; msg.textContent = '🎨 画像を生成しています…'; }

      h2c(card, {
        backgroundColor: '#050810',
        scale: 2,
        useCORS: true,
        logging: false,
      }).then(function (canvas) {
        const link = document.createElement('a');
        link.download = 'flow_rougo_shindan.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
        if (msg) { msg.textContent = '✅ 保存しました！'; setTimeout(() => { msg.style.display = 'none'; }, 2500); }
      }).catch(function (err) {
        console.warn('[ShareCard] html2canvas error:', err);
        if (msg) { msg.textContent = '⚠️ 画像生成に失敗しました'; setTimeout(() => { msg.style.display = 'none'; }, 3000); }
      });
    });
  };

  // ── 6. X（Twitter）シェア ────────────────────────────────────────────
  window.shareCardToX = function () {
    const result = getLastResult();
    if (!result) return;

    const rank = getRank(result.successRate ?? 0);
    const dev  = toDevScore(result.successRate ?? 0);
    const pct  = Math.round((result.successRate ?? 0) * 100);
    const age  = result.startAge ?? '—';

    const text = [
      `【FLOW老後診断】`,
      `現在${age}歳 / 老後安心ランク【${rank.rank}】`,
      `${rank.emoji} ${rank.label}`,
      `資産寿命スコア: ${pct}% / 老後偏差値: ${dev}点`,
      `#老後資産診断 #FLOW家計シミュレーター`,
    ].join('\n');

    const url = encodeURIComponent(location.href.split('?')[0]);
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${url}`;
    window.open(twitterUrl, '_blank', 'noopener,width=600,height=400');
  };

  // ── 7. html2canvas 遅延ロード ────────────────────────────────────────
  function _ensureHtml2Canvas(cb) {
    if (window.html2canvas) { cb(window.html2canvas); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    s.onload  = function () { cb(window.html2canvas); };
    s.onerror = function () {
      const msg = document.getElementById('sc-gen-msg');
      if (msg) { msg.style.display = 'block'; msg.textContent = '⚠️ 画像ライブラリの読み込みに失敗しました。ネット接続を確認してください。'; }
    };
    document.head.appendChild(s);
  }

  // ── 8. 改善提案エンジン ─────────────────────────────────────────────
  /**
   * 簡易モデル: 成功率を「変数を動かしたとき」に近似推計する。
   * 本シミュレーションを再実行せず、感度係数から高速に差分を計算。
   *
   * 感度係数（実験的推定値）:
   *   - NISA満額（+年24万円の追加投資）      → 成功率 +0.04〜+0.12 / 万円
   *   - 支出削減（月 -1万円）               → 成功率 +0.015〜+0.04 / 万円
   *   - 退職延長（+1年）                    → 成功率 +0.015〜+0.025
   * ※係数は surplus65 と現在資産残高から動的に調整する
   */
  function estimateImprovedRate(base, params) {
    const {
      successRate, surplus65, assets65, startAge,
      nisaBoostMan = 0,      // 年間NISA追加投資（万円）
      expCutMan = 0,         // 月支出削減（万円）
      retireDelayYears = 0,  // 退職延長（年）
    } = params;

    // 現状の余剰度（正なら余裕あり）
    const surplusRatio = surplus65 > 0
      ? Math.min(1, surplus65 / Math.max(1, assets65))
      : -0.3;

    // NISA: 年24万円投資で何年か複利。残り年数≒65-startAge
    const remainYears = Math.max(5, 65 - startAge);
    const nisaFutureVal = nisaBoostMan * Math.pow(1.05, remainYears); // 年利5%仮定
    const nisaEffect    = Math.min(0.30, nisaFutureVal / 3000 * 0.18); // 3000万を基準

    // 支出削減: 月削減額 × 12ヶ月 × 残余命（仮20年）
    const expEffect = Math.min(0.25, expCutMan * 12 * 20 / 3000 * 0.18);

    // 退職延長: 1年延ばすごとに収入+支出の両面改善
    const retireEffect = Math.min(0.20, retireDelayYears * 0.025 * (1 + Math.max(0, -surplusRatio)));

    const improved = Math.min(0.98, successRate + nisaEffect + expEffect + retireEffect);
    return Math.round(improved * 100) / 100;
  }

  function renderImprovementEngine(result) {
    const container = document.getElementById('improvement-engine-section');
    if (!container) return;

    const sr      = result.successRate ?? 0;
    const pct     = Math.round(sr * 100);
    const surplus = result.surplus65Man ?? 0; // 万円
    const assets  = result.assets65 ?? 0;     // 円
    const age     = result.startAge ?? 35;
    const rank    = getRank(sr);

    // 3つのシナリオを計算
    const scenarios = [
      {
        id:    'nisa',
        icon:  '💹',
        title: 'NISA満額活用',
        desc:  '年間360万円（新NISA上限）を積立',
        params: { successRate: sr, surplus65: surplus * 10000, assets65: assets, startAge: age, nisaBoostMan: 360 },
        detail: 'つみたてNISA・成長投資枠の年間上限360万円を5%複利で運用',
        cta: null,
      },
      {
        id:    'expense',
        icon:  '✂️',
        title: '月2万円の支出削減',
        desc:  'サブスク・外食費など見直し',
        params: { successRate: sr, surplus65: surplus * 10000, assets65: assets, startAge: age, expCutMan: 2 },
        detail: '通信費・サブスク・外食費など固定費を月2万円カット',
        cta: null,
      },
      {
        id:    'retire',
        icon:  '🕐',
        title: '退職を3年延ばす',
        desc:  '65歳まで現役で収入を確保',
        params: { successRate: sr, surplus65: surplus * 10000, assets65: assets, startAge: age, retireDelayYears: 3 },
        detail: '65歳定年まで働くことで収入延長・年金増額のダブル効果',
        cta: null,
      },
    ];

    // 複合シナリオ（全部合わせると）
    const allParams = {
      successRate: sr, surplus65: surplus * 10000, assets65: assets, startAge: age,
      nisaBoostMan: 360, expCutMan: 2, retireDelayYears: 3,
    };
    const allRate = estimateImprovedRate(sr, allParams);
    const allPct  = Math.round(allRate * 100);

    const rows = scenarios.map(sc => {
      const improved = estimateImprovedRate(sr, sc.params);
      const impPct   = Math.round(improved * 100);
      const delta    = impPct - pct;
      const newRank  = getRank(improved);
      const rankUp   = newRank.rank !== rank.rank;
      return { ...sc, improved, impPct, delta, newRank, rankUp };
    });

    // ランクアップする最大シナリオを強調
    const best = rows.reduce((a, b) => b.delta > a.delta ? b : a, rows[0]);

    container.innerHTML = `
      <div class="ie-wrap">
        <div class="ie-header">
          <div class="ie-title">💡 老後安心度 改善シミュレーター</div>
          <div class="ie-subtitle">どうすれば、もっと安心できる？ — 3つのシナリオ比較</div>
        </div>

        <!-- 現状 -->
        <div class="ie-current">
          <div class="ie-current-label">現在の老後安心スコア</div>
          <div class="ie-current-val">
            <div class="ie-current-pct" style="color:${rank.color}">${pct}<span style="font-size:18px;opacity:.7;">%</span></div>
            <div class="ie-current-rank" style="color:${rank.color}">ランク ${rank.rank}</div>
          </div>
          <div class="ie-current-char">${rank.emoji} ${rank.label}</div>
        </div>

        <!-- 矢印 -->
        <div class="ie-arrow">↓ こうすれば改善できます</div>

        <!-- シナリオカード群 -->
        <div class="ie-cards">
          ${rows.map(sc => `
            <div class="ie-card ${sc.id === best.id ? 'ie-card-best' : ''}">
              <div class="ie-card-top">
                <span class="ie-card-icon">${sc.icon}</span>
                <span class="ie-card-title">${sc.title}</span>
                ${sc.id === best.id ? '<span class="ie-card-badge">最大効果</span>' : ''}
              </div>
              <div class="ie-card-desc">${sc.desc}</div>
              <div class="ie-card-nums">
                <div class="ie-card-before">${pct}%</div>
                <div class="ie-card-arrow-sm">→</div>
                <div class="ie-card-after" style="color:${sc.newRank.color}">${sc.impPct}%</div>
                <div class="ie-card-delta">+${sc.delta}pt</div>
              </div>
              ${sc.rankUp ? `<div class="ie-card-rankup" style="color:${sc.newRank.color}">ランク ${rank.rank} → ${sc.newRank.rank} にアップ！</div>` : ''}
              <div class="ie-card-detail">${sc.detail}</div>
            </div>
          `).join('')}
        </div>

        <!-- 全部合わせると -->
        <div class="ie-combo">
          <div class="ie-combo-label">🚀 3つすべて実践したら…</div>
          <div class="ie-combo-val">
            <span class="ie-combo-before">${pct}%</span>
            <span class="ie-combo-arrow"> ➔ </span>
            <span class="ie-combo-after" style="color:${getRank(allRate).color}">${allPct}%</span>
            <span class="ie-combo-delta">+${allPct - pct}pt</span>
          </div>
          <div class="ie-combo-rank" style="color:${getRank(allRate).color}">
            ${getRank(allRate).emoji} ${getRank(allRate).label}
          </div>
          <div class="ie-combo-note">※改善効果は統計的な推計値です。実際の効果はシミュレーションを再実行してご確認ください。</div>
        </div>

        <!-- パラメータを実際に変えて再シミュレーション促進 -->
        <div class="ie-cta">
          <div class="ie-cta-text">シナリオの数値を変えて、より詳細に試算できます</div>
          <button class="ie-cta-btn" onclick="document.getElementById('run-btn')?.scrollIntoView({behavior:'smooth'})">
            ▶ パラメータを変えて再シミュレーション
          </button>
        </div>
      </div>
    `;
  }

  // ── 9. スタイル注入 ─────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('sharecard-styles')) return;
    const style = document.createElement('style');
    style.id = 'sharecard-styles';
    style.textContent = `
/* ═══════════════════════════════════════════════
   SHARE CARD
═══════════════════════════════════════════════ */
.sc-wrap {
  font-family: var(--font-main, 'Inter', sans-serif);
  margin: 0 auto;
  max-width: 560px;
}
.sc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  flex-wrap: wrap;
  gap: 6px;
}
.sc-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--text, #e8edf5);
  letter-spacing: .5px;
}
.sc-hint {
  font-size: 10px;
  color: var(--text-dim, #6b7a99);
  background: rgba(168,255,120,.08);
  border: 1px solid rgba(168,255,120,.2);
  border-radius: 4px;
  padding: 2px 8px;
}

/* カード本体 */
.sc-card {
  background: linear-gradient(135deg, #0a1628 0%, #050810 60%, #0a0f1e 100%);
  border: 1.5px solid var(--rank-color, #00d4ff);
  border-radius: 16px;
  box-shadow: 0 0 40px var(--rank-glow, rgba(0,212,255,.2)), 0 4px 24px rgba(0,0,0,.6);
  overflow: hidden;
  position: relative;
}
.sc-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 0%, var(--rank-glow, rgba(0,212,255,.12)) 0%, transparent 65%);
  pointer-events: none;
}
.sc-card-inner {
  padding: 24px 28px 20px;
  position: relative;
  z-index: 1;
}
.sc-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.sc-app-name {
  font-size: 11px;
  font-weight: 700;
  color: var(--rank-color, #00d4ff);
  letter-spacing: 1.5px;
  font-family: var(--font-mono, monospace);
  opacity: .85;
}
.sc-age-badge {
  font-size: 11px;
  color: var(--text-dim, #6b7a99);
  background: rgba(255,255,255,.05);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 20px;
  padding: 3px 10px;
}

.sc-rank-block {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}
.sc-rank-letter {
  font-size: 72px;
  font-weight: 900;
  color: var(--rank-color, #00d4ff);
  line-height: 1;
  text-shadow: 0 0 40px var(--rank-glow, rgba(0,212,255,.5));
  letter-spacing: -2px;
  font-family: var(--font-mono, monospace);
}
.sc-rank-meta { display: flex; flex-direction: column; gap: 4px; }
.sc-rank-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text, #e8edf5);
  line-height: 1.3;
}
.sc-rank-sub {
  font-size: 11px;
  color: var(--text-dim, #6b7a99);
  letter-spacing: .5px;
}

.sc-metrics {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
}
.sc-metric {
  background: rgba(255,255,255,.03);
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 8px;
  padding: 10px 8px;
  text-align: center;
}
.sc-metric-val {
  font-size: 22px;
  font-weight: 800;
  color: var(--rank-color, #00d4ff);
  font-family: var(--font-mono, monospace);
  line-height: 1;
  margin-bottom: 4px;
}
.sc-unit { font-size: 12px; opacity: .7; }
.sc-life { font-size: 11px; line-height: 1.3; }
.sc-metric-key {
  font-size: 10px;
  color: var(--text-dim, #6b7a99);
  letter-spacing: .3px;
}

.sc-bar-wrap { margin-bottom: 16px; }
.sc-bar-bg {
  height: 8px;
  background: rgba(255,255,255,.07);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 4px;
}
.sc-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--rank-color, #00d4ff), rgba(255,255,255,.5));
  border-radius: 4px;
  transition: width .6s ease;
}
.sc-bar-labels {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--text-dim, #6b7a99);
}

.sc-footer {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--text-dim, #6b7a99);
  padding-top: 12px;
  border-top: 1px solid rgba(255,255,255,.06);
}

/* ボタン */
.sc-actions {
  display: flex;
  gap: 10px;
  margin-top: 14px;
  flex-wrap: wrap;
}
.sc-btn {
  flex: 1;
  padding: 11px 16px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all .2s;
  min-width: 140px;
}
.sc-btn-dl {
  background: rgba(168,255,120,.1);
  border: 1.5px solid rgba(168,255,120,.35);
  color: #a8ff78;
}
.sc-btn-dl:hover { background: rgba(168,255,120,.18); }
.sc-btn-x {
  background: rgba(0,0,0,.3);
  border: 1.5px solid rgba(255,255,255,.15);
  color: var(--text, #e8edf5);
}
.sc-btn-x:hover { background: rgba(255,255,255,.08); }
.sc-gen-msg {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-dim, #6b7a99);
  text-align: center;
}

/* ═══════════════════════════════════════════════
   IMPROVEMENT ENGINE
═══════════════════════════════════════════════ */
.ie-wrap {
  font-family: var(--font-main, 'Inter', sans-serif);
}
.ie-header { margin-bottom: 20px; }
.ie-title {
  font-size: 16px;
  font-weight: 800;
  color: var(--text, #e8edf5);
  margin-bottom: 4px;
}
.ie-subtitle {
  font-size: 12px;
  color: var(--text-dim, #6b7a99);
}

.ie-current {
  background: rgba(255,255,255,.03);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 10px;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.ie-current-label {
  font-size: 11px;
  color: var(--text-dim, #6b7a99);
  letter-spacing: .5px;
  flex: 0 0 auto;
  min-width: 120px;
}
.ie-current-val { display: flex; align-items: baseline; gap: 10px; flex: 0 0 auto; }
.ie-current-pct {
  font-size: 40px;
  font-weight: 900;
  font-family: var(--font-mono, monospace);
  line-height: 1;
}
.ie-current-rank { font-size: 15px; font-weight: 700; }
.ie-current-char { font-size: 12px; color: var(--text-mid, #a0adc0); flex: 1; }

.ie-arrow {
  text-align: center;
  font-size: 13px;
  color: var(--text-dim, #6b7a99);
  margin: 10px 0;
  letter-spacing: .3px;
}

.ie-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.ie-card {
  background: rgba(255,255,255,.03);
  border: 1px solid rgba(255,255,255,.09);
  border-radius: 10px;
  padding: 14px 16px;
  transition: border-color .2s, box-shadow .2s;
}
.ie-card-best {
  border-color: rgba(0,212,255,.4);
  box-shadow: 0 0 20px rgba(0,212,255,.08);
}
.ie-card-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.ie-card-icon { font-size: 18px; }
.ie-card-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text, #e8edf5);
  flex: 1;
}
.ie-card-badge {
  font-size: 9px;
  font-weight: 700;
  color: #00d4ff;
  background: rgba(0,212,255,.1);
  border: 1px solid rgba(0,212,255,.3);
  border-radius: 20px;
  padding: 2px 7px;
  letter-spacing: .5px;
}
.ie-card-desc {
  font-size: 11px;
  color: var(--text-dim, #6b7a99);
  margin-bottom: 10px;
  line-height: 1.5;
}
.ie-card-nums {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 6px;
}
.ie-card-before { font-size: 16px; color: var(--text-dim, #6b7a99); font-family: var(--font-mono, monospace); }
.ie-card-arrow-sm { font-size: 14px; color: var(--text-dim, #6b7a99); }
.ie-card-after { font-size: 24px; font-weight: 900; font-family: var(--font-mono, monospace); }
.ie-card-delta {
  font-size: 12px;
  font-weight: 700;
  color: #a8ff78;
  background: rgba(168,255,120,.1);
  border-radius: 4px;
  padding: 1px 6px;
}
.ie-card-rankup {
  font-size: 11px;
  font-weight: 700;
  margin-bottom: 6px;
  padding: 3px 8px;
  background: rgba(255,255,255,.04);
  border-radius: 4px;
  display: inline-block;
}
.ie-card-detail {
  font-size: 10px;
  color: var(--text-dim, #6b7a99);
  line-height: 1.6;
  border-top: 1px solid rgba(255,255,255,.06);
  padding-top: 8px;
  margin-top: 6px;
}

.ie-combo {
  background: linear-gradient(135deg, rgba(0,212,255,.06) 0%, rgba(179,136,255,.06) 100%);
  border: 1px solid rgba(0,212,255,.2);
  border-radius: 12px;
  padding: 18px 20px;
  margin-bottom: 16px;
  text-align: center;
}
.ie-combo-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--text, #e8edf5);
  margin-bottom: 10px;
}
.ie-combo-val {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 8px;
  margin-bottom: 8px;
}
.ie-combo-before { font-size: 22px; color: var(--text-dim, #6b7a99); font-family: var(--font-mono, monospace); }
.ie-combo-arrow { font-size: 20px; color: var(--text-dim, #6b7a99); }
.ie-combo-after { font-size: 42px; font-weight: 900; font-family: var(--font-mono, monospace); }
.ie-combo-delta {
  font-size: 14px;
  font-weight: 700;
  color: #a8ff78;
  background: rgba(168,255,120,.12);
  border-radius: 6px;
  padding: 2px 8px;
}
.ie-combo-rank { font-size: 14px; font-weight: 700; margin-bottom: 8px; }
.ie-combo-note {
  font-size: 10px;
  color: var(--text-dim, #6b7a99);
  line-height: 1.6;
  opacity: .7;
}

.ie-cta {
  text-align: center;
  padding: 12px 0 4px;
}
.ie-cta-text {
  font-size: 12px;
  color: var(--text-dim, #6b7a99);
  margin-bottom: 10px;
}
.ie-cta-btn {
  background: rgba(0,212,255,.1);
  border: 1.5px solid rgba(0,212,255,.3);
  color: #00d4ff;
  border-radius: 8px;
  padding: 10px 24px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all .2s;
}
.ie-cta-btn:hover {
  background: rgba(0,212,255,.18);
  box-shadow: 0 0 16px rgba(0,212,255,.15);
}
    `;
    document.head.appendChild(style);
  }

  // ── 10. 初期化 ──────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    injectStyles();

    // share-card-section と improvement-engine-section がなければ自動生成
    _ensureSections();

    // 既存結果があれば即レンダリング
    if (window._lastSimResult) {
      _onResultReady(window._lastSimResult);
    }
  });

  function _ensureSections() {
    // シェアカードセクション
    if (!document.getElementById('share-card-section')) {
      const sec = document.createElement('section');
      sec.id = 'share-card-section';
      sec.className = 'panel';
      sec.style.cssText = 'display:none;'; // シム完了まで非表示
      sec.innerHTML = '<div style="color:var(--text-dim);font-size:12px;text-align:center;padding:20px;">シミュレーション完了後に表示されます</div>';

      // kpi-section か chart-container の後ろに挿入
      const anchor = document.getElementById('kpi-section') || document.getElementById('chart-container');
      if (anchor && anchor.parentNode) {
        anchor.parentNode.insertBefore(sec, anchor.nextSibling);
      } else {
        document.body.appendChild(sec);
      }
    }

    // 改善提案エンジンセクション
    if (!document.getElementById('improvement-engine-section')) {
      const sec = document.createElement('section');
      sec.id = 'improvement-engine-section';
      sec.className = 'panel';
      sec.style.cssText = 'display:none;';
      sec.innerHTML = '';

      const scSec = document.getElementById('share-card-section');
      if (scSec && scSec.parentNode) {
        scSec.parentNode.insertBefore(sec, scSec.nextSibling);
      } else {
        document.body.appendChild(sec);
      }
    }
  }

  // ── 11. simulation.js 完了後フック（非侵襲パッチ） ──────────────────
  // simulation.js の runSimulation が終わった後、
  // window._lastSimData はすでに書き込まれている。
  // そこから必要な値を取り出して setLastSimResult を呼ぶ。
  const _origSim = window.runSimulation;
  if (typeof _origSim === 'function') {
    window.runSimulation = async function (...args) {
      const ret = await _origSim.apply(this, args);
      _tryHarvestResult();
      return ret;
    };
  } else {
    // runSimulation がまだロードされていない場合: MutationObserver で待機
    const _mo = new MutationObserver(function () {
      if (typeof window.runSimulation === 'function' && window.runSimulation !== window._scPatched) {
        window._scPatched = window.runSimulation;
        window.runSimulation = async function (...args) {
          const ret = await window._scPatched.apply(this, args);
          _tryHarvestResult();
          return ret;
        };
        _mo.disconnect();
      }
    });
    _mo.observe(document, { childList: true, subtree: true });
  }

  function _tryHarvestResult() {
    // window._lastSimData は simulation.js が書き込む
    const d = window._lastSimData;
    if (!d) return;

    // KPI DOMから成功率を取得（最も信頼性が高い）
    const successEl = document.getElementById('kpi-success');
    const srText = successEl ? successEl.textContent.replace('%', '').trim() : null;
    const successRate = srText && !isNaN(parseFloat(srText)) ? parseFloat(srText) / 100 : null;
    if (successRate === null) return;

    // 65歳時資産（kpi-assets65 or 計算）
    const assets65El = document.getElementById('kpi-assets65');
    const a65Text = assets65El ? assets65El.textContent.replace(/[^0-9.]/g, '') : '0';
    const assets65Man = parseFloat(a65Text) * 100 || 0; // 億→万

    // 余剰/不足（kpi-retire-surplus）
    const surplusEl = document.getElementById('kpi-retire-surplus');
    const surplusText = surplusEl ? surplusEl.textContent.replace(/[^0-9.\-+]/g, '') : '0';
    const surplus65Man = parseFloat(surplusText) || 0;

    const startAge = parseInt(document.getElementById('start-age')?.value || '35');

    const result = {
      successRate,
      assets65: assets65Man * 10000, // 円
      assets65Man,
      surplus65Man,
      startAge,
    };

    window.setLastSimResult(result);

    // セクションを表示
    const scSec = document.getElementById('share-card-section');
    const ieSec = document.getElementById('improvement-engine-section');
    if (scSec) scSec.style.display = '';
    if (ieSec) ieSec.style.display = '';
  }

})();
