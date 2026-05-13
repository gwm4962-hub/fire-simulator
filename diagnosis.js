/**
 * diagnosis.js — 家計タイプ診断エンジン v2.1
 * FLOW | 資産シミュレーター
 *
 * 修正点:
 *   ⑪ lifeAge() を線形補間式に修正（直感と合わない値を排除）
 *   ⑫ ライフカードに role="checkbox" + tabindex + キーボード操作対応
 *   ⑬ sim:done リスナーを1つに統合（render → AI診断を順番保証）
 *      AI診断を diagnosis-panel 内部に組み込み視覚的に一体化
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
    { id:'nisa',   icon:'💹', title:'NISA積立を月3万円増やす', sub:'新NISAの非課税枠を活用', effect:'+12年', boost:0.12, color:'#a8ff78', rarity:'SSR', cost:'月3万円' },
    { id:'exp',    icon:'✂️', title:'固定費を月1万円削減',     sub:'サブスク・通信費を見直す', effect:'+5年',  boost:0.06, color:'#00d4ff', rarity:'R',   cost:'0円' },
    { id:'retire', icon:'🕐', title:'65歳まで働く（再雇用含む）', sub:'60〜65歳は収入50%で試算', effect:'+8年', boost:0.09, color:'#b388ff', rarity:'SR',  cost:'5年の労働' },
    { id:'side',   icon:'💻', title:'副業で月3万円追加',       sub:'スキル活用・フリーランス', effect:'+8年',  boost:0.09, color:'#ffd166', rarity:'SR',  cost:'月3万円' },
    { id:'ideco',  icon:'🏛️', title:'iDeCoを満額拠出',        sub:'所得控除で節税しながら積立', effect:'+7年', boost:0.08, color:'#ff6eb4', rarity:'SR',  cost:'月2.3万円' },
  ];

  // レアリティ色マップ
  const RARITY_COLOR = { SSR: '#ffd700', SR: '#c586f0', R: '#00d4ff' };
  const RARITY_GLOW  = { SSR: 'rgba(255,215,0,.35)', SR: 'rgba(197,134,240,.3)', R: 'rgba(0,212,255,.2)' };

  function getType(r) { return TYPES.find(t => t.cond(r)) || TYPES[TYPES.length-1]; }

  /**
   * ⑪ lifeAge() — 線形補間式に修正
   * 旧: sr*10 などの係数で直感と合わない値が出ていた
   *     例）sr=0.94 → 90+9.4=99歳（95%未満なのに99歳は高すぎ）
   * 新: 区間の両端を固定し、その間を線形補間
   *     95%→"100歳以上" | 85%→95歳 | 70%→88歳 | 50%→80歳 | 0%→65歳
   */
  function lifeAge(sr) {
    if (sr >= 0.95) return '100歳以上';
    if (sr >= 0.85) return Math.round(88 + (sr - 0.85) / 0.10 * 7) + '歳'; // 88〜95歳
    if (sr >= 0.70) return Math.round(80 + (sr - 0.70) / 0.15 * 8) + '歳'; // 80〜88歳
    if (sr >= 0.50) return Math.round(74 + (sr - 0.50) / 0.20 * 6) + '歳'; // 74〜80歳
    return Math.round(65 + sr / 0.50 * 9) + '歳';                          // 65〜74歳
  }

  let _active = new Set(), _baseSr = 0, _currentType = null, _result = null;

  // ─────────────────────────────────────────────
  // render() — 家計タイプカードを描画
  // ⑬ AI診断セクションをここに内包（視覚的一体化）
  // ─────────────────────────────────────────────
  function render(result) {
    const el = document.getElementById('diagnosis-panel');
    if (!el) return;
    _result = result;
    _baseSr = result.successRate ?? 0;
    _active.clear();
    const type = getType(result);
    _currentType = type;
    const pct  = Math.round(_baseSr * 100);
    const lage = lifeAge(_baseSr);
    const agePill = result.startAge ? `${result.startAge}歳` : '診断済';

    // ⑫ ライフカード: role="checkbox" + tabindex="0" でキーボード対応（ゲームカードUI）
    const lcItems = LIFE_CARDS.map(c => {
      const rc = RARITY_COLOR[c.rarity] || c.color;
      const rg = RARITY_GLOW[c.rarity]  || 'rgba(0,0,0,0)';
      return `
      <div class="diag-lc diag-lc-game"
           id="lc-${c.id}"
           role="checkbox"
           aria-checked="false"
           aria-label="${c.title}"
           tabindex="0"
           style="--lc-rc:${rc};--lc-rg:${rg};"
           onclick="toggleLC('${c.id}')"
           onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleLC('${c.id}');}">
        <div class="diag-lc-shimmer"></div>
        <div class="diag-lc-rarity" style="color:${rc}">${c.rarity}</div>
        <div class="diag-lc-check" id="lc-chk-${c.id}" aria-hidden="true">✓</div>
        <div class="diag-lc-icon" aria-hidden="true">${c.icon}</div>
        <div class="diag-lc-body">
          <div class="diag-lc-title">${c.title}</div>
          <div class="diag-lc-sub">${c.sub}</div>
          <div class="diag-lc-cost">コスト：${c.cost}</div>
        </div>
        <div class="diag-lc-eff" style="color:${c.color}" aria-hidden="true">
          <span class="diag-lc-eff-num">${c.effect}</span>
          <span class="diag-lc-eff-lbl">延命</span>
        </div>
      </div>
    `;}).join('');

    el.innerHTML = `
<div class="diag-wrap">

  <!-- ━ タイプカード ━ -->
  <div class="diag-card" style="--tc:${type.color};--tg:${type.glow}">
    <div class="diag-card-shimmer"></div>
    <div class="diag-top-row">
      <span class="diag-app-tag">🔍 家計タイプ診断</span>
      <span class="diag-age-pill">${agePill}</span>
    </div>
    <div class="diag-main-row">
      <span class="diag-emoji" aria-hidden="true">${type.emoji}</span>
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
      <div class="diag-donut-wrap" role="img" aria-label="老後安心スコア ${pct}%">
        ${buildDonut(pct, type.color)}
        <div class="diag-donut-center">
          <div class="diag-donut-num" id="d-pct" style="color:${type.color}">${pct}</div>
          <div class="diag-donut-unit">%</div>
        </div>
      </div>
    </div>
    <div class="diag-score-track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
      <div class="diag-score-fill" id="d-fill" style="width:${pct}%;background:${type.color};box-shadow:0 0 10px ${type.glow}"></div>
    </div>
    <div class="diag-desc">${type.desc}</div>
  </div>

  <!-- ━ AI深層診断（⑬ diagnosis-panel内に統合） ━ -->
  <div class="diag-section diag-ai-sec" id="diag-ai-section">
    <div class="diag-section-hd">
      <span>🤖 AI深層診断</span>
      <span class="diag-ai-badge">Gemini 2.5 Flash</span>
    </div>
    <div id="diag-ai-body" class="diag-ai-loading">
      <div class="diag-ai-spinner" aria-hidden="true"></div>
      <span>分析中…</span>
    </div>
  </div>

  <!-- ━ 寿命延長カード ━ -->
  <div class="diag-section diag-lifegame-sec">
    <div class="diag-section-hd">
      <span>🃏 延命アイテムを装備しよう</span>
      <div class="diag-lc-counter-wrap">
        <span class="diag-lc-counter" id="lc-counter">0 / ${LIFE_CARDS.length}</span>
        <span class="diag-hint-blink">タップで装備</span>
      </div>
    </div>
    <div class="diag-lifebar-wrap" aria-label="現在の資産寿命ゲージ">
      <div class="diag-lifebar-track">
        <div class="diag-lifebar-fill" id="d-lifebar" style="width:${Math.min(100,pct)}%;background:${type.color};"></div>
        <div class="diag-lifebar-label" id="d-lifebar-label">${lage}</div>
      </div>
      <div class="diag-lifebar-max">💀 破産</div>
    </div>
    <div class="diag-lc-grid" role="group" aria-label="延命アイテムカード">
      ${lcItems}
    </div>
    <div class="diag-boost-box" id="d-boost" style="display:none" aria-live="polite">
      <div class="dbb-lbl">✨ 装備効果：推定スコア変化</div>
      <div class="dbb-row">
        <span class="dbb-before" id="dbb-bef">${pct}%</span>
        <span class="dbb-arr" aria-hidden="true">⟶</span>
        <span class="dbb-after" id="dbb-aft" style="color:${type.color}">—</span>
      </div>
      <div class="dbb-life">💰 資産寿命：<span id="dbb-life" style="color:${type.color};font-weight:700">—</span></div>
      <div class="dbb-msg" id="dbb-msg"></div>
    </div>
  </div>

  <!-- ━ シェアセクション ━ -->
  <div class="diag-section diag-share-sec">
    <div class="diag-section-hd">📱 診断結果をシェア</div>
    <div class="diag-share-preview" aria-label="シェア用テキストプレビュー">
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
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.261 5.632L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/></svg>
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
    return `<svg width="80" height="80" viewBox="0 0 80 80" aria-hidden="true">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="${sw}"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}"
        stroke-dasharray="${fill} ${circ-fill}" stroke-dashoffset="${circ*.25}"
        stroke-linecap="round" style="transition:stroke-dasharray .8s ease"/>
    </svg>`;
  }

  // ⑫ toggleLC — aria-checked も更新
  window.toggleLC = function(id) {
    const card = LIFE_CARDS.find(c => c.id === id);
    if (!card) return;
    const el = document.getElementById('lc-' + id);
    if (_active.has(id)) {
      _active.delete(id);
      el?.classList.remove('lc-on');
      el?.setAttribute('aria-checked', 'false');
    } else {
      _active.add(id);
      el?.classList.add('lc-on');
      el?.setAttribute('aria-checked', 'true');
    }
    _refreshBoost();
  };

  function _refreshBoost() {
    const boostEl    = document.getElementById('d-boost');
    const aftEl      = document.getElementById('dbb-aft');
    const lifeEl     = document.getElementById('dbb-life');
    const fillEl     = document.getElementById('d-fill');
    const pctEl      = document.getElementById('d-pct');
    const lageEl     = document.getElementById('d-life');
    const befEl      = document.getElementById('dbb-bef');
    const lbarFill   = document.getElementById('d-lifebar');
    const lbarLabel  = document.getElementById('d-lifebar-label');
    const msgEl      = document.getElementById('dbb-msg');
    const counterEl  = document.getElementById('lc-counter');
    const basePct    = Math.round(_baseSr * 100);

    // カウンター更新
    if (counterEl) counterEl.textContent = _active.size + ' / ' + LIFE_CARDS.length;

    if (_active.size === 0) {
      if (boostEl)   boostEl.style.display = 'none';
      if (fillEl)    fillEl.style.width = Math.min(100, basePct) + '%';
      if (pctEl)     pctEl.textContent  = basePct;
      const la = lifeAge(_baseSr);
      if (lageEl)    lageEl.textContent = la;
      if (lbarFill)  lbarFill.style.width = Math.min(100, basePct) + '%';
      if (lbarLabel) lbarLabel.textContent = la;
      return;
    }

    let boost = 0;
    _active.forEach(id => { const c = LIFE_CARDS.find(x => x.id===id); if(c) boost += c.boost; });

    const rawSr  = _baseSr + boost;
    const newSr  = Math.min(0.98, rawSr);
    const newPct = Math.round(newSr * 100);
    const actualDelta = newPct - basePct;
    const nla = lifeAge(newSr);

    // ゲームっぽいメッセージ
    let gameMsg = '';
    if (_active.size === 1) gameMsg = '💡 アイテム装備！資産寿命が延びています';
    else if (_active.size === 2) gameMsg = '⚡ コンボ！複数装備で相乗効果';
    else if (_active.size === 3) gameMsg = '🔥 トリプルコンボ！かなりの延命効果';
    else if (_active.size >= LIFE_CARDS.length) gameMsg = '👑 フルコンプ！最大延命モード突入';
    else gameMsg = `✨ ${_active.size}アイテム装備中`;

    if (boostEl) boostEl.style.display = 'block';
    if (befEl)   befEl.textContent  = basePct + '%';
    if (aftEl)   aftEl.textContent  = actualDelta > 0
      ? `${newPct}%（+${actualDelta}pt 🆙）`
      : `${newPct}%（上限98%に到達 👑）`;
    if (lifeEl)  lifeEl.textContent = nla;
    if (fillEl)  { fillEl.style.width = Math.min(100, newPct) + '%'; }
    if (pctEl)   pctEl.textContent  = newPct;
    if (lageEl)  lageEl.textContent = nla;
    if (lbarFill)  { lbarFill.style.width = Math.min(100, newPct) + '%'; }
    if (lbarLabel) lbarLabel.textContent = nla;
    if (msgEl)   msgEl.textContent = gameMsg;
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

  // ─────────────────────────────────────────────
  // ⑬ sim:done リスナーを1つに統合
  //    ① render（家計タイプ）→ ② AI診断fetch の順番を保証
  //    AI診断は diagnosis-panel 内の #diag-ai-body に表示（視覚的一体化）
  // ─────────────────────────────────────────────
  // ── クールタイム管理（レート制限対策）───────────────────────────
  // 30秒以内の連続実行は診断ボタンを無効化してAPIを叩かせない
  const COOLDOWN_MS = 30_000;
  let _lastDiagAt   = 0;

  window.addEventListener('sim:done', async (e) => {
    if (!e.detail) return;
    const result = e.detail;
    const mode   = document.body.getAttribute('data-mode');

    // ── ① 家計タイプ診断（pro モード以外）──
    if (mode !== 'pro') {
      render(result);
      const p = document.getElementById('diagnosis-panel');
      if (p) {
        requestAnimationFrame(() => {
          p.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    }

    // ── ② AI深層診断（diagnosis-panel 内 #diag-ai-body に表示）──
    // #ai-response（旧）は非表示にして diag-ai-body に一本化
    const legacyAi = document.getElementById('ai-response');
    if (legacyAi) legacyAi.style.display = 'none';

    const aiBody = document.getElementById('diag-ai-body');
    if (!aiBody) return;

    // ── クールタイムチェック ──────────────────────────────
    const now = Date.now();
    const remaining = Math.ceil((COOLDOWN_MS - (now - _lastDiagAt)) / 1000);
    if (_lastDiagAt > 0 && remaining > 0) {
      aiBody.className = '';
      aiBody.innerHTML = `<p class="diag-ai-error">⏳ 診断は${remaining}秒後に再実行できます。シミュレーション条件を変えてお待ちください。</p>`;
      return;
    }
    _lastDiagAt = now;

    // ローディング表示（スピナー）
    aiBody.className = 'diag-ai-loading';
    aiBody.innerHTML = `
      <div class="diag-ai-spinner" aria-hidden="true"></div>
      <span>分析中…</span>`;

    try {
      const res = await fetch('https://fire-simulator-mv3a.onrender.com/api/diagnosis', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success_rate:       result.successRate,
          assets_65man:       result.assets65Man,
          fire_age:           result.fireAge        ?? null,
          monthly_expense:    result.monthlyExpense ?? null,
          surplus_65man:      result.surplus65Man   ?? null,
          need_at_65man:      result.needAt65Man    ?? null,
          inflation_rate:     result.inflationRate  ?? null,
          stock_ratio_work:   result.stockRatioWork   ?? null,
          stock_ratio_retire: result.stockRatioRetire ?? null,
        }),
      });

      if (!res.ok) {
        // レート制限エラーの場合は詳細なメッセージを取得
        let errBody = null;
        try { errBody = await res.json(); } catch(_) {}
        if (res.status === 429) {
          const waitSec = errBody?.retry_after ?? 30;
          const errMsg = errBody?.message ?? `診断は${waitSec}秒後に再実行できます。`;
          aiBody.className = '';
          aiBody.innerHTML = `<p class="diag-ai-error">⏳ ${errMsg}</p>`;
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const rawText = await res.text();
      console.log('[AI診断] raw response:', rawText);

      // JSON パース
      let data;
      try {
        data = JSON.parse(rawText);
      } catch (parseErr) {
        console.error('[AI診断] JSON parse error:', parseErr);
        aiBody.className = '';
        aiBody.innerHTML = '<p class="diag-ai-error">⚠️ レスポンスの解析に失敗しました。</p>';
        return;
      }

      console.log('[AI診断] parsed data:', data);
      console.log('[AI診断] data.analysis type:', typeof data.analysis, data.analysis);

      // ── 値を文字列として安全に取り出す共通ヘルパー ──
      function safeStr(v) {
        if (v === null || v === undefined) return '';
        if (typeof v === 'string') return v;
        // オブジェクト・配列は JSON 化（[object Object] を絶対に出さない）
        return JSON.stringify(v, null, 2);
      }

      // ── analysis オブジェクトを取り出す ──
      // パターン1: { analysis: { diagnosis, blind_spot, action }, used_model }  ← main.py の正規形
      // パターン2: { diagnosis, blind_spot, action }  ← analysis ラップなし
      // パターン3: { analysis: "文字列" }  ← まれに文字列で来る場合
      let src = null;
      if (data && data.analysis !== undefined) {
        if (typeof data.analysis === 'object' && data.analysis !== null) {
          src = data.analysis;                          // パターン1
        } else if (typeof data.analysis === 'string') {
          try { src = JSON.parse(data.analysis); }      // パターン3: 文字列→再パース
          catch (_) { src = { diagnosis: data.analysis, blind_spot: '', action: '' }; }
        }
      } else if (data && typeof data.diagnosis === 'string') {
        src = data;                                     // パターン2
      }

      console.log('[AI診断] src:', src);

      if (src && typeof src === 'object') {
        const diagnosis  = safeStr(src.diagnosis);
        const blind_spot = safeStr(src.blind_spot);
        const action     = safeStr(src.action);

        if (diagnosis || blind_spot || action) {
          const sections = [
            { icon: '📊', label: '診断',            color: '#00d4ff', text: diagnosis  },
            { icon: '⚠️', label: '盲点・リスク',    color: '#ffd166', text: blind_spot },
            { icon: '🎯', label: '最優先アクション', color: '#a8ff78', text: action     },
          ];
          const html = sections.filter(s => s.text).map(s => {
            const escaped = s.text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return '<div class="diag-ai-block">'
              + '<div class="diag-ai-block-hd" style="color:' + s.color + '">'
              + '<span>' + s.icon + '</span><span>' + s.label + '</span></div>'
              + '<p class="diag-ai-text">' + escaped + '</p></div>';
          }).join('');
          aiBody.className = '';
          aiBody.innerHTML = html;
        } else {
          aiBody.className = '';
          aiBody.innerHTML = '<p class="diag-ai-error">⚠️ 診断データが空でした。再実行してください。</p>';
        }
      } else {
        // どのパターンにも合致しない → 生テキストを表示
        const safe = rawText.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        aiBody.className = '';
        aiBody.innerHTML = '<p class="diag-ai-text">' + safe + '</p>';
      }

    } catch (err) {
      console.error('AI診断エラー:', err);
      aiBody.className = '';

      // main.py のエラーコードに応じてユーザーフレンドリーなメッセージを表示
      let msg = '⚠️ AI診断に失敗しました。30秒後に再実行してください。';
      try {
        const errData = await err?.response?.json?.() ?? {};
        const code = errData?.detail?.error_code ?? '';
        if (code === 'RATE_LIMIT') {
          msg = '⏱️ AIの診断枠が一時的に満杯です。1〜2分後に再実行してください。';
        } else if (code === 'TIMEOUT') {
          msg = '⌛ AIの応答がタイムアウトしました。サーバーが混雑しています。少し待ってから再実行してください。';
        } else if (code === 'AUTH_ERROR') {
          msg = '🔧 サーバー設定に問題が発生しています。運営者にお問い合わせください。';
        }
      } catch (_) { /* レスポンスなし or パース失敗はデフォルトメッセージのまま */ }

      aiBody.innerHTML = `<p class="diag-ai-error">${msg}</p>`;
    }
  });

  // ─────────────────────────────────────────────
  // スタイル注入
  // ─────────────────────────────────────────────
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
.diag-top-row    { display:flex;justify-content:space-between;align-items:center;margin-bottom:14px; }
.diag-app-tag    { font-size:11px;color:var(--text-dim);font-family:'Space Mono',monospace;letter-spacing:1px; }
.diag-age-pill   { font-size:11px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);padding:3px 10px;border-radius:20px;color:var(--text-mid); }
.diag-main-row   { display:flex;align-items:center;gap:14px;margin-bottom:16px; }
.diag-emoji      { font-size:48px;line-height:1;filter:drop-shadow(0 0 12px var(--tg,rgba(168,255,120,.5))); }
.diag-type-name  { font-size:22px;font-weight:800;line-height:1.2;margin-bottom:3px; }
.diag-type-tag   { font-size:12px;color:var(--text-mid); }
.diag-life-row   { display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:rgba(0,0,0,.25);border-radius:10px;margin-bottom:12px; }
.diag-life-lbl   { font-size:11px;color:var(--text-dim);margin-bottom:3px; }
.diag-life-val   { font-size:26px;font-weight:800;font-family:'Space Mono',monospace;transition:all .5s; }
.diag-donut-wrap { position:relative;width:80px;height:80px;flex-shrink:0; }
.diag-donut-center { position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center; }
.diag-donut-num  { font-size:22px;font-weight:800;font-family:'Space Mono',monospace;line-height:1; }
.diag-donut-unit { font-size:10px;color:var(--text-dim); }
.diag-score-track { height:6px;background:rgba(255,255,255,.07);border-radius:3px;overflow:hidden;margin-bottom:12px; }
.diag-score-fill  { height:100%;border-radius:3px;transition:width .8s cubic-bezier(.4,0,.2,1); }
.diag-desc       { font-size:12px;color:var(--text-mid);line-height:1.8;border-top:1px solid rgba(255,255,255,.06);padding-top:12px; }

/* ─ セクション ─ */
.diag-section    { background:var(--surface,#0b1220);border:1px solid var(--border,#1c3050);border-radius:14px;padding:14px; }
.diag-section-hd { display:flex;justify-content:space-between;align-items:center;font-size:13px;font-weight:700;margin-bottom:10px;color:var(--text); }
.diag-hint-blink { font-size:10px;color:var(--text-dim);font-weight:400;animation:hblink 2s ease-in-out infinite; }
@keyframes hblink{0%,100%{opacity:.5}50%{opacity:1}}

/* ─ AI深層診断（⑬ diagnosis-panel内に統合） ─ */
.diag-ai-sec    { border-color:rgba(0,212,255,.2); }
.diag-ai-badge  {
  font-size:10px;font-family:'Space Mono',monospace;letter-spacing:.5px;
  padding:2px 8px;border-radius:4px;
  background:rgba(0,212,255,.1);color:#00d4ff;
  border:1px solid rgba(0,212,255,.25);
}
.diag-ai-loading {
  display:flex;align-items:center;gap:10px;
  padding:4px 0;color:var(--text-dim);font-size:13px;
}
.diag-ai-spinner {
  width:16px;height:16px;flex-shrink:0;
  border:2px solid rgba(0,212,255,.2);border-top-color:#00d4ff;
  border-radius:50%;animation:diag-spin .8s linear infinite;
}
@keyframes diag-spin { to { transform:rotate(360deg) } }
.diag-ai-text  { margin:0;font-size:13px;color:var(--text-mid,#8ca0b8);line-height:1.9; }
.diag-ai-error { margin:0;font-size:12px;color:#ffd166;line-height:1.7; }
.diag-ai-block { margin-bottom:12px; }
.diag-ai-block:last-child { margin-bottom:0; }
.diag-ai-block-hd {
  display:flex;align-items:center;gap:5px;
  font-size:11px;font-weight:700;letter-spacing:.5px;
  font-family:'Space Mono',monospace;
  margin-bottom:4px;opacity:.9;
}
.diag-ai-block .diag-ai-text { font-size:13px;color:var(--text,#c8d8e8);line-height:1.85; }

/* ─ ライフカードゲームUI ─ */
.diag-lifegame-sec { border-color:rgba(168,255,120,.15); }
.diag-lc-counter-wrap { display:flex;align-items:center;gap:8px; }
.diag-lc-counter { font-size:11px;font-family:'Space Mono',monospace;color:#a8ff78;background:rgba(168,255,120,.1);border:1px solid rgba(168,255,120,.25);padding:2px 8px;border-radius:4px; }
/* ライフバー */
.diag-lifebar-wrap { display:flex;align-items:center;gap:8px;margin-bottom:10px; }
.diag-lifebar-track { flex:1;height:22px;background:rgba(0,0,0,.35);border-radius:11px;position:relative;overflow:hidden;border:1px solid rgba(255,255,255,.08); }
.diag-lifebar-fill { height:100%;border-radius:11px;transition:width .8s cubic-bezier(.4,0,.2,1);background:#a8ff78;box-shadow:0 0 12px rgba(168,255,120,.4); }
.diag-lifebar-label { position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;font-family:'Space Mono',monospace;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.8);mix-blend-mode:normal; }
.diag-lifebar-max { font-size:10px;color:var(--text-dim);white-space:nowrap; }
/* カードグリッド */
.diag-lc-grid { display:flex;flex-direction:column;gap:7px;margin-bottom:10px; }
.diag-lc {
  display:flex;align-items:center;gap:10px;padding:11px 12px;
  background:var(--surface2,#0f1a2c);
  border:1px solid var(--lc-rc,var(--border,#1c3050));
  border-radius:12px;
  cursor:pointer;transition:all .22s cubic-bezier(.4,0,.2,1);
  position:relative;overflow:hidden;
  -webkit-tap-highlight-color:transparent;outline:none;
  box-shadow:0 0 0 0 var(--lc-rg,transparent);
}
.diag-lc-shimmer {
  position:absolute;inset:0;pointer-events:none;opacity:0;
  background:radial-gradient(ellipse 70% 50% at 80% 20%,var(--lc-rg,rgba(255,255,255,.08)) 0%,transparent 70%);
  transition:opacity .3s;
}
.diag-lc:hover .diag-lc-shimmer,
.diag-lc:focus-visible .diag-lc-shimmer { opacity:1; }
.diag-lc:hover,
.diag-lc:focus-visible { border-color:var(--lc-rc,var(--accent,#00d4ff));transform:translateX(4px);box-shadow:0 0 12px var(--lc-rg,transparent); }
.diag-lc:focus-visible { box-shadow:0 0 0 2px rgba(0,212,255,.4); }
.diag-lc.lc-on {
  background:linear-gradient(135deg,rgba(168,255,120,.06),rgba(0,0,0,.1));
  border-color:var(--lc-rc,#a8ff78);
  box-shadow:0 0 18px var(--lc-rg,rgba(168,255,120,.2));
  transform:translateX(2px);
}
.diag-lc.lc-on .diag-lc-shimmer { opacity:1; }
/* レアリティバッジ */
.diag-lc-rarity {
  position:absolute;top:5px;left:10px;
  font-size:9px;font-weight:800;font-family:'Space Mono',monospace;
  letter-spacing:1px;opacity:.85;
}
.diag-lc-check {
  display:none;position:absolute;top:5px;right:8px;
  font-size:10px;font-weight:900;color:#a8ff78;
  background:rgba(168,255,120,.2);border:1px solid rgba(168,255,120,.4);
  border-radius:50%;width:20px;height:20px;
  align-items:center;justify-content:center;
  animation:lcCheckIn .25s cubic-bezier(.4,0,.2,1);
}
@keyframes lcCheckIn{from{transform:scale(0) rotate(-90deg)}to{transform:scale(1) rotate(0)}}
.lc-on .diag-lc-check { display:flex; }
.diag-lc-icon  { font-size:22px;flex-shrink:0;margin-top:6px; }
.diag-lc-body  { flex:1;min-width:0;padding-top:8px; }
.diag-lc-title { font-size:12px;font-weight:700;color:var(--text);line-height:1.3; }
.diag-lc-sub   { font-size:10px;color:var(--text-dim);margin-top:1px; }
.diag-lc-cost  { font-size:9px;color:var(--text-dim);margin-top:3px;font-family:'Space Mono',monospace;opacity:.7; }
.diag-lc-eff   { display:flex;flex-direction:column;align-items:center;flex-shrink:0;opacity:.6;transition:opacity .2s; }
.diag-lc-eff-num { font-size:16px;font-weight:800;font-family:'Space Mono',monospace; }
.diag-lc-eff-lbl { font-size:9px;font-family:'Space Mono',monospace;opacity:.7; }
.lc-on .diag-lc-eff { opacity:1; }
/* ブーストボックス（ゲームライク） */
.diag-boost-box {
  background:linear-gradient(135deg,rgba(168,255,120,.09),rgba(0,212,255,.06));
  border:1px solid rgba(168,255,120,.25);border-radius:12px;padding:14px;
  animation:boostIn .35s cubic-bezier(.4,0,.2,1);
}
@keyframes boostIn{from{opacity:0;transform:translateY(8px) scale(.97)}to{opacity:1;transform:none}}
.dbb-lbl    { font-size:10px;color:var(--text-dim);margin-bottom:8px;letter-spacing:.3px; }
.dbb-row    { display:flex;align-items:center;gap:10px;margin-bottom:8px; }
.dbb-before { font-size:18px;font-family:'Space Mono',monospace;color:var(--text-dim);text-decoration:line-through; }
.dbb-arr    { color:#a8ff78;font-size:18px; }
.dbb-after  { font-size:26px;font-weight:800;font-family:'Space Mono',monospace;transition:all .4s; }
.dbb-life   { font-size:12px;color:var(--text-mid);margin-bottom:6px; }
.dbb-msg    { font-size:11px;color:#a8ff78;font-weight:700;margin-top:4px;min-height:16px; }

/* ─ シェア ─ */
.diag-share-preview { background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:8px;padding:12px;margin-bottom:10px; }
.diag-share-btns    { display:flex;flex-direction:column;gap:8px; }
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
  .diag-emoji     { font-size:36px; }
  .diag-type-name { font-size:18px; }
  .diag-life-val  { font-size:20px; }
  .diag-lc-grid   { gap:5px; }
}
    `;
    document.head.appendChild(s);
  }

  injectStyles();

})();
