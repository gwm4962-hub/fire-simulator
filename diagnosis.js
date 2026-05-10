/**
 * diagnosis.js — 家計タイプ診断エンジン v2
 * FLOW | 資産シミュレーター
 */
(function () {
  'use strict';

  const TYPES = [
    { id:'escape',  emoji:'🏆', name:'逃げ切り成功型',   tag:'余裕の隠居予備軍',    color:'#a8ff78', glow:'rgba(168,255,120,.4)',
      desc:'資産管理が優秀で老後も十分な余裕があります。このまま維持すれば100歳まで安心。',
      share:'私の家計タイプは【逃げ切り成功型🏆】でした！\n老後も余裕の資産設計。このまま継続するだけでOK。',
      cond: r => r.successRate >= 0.88 && (r.surplus65Man ?? 0) > 500 },
    { id:'steady',  emoji:'🔒', name:'堅実長寿型',       tag:'計算高い安定志向',    color:'#00d4ff', glow:'rgba(0,212,255,.4)',
      desc:'着実な積立と節約で老後設計は良好。少しの改善でさらに安心度が上がります。',
      share:'私の家計タイプは【堅実長寿型🔒】でした！\n地道に積み上げる堅実派。もう少しで完璧な老後設計に。',
      cond: r => r.successRate >= 0.70 },
    { id:'late',    emoji:'🌱', name:'遅咲き大器晩成型', tag:'将来の大器晩成タイプ', color:'#b388ff', glow:'rgba(179,136,255,.4)',
      desc:'まだ若い段階で対策を始めれば十分間に合います。時間を味方につけましょう。',
      share:'私の家計タイプは【遅咲き大器晩成型🌱】でした！\n今からでも遅くない。複利の力で将来は大器晩成タイプに。',
      cond: r => (r.startAge ?? 99) <= 38 && r.successRate >= 0.50 },
    { id:'spender', emoji:'🌊', name:'高収入浪費型',     tag:'穴の空いたバケツ状態', color:'#ffd166', glow:'rgba(255,209,102,.4)',
      desc:'収入は高いのに老後資金が不十分。支出の見直しで劇的に改善できます。',
      share:'私の家計タイプは【高収入浪費型🌊】でした！\n稼いでいるのに老後が不安…支出見直しで大逆転できるらしい。',
      cond: r => r.successRate < 0.70 && (r.monthlyRetire ?? 0) >= 15 },
    { id:'gambler', emoji:'🎲', name:'一発逆転依存型',   tag:'リスクを取りすぎな博打打ち', color:'#ff4757', glow:'rgba(255,71,87,.4)',
      desc:'資産が少なく高リターン狙い。堅実な積立に切り替えることが最優先です。',
      share:'私の家計タイプは【一発逆転依存型🎲】でした！\n老後が危険ゾーン…でも今から堅実な積立に切り替えれば逆転可能らしい。',
      cond: () => true },
  ];

  const LIFE_CARDS = [
    { id:'nisa',   icon:'💹', title:'NISA積立を月3万円増やす', sub:'新NISAの非課税枠を活用', effect:'+12年', boost:0.12, color:'#a8ff78' },
    { id:'exp',    icon:'✂️', title:'固定費を月1万円削減',     sub:'サブスク・通信費を見直す', effect:'+5年',  boost:0.06, color:'#00d4ff' },
    { id:'retire', icon:'🕐', title:'定年を2年延ばす',         sub:'65歳まで現役で収入延長',   effect:'+5年',  boost:0.07, color:'#b388ff' },
    { id:'side',   icon:'💻', title:'副業で月3万円追加',       sub:'スキル活用・フリーランス', effect:'+8年',  boost:0.09, color:'#ffd166' },
    { id:'ideco',  icon:'🏛️', title:'iDeCoを満額拠出',       sub:'所得控除で節税しながら積立', effect:'+7年', boost:0.08, color:'#ff6eb4' },
  ];

  function getType(r) { return TYPES.find(t => t.cond(r)) || TYPES[TYPES.length-1]; }

  function lifeAge(sr) {
    if (sr >= 0.95) return '100歳以上';
    if (sr >= 0.85) return Math.round(90 + sr*10) + '歳';
    if (sr >= 0.70) return Math.round(80 + sr*12) + '歳';
    if (sr >= 0.50) return Math.round(72 + sr*14) + '歳';
    return Math.round(65 + sr*14) + '歳';
  }

  let _active = new Set(), _baseSr = 0, _currentType = null, _result = null;

  function render(result) {
    const el = document.getElementById('diagnosis-panel');
    if (!el) return;
    _result = result;
    _baseSr = result.successRate ?? 0;
    _active.clear();
    const type = getType(result);
    _currentType = type;
    const pct = Math.round(_baseSr * 100);
    const lage = lifeAge(_baseSr);

    el.innerHTML = `
<div class="diag-wrap">

  <!-- ━ タイプカード ━ -->
  <div class="diag-card" style="--tc:${type.color};--tg:${type.glow}">
    <div class="diag-card-shimmer"></div>
    <div class="diag-top-row">
      <span class="diag-app-tag">🔍 家計タイプ診断</span>
      <span class="diag-age-pill">${result.startAge ?? '—'}歳</span>
    </div>
    <div class="diag-main-row">
      <span class="diag-emoji">${type.emoji}</span>
      <div>
        <div class="diag-type-name" style="color:${type.color}">${type.name}</div>
        <div class="diag-type-tag">${type.tag}</div>
      </div>
    </div>
    <div class="diag-life-row">
      <div class="diag-life-left">
        <div class="diag-life-lbl">💰 お金の寿命（推定）</div>
        <div class="diag-life-val" id="d-life" style="color:${type.color}">${lage}</div>
      </div>
      <div class="diag-donut-wrap">
        ${buildDonut(pct, type.color)}
        <div class="diag-donut-center">
          <div class="diag-donut-num" id="d-pct" style="color:${type.color}">${pct}</div>
          <div class="diag-donut-unit">%</div>
        </div>
      </div>
    </div>
    <div class="diag-score-track"><div class="diag-score-fill" id="d-fill" style="width:${pct}%;background:${type.color};box-shadow:0 0 10px ${type.glow}"></div></div>
    <div class="diag-desc">${type.desc}</div>
  </div>

  <!-- ━ 寿命延長カード ━ -->
  <div class="diag-section">
    <div class="diag-section-hd">
      <span>🃏 寿命延長カードを装備しよう</span>
      <span class="diag-hint-blink">タップ → 資産寿命がのびる</span>
    </div>
    <div class="diag-lc-grid">
      ${LIFE_CARDS.map(c => `
        <div class="diag-lc" id="lc-${c.id}" onclick="toggleLC('${c.id}')">
          <div class="diag-lc-check" id="lc-chk-${c.id}">✓</div>
          <div class="diag-lc-icon">${c.icon}</div>
          <div class="diag-lc-body">
            <div class="diag-lc-title">${c.title}</div>
            <div class="diag-lc-sub">${c.sub}</div>
          </div>
          <div class="diag-lc-eff" style="color:${c.color}">${c.effect}</div>
        </div>
      `).join('')}
    </div>
    <div class="diag-boost-box" id="d-boost" style="display:none">
      <div class="dbb-lbl">カード装備後の推定スコア</div>
      <div class="dbb-row">
        <span class="dbb-before" id="dbb-bef">${pct}%</span>
        <span class="dbb-arr">→</span>
        <span class="dbb-after" id="dbb-aft" style="color:${type.color}">—</span>
      </div>
      <div class="dbb-life">📅 資産寿命：<span id="dbb-life" style="color:${type.color};font-weight:700">—</span></div>
    </div>
  </div>

  <!-- ━ シェアセクション ━ -->
  <div class="diag-section diag-share-sec">
    <div class="diag-section-hd">📱 診断結果をシェア</div>
    <div class="diag-share-preview">
      <div style="font-size:15px;font-weight:700;color:${type.color};margin-bottom:4px">${type.emoji} ${type.name}</div>
      <div style="font-size:12px;color:var(--text-mid);line-height:1.8">${type.share.replace(/\n/g,'<br>')}<br>
      老後安心スコア: ${pct}% / お金の寿命: ${lage}</div>
      <div style="font-size:11px;color:var(--text-dim);margin-top:6px">#家計タイプ診断 #FLOW資産シミュレーター</div>
    </div>
    <div class="diag-share-btns">
      <button class="diag-share-img-btn" onclick="openShareImageModal()">
        🖼️ おしゃれな画像でシェア
      </button>
      <button class="diag-share-x-btn" onclick="shareDiagToX()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.261 5.632L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/></svg>
        テキストでシェア
      </button>
    </div>
  </div>

</div>`;

    el.style.display = 'block';
    injectStyles();
  }

  function buildDonut(pct, color) {
    const r = 36, cx = 40, cy = 40, sw = 7;
    const circ = 2 * Math.PI * r;
    const fill = circ * pct / 100;
    return `<svg width="80" height="80" viewBox="0 0 80 80">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="${sw}"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}"
        stroke-dasharray="${fill} ${circ-fill}" stroke-dashoffset="${circ*.25}"
        stroke-linecap="round" style="transition:stroke-dasharray .8s ease"/>
    </svg>`;
  }

  window.toggleLC = function(id) {
    const card = LIFE_CARDS.find(c => c.id === id);
    if (!card) return;
    const el = document.getElementById('lc-' + id);
    if (_active.has(id)) { _active.delete(id); el?.classList.remove('lc-on'); }
    else                  { _active.add(id);    el?.classList.add('lc-on'); }
    _refreshBoost();
  };

  function _refreshBoost() {
    const boostEl = document.getElementById('d-boost');
    const aftEl   = document.getElementById('dbb-aft');
    const lifeEl  = document.getElementById('dbb-life');
    const fillEl  = document.getElementById('d-fill');
    const pctEl   = document.getElementById('d-pct');
    const lageEl  = document.getElementById('d-life');
    const befEl   = document.getElementById('dbb-bef');
    const basePct = Math.round(_baseSr * 100);

    if (_active.size === 0) {
      if (boostEl) boostEl.style.display = 'none';
      if (fillEl)  fillEl.style.width = basePct + '%';
      if (pctEl)   pctEl.textContent  = basePct;
      if (lageEl)  lageEl.textContent = lifeAge(_baseSr);
      return;
    }
    let boost = 0;
    _active.forEach(id => { const c = LIFE_CARDS.find(x => x.id===id); if(c) boost += c.boost; });
    const newSr  = Math.min(0.98, _baseSr + boost);
    const newPct = Math.round(newSr * 100);
    const delta  = newPct - basePct;
    const nla    = lifeAge(newSr);
    if (boostEl) boostEl.style.display = 'block';
    if (befEl)   befEl.textContent  = basePct + '%';
    if (aftEl)   aftEl.textContent  = `${newPct}%  (+${delta}pt)`;
    if (lifeEl)  lifeEl.textContent = nla;
    if (fillEl)  fillEl.style.width = newPct + '%';
    if (pctEl)   pctEl.textContent  = newPct;
    if (lageEl)  lageEl.textContent = nla;
  }

  window.shareDiagToX = function() {
    if (!_result) return;
    const type = getType(_result);
    const pct  = Math.round(_baseSr * 100);
    const lage = lifeAge(_baseSr);
    let boost = 0;
    _active.forEach(id => { const c = LIFE_CARDS.find(x => x.id===id); if(c) boost += c.boost; });
    const extra = _active.size > 0
      ? `\n改善策を実践すれば → ${Math.round(Math.min(0.98,_baseSr+boost)*100)}% に！`
      : '';
    const text = `【FLOW 家計タイプ診断】\n${type.emoji} ${type.name}\n老後安心スコア: ${pct}% / お金の寿命: ${lage}${extra}\n#家計タイプ診断 #FLOW資産シミュレーター`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(location.href.split('?')[0])}`, '_blank', 'noopener,width=600,height=400');
  };

  window.addEventListener('sim:done', function(e) {
    if (!e.detail) return;
    const mode = document.body.getAttribute('data-mode');
    if (mode === 'pro') return;
    render(e.detail);
    const p = document.getElementById('diagnosis-panel');
    if (p) setTimeout(() => p.scrollIntoView({ behavior:'smooth', block:'start' }), 200);
  });

  function injectStyles() {
    if (document.getElementById('diag-styles')) return;
    const s = document.createElement('style');
    s.id = 'diag-styles';
    s.textContent = `
.diag-wrap { display:flex;flex-direction:column;gap:14px;font-family:'Noto Sans JP',sans-serif; }

/* ─ タイプカード ─ */
.diag-card {
  background:var(--surface,#0b1220);
  border:1px solid color-mix(in srgb,var(--tc,#a8ff78) 35%,transparent);
  border-radius:16px;padding:18px 18px 16px;position:relative;overflow:hidden;
  box-shadow:0 0 40px var(--tg,rgba(168,255,120,.2));
}
.diag-card-shimmer {
  position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(ellipse 60% 40% at 80% 10%,var(--tg,rgba(168,255,120,.1)) 0%,transparent 70%);
}
.diag-top-row { display:flex;justify-content:space-between;align-items:center;margin-bottom:14px; }
.diag-app-tag { font-size:11px;color:var(--text-dim);font-family:'Space Mono',monospace;letter-spacing:1px; }
.diag-age-pill { font-size:11px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);padding:3px 10px;border-radius:20px;color:var(--text-mid); }
.diag-main-row { display:flex;align-items:center;gap:14px;margin-bottom:16px; }
.diag-emoji { font-size:48px;line-height:1;filter:drop-shadow(0 0 12px var(--tg,rgba(168,255,120,.5))); }
.diag-type-name { font-size:22px;font-weight:800;line-height:1.2;margin-bottom:3px; }
.diag-type-tag { font-size:12px;color:var(--text-mid); }
.diag-life-row { display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:rgba(0,0,0,.25);border-radius:10px;margin-bottom:12px; }
.diag-life-lbl { font-size:11px;color:var(--text-dim);margin-bottom:3px; }
.diag-life-val { font-size:26px;font-weight:800;font-family:'Space Mono',monospace;transition:all .5s; }
.diag-donut-wrap { position:relative;width:80px;height:80px;flex-shrink:0; }
.diag-donut-center { position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center; }
.diag-donut-num { font-size:22px;font-weight:800;font-family:'Space Mono',monospace;line-height:1; }
.diag-donut-unit { font-size:10px;color:var(--text-dim); }
.diag-score-track { height:6px;background:rgba(255,255,255,.07);border-radius:3px;overflow:hidden;margin-bottom:12px; }
.diag-score-fill { height:100%;border-radius:3px;transition:width .8s cubic-bezier(.4,0,.2,1); }
.diag-desc { font-size:12px;color:var(--text-mid);line-height:1.8;border-top:1px solid rgba(255,255,255,.06);padding-top:12px; }

/* ─ セクション ─ */
.diag-section { background:var(--surface,#0b1220);border:1px solid var(--border,#1c3050);border-radius:14px;padding:14px; }
.diag-section-hd { display:flex;justify-content:space-between;align-items:center;font-size:13px;font-weight:700;margin-bottom:10px;color:var(--text); }
.diag-hint-blink { font-size:10px;color:var(--text-dim);font-weight:400;animation:hblink 2s ease-in-out infinite; }
@keyframes hblink{0%,100%{opacity:.5}50%{opacity:1}}

/* ─ ライフカード ─ */
.diag-lc-grid { display:flex;flex-direction:column;gap:6px;margin-bottom:10px; }
.diag-lc {
  display:flex;align-items:center;gap:10px;padding:10px 12px;
  background:var(--surface2,#0f1a2c);border:1px solid var(--border,#1c3050);border-radius:10px;
  cursor:pointer;transition:all .2s;position:relative;-webkit-tap-highlight-color:transparent;
}
.diag-lc:hover { border-color:var(--accent,#00d4ff);transform:translateX(3px); }
.diag-lc.lc-on { border-color:var(--accent3,#a8ff78);background:rgba(168,255,120,.07);box-shadow:0 0 14px rgba(168,255,120,.15); }
.diag-lc-check {
  display:none;position:absolute;top:6px;right:6px;
  font-size:11px;font-weight:700;color:#a8ff78;
  background:rgba(168,255,120,.15);border-radius:50%;width:18px;height:18px;
  align-items:center;justify-content:center;
}
.lc-on .diag-lc-check { display:flex; }
.diag-lc-icon { font-size:20px;flex-shrink:0; }
.diag-lc-body { flex:1;min-width:0; }
.diag-lc-title { font-size:12px;font-weight:700;color:var(--text);line-height:1.3; }
.diag-lc-sub { font-size:10px;color:var(--text-dim);margin-top:1px; }
.diag-lc-eff { font-size:14px;font-weight:800;font-family:'Space Mono',monospace;flex-shrink:0;opacity:.65; }
.lc-on .diag-lc-eff { opacity:1; }

/* ─ ブーストボックス ─ */
.diag-boost-box { background:linear-gradient(135deg,rgba(168,255,120,.08),rgba(0,212,255,.06));border:1px solid rgba(168,255,120,.2);border-radius:10px;padding:12px;animation:boostIn .4s ease-out; }
@keyframes boostIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.dbb-lbl { font-size:10px;color:var(--text-dim);margin-bottom:6px; }
.dbb-row { display:flex;align-items:center;gap:10px;margin-bottom:6px; }
.dbb-before { font-size:18px;font-family:'Space Mono',monospace;color:var(--text-dim); }
.dbb-arr { color:#a8ff78;font-size:16px; }
.dbb-after { font-size:24px;font-weight:800;font-family:'Space Mono',monospace;transition:all .4s; }
.dbb-life { font-size:12px;color:var(--text-mid); }

/* ─ シェア ─ */
.diag-share-sec {}
.diag-share-preview { background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:8px;padding:12px;margin-bottom:10px; }
.diag-share-btns { display:flex;flex-direction:column;gap:8px; }
.diag-share-img-btn {
  width:100%;padding:14px;
  background:linear-gradient(135deg,#0055cc,#003d99);
  border:none;border-radius:10px;color:#fff;font-size:14px;font-weight:700;
  cursor:pointer;transition:all .2s;font-family:'Noto Sans JP',sans-serif;
  box-shadow:0 4px 20px rgba(0,85,204,.4);
}
.diag-share-img-btn:hover { transform:translateY(-2px);box-shadow:0 6px 28px rgba(0,85,204,.55); }
.diag-share-x-btn {
  width:100%;padding:12px;background:#000;border:1px solid rgba(255,255,255,.2);
  border-radius:10px;color:#fff;font-size:13px;font-weight:700;
  cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;
  transition:all .2s;font-family:'Noto Sans JP',sans-serif;
}
.diag-share-x-btn:hover { background:rgba(255,255,255,.1); }
@media(max-width:480px){
  .diag-emoji{font-size:36px}
  .diag-type-name{font-size:18px}
  .diag-life-val{font-size:20px}
  .diag-lc-grid{gap:5px}
}
    `;
    document.head.appendChild(s);
  }

  injectStyles();
})();
