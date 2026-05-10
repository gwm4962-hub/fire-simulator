/**
 * advisor.js — 自動アドバイスエンジン v1
 * FLOW | 資産シミュレーター
 *
 * 機能:
 *  1. 「成功率を90%にする最小努力値」を自動逆算
 *  2. ライフイベント・プリセットカタログ
 *  3. プライバシー保証バッジ
 */
(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════
  // 1. 自動アドバイスエンジン
  // ══════════════════════════════════════════════════════════

  const TARGET_RATE = 0.90;

  /**
   * 現在の successRate から「90%達成に必要な最小努力値」を逆算
   * @param {object} result - sim result { successRate, startAge, assets65, surplus65Man, monthlyRetire }
   */
  function calcMinEffort(result) {
    const sr      = result.successRate ?? 0;
    const gap     = Math.max(0, TARGET_RATE - sr);  // 0〜1
    const age     = result.startAge ?? 35;
    const years   = Math.max(5, 65 - age);

    if (gap <= 0) return null;  // すでに90%以上

    // 各手段の「1万円あたり成功率改善量」を推定
    // (estimation model: simplified linear approximation)
    const savingEffectPer1man  = 0.0030; // 月1万増積→成功率+0.3%
    const expCutEffectPer1man  = 0.0025; // 月1万削減→成功率+0.25%
    const retireDelayEffect1yr = 0.0280; // 1年延長→成功率+2.8%
    const nisaEffect1man       = 0.0018; // 月1万NISA→成功率+0.18%

    const savingNeeded   = Math.ceil(gap / savingEffectPer1man);     // 万円/月
    const expCutNeeded   = Math.ceil(gap / expCutEffectPer1man);
    const retireDelay    = Math.ceil(gap / retireDelayEffect1yr);    // 年
    const nisaNeeded     = Math.ceil(gap / nisaEffect1man);

    return {
      gap: Math.round(gap * 100),
      savingNeeded:  Math.min(savingNeeded, 30),
      expCutNeeded:  Math.min(expCutNeeded, 30),
      retireDelay:   Math.min(retireDelay, 10),
      nisaNeeded:    Math.min(nisaNeeded, 30),
    };
  }

  /**
   * アドバイスパネルを描画
   */
  function renderAdvicePanel(result) {
    const el = document.getElementById('advice-engine-panel');
    if (!el) return;

    const sr   = result.successRate ?? 0;
    const pct  = Math.round(sr * 100);
    const effort = calcMinEffort(result);

    let html = `<div class="adv-wrap">`;

    // ─ 現状評価 ─
    const statusColor = sr >= 0.90 ? '#a8ff78' : sr >= 0.70 ? '#ffd166' : '#ff4757';
    const statusIcon  = sr >= 0.90 ? '✅' : sr >= 0.70 ? '⚡' : '🚨';
    const statusLabel = sr >= 0.90 ? '安全圏！このまま継続を'
                      : sr >= 0.70 ? 'あと少しで安全圏'
                      : '早急な改善が必要';

    html += `
      <div class="adv-status-bar" style="border-color:${statusColor}30;background:${statusColor}08">
        <span class="adv-status-icon">${statusIcon}</span>
        <div>
          <div class="adv-status-label" style="color:${statusColor}">${statusLabel}</div>
          <div class="adv-status-sub">現在の老後安心スコア: <b style="color:${statusColor}">${pct}%</b>
            ${sr < 0.90 ? `→ 目標: <b style="color:#a8ff78">90%</b>` : '（目標達成！）'}
          </div>
        </div>
      </div>`;

    // ─ 達成済みなら称賛 ─
    if (!effort) {
      html += `
        <div class="adv-achieved">
          <div class="adv-achieved-emoji">🏆</div>
          <div class="adv-achieved-title">老後資金の安全圏を達成しています！</div>
          <div class="adv-achieved-sub">現在の計画を維持しながら、急な出費への備えを確認しましょう。</div>
        </div>`;
    } else {
      // ─ 最小努力値カード ─
      html += `
        <div class="adv-section-title">🎯 成功率90%にするための「最小努力値」</div>
        <div class="adv-cards">
          <div class="adv-card">
            <div class="adv-card-icon">💰</div>
            <div class="adv-card-body">
              <div class="adv-card-title">毎月の積立を増やす</div>
              <div class="adv-card-val">+<b>${effort.savingNeeded}</b>万円/月</div>
              <div class="adv-card-desc">現在の積立に追加するだけで目標達成</div>
            </div>
          </div>
          <div class="adv-card">
            <div class="adv-card-icon">✂️</div>
            <div class="adv-card-body">
              <div class="adv-card-title">支出を削減する</div>
              <div class="adv-card-val">-<b>${effort.expCutNeeded}</b>万円/月</div>
              <div class="adv-card-desc">固定費・サブスク見直しで達成可能</div>
            </div>
          </div>
          <div class="adv-card">
            <div class="adv-card-icon">🕐</div>
            <div class="adv-card-body">
              <div class="adv-card-title">退職を遅らせる</div>
              <div class="adv-card-val">+<b>${effort.retireDelay}</b>年</div>
              <div class="adv-card-desc">収入延長＋年金増額のダブル効果</div>
            </div>
          </div>
          <div class="adv-card">
            <div class="adv-card-icon">💹</div>
            <div class="adv-card-body">
              <div class="adv-card-title">NISAを活用する</div>
              <div class="adv-card-val">月<b>${effort.nisaNeeded}</b>万円積立</div>
              <div class="adv-card-desc">非課税複利で効率よく資産形成</div>
            </div>
          </div>
        </div>
        <div class="adv-combo-note">
          💡 上記を組み合わせると少ない負担で達成できます。例えば「支出削減${Math.ceil(effort.expCutNeeded/2)}万＋NISA増額${Math.ceil(effort.nisaNeeded/2)}万」など。
        </div>`;
    }

    html += `</div>`;
    el.innerHTML = html;
    el.style.display = 'block';
    injectAdviceStyles();
  }

  // ══════════════════════════════════════════════════════════
  // 2. ライフイベント・プリセットカタログ
  // ══════════════════════════════════════════════════════════

  const LIFE_PRESETS = [
    {
      category: '🏠 住まい',
      items: [
        { icon:'🏠', label:'マイホーム購入', age:35, amount:-500,  type:'expense', note:'頭金・諸費用（物件価格別途ローンで設定）' },
        { icon:'🏠', label:'住宅ローン完済', age:55, amount:0,     type:'asset',   note:'ローン完済 → 支出段階で調整してください' },
        { icon:'🔧', label:'大規模リフォーム', age:55, amount:-300, type:'expense', note:'築20年前後の設備更新' },
        { icon:'🚗', label:'車の買い替え',   age:40, amount:-250,  type:'expense', note:'新車購入費用（10年ごとに設定推奨）' },
      ]
    },
    {
      category: '👶 教育費',
      items: [
        { icon:'🎓', label:'大学入学（私立）', age:45, amount:-500, type:'expense', note:'入学金＋4年間授業料の目安' },
        { icon:'🎓', label:'大学入学（国公立）',age:45, amount:-200, type:'expense', note:'入学金＋4年間授業料の目安' },
        { icon:'📚', label:'中学受験・塾費用', age:40, amount:-200, type:'expense', note:'小5〜中3の3年間合計' },
        { icon:'🌏', label:'留学費用',         age:22, amount:-200, type:'expense', note:'1年間の語学留学目安' },
      ]
    },
    {
      category: '💼 キャリア・収入',
      items: [
        { icon:'💼', label:'退職金受取',      age:60, amount:1500, type:'income',  note:'会社員の平均的な退職金（会社規模で変動）' },
        { icon:'🏢', label:'相続（親から）',  age:55, amount:1000, type:'income',  note:'相続財産の目安（個人差大）' },
        { icon:'💰', label:'副業収入（年間）', age:40, amount:50,   type:'income',  note:'年間副業収入を毎年追加する場合は複数登録' },
      ]
    },
    {
      category: '🏥 医療・老後',
      items: [
        { icon:'🏥', label:'大病・入院費用',  age:65, amount:-100, type:'expense', note:'手術・入院等の自己負担額目安' },
        { icon:'🏡', label:'老人ホーム入居金', age:75, amount:-500, type:'expense', note:'サービス付き高齢者住宅の入居一時金' },
        { icon:'🌸', label:'葬祭費用',         age:80, amount:-200, type:'expense', note:'配偶者・自身の葬儀・墓石費用' },
      ]
    },
  ];

  window.openLifeCatalog = function () {
    const modal = document.getElementById('life-catalog-modal');
    const content = document.getElementById('life-catalog-content');
    if (!modal || !content) return;

    const startAge = parseInt(document.getElementById('start-age')?.value || 35);

    let html = `
      <div class="lc-wrap">
        <div class="lc-header">
          <div class="lc-title">📅 ライフイベントを追加</div>
          <button class="lc-close" onclick="document.getElementById('life-catalog-modal').style.display='none'">✕</button>
        </div>
        <div class="lc-subtitle">タップして一時イベントに追加できます（年齢は後から変更可）</div>
    `;

    LIFE_PRESETS.forEach(cat => {
      html += `<div class="lc-category">${cat.category}</div><div class="lc-items">`;
      cat.items.forEach(item => {
        const displayAge = Math.max(startAge + 1, item.age);
        const amtStr = item.amount === 0 ? '—' : (item.amount > 0 ? '+' : '') + item.amount.toLocaleString() + '万円';
        const amtColor = item.amount > 0 ? '#a8ff78' : item.amount < 0 ? '#ff4757' : 'var(--text-dim)';
        html += `
          <div class="lc-item" onclick="addLifePreset(${displayAge},${item.amount},'${item.type}','${item.label.replace(/'/g,"\\'")}')">
            <span class="lc-item-icon">${item.icon}</span>
            <div class="lc-item-body">
              <div class="lc-item-title">${item.label}</div>
              <div class="lc-item-note">${item.note}</div>
            </div>
            <div class="lc-item-right">
              <div class="lc-item-amt" style="color:${amtColor}">${amtStr}</div>
              <div class="lc-item-age">${displayAge}歳</div>
            </div>
          </div>`;
      });
      html += `</div>`;
    });

    html += `
        <button class="lc-done-btn" onclick="document.getElementById('life-catalog-modal').style.display='none'">
          完了
        </button>
      </div>`;

    content.innerHTML = html;
    modal.style.display = 'block';
    injectAdviceStyles();
  };

  window.addLifePreset = function(age, amount, type, label) {
    if (typeof addOneTimeEvent === 'function') {
      addOneTimeEvent({ age, amount, type, label });
      // フラッシュ確認
      const btn = event?.currentTarget;
      if (btn) {
        const orig = btn.style.background;
        btn.style.background = 'rgba(168,255,120,.2)';
        btn.style.borderColor = '#a8ff78';
        setTimeout(() => { btn.style.background = orig; btn.style.borderColor = ''; }, 600);
      }
    }
  };

  // ══════════════════════════════════════════════════════════
  // 3. プライバシー保証バッジ
  // ══════════════════════════════════════════════════════════

  function renderPrivacyBadge() {
    const el = document.getElementById('privacy-badge');
    if (!el) return;
    el.innerHTML = `
      <div class="pvb-wrap">
        <div class="pvb-item">
          <span class="pvb-icon">🔒</span>
          <div>
            <div class="pvb-title">完全ローカル計算</div>
            <div class="pvb-desc">データは一切外部に送信されません</div>
          </div>
        </div>
        <div class="pvb-item">
          <span class="pvb-icon">📱</span>
          <div>
            <div class="pvb-title">オフライン対応</div>
            <div class="pvb-desc">インターネット不要で動作します</div>
          </div>
        </div>
        <div class="pvb-item">
          <span class="pvb-icon">🗑️</span>
          <div>
            <div class="pvb-title">いつでも削除可能</div>
            <div class="pvb-desc">設定 → データ削除で即座に消去</div>
          </div>
        </div>
      </div>
    `;
    el.style.display = 'block';
  }

  // sim:done を受けてアドバイスパネル更新
  window.addEventListener('sim:done', function(e) {
    if (e.detail) renderAdvicePanel(e.detail);
  });

  // DOMContentLoaded でプライバシーバッジ表示
  document.addEventListener('DOMContentLoaded', function() {
    renderPrivacyBadge();
  });

  // ══════════════════════════════════════════════════════════
  // スタイル
  // ══════════════════════════════════════════════════════════
  function injectAdviceStyles() {
    if (document.getElementById('advisor-styles')) return;
    const s = document.createElement('style');
    s.id = 'advisor-styles';
    s.textContent = `
/* ═══ Advice Engine ═══ */
.adv-wrap { display:flex;flex-direction:column;gap:14px;font-family:'Noto Sans JP',sans-serif; }
.adv-status-bar {
  display:flex;align-items:center;gap:12px;
  padding:12px 14px;border-radius:10px;border:1px solid;
}
.adv-status-icon { font-size:22px;flex-shrink:0; }
.adv-status-label { font-size:13px;font-weight:700;margin-bottom:2px; }
.adv-status-sub { font-size:12px;color:var(--text-mid); }
.adv-achieved { text-align:center;padding:24px 16px; }
.adv-achieved-emoji { font-size:48px;margin-bottom:8px; }
.adv-achieved-title { font-size:15px;font-weight:700;color:#a8ff78;margin-bottom:4px; }
.adv-achieved-sub { font-size:12px;color:var(--text-dim);line-height:1.7; }
.adv-section-title { font-size:12px;font-weight:700;color:var(--text-mid);letter-spacing:.5px; }
.adv-cards { display:grid;grid-template-columns:1fr 1fr;gap:8px; }
.adv-card {
  background:var(--surface2);border:1px solid var(--border);
  border-radius:10px;padding:12px;display:flex;align-items:flex-start;gap:10px;
}
.adv-card-icon { font-size:20px;flex-shrink:0; }
.adv-card-title { font-size:11px;color:var(--text-dim);margin-bottom:4px; }
.adv-card-val { font-size:18px;font-weight:800;font-family:'Space Mono',monospace;color:var(--accent);margin-bottom:3px; }
.adv-card-desc { font-size:10px;color:var(--text-dim);line-height:1.5; }
.adv-combo-note {
  font-size:11px;color:var(--text-mid);line-height:1.7;
  background:rgba(0,212,255,.05);border:1px solid rgba(0,212,255,.15);
  border-radius:8px;padding:10px 12px;
}

/* ═══ Life Catalog Modal ═══ */
.lc-wrap { background:var(--surface);border-radius:16px;padding:20px;color:var(--text); }
.lc-header { display:flex;justify-content:space-between;align-items:center;margin-bottom:6px; }
.lc-title { font-size:16px;font-weight:700; }
.lc-close { background:none;border:none;color:var(--text-dim);font-size:18px;cursor:pointer;padding:4px 8px; }
.lc-subtitle { font-size:11px;color:var(--text-dim);margin-bottom:16px;line-height:1.6; }
.lc-category { font-size:12px;font-weight:700;color:var(--accent);margin:14px 0 8px;letter-spacing:.5px; }
.lc-items { display:flex;flex-direction:column;gap:6px;margin-bottom:4px; }
.lc-item {
  display:flex;align-items:center;gap:12px;padding:11px 12px;
  background:var(--surface2);border:1px solid var(--border);border-radius:8px;
  cursor:pointer;transition:all .2s;-webkit-tap-highlight-color:transparent;
}
.lc-item:hover,.lc-item:active { border-color:var(--accent);background:rgba(0,212,255,.07); }
.lc-item-icon { font-size:22px;flex-shrink:0; }
.lc-item-body { flex:1;min-width:0; }
.lc-item-title { font-size:13px;font-weight:600;color:var(--text);margin-bottom:2px; }
.lc-item-note { font-size:10px;color:var(--text-dim);line-height:1.5; }
.lc-item-right { text-align:right;flex-shrink:0; }
.lc-item-amt { font-size:13px;font-weight:700;font-family:'Space Mono',monospace;margin-bottom:2px; }
.lc-item-age { font-size:10px;color:var(--text-dim); }
.lc-done-btn {
  width:100%;margin-top:18px;padding:14px;
  background:var(--accent);color:#000;font-size:14px;font-weight:700;
  border:none;border-radius:10px;cursor:pointer;font-family:'Noto Sans JP',sans-serif;
}

/* ═══ Privacy Badge ═══ */
.pvb-wrap { display:flex;flex-direction:column;gap:10px; }
.pvb-item { display:flex;align-items:center;gap:12px;padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:8px; }
.pvb-icon { font-size:20px;flex-shrink:0; }
.pvb-title { font-size:12px;font-weight:700;color:var(--text);margin-bottom:1px; }
.pvb-desc { font-size:11px;color:var(--text-dim); }

/* ═══ Compare trigger btn ═══ */
.compare-trigger-btn {
  display:inline-flex;align-items:center;gap:4px;
  margin-left:8px;padding:3px 8px;
  background:rgba(0,212,255,.1);border:1px solid rgba(0,212,255,.3);
  border-radius:6px;color:var(--accent);font-size:10px;font-weight:700;
  cursor:pointer;transition:all .2s;white-space:nowrap;
  font-family:'Noto Sans JP',sans-serif;vertical-align:middle;
}
.compare-trigger-btn:hover { background:rgba(0,212,255,.2); }

@media(max-width:480px){
  .adv-cards { grid-template-columns:1fr; }
}
    `;
    document.head.appendChild(s);
  }

  injectAdviceStyles();
})();
