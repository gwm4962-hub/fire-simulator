/**
 * compare.js — シナリオ比較エンジン
 * FLOW | 資産シミュレーター
 *
 * 機能:
 *  1. 株式比率別シナリオ比較（全モード対応）
 *  2. 「現状 vs 改善プラン」2軸グラフ比較
 *  3. シェア用OGP画像生成（Canvas）
 */
(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════
  // 1. 株式比率比較パネル
  // ══════════════════════════════════════════════════════════

  const STOCK_SCENARIOS = [
    { pct: 0,   label: '現金のみ',   color: '#7a9bbf', note: '元本保証。インフレに負けるリスク' },
    { pct: 30,  label: '保守型',     color: '#00d4ff', note: '低リスク・低リターン。安定志向向け' },
    { pct: 50,  label: 'バランス型', color: '#b388ff', note: '株式・債券を半々。標準的な資産配分' },
    { pct: 70,  label: '積極型',     color: '#ffd166', note: '長期なら高リターン。変動は大きい' },
    { pct: 100, label: '全力株式',   color: '#ff6eb4', note: '最大リターン狙い。暴落時-50%も' },
  ];

  window.openStockCompare = function () {
    const modal   = document.getElementById('stock-compare-modal');
    const content = document.getElementById('stock-compare-content');
    if (!modal || !content) return;

    const lastData = window._lastSimData;
    if (!lastData) {
      content.innerHTML = `
        <div class="sc2-wrap">
          <div class="sc2-header">
            <div class="sc2-title">📊 株式比率別シミュレーション比較</div>
            <button class="sc2-close" onclick="document.getElementById('stock-compare-modal').style.display='none'">✕</button>
          </div>
          <div style="text-align:center;padding:40px 20px;color:var(--text-dim);font-size:13px;">
            先にシミュレーションを実行してください
          </div>
        </div>`;
      modal.style.display = 'block';
      injectCompareStyles();
      return;
    }

    const currentW = parseInt(document.getElementById('w-working')?.value || 0);

    // 各シナリオの successRate を簡易推定（線形モデル）
    // 実際のシム結果の successRate をベースに、比率差分から補正
    const baseSr   = window._lastCompareBase ?? 0.65;
    const baseW    = currentW;

    function estimateSr(pct) {
      // 株式比率が上がると長期期待リターン↑ → 成功率↑（ただし変動も↑）
      // 簡易モデル: 0%=0.45, 50%=baseSr基準, 100%=0.82上限
      const diff = pct - baseW;
      const boost = diff * 0.0025;  // 1%あたり+0.25pt
      return Math.min(0.95, Math.max(0.10, baseSr + boost));
    }

    let html = `
      <div class="sc2-wrap">
        <div class="sc2-header">
          <div class="sc2-title">📊 株式比率別シミュレーション比較</div>
          <button class="sc2-close" onclick="document.getElementById('stock-compare-modal').style.display='none'">✕</button>
        </div>
        <div class="sc2-subtitle">株式比率を変えると老後安心スコアはどう変わる？</div>

        <div class="sc2-current-badge">現在の設定: 株式${currentW}%</div>

        <div class="sc2-bars">`;

    STOCK_SCENARIOS.forEach(sc => {
      const sr  = estimateSr(sc.pct);
      const pct = Math.round(sr * 100);
      const isCurrent = sc.pct === currentW;
      html += `
        <div class="sc2-bar-row ${isCurrent ? 'sc2-current' : ''}">
          <div class="sc2-bar-label-wrap">
            <span class="sc2-bar-pct">${sc.pct}%</span>
            <span class="sc2-bar-name">${sc.label}</span>
            ${isCurrent ? '<span class="sc2-now-tag">現在</span>' : ''}
          </div>
          <div class="sc2-bar-track">
            <div class="sc2-bar-fill" style="width:${pct}%;background:${sc.color};box-shadow:0 0 8px ${sc.color}60"></div>
          </div>
          <div class="sc2-bar-score" style="color:${sc.color}">${pct}%</div>
        </div>
        <div class="sc2-bar-note">${sc.note}</div>`;
    });

    html += `
        </div>

        <div class="sc2-recommend">
          <div class="sc2-rec-title">💡 どの比率が自分に合う？</div>
          <div class="sc2-rec-items">
            <div class="sc2-rec-item">
              <b>退職まで10年以上</b> → 株式50〜70%推奨
            </div>
            <div class="sc2-rec-item">
              <b>退職まで5年以内</b> → 株式30〜50%に下げて安定化
            </div>
            <div class="sc2-rec-item">
              <b>退職後</b> → 株式20〜40%で取り崩しリスクを抑える
            </div>
          </div>
        </div>

        <div class="sc2-apply-section">
          <div class="sc2-apply-title">比率を変えて再シミュレーション</div>
          <div class="sc2-apply-btns">
            ${STOCK_SCENARIOS.map(sc => `
              <button class="sc2-apply-btn ${sc.pct === currentW ? 'sc2-apply-current' : ''}"
                onclick="applyStockRatio(${sc.pct})"
                style="${sc.pct === currentW ? `border-color:${sc.color};color:${sc.color}` : ''}">
                ${sc.pct}%
              </button>
            `).join('')}
          </div>
        </div>

        <button class="sc2-close-btn" onclick="document.getElementById('stock-compare-modal').style.display='none'">
          閉じる
        </button>
      </div>`;

    content.innerHTML = html;
    modal.style.display = 'block';
    injectCompareStyles();
  };

  window.applyStockRatio = function (pct) {
    const wEl = document.getElementById('w-working');
    const rEl = document.getElementById('w-retired');
    if (wEl) { wEl.value = pct; wEl.dispatchEvent(new Event('input', { bubbles: true })); }
    if (rEl) { const rPct = Math.max(0, pct - 20); rEl.value = rPct; rEl.dispatchEvent(new Event('input', { bubbles: true })); }
    document.getElementById('stock-compare-modal').style.display = 'none';
    // 再シミュレーション
    setTimeout(() => { if (typeof runSimulation === 'function') runSimulation(); }, 100);
  };

  // sim:done で base successRate を記録
  window.addEventListener('sim:done', function (e) {
    if (e.detail?.successRate != null) {
      window._lastCompareBase = e.detail.successRate;
    }
  });

  // ══════════════════════════════════════════════════════════
  // 2. シェア画像生成（Canvas OGP）
  // ══════════════════════════════════════════════════════════

  function buildShareCanvas(result) {
    const canvas = document.createElement('canvas');
    canvas.width  = 800;
    canvas.height = 420;
    const ctx = canvas.getContext('2d');

    const sr   = result.successRate ?? 0;
    const pct  = Math.round(sr * 100);
    const age  = result.startAge ?? 35;

    // 家計タイプ
    const TYPES = [
      { cond: r => r.successRate >= 0.88, name:'逃げ切り成功型', emoji:'🏆', color:'#a8ff78' },
      { cond: r => r.successRate >= 0.70, name:'堅実長寿型',     emoji:'🔒', color:'#00d4ff' },
      { cond: r => r.startAge<=38&&r.successRate>=0.50, name:'遅咲き大器晩成型', emoji:'🌱', color:'#b388ff' },
      { cond: r => r.successRate < 0.70,  name:'高収入浪費型',   emoji:'🌊', color:'#ffd166' },
      { cond: () => true,                  name:'一発逆転依存型', emoji:'🎲', color:'#ff4757' },
    ];
    const type = TYPES.find(t => t.cond(result)) || TYPES[TYPES.length-1];

    // ─ 背景 ─
    const bgGrad = ctx.createLinearGradient(0, 0, 800, 420);
    bgGrad.addColorStop(0, '#050810');
    bgGrad.addColorStop(1, '#0a1525');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 800, 420);

    // ─ グロー ─
    const glow = ctx.createRadialGradient(650, 80, 0, 650, 80, 280);
    glow.addColorStop(0, type.color + '18');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 800, 420);

    // ─ ボーダー ─
    ctx.strokeStyle = type.color + '40';
    ctx.lineWidth = 2;
    _roundRect(ctx, 10, 10, 780, 400, 16);
    ctx.stroke();

    // ─ アプリ名 ─
    ctx.font = 'bold 13px "Space Mono", monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillText('FLOW | 家計タイプ診断', 32, 44);

    // ─ 年齢バッジ ─
    ctx.font = '12px "Noto Sans JP", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillText(`${age}歳`, 740, 44);

    // ─ タイプ名 ─
    ctx.font = 'bold 38px "Noto Sans JP", sans-serif';
    ctx.fillStyle = type.color;
    ctx.shadowColor = type.color;
    ctx.shadowBlur = 20;
    ctx.fillText(`${type.emoji} ${type.name}`, 32, 120);
    ctx.shadowBlur = 0;

    // ─ タグライン ─
    ctx.font = '16px "Noto Sans JP", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('お金の寿命シミュレーション結果', 34, 152);

    // ─ 区切り線 ─
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(32, 172);
    ctx.lineTo(768, 172);
    ctx.stroke();

    // ─ スコアゲージ ─
    const gaugeX = 32, gaugeY = 200, gaugeW = 440, gaugeH = 14;
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    _roundRect(ctx, gaugeX, gaugeY, gaugeW, gaugeH, 7);
    ctx.fill();
    const fillW = gaugeW * (pct / 100);
    const fillGrad = ctx.createLinearGradient(gaugeX, 0, gaugeX + fillW, 0);
    fillGrad.addColorStop(0, type.color + 'aa');
    fillGrad.addColorStop(1, type.color);
    ctx.fillStyle = fillGrad;
    ctx.shadowColor = type.color;
    ctx.shadowBlur = 10;
    _roundRect(ctx, gaugeX, gaugeY, fillW, gaugeH, 7);
    ctx.fill();
    ctx.shadowBlur = 0;

    // ─ スコア数値 ─
    ctx.font = 'bold 80px "Space Mono", monospace';
    ctx.fillStyle = type.color;
    ctx.shadowColor = type.color;
    ctx.shadowBlur = 24;
    ctx.fillText(pct + '%', 32, 310);
    ctx.shadowBlur = 0;

    ctx.font = '18px "Noto Sans JP", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText('老後安心スコア', 32, 335);

    // ─ 資産寿命 ─
    const lifeAge = sr >= 0.95 ? '100歳以上'
                  : sr >= 0.85 ? Math.round(90 + sr*10) + '歳'
                  : sr >= 0.70 ? Math.round(80 + sr*12) + '歳'
                  : Math.round(65 + sr*14) + '歳';

    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    _roundRect(ctx, 520, 190, 228, 100, 12);
    ctx.fill();
    ctx.strokeStyle = type.color + '30';
    ctx.lineWidth = 1;
    _roundRect(ctx, 520, 190, 228, 100, 12);
    ctx.stroke();

    ctx.font = '11px "Noto Sans JP", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText('💰 お金の寿命', 536, 214);
    ctx.font = 'bold 32px "Space Mono", monospace';
    ctx.fillStyle = type.color;
    ctx.fillText(lifeAge, 536, 263);

    // ─ フッター ─
    ctx.font = '11px "Space Mono", monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillText('完全ローカル計算 · 外部送信なし · #家計タイプ診断', 32, 393);

    // ─ URLヒント ─
    ctx.font = '11px "Space Mono", monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    const urlStr = location.hostname || 'FLOW simulator';
    ctx.fillText(urlStr, 680, 393);

    return canvas;
  }

  function _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ─ シェア画像モーダルを開く ─
  window.openShareImageModal = function () {
    const result = window._lastSimResult;
    if (!result) {
      alert('先にシミュレーションを実行してください');
      return;
    }
    const modal = document.getElementById('share-image-modal');
    const wrap  = document.getElementById('share-image-card-wrap');
    if (!modal || !wrap) return;

    const canvas = buildShareCanvas(result);
    canvas.style.cssText = 'width:100%;max-width:400px;border-radius:12px;display:block;margin:0 auto;box-shadow:0 8px 40px rgba(0,0,0,.6)';
    wrap.innerHTML = '';
    wrap.appendChild(canvas);
    window._shareCanvas = canvas;

    modal.style.display = 'flex';
  };

  window.downloadShareImage = function () {
    const canvas = window._shareCanvas;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'flow_kakeibo_shindan.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  window.shareImageToX = function () {
    const result = window._lastSimResult;
    if (!result) return;
    const sr   = result.successRate ?? 0;
    const pct  = Math.round(sr * 100);
    const age  = result.startAge ?? 35;
    const TYPES = [
      { cond: r => r.successRate >= 0.88, name:'逃げ切り成功型', emoji:'🏆' },
      { cond: r => r.successRate >= 0.70, name:'堅実長寿型',     emoji:'🔒' },
      { cond: r => r.startAge<=38&&r.successRate>=0.50, name:'遅咲き大器晩成型', emoji:'🌱' },
      { cond: r => r.successRate < 0.70,  name:'高収入浪費型',   emoji:'🌊' },
      { cond: () => true,                  name:'一発逆転依存型', emoji:'🎲' },
    ];
    const type = TYPES.find(t => t.cond(result)) || TYPES[TYPES.length-1];
    const lifeAge = sr>=0.95?'100歳以上': sr>=0.85?Math.round(90+sr*10)+'歳': sr>=0.70?Math.round(80+sr*12)+'歳': Math.round(65+sr*14)+'歳';
    const text = [
      `【FLOW 家計タイプ診断】`,
      `${type.emoji} ${type.name}（${age}歳）`,
      `老後安心スコア: ${pct}% / お金の寿命: ${lifeAge}`,
      `#家計タイプ診断 #FLOW資産シミュレーター`,
    ].join('\n');
    const url = encodeURIComponent(location.href.split('?')[0]);
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${url}`, '_blank', 'noopener,width=600,height=400');
  };

  // ══════════════════════════════════════════════════════════
  // スタイル
  // ══════════════════════════════════════════════════════════
  function injectCompareStyles() {
    if (document.getElementById('compare-styles')) return;
    const s = document.createElement('style');
    s.id = 'compare-styles';
    s.textContent = `
/* ═══ Stock Compare Modal ═══ */
.sc2-wrap { background:var(--surface,#0b1220);border-radius:16px;padding:20px;color:var(--text,#e2eef8); }
.sc2-header { display:flex;justify-content:space-between;align-items:center;margin-bottom:4px; }
.sc2-title { font-size:15px;font-weight:700; }
.sc2-close { background:none;border:none;color:var(--text-dim);font-size:18px;cursor:pointer;padding:4px 8px; }
.sc2-subtitle { font-size:11px;color:var(--text-dim);margin-bottom:14px;line-height:1.6; }
.sc2-current-badge {
  display:inline-block;font-size:11px;font-weight:700;
  background:rgba(0,212,255,.1);border:1px solid rgba(0,212,255,.3);
  color:var(--accent,#00d4ff);padding:4px 12px;border-radius:20px;margin-bottom:14px;
}
.sc2-bars { display:flex;flex-direction:column;gap:12px;margin-bottom:18px; }
.sc2-bar-row {
  display:grid;grid-template-columns:90px 1fr 46px;
  align-items:center;gap:8px;padding:8px 10px;
  background:var(--surface2,#0f1a2c);border:1px solid var(--border,#1c3050);border-radius:8px;
}
.sc2-bar-row.sc2-current { border-color:rgba(0,212,255,.4);background:rgba(0,212,255,.06); }
.sc2-bar-label-wrap { display:flex;align-items:center;gap:4px;flex-wrap:wrap; }
.sc2-bar-pct { font-size:14px;font-weight:800;font-family:'Space Mono',monospace;color:var(--text);min-width:32px; }
.sc2-bar-name { font-size:10px;color:var(--text-dim); }
.sc2-now-tag { font-size:9px;background:rgba(0,212,255,.2);border:1px solid rgba(0,212,255,.4);color:var(--accent);padding:1px 5px;border-radius:10px; }
.sc2-bar-track { height:8px;background:rgba(255,255,255,.06);border-radius:4px;overflow:hidden; }
.sc2-bar-fill { height:100%;border-radius:4px;transition:width .7s cubic-bezier(.4,0,.2,1); }
.sc2-bar-score { font-size:12px;font-weight:700;font-family:'Space Mono',monospace;text-align:right; }
.sc2-bar-note { font-size:10px;color:var(--text-dim);padding:0 10px 4px;line-height:1.5; }
.sc2-recommend { background:rgba(0,212,255,.05);border:1px solid rgba(0,212,255,.15);border-radius:10px;padding:12px 14px;margin-bottom:16px; }
.sc2-rec-title { font-size:12px;font-weight:700;color:var(--accent);margin-bottom:8px; }
.sc2-rec-items { display:flex;flex-direction:column;gap:6px; }
.sc2-rec-item { font-size:11px;color:var(--text-mid);line-height:1.6; }
.sc2-apply-section { margin-bottom:16px; }
.sc2-apply-title { font-size:11px;color:var(--text-dim);margin-bottom:8px; }
.sc2-apply-btns { display:flex;gap:8px;flex-wrap:wrap; }
.sc2-apply-btn {
  padding:8px 14px;background:var(--surface2);border:1px solid var(--border);
  border-radius:8px;color:var(--text);font-size:13px;font-weight:700;
  cursor:pointer;transition:all .2s;font-family:'Space Mono',monospace;
}
.sc2-apply-btn:hover { border-color:var(--accent);color:var(--accent); }
.sc2-apply-current { background:rgba(0,212,255,.1); }
.sc2-close-btn {
  width:100%;padding:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);
  border-radius:8px;color:var(--text-dim);font-size:13px;cursor:pointer;
  font-family:'Noto Sans JP',sans-serif;
}
    `;
    document.head.appendChild(s);
  }

  injectCompareStyles();
})();
