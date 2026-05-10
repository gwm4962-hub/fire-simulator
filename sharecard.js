/**
 * sharecard.js — シェアカード生成 + 改善提案エンジン（改善版）
 * FLOW | 資産シミュレーター
 *
 * 改善点:
 *  1. Xシェアボタンを大型・目立つデザインに
 *  2. ドーナツグラフ（SVG）でスコアを視覚化
 *  3. 改善シナリオを横棒グラフで比較表示
 *  4. ランクゲージ・パルスアニメーション
 *  5. 改善前→後のアニメーション付きカード
 *
 * 依存: simulation.js (window._lastSimData, window._lastSimParams)
 *       html2canvas (CDN経由、なければ非表示)
 */
(function () {
  'use strict';

  // ── 1. ランク定義 ──────────────────────────────────────────────────────
  const RANKS = [
    { min: 0.90, rank: 'S', label: '悠々自適な逃げ切り世代',   color: '#a8ff78', glow: 'rgba(168,255,120,.35)', emoji: '🏆', pct: 100 },
    { min: 0.75, rank: 'A', label: '盤石な資産防衛族',          color: '#00d4ff', glow: 'rgba(0,212,255,.35)',   emoji: '✨', pct: 80  },
    { min: 0.60, rank: 'B', label: '着実な老後設計者',          color: '#b388ff', glow: 'rgba(179,136,255,.35)', emoji: '📈', pct: 60  },
    { min: 0.45, rank: 'C', label: '綱渡りの現役続行おじさん', color: '#ffd166', glow: 'rgba(255,209,102,.35)', emoji: '⚡', pct: 40  },
    { min: 0.00, rank: 'D', label: '労働の果てなき旅人',        color: '#ff4757', glow: 'rgba(255,71,87,.35)',   emoji: '💪', pct: 20  },
  ];

  function getRank(successRate) {
    return RANKS.find(r => successRate >= r.min) || RANKS[RANKS.length - 1];
  }

  function toDevScore(successRate) {
    const raw = 25 + successRate * 50;
    return Math.min(75, Math.max(25, Math.round(raw)));
  }

  // ── 2. 最新シミュレーション結果 ────────────────────────────────────────
  window._lastSimResult = window._lastSimResult || null;

  window.setLastSimResult = function (result) {
    window._lastSimResult = result;
    _onResultReady(result);
  };

  function _onResultReady(result) {
    if (!result) return;
    renderShareCard(result);
    renderImprovementEngine(result);
  }

  window.addEventListener('sim:done', function (e) {
    if (e.detail) {
      window._lastSimResult = e.detail;
      _onResultReady(e.detail);
    }
  });

  // ── 3. SVGドーナツグラフ生成 ────────────────────────────────────────────
  function buildDonutSVG(pct, color, glow, size) {
    const r = size / 2;
    const cx = r, cy = r;
    const trackR = r - 10;
    const circumference = 2 * Math.PI * trackR;
    const fillLen = circumference * (pct / 100);
    const dashArray = `${fillLen} ${circumference - fillLen}`;
    const startAngle = -90; // top
    const startX = cx + trackR * Math.cos(startAngle * Math.PI / 180);
    const startY = cy + trackR * Math.sin(startAngle * Math.PI / 180);

    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="glow-${pct}">
          <feGaussianBlur stdDeviation="3" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <!-- トラック -->
      <circle cx="${cx}" cy="${cy}" r="${trackR}" fill="none"
        stroke="rgba(255,255,255,0.07)" stroke-width="10"/>
      <!-- 塗り -->
      <circle cx="${cx}" cy="${cy}" r="${trackR}" fill="none"
        stroke="${color}" stroke-width="10"
        stroke-dasharray="${dashArray}"
        stroke-dashoffset="${circumference * 0.25}"
        stroke-linecap="round"
        filter="url(#glow-${pct})"
        style="transition: stroke-dasharray 1s ease"/>
    </svg>`;
  }

  // ── 4. シェアカード描画 ─────────────────────────────────────────────────
  function renderShareCard(result) {
    const container = document.getElementById('share-card-section');
    if (!container) return;

    const sr   = result.successRate ?? 0;
    const rank = getRank(sr);
    const dev  = toDevScore(sr);
    const age  = result.startAge ?? '—';
    const pct  = Math.round(sr * 100);
    const lifeLabel = sr >= 0.9 ? '100歳超対応' : sr >= 0.6 ? '90歳まで安心' : '要プランニング';
    const donut = buildDonutSVG(pct, rank.color, rank.glow, 120);

    container.innerHTML = `
      <div class="sc-wrap">
        <div class="sc-header">
          <span class="sc-label">📊 あなたの老後診断カード</span>
          <span class="sc-hint">金額非表示・安心してシェアできます</span>
        </div>

        <!-- カード本体 -->
        <div id="share-card" class="sc-card" style="--rank-color:${rank.color};--rank-glow:${rank.glow}">
          <div class="sc-card-inner">
            <div class="sc-top">
              <div class="sc-app-name">FLOW | 老後資産診断</div>
              <div class="sc-age-badge">現在 ${age}歳</div>
            </div>

            <!-- メインビジュアルエリア -->
            <div class="sc-main-vis">
              <!-- ドーナツグラフ -->
              <div class="sc-donut-wrap">
                ${donut}
                <div class="sc-donut-center">
                  <div class="sc-donut-pct">${pct}</div>
                  <div class="sc-donut-label">%</div>
                </div>
              </div>

              <!-- ランクブロック -->
              <div class="sc-rank-block">
                <div class="sc-rank-letter">${rank.rank}</div>
                <div class="sc-rank-meta">
                  <div class="sc-rank-badge-row">
                    <span class="sc-rank-badge">老後安心ランク</span>
                  </div>
                  <div class="sc-rank-title">${rank.emoji} ${rank.label}</div>
                  <div class="sc-dev-score-row">
                    <span class="sc-dev-label">老後偏差値</span>
                    <span class="sc-dev-val" style="color:${rank.color}">${dev}点</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- ランクゲージバー -->
            <div class="sc-gauge-wrap">
              <div class="sc-gauge-track">
                ${RANKS.slice().reverse().map((r, i) => `
                  <div class="sc-gauge-seg" style="background:${r.color};opacity:${rank.rank === r.rank ? '1' : '0.25'}">
                    <span class="sc-gauge-seg-label">${r.rank}</span>
                  </div>
                `).join('')}
                <div class="sc-gauge-needle" style="left:${Math.min(98, Math.max(2, pct))}%">
                  <div class="sc-gauge-needle-line"></div>
                  <div class="sc-gauge-needle-dot" style="background:${rank.color}"></div>
                </div>
              </div>
              <div class="sc-gauge-sublabels">
                <span>0%</span><span>50%</span><span>100%</span>
              </div>
            </div>

            <!-- サブメトリクス -->
            <div class="sc-metrics">
              <div class="sc-metric">
                <div class="sc-metric-icon">🎯</div>
                <div class="sc-metric-val" style="color:${rank.color}">${pct}<span class="sc-unit">%</span></div>
                <div class="sc-metric-key">資産寿命スコア</div>
              </div>
              <div class="sc-metric">
                <div class="sc-metric-icon">📐</div>
                <div class="sc-metric-val" style="color:${rank.color}">${dev}<span class="sc-unit">点</span></div>
                <div class="sc-metric-key">老後偏差値</div>
              </div>
              <div class="sc-metric">
                <div class="sc-metric-icon">🕰️</div>
                <div class="sc-metric-val sc-life">${lifeLabel}</div>
                <div class="sc-metric-key">カバー寿命</div>
              </div>
            </div>

            <div class="sc-footer">
              <span>FLOW シミュレーター</span>
              <span style="opacity:.5;">※金額は非表示 / データはブラウザ内のみ</span>
            </div>
          </div>
        </div>

        <!-- ── アクションボタン群 ── -->
        <div class="sc-actions">
          <!-- Xシェアボタン（メイン・大型） -->
          <button class="sc-btn-x-main" onclick="shareCardToX()">
            <span class="sc-btn-x-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.261 5.632L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/>
              </svg>
            </span>
            <span class="sc-btn-x-text">
              <span class="sc-btn-x-main-text">Xにシェアする</span>
              <span class="sc-btn-x-sub">診断結果を投稿しよう！</span>
            </span>
            <span class="sc-btn-x-arrow">→</span>
          </button>

          <!-- 画像保存ボタン（サブ） -->
          <button class="sc-btn-dl" onclick="downloadShareCard()">
            <span>📥</span> 画像を保存
          </button>
        </div>

        <!-- シェアプレビュー文 -->
        <div class="sc-tweet-preview" id="sc-tweet-preview"></div>

        <div id="sc-gen-msg" class="sc-gen-msg" style="display:none"></div>
      </div>
    `;

    // ツイートプレビュー生成
    _renderTweetPreview(result);
  }

  function _renderTweetPreview(result) {
    const el = document.getElementById('sc-tweet-preview');
    if (!el) return;
    const rank = getRank(result.successRate ?? 0);
    const dev  = toDevScore(result.successRate ?? 0);
    const pct  = Math.round((result.successRate ?? 0) * 100);
    const age  = result.startAge ?? '—';
    el.innerHTML = `
      <div class="sc-tweet-title">📋 投稿プレビュー</div>
      <div class="sc-tweet-body">【FLOW老後診断】<br>
      現在${age}歳 / 老後安心ランク【${rank.rank}】<br>
      ${rank.emoji} ${rank.label}<br>
      資産寿命スコア: ${pct}% / 老後偏差値: ${dev}点<br>
      <span style="opacity:.6;">#老後資産診断 #FLOW家計シミュレーター</span></div>
    `;
  }

  // ── 5. カードPNGダウンロード ────────────────────────────────────────────
  window.downloadShareCard = function () {
    const card = document.getElementById('share-card');
    if (!card) return;
    _ensureHtml2Canvas(function (h2c) {
      const msg = document.getElementById('sc-gen-msg');
      if (msg) { msg.style.display = 'block'; msg.textContent = '🎨 画像を生成しています…'; }
      h2c(card, { backgroundColor: '#050810', scale: 2, useCORS: true, logging: false })
        .then(function (canvas) {
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

  // ── 6. X（Twitter）シェア ────────────────────────────────────────────────
  window.shareCardToX = function () {
    const result = window._lastSimResult;
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
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${url}`, '_blank', 'noopener,width=600,height=400');

    // ボタンにフィードバック
    const btn = document.querySelector('.sc-btn-x-main');
    if (btn) {
      btn.classList.add('sc-btn-x-sent');
      setTimeout(() => btn.classList.remove('sc-btn-x-sent'), 2000);
    }
  };

  // ── 7. html2canvas 遅延ロード ────────────────────────────────────────────
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

  // ── 8. 改善提案エンジン ──────────────────────────────────────────────────
  function estimateImprovedRate(base, params) {
    const { successRate, surplus65, assets65, startAge,
      nisaBoostMan = 0, expCutMan = 0, retireDelayYears = 0 } = params;
    const surplusRatio = surplus65 > 0 ? Math.min(1, surplus65 / Math.max(1, assets65)) : -0.3;
    const remainYears = Math.max(5, 65 - startAge);
    const nisaFutureVal = nisaBoostMan * Math.pow(1.05, remainYears);
    const nisaEffect    = Math.min(0.30, nisaFutureVal / 3000 * 0.18);
    const expEffect     = Math.min(0.25, expCutMan * 12 * 20 / 3000 * 0.18);
    const retireEffect  = Math.min(0.20, retireDelayYears * 0.025 * (1 + Math.max(0, -surplusRatio)));
    return Math.min(0.98, Math.round((successRate + nisaEffect + expEffect + retireEffect) * 100) / 100);
  }

  // ── 9. 横棒グラフSVG生成 ────────────────────────────────────────────────
  function buildBarChartSVG(scenarios, basePct, allPct) {
    const W = 340, barH = 28, gap = 14, padL = 0, padTop = 8;
    const items = [
      ...scenarios.map(s => ({ label: s.title, icon: s.icon, pct: s.impPct, color: s.newRank.color, delta: s.delta })),
      { label: '全部実践！', icon: '🚀', pct: allPct, color: '#a8ff78', delta: allPct - basePct },
    ];
    const totalH = padTop + items.length * (barH + gap) + 20;

    const bars = items.map((item, i) => {
      const y = padTop + i * (barH + gap);
      const baseW = Math.round((basePct / 100) * (W - 80));
      const fillW = Math.round((item.pct / 100) * (W - 80));
      return `
        <g transform="translate(0,${y})">
          <text x="0" y="${barH / 2 + 5}" font-size="15" dominant-baseline="middle">${item.icon}</text>
          <!-- ベースバー -->
          <rect x="22" y="4" width="${baseW}" height="${barH - 8}" rx="4"
            fill="rgba(255,255,255,0.07)"/>
          <!-- 改善バー -->
          <rect x="22" y="4" width="${fillW}" height="${barH - 8}" rx="4"
            fill="${item.color}" opacity="0.85"
            style="transition: width 1s ease"/>
          <!-- ベースマーカー -->
          <line x1="${22 + baseW}" y1="2" x2="${22 + baseW}" y2="${barH - 2}"
            stroke="rgba(255,255,255,0.4)" stroke-width="1.5" stroke-dasharray="3,2"/>
          <!-- パーセント表示 -->
          <text x="${22 + fillW + 6}" y="${barH / 2 + 1}" font-size="12" fill="${item.color}"
            dominant-baseline="middle" font-weight="700">${item.pct}%</text>
          <text x="${22 + fillW + 6 + 30}" y="${barH / 2 + 1}" font-size="11"
            fill="#a8ff78" dominant-baseline="middle">+${item.delta}pt</text>
        </g>
      `;
    }).join('');

    // ラベル列（左）
    const labels = items.map((item, i) => {
      const y = padTop + i * (barH + gap) + barH / 2;
      return `<text x="${W + 10}" y="${y}" font-size="10" fill="rgba(255,255,255,0.45)"
        dominant-baseline="middle">${item.label}</text>`;
    }).join('');

    return `<svg width="100%" viewBox="0 0 ${W + 10} ${totalH}" xmlns="http://www.w3.org/2000/svg"
      style="overflow:visible">${bars}</svg>`;
  }

  function renderImprovementEngine(result) {
    const container = document.getElementById('improvement-engine-section');
    if (!container) return;

    const sr      = result.successRate ?? 0;
    const pct     = Math.round(sr * 100);
    const surplus = result.surplus65Man ?? 0;
    const assets  = result.assets65 ?? 0;
    const age     = result.startAge ?? 35;
    const rank    = getRank(sr);

    const scenarios = [
      {
        id: 'nisa', icon: '💹', title: 'NISA満額活用',
        desc: '年間360万円を5%複利で運用',
        params: { successRate: sr, surplus65: surplus * 10000, assets65: assets, startAge: age, nisaBoostMan: 360 },
        detail: 'つみたてNISA・成長投資枠の年間上限360万円を5%複利で運用',
      },
      {
        id: 'expense', icon: '✂️', title: '月2万円の支出削減',
        desc: 'サブスク・外食費など固定費見直し',
        params: { successRate: sr, surplus65: surplus * 10000, assets65: assets, startAge: age, expCutMan: 2 },
        detail: '通信費・サブスク・外食費など固定費を月2万円カット',
      },
      {
        id: 'retire', icon: '🕐', title: '退職を3年延ばす',
        desc: '65歳まで現役で収入+年金増額',
        params: { successRate: sr, surplus65: surplus * 10000, assets65: assets, startAge: age, retireDelayYears: 3 },
        detail: '65歳定年まで働くことで収入延長・年金増額のダブル効果',
      },
    ];

    const allParams = { successRate: sr, surplus65: surplus * 10000, assets65: assets, startAge: age,
      nisaBoostMan: 360, expCutMan: 2, retireDelayYears: 3 };
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

    const best = rows.reduce((a, b) => b.delta > a.delta ? b : a, rows[0]);
    const barChart = buildBarChartSVG(rows, pct, allPct);
    const allRank = getRank(allRate);
    const donutAll = buildDonutSVG(allPct, allRank.color, allRank.glow, 90);

    container.innerHTML = `
      <div class="ie-wrap">
        <div class="ie-header">
          <div class="ie-title">💡 老後安心度 改善シミュレーター</div>
          <div class="ie-subtitle">どうすれば、もっと安心できる？ — 3つのシナリオを比較</div>
        </div>

        <!-- 現状 vs 目標ビジュアル -->
        <div class="ie-compare-row">
          <!-- 現状 -->
          <div class="ie-compare-card ie-compare-now">
            <div class="ie-compare-card-label">現在のスコア</div>
            <div class="ie-compare-donut-wrap">
              ${buildDonutSVG(pct, rank.color, rank.glow, 90)}
              <div class="ie-compare-donut-center">
                <div class="ie-compare-pct" style="color:${rank.color}">${pct}</div>
                <div class="ie-compare-unit">%</div>
              </div>
            </div>
            <div class="ie-compare-rank" style="color:${rank.color}">${rank.emoji} ランク${rank.rank}</div>
            <div class="ie-compare-char">${rank.label}</div>
          </div>

          <!-- 矢印 -->
          <div class="ie-compare-arrow">
            <div class="ie-arrow-pulse">→</div>
            <div class="ie-arrow-sub">全部実践</div>
          </div>

          <!-- 全部実践後 -->
          <div class="ie-compare-card ie-compare-goal">
            <div class="ie-compare-card-label">全部実践後</div>
            <div class="ie-compare-donut-wrap">
              ${donutAll}
              <div class="ie-compare-donut-center">
                <div class="ie-compare-pct" style="color:${allRank.color}">${allPct}</div>
                <div class="ie-compare-unit">%</div>
              </div>
            </div>
            <div class="ie-compare-rank" style="color:${allRank.color}">${allRank.emoji} ランク${allRank.rank}</div>
            <div class="ie-compare-char">${allRank.label}</div>
          </div>
        </div>

        <!-- 変化量バッジ -->
        <div class="ie-delta-banner">
          <span class="ie-delta-val">+${allPct - pct}<span style="font-size:16px;">pt</span></span>
          <span class="ie-delta-desc">3つすべて実践すると老後安心スコアが大幅アップ！</span>
        </div>

        <!-- 棒グラフ比較 -->
        <div class="ie-chart-section">
          <div class="ie-chart-title">📊 シナリオ別 改善効果グラフ</div>
          <div class="ie-chart-legend">
            <span class="ie-legend-base">▏現在 ${pct}%</span>
            <span class="ie-legend-imp">■ 改善後</span>
          </div>
          <div class="ie-bar-chart-wrap">
            ${barChart}
          </div>
        </div>

        <!-- シナリオ詳細カード -->
        <div class="ie-cards">
          ${rows.map(sc => `
            <div class="ie-card ${sc.id === best.id ? 'ie-card-best' : ''}">
              <div class="ie-card-top">
                <span class="ie-card-icon">${sc.icon}</span>
                <span class="ie-card-title">${sc.title}</span>
                ${sc.id === best.id ? '<span class="ie-card-badge">最大効果</span>' : ''}
              </div>
              <div class="ie-card-desc">${sc.desc}</div>

              <!-- ミニプログレス -->
              <div class="ie-card-progress-wrap">
                <div class="ie-card-progress-track">
                  <div class="ie-card-progress-base" style="width:${pct}%"></div>
                  <div class="ie-card-progress-fill" style="width:${sc.impPct}%;background:${sc.newRank.color}"></div>
                </div>
              </div>

              <div class="ie-card-nums">
                <div class="ie-card-before">${pct}%</div>
                <div class="ie-card-arrow-sm">→</div>
                <div class="ie-card-after" style="color:${sc.newRank.color}">${sc.impPct}%</div>
                <div class="ie-card-delta">+${sc.delta}pt</div>
              </div>
              ${sc.rankUp ? `<div class="ie-card-rankup" style="color:${sc.newRank.color}">
                ランク ${rank.rank} → ${sc.newRank.rank} にアップ！🎉</div>` : ''}
              <div class="ie-card-detail">${sc.detail}</div>
            </div>
          `).join('')}
        </div>

        <!-- 改善後のXシェアボタン -->
        <div class="ie-share-cta">
          <div class="ie-share-cta-label">改善シナリオをシェアして、仲間に教えよう</div>
          <button class="ie-share-x-btn" onclick="shareImprovementToX()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.261 5.632L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/>
            </svg>
            改善結果をXにシェア
          </button>
        </div>

        <!-- 再シミュレーション -->
        <div class="ie-cta">
          <div class="ie-cta-text">シナリオの数値を変えて、より詳細に試算できます</div>
          <button class="ie-cta-btn" onclick="document.getElementById('run-btn')?.scrollIntoView({behavior:'smooth'})">
            ▶ パラメータを変えて再シミュレーション
          </button>
        </div>
      </div>
    `;
  }

  // ── 10. 改善結果のXシェア ───────────────────────────────────────────────
  window.shareImprovementToX = function () {
    const result = window._lastSimResult;
    if (!result) return;
    const sr  = result.successRate ?? 0;
    const pct = Math.round(sr * 100);
    const age = result.startAge ?? '—';
    const allParams = {
      successRate: sr,
      surplus65: (result.surplus65Man ?? 0) * 10000,
      assets65: result.assets65 ?? 0,
      startAge: age,
      nisaBoostMan: 360, expCutMan: 2, retireDelayYears: 3,
    };
    const allRate = estimateImprovedRate(sr, allParams);
    const allPct  = Math.round(allRate * 100);
    const allRank = getRank(allRate);
    const text = [
      `【FLOWで家計を見直した結果】`,
      `FIRE成功率が +${allPct - pct}% 向上しました！`,
      `[ ${pct}% ] ➔ [ ${allPct}% ] ${allRank.emoji}`,
      `老後安心ランク: ${allRank.rank}「${allRank.label}」`,
      `#家計改善 #老後資産診断 #FLOW家計シミュレーター`,
    ].join('\n');
    const url = encodeURIComponent(location.href.split('?')[0]);
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${url}`, '_blank', 'noopener,width=600,height=400');
  };

  // ── 11. スタイル注入 ────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('sharecard-styles')) return;
    const style = document.createElement('style');
    style.id = 'sharecard-styles';
    style.textContent = `
/* ═══════════════════════════════════════════════
   SHARE CARD（改善版）
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
  margin-bottom: 18px;
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

/* メインビジュアル（ドーナツ + ランク） */
.sc-main-vis {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 20px;
}
.sc-donut-wrap {
  position: relative;
  flex: 0 0 auto;
  width: 120px;
  height: 120px;
}
.sc-donut-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.sc-donut-pct {
  font-size: 28px;
  font-weight: 900;
  color: var(--rank-color, #00d4ff);
  font-family: var(--font-mono, monospace);
  line-height: 1;
}
.sc-donut-label {
  font-size: 12px;
  color: var(--text-dim, #6b7a99);
}
.sc-rank-block {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sc-rank-badge-row { display: flex; gap: 6px; }
.sc-rank-badge {
  font-size: 10px;
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 4px;
  padding: 2px 8px;
  color: var(--text-dim, #6b7a99);
  letter-spacing: .5px;
}
.sc-rank-letter {
  font-size: 64px;
  font-weight: 900;
  color: var(--rank-color, #00d4ff);
  line-height: 1;
  text-shadow: 0 0 40px var(--rank-glow, rgba(0,212,255,.5));
  letter-spacing: -2px;
  font-family: var(--font-mono, monospace);
}
.sc-rank-meta { display: flex; flex-direction: column; gap: 4px; }
.sc-rank-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text, #e8edf5);
  line-height: 1.3;
}
.sc-dev-score-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}
.sc-dev-label {
  font-size: 10px;
  color: var(--text-dim, #6b7a99);
}
.sc-dev-val {
  font-size: 18px;
  font-weight: 800;
  font-family: var(--font-mono, monospace);
}

/* ランクゲージ */
.sc-gauge-wrap { margin-bottom: 16px; }
.sc-gauge-track {
  position: relative;
  display: flex;
  height: 20px;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 4px;
}
.sc-gauge-seg {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity .3s;
}
.sc-gauge-seg-label {
  font-size: 9px;
  font-weight: 800;
  color: rgba(0,0,0,.6);
  letter-spacing: .5px;
}
.sc-gauge-needle {
  position: absolute;
  top: -3px;
  bottom: -3px;
  transform: translateX(-50%);
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.sc-gauge-needle-line {
  width: 2px;
  flex: 1;
  background: #fff;
  border-radius: 1px;
  box-shadow: 0 0 8px rgba(255,255,255,.8);
}
.sc-gauge-needle-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 0 10px currentColor;
  margin-top: 2px;
}
.sc-gauge-sublabels {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--text-dim, #6b7a99);
}

/* メトリクス */
.sc-metrics {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 10px;
  margin-bottom: 16px;
}
.sc-metric {
  background: rgba(255,255,255,.03);
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 8px;
  padding: 10px 8px;
  text-align: center;
}
.sc-metric-icon { font-size: 14px; margin-bottom: 4px; }
.sc-metric-val {
  font-size: 20px;
  font-weight: 800;
  font-family: var(--font-mono, monospace);
  line-height: 1;
  margin-bottom: 4px;
}
.sc-unit { font-size: 11px; opacity: .7; }
.sc-life { font-size: 10px; line-height: 1.3; }
.sc-metric-key { font-size: 10px; color: var(--text-dim, #6b7a99); }

.sc-footer {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--text-dim, #6b7a99);
  padding-top: 12px;
  border-top: 1px solid rgba(255,255,255,.06);
}

/* ═══ Xシェアボタン（大型メイン） ═══ */
.sc-actions {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* メインXボタン */
.sc-btn-x-main {
  width: 100%;
  padding: 18px 24px;
  background: linear-gradient(135deg, #000 0%, #111 100%);
  border: 2px solid rgba(255,255,255,0.25);
  border-radius: 14px;
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 14px;
  transition: all .2s;
  box-shadow: 0 4px 20px rgba(0,0,0,.5), 0 0 0 0 rgba(255,255,255,.1);
  position: relative;
  overflow: hidden;
}
.sc-btn-x-main::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255,255,255,.04) 0%, transparent 60%);
  pointer-events: none;
}
.sc-btn-x-main:hover {
  background: linear-gradient(135deg, #111 0%, #222 100%);
  border-color: rgba(255,255,255,.45);
  transform: translateY(-1px);
  box-shadow: 0 8px 32px rgba(0,0,0,.6), 0 0 0 3px rgba(255,255,255,.08);
}
.sc-btn-x-main:active { transform: translateY(0); }
.sc-btn-x-main.sc-btn-x-sent {
  background: linear-gradient(135deg, #0a3 0%, #051 100%);
  border-color: rgba(168,255,120,.4);
}
.sc-btn-x-icon {
  flex: 0 0 auto;
  width: 40px;
  height: 40px;
  background: rgba(255,255,255,.1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.sc-btn-x-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}
.sc-btn-x-main-text {
  font-size: 16px;
  font-weight: 800;
  letter-spacing: .3px;
}
.sc-btn-x-sub {
  font-size: 11px;
  opacity: .55;
  font-weight: 400;
}
.sc-btn-x-arrow {
  font-size: 20px;
  opacity: .5;
  font-weight: 300;
  transition: transform .2s;
}
.sc-btn-x-main:hover .sc-btn-x-arrow { transform: translateX(4px); opacity: .9; }

/* サブ保存ボタン */
.sc-btn-dl {
  width: 100%;
  padding: 12px 20px;
  background: rgba(168,255,120,.08);
  border: 1.5px solid rgba(168,255,120,.25);
  border-radius: 10px;
  color: #a8ff78;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all .2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.sc-btn-dl:hover { background: rgba(168,255,120,.16); }

/* ツイートプレビュー */
.sc-tweet-preview {
  margin-top: 10px;
  background: rgba(255,255,255,.03);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 10px;
  padding: 12px 16px;
}
.sc-tweet-title {
  font-size: 11px;
  color: var(--text-dim, #6b7a99);
  margin-bottom: 6px;
  letter-spacing: .5px;
}
.sc-tweet-body {
  font-size: 13px;
  color: var(--text, #e8edf5);
  line-height: 1.7;
}
.sc-gen-msg {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-dim, #6b7a99);
  text-align: center;
}

/* ═══════════════════════════════════════════════
   IMPROVEMENT ENGINE（改善版）
═══════════════════════════════════════════════ */
.ie-wrap { font-family: var(--font-main, 'Inter', sans-serif); }
.ie-header { margin-bottom: 20px; }
.ie-title { font-size: 16px; font-weight: 800; color: var(--text, #e8edf5); margin-bottom: 4px; }
.ie-subtitle { font-size: 12px; color: var(--text-dim, #6b7a99); }

/* 現在 vs 目標 比較ビジュアル */
.ie-compare-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
  background: rgba(255,255,255,.02);
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 14px;
  padding: 16px;
}
.ie-compare-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-align: center;
}
.ie-compare-card-label {
  font-size: 10px;
  color: var(--text-dim, #6b7a99);
  letter-spacing: .5px;
  text-transform: uppercase;
}
.ie-compare-donut-wrap {
  position: relative;
  width: 90px;
  height: 90px;
}
.ie-compare-donut-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.ie-compare-pct {
  font-size: 22px;
  font-weight: 900;
  font-family: var(--font-mono, monospace);
  line-height: 1;
}
.ie-compare-unit { font-size: 10px; color: var(--text-dim, #6b7a99); }
.ie-compare-rank { font-size: 13px; font-weight: 700; }
.ie-compare-char { font-size: 10px; color: var(--text-dim, #6b7a99); line-height: 1.4; }
.ie-compare-goal { background: rgba(168,255,120,.03); border-radius: 10px; }

/* 矢印アニメーション */
.ie-compare-arrow {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.ie-arrow-pulse {
  font-size: 28px;
  animation: ie-pulse 1.5s ease-in-out infinite;
  color: #a8ff78;
}
@keyframes ie-pulse {
  0%, 100% { opacity: .5; transform: translateX(0); }
  50% { opacity: 1; transform: translateX(5px); }
}
.ie-arrow-sub { font-size: 9px; color: var(--text-dim, #6b7a99); }

/* 変化量バナー */
.ie-delta-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  background: linear-gradient(135deg, rgba(168,255,120,.08) 0%, rgba(0,212,255,.06) 100%);
  border: 1px solid rgba(168,255,120,.2);
  border-radius: 10px;
  padding: 14px 20px;
  margin-bottom: 20px;
  flex-wrap: wrap;
  text-align: center;
}
.ie-delta-val {
  font-size: 36px;
  font-weight: 900;
  color: #a8ff78;
  font-family: var(--font-mono, monospace);
  line-height: 1;
}
.ie-delta-desc {
  font-size: 13px;
  color: var(--text, #e8edf5);
  line-height: 1.5;
  flex: 1;
  min-width: 160px;
}

/* 棒グラフ */
.ie-chart-section {
  background: rgba(255,255,255,.02);
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 18px;
}
.ie-chart-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text, #e8edf5);
  margin-bottom: 8px;
}
.ie-chart-legend {
  display: flex;
  gap: 14px;
  margin-bottom: 12px;
  font-size: 11px;
}
.ie-legend-base { color: var(--text-dim, #6b7a99); }
.ie-legend-imp { color: #00d4ff; }
.ie-bar-chart-wrap { width: 100%; overflow: hidden; }

/* シナリオ詳細カード */
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
}
.ie-card-desc {
  font-size: 11px;
  color: var(--text-dim, #6b7a99);
  margin-bottom: 10px;
  line-height: 1.5;
}

/* ミニプログレスバー */
.ie-card-progress-wrap { margin-bottom: 8px; }
.ie-card-progress-track {
  position: relative;
  height: 6px;
  background: rgba(255,255,255,.06);
  border-radius: 3px;
  overflow: hidden;
}
.ie-card-progress-base {
  position: absolute;
  top: 0; left: 0; bottom: 0;
  background: rgba(255,255,255,.15);
  border-radius: 3px;
}
.ie-card-progress-fill {
  position: absolute;
  top: 0; left: 0; bottom: 0;
  border-radius: 3px;
  opacity: .8;
  transition: width .8s ease;
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

/* 改善結果シェアボタン */
.ie-share-cta {
  background: rgba(0,0,0,.25);
  border: 1.5px solid rgba(255,255,255,.12);
  border-radius: 12px;
  padding: 16px 20px;
  text-align: center;
  margin-bottom: 14px;
}
.ie-share-cta-label {
  font-size: 12px;
  color: var(--text-dim, #6b7a99);
  margin-bottom: 12px;
}
.ie-share-x-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 28px;
  background: #000;
  border: 2px solid rgba(255,255,255,.2);
  border-radius: 10px;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all .2s;
  letter-spacing: .3px;
}
.ie-share-x-btn:hover {
  background: #111;
  border-color: rgba(255,255,255,.4);
  transform: translateY(-1px);
  box-shadow: 0 4px 20px rgba(0,0,0,.5);
}

/* CTA */
.ie-cta { text-align: center; padding: 12px 0 4px; }
.ie-cta-text { font-size: 12px; color: var(--text-dim, #6b7a99); margin-bottom: 10px; }
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

@media (max-width: 480px) {
  .sc-main-vis { flex-direction: column; align-items: flex-start; }
  .ie-compare-row { flex-direction: column; }
  .ie-delta-banner { flex-direction: column; gap: 6px; }
}
    `;
    document.head.appendChild(style);
  }

  // ── 12. 初期化 ──────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    injectStyles();
    _ensureSections();
    if (window._lastSimResult) _onResultReady(window._lastSimResult);
  });

  function _ensureSections() {
    if (!document.getElementById('share-card-section')) {
      const sec = document.createElement('section');
      sec.id = 'share-card-section';
      sec.className = 'panel';
      sec.style.cssText = 'display:none;';
      sec.innerHTML = '<div style="color:var(--text-dim);font-size:12px;text-align:center;padding:20px;">シミュレーション完了後に表示されます</div>';
      const anchor = document.getElementById('kpi-section') || document.getElementById('chart-container');
      if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(sec, anchor.nextSibling);
      else document.body.appendChild(sec);
    }
    if (!document.getElementById('improvement-engine-section')) {
      const sec = document.createElement('section');
      sec.id = 'improvement-engine-section';
      sec.className = 'panel';
      sec.style.cssText = 'display:none;';
      const scSec = document.getElementById('share-card-section');
      if (scSec && scSec.parentNode) scSec.parentNode.insertBefore(sec, scSec.nextSibling);
      else document.body.appendChild(sec);
    }
  }

  // ── 13. simulation.js 完了後フック（非侵襲パッチ） ─────────────────────
  const _origSim = window.runSimulation;
  if (typeof _origSim === 'function') {
    window.runSimulation = async function (...args) {
      const ret = await _origSim.apply(this, args);
      _tryHarvestResult();
      return ret;
    };
  } else {
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
    const d = window._lastSimData;
    if (!d) return;
    const successEl  = document.getElementById('kpi-success');
    const srText     = successEl ? successEl.textContent.replace('%', '').trim() : null;
    const successRate = srText && !isNaN(parseFloat(srText)) ? parseFloat(srText) / 100 : null;
    if (successRate === null) return;

    const assets65El  = document.getElementById('kpi-assets65');
    const a65Text     = assets65El ? assets65El.textContent.replace(/[^0-9.]/g, '') : '0';
    const assets65Man = parseFloat(a65Text) * 100 || 0;

    const surplusEl   = document.getElementById('kpi-retire-surplus');
    const surplusText = surplusEl ? surplusEl.textContent.replace(/[^0-9.\-+]/g, '') : '0';
    const surplus65Man = parseFloat(surplusText) || 0;

    const startAge = parseInt(document.getElementById('start-age')?.value || '35');

    // monthlyRetire を追加
    const monthlyRetireEl = document.getElementById('kpi-monthly-retire') || document.getElementById('bsumm-monthly');
    const monthlyRetireText = monthlyRetireEl ? monthlyRetireEl.textContent.replace(/[^0-9.]/g, '') : '0';
    const monthlyRetire = parseFloat(monthlyRetireText) || 0;

    const result = { successRate, assets65: assets65Man * 10000, assets65Man, surplus65Man, startAge, monthlyRetire };
    window.setLastSimResult(result);

    // 家計タイプ診断エンジンに結果を通知
    window.dispatchEvent(new CustomEvent('sim:done', { detail: result }));

    const scSec = document.getElementById('share-card-section');
    const ieSec = document.getElementById('improvement-engine-section');
    // 初心者・通常モードではシェアカードを非表示（diagnosis-panelに集約）
    const mode = document.body.getAttribute('data-mode');
    if (scSec) scSec.style.display = (mode === 'pro') ? '' : 'none';
    if (ieSec) ieSec.style.display = (mode === 'pro') ? '' : 'none';
  }

})();
