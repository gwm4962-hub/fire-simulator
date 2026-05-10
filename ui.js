/**
 * ui.js — UI操作・モーダル・マルコフビジュアライザー・税計算・家族設定・トルネード分析
 * FLOW | 資産シミュレーター
 */
// ============================================================
// ★ モーダル（プライバシー・免責・お問い合わせ・運営者）
// ============================================================
const MODAL_CONTENT = {

  // ──────────────────────────────────────────
  privacy: `
    <div style="font-family:var(--font-mono);font-size:10px;color:var(--accent);letter-spacing:2px;margin-bottom:4px;">PRIVACY POLICY</div>
    <h2 style="font-size:20px;color:var(--text);margin:0 0 4px;">🔒 プライバシーポリシー</h2>
    <p style="font-size:11px;color:var(--text-dim);margin:0 0 20px;">制定：2024年　最終更新：2025年</p>

    <div style="font-size:13px;color:var(--text-mid);line-height:2.0;">

      <div style="padding:12px 14px;background:rgba(0,212,255,0.06);border:1px solid rgba(0,212,255,0.2);border-radius:6px;margin-bottom:20px;font-size:13px;">
        <b style="color:var(--accent);">✅ 重要：</b>本ツールに入力した資産・年収などのデータは、<b style="color:var(--text);">外部サーバーへ一切送信されません。</b>すべての計算はお使いのブラウザ上でのみ実行されます。
      </div>

      <h3 style="font-size:14px;color:var(--accent);margin:20px 0 8px;display:flex;align-items:center;gap:6px;"><span>1.</span> 基本方針</h3>
      <p>FIREシミュレーター（以下「本ツール」）は、利用者のプライバシーを尊重し、個人情報の適切な管理に努めます。本ポリシーは、当ツールにおける情報の取り扱い方針を定めるものです。</p>

      <h3 style="font-size:14px;color:var(--accent);margin:20px 0 8px;">2. 収集する情報と利用目的</h3>
      <div style="display:grid;gap:8px;margin-bottom:12px;">
        <div style="padding:10px 12px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:6px;">
          <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:4px;">📦 ローカルストレージ（ブラウザ内保存）</div>
          <div style="font-size:12px;color:var(--text-dim);">シミュレーションの設定値（年齢・資産額・目標額など）を次回アクセス時に復元するためにブラウザ内に保存します。このデータは外部には送信されず、ブラウザキャッシュを削除すれば消去されます。</div>
        </div>
        <div style="padding:10px 12px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:6px;">
          <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:4px;">📊 Google Analytics（アクセス解析）</div>
          <div style="font-size:12px;color:var(--text-dim);">本サイトのアクセス状況（ページビュー数・滞在時間など）を把握するためにGoogle Analyticsを使用する場合があります。取得するデータに氏名・住所等の個人を特定できる情報は含まれません。</div>
        </div>
        <div style="padding:10px 12px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:6px;">
          <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:4px;">💰 Google AdSense（広告配信）</div>
          <div style="font-size:12px;color:var(--text-dim);">本サイトはGoogle AdSenseによる広告を掲載する場合があります。Googleは広告配信にCookieを使用し、利用者の興味に応じた広告を表示することがあります。</div>
        </div>
      </div>

      <h3 style="font-size:14px;color:var(--accent);margin:20px 0 8px;">3. Cookieについて</h3>
      <p>Cookieとは、ウェブサイトがブラウザに保存する小さなデータファイルです。本ツール自体はCookieを使用しませんが、Google Analytics・AdSenseがCookieを利用します。ブラウザの設定からCookieを無効化することで、これらをオプトアウトできます。</p>
      <p style="margin-top:8px;">Google のプライバシーポリシー：<a href="https://policies.google.com/privacy" target="_blank" style="color:var(--accent);">https://policies.google.com/privacy</a></p>

      <h3 style="font-size:14px;color:var(--accent);margin:20px 0 8px;">4. 第三者への情報提供</h3>
      <p>法令に基づく場合、または利用者の同意がある場合を除き、収集した情報を第三者に提供することはありません。</p>

      <h3 style="font-size:14px;color:var(--accent);margin:20px 0 8px;">5. 未成年者の利用</h3>
      <p>本ツールは成人を対象としています。18歳未満の方が利用する場合は、保護者の同意のもとでご利用ください。</p>

      <h3 style="font-size:14px;color:var(--accent);margin:20px 0 8px;">6. ポリシーの改定</h3>
      <p>本ポリシーは予告なく変更する場合があります。変更後のポリシーは本ページに掲載した時点で効力を生じます。重要な変更がある場合はツール上でお知らせします。</p>

      <div style="margin-top:24px;padding:12px 14px;background:rgba(0,212,255,0.04);border:1px solid rgba(0,212,255,0.15);border-radius:6px;font-size:12px;color:var(--text-dim);">
        運営：FIREシミュレーター個人開発者　／　X: <a href="https://x.com/start_simu" target="_blank" style="color:var(--accent);">@start_simu</a>
      </div>
    </div>
  `,

  // ──────────────────────────────────────────
  disclaimer: `
    <div style="font-family:var(--font-mono);font-size:10px;color:var(--warning);letter-spacing:2px;margin-bottom:4px;">DISCLAIMER</div>
    <h2 style="font-size:20px;color:var(--text);margin:0 0 4px;">⚠️ 免責事項</h2>
    <p style="font-size:11px;color:var(--text-dim);margin:0 0 20px;">最終更新：2025年</p>

    <div style="font-size:13px;color:var(--text-mid);line-height:2.0;">

      <div style="padding:14px;background:rgba(255,71,87,0.08);border:1px solid rgba(255,71,87,0.35);border-radius:8px;margin-bottom:20px;">
        <b style="color:var(--danger);font-size:14px;">⚠️ 最重要事項</b><br>
        <span style="font-size:13px;">本ツールは<b style="color:var(--text);">投資勧誘・売買推奨を一切目的としていません。</b>シミュレーション結果はあくまで統計的な参考情報であり、将来の成果を何ら保証するものではありません。</span>
      </div>

      <h3 style="font-size:14px;color:var(--warning);margin:20px 0 8px;">1. ツールの目的と限界</h3>
      <p>本ツールは、モンテカルロ法に基づく統計的シミュレーションによって資産形成の「可能性の幅」を提示するものです。以下の点にご注意ください：</p>
      <ul style="margin:8px 0 0 16px;padding:0;display:grid;gap:4px;">
        <li>過去のデータや統計的仮定に基づいており、未来を予測するものではありません</li>
        <li>税制・社会保険制度の変更は反映されません</li>
        <li>個人の健康状態・家族構成の変化・緊急支出等は考慮されません</li>
        <li>設定値の誤りにより、現実とかけ離れた結果が出る場合があります</li>
      </ul>

      <h3 style="font-size:14px;color:var(--warning);margin:20px 0 8px;">2. 投資リスクの警告</h3>
      <p>投資には元本割れのリスクが伴います。主なリスクには以下が含まれます：</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:8px 0;">
        ${[['市場リスク','相場全体の下落による損失'],['信用リスク','発行体の債務不履行'],['流動性リスク','売りたいときに売れない'],['インフレリスク','物価上昇による実質価値の目減り'],['為替リスク','外貨建て資産の為替変動'],['長寿リスク','想定以上に長生きすることによる資産枯渇']].map(([k,v])=>`
          <div style="padding:8px 10px;background:rgba(255,71,87,0.05);border:1px solid rgba(255,71,87,0.15);border-radius:5px;">
            <div style="font-size:11px;font-weight:700;color:var(--warning);">${k}</div>
            <div style="font-size:11px;color:var(--text-dim);">${v}</div>
          </div>
        `).join('')}
      </div>

      <h3 style="font-size:14px;color:var(--warning);margin:20px 0 8px;">3. 専門家への相談を強く推奨します</h3>
      <div style="display:grid;gap:6px;margin-bottom:12px;">
        ${[['💼 ファイナンシャルプランナー（CFP/AFP）','資産運用・保険・ライフプラン全般'],['🧾 税理士','税務・確定申告・相続税対策'],['⚖️ 弁護士','契約・相続・法的トラブル全般'],['🏦 証券会社・銀行','具体的な金融商品の選択']].map(([k,v])=>`
          <div style="display:flex;gap:10px;align-items:center;padding:8px 12px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:5px;">
            <span style="font-size:13px;font-weight:700;color:var(--text);min-width:0;">${k}</span>
            <span style="font-size:12px;color:var(--text-dim);">${v}</span>
          </div>
        `).join('')}
      </div>

      <h3 style="font-size:14px;color:var(--warning);margin:20px 0 8px;">4. 損害賠償の否認</h3>
      <p>本ツールの利用によって生じたいかなる損害（直接的・間接的・特別・付随的損害を含む）についても、開発者は一切の責任を負いません。利用者は自己の判断と責任において本ツールを使用するものとします。</p>

      <h3 style="font-size:14px;color:var(--warning);margin:20px 0 8px;">5. 著作権・利用規約</h3>
      <p>本ツールのソースコード・テキスト・デザイン等の著作権は開発者に帰属します。個人的な学習・参考目的での利用は自由ですが、無断での複製・商用利用・再配布を禁じます。</p>

      <div style="margin-top:24px;padding:12px 14px;background:rgba(255,209,102,0.05);border:1px solid rgba(255,209,102,0.2);border-radius:6px;font-size:12px;color:var(--text-dim);">
        本免責事項は日本法に準拠します。紛争が生じた場合は、開発者の所在地を管轄する裁判所を専属的合意管轄裁判所とします。
      </div>
    </div>
  `,

  // ──────────────────────────────────────────
  contact: `
    <div style="font-family:var(--font-mono);font-size:10px;color:#a8ff78;letter-spacing:2px;margin-bottom:4px;">CONTACT</div>
    <h2 style="font-size:20px;color:var(--text);margin:0 0 4px;">✉️ お問い合わせ</h2>
    <p style="font-size:13px;color:var(--text-dim);margin:0 0 20px;">不具合の報告・機能のご要望・ご質問はこちらからお寄せください。</p>

    <div style="font-size:13px;color:var(--text-mid);line-height:2.0;">

      <h3 style="font-size:14px;color:#a8ff78;margin:0 0 10px;">📬 連絡先</h3>
      <div style="display:grid;gap:10px;margin-bottom:24px;">
        <a href="https://x.com/start_simu" target="_blank"
           style="display:flex;align-items:center;gap:14px;padding:14px 16px;background:rgba(29,155,240,0.05);border:1px solid rgba(29,155,240,0.25);border-radius:8px;text-decoration:none;transition:border-color .2s;"
           onmouseover="this.style.borderColor='#1d9bf0'" onmouseout="this.style.borderColor='rgba(29,155,240,0.25)'">
          <span style="font-size:28px;flex-shrink:0;">𝕏</span>
          <div>
            <div style="font-size:14px;font-weight:700;color:var(--text);">X（旧Twitter）でDM</div>
            <div style="font-size:12px;color:var(--text-dim);">@start_simu　— 返信まで数日いただく場合があります</div>
          </div>
          <span style="margin-left:auto;font-size:18px;color:var(--text-dim);">→</span>
        </a>
        <a href="https://buymeacoffee.com/start.simu" target="_blank"
           style="display:flex;align-items:center;gap:14px;padding:14px 16px;background:rgba(255,129,63,0.05);border:1px solid rgba(255,129,63,0.25);border-radius:8px;text-decoration:none;"
           onmouseover="this.style.borderColor='#FF813F'" onmouseout="this.style.borderColor='rgba(255,129,63,0.25)'">
          <span style="font-size:28px;flex-shrink:0;">☕</span>
          <div>
            <div style="font-size:14px;font-weight:700;color:var(--text);">Buy Me a Coffee でメッセージ</div>
            <div style="font-size:12px;color:var(--text-dim);">開発支援のご寄付と合わせてメッセージを送れます</div>
          </div>
          <span style="margin-left:auto;font-size:18px;color:var(--text-dim);">→</span>
        </a>
      </div>

      <h3 style="font-size:14px;color:#a8ff78;margin:0 0 10px;">❓ よくあるご質問</h3>
      <div style="display:grid;gap:8px;">
        ${[
          ['🐛 バグ・計算が合わない','X（旧Twitter）のDMにて「設定値・再現手順・スクリーンショット」をお送りください。迅速に対応します。'],
          ['💡 機能リクエスト','新機能のご要望は大歓迎です！特に多かったご要望は優先して実装します。'],
          ['💾 データが消えた','ブラウザのキャッシュクリア・プライベートモード・別のブラウザでは設定が消えます。定期的にエクスポートをお勧めします。'],
          ['📱 スマホで表示が崩れる','機種名・OSバージョン・ブラウザ名をお知らせください。できる限り対応します。'],
          ['🔢 計算結果の解釈方法','ツール内の「クイックガイド」や「数理モデル解説」パネルをご確認ください。'],
          ['📧 返信がない','スパムフォルダをご確認ください。1週間以上経過しても返信がない場合は再度ご連絡ください。'],
          ['📊 成功率は何%あれば安全？','一般的には70%以上が「合格ライン」、90%以上が「安全圏」とされます。ただし生活費の柔軟性（支出を減らせる余地）があれば70%でも実質的なリスクは低くなります。'],
          ['🎯 FIRE達成目標資産はいくらにすれば？','「4%ルール」では年間支出の25倍が目安です。月30万円の生活なら年360万円×25倍＝9,000万円。ただし日本の場合は年金受給があるため、実態に合わせて減額できます。'],
          ['📁 結果をExcelで分析したい','チャート右上の「📊」ボタンからCSVエクスポートできます。年齢別の中央値・パーセンタイル値が取得できます。'],
        ].map(([q,a])=>`
          <details style="padding:0;border:1px solid var(--border);border-radius:6px;overflow:hidden;">
            <summary style="padding:10px 12px;cursor:pointer;font-size:12px;font-weight:700;color:var(--text);list-style:none;display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.02);">
              <span>${q}</span>
            </summary>
            <div style="padding:10px 12px;font-size:12px;color:var(--text-dim);border-top:1px solid var(--border);background:rgba(255,255,255,0.01);line-height:1.7;">${a}</div>
          </details>
        `).join('')}
      </div>

      <div style="margin-top:20px;padding:12px 14px;background:rgba(168,255,120,0.04);border:1px solid rgba(168,255,120,0.15);border-radius:6px;font-size:12px;color:var(--text-dim);">
        💌 いただいたフィードバックはすべて開発改善に活用しています。ご意見・ご感想もお気軽にどうぞ！
      </div>
    </div>
  `,

  // ──────────────────────────────────────────
  profile: `
    <div style="font-family:var(--font-mono);font-size:10px;color:#b388ff;letter-spacing:2px;margin-bottom:4px;">ABOUT</div>
    <h2 style="font-size:20px;color:var(--text);margin:0 0 20px;">👤 運営者情報</h2>

    <div style="font-size:13px;color:var(--text-mid);line-height:2.0;">

      <!-- プロフィールカード -->
      <div style="display:flex;align-items:center;gap:16px;padding:16px;background:rgba(179,136,255,0.07);border:1px solid rgba(179,136,255,0.25);border-radius:10px;margin-bottom:22px;">
        <div style="width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#b388ff,#00d4ff);display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0;box-shadow:0 0 20px rgba(179,136,255,0.3);">📈</div>
        <div style="min-width:0;">
          <div style="font-size:16px;font-weight:700;color:var(--text);">FIREシミュレーター 開発者</div>
          <div style="font-size:12px;color:var(--text-dim);margin-top:2px;">統計・資産運用に興味を持つ個人開発エンジニア</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;">
            <a href="https://x.com/start_simu" target="_blank" style="font-size:12px;color:#1d9bf0;text-decoration:none;display:flex;align-items:center;gap:4px;">𝕏 @start_simu</a>
            <a href="https://buymeacoffee.com/start.simu" target="_blank" style="font-size:12px;color:#FF813F;text-decoration:none;display:flex;align-items:center;gap:4px;">☕ Buy Me a Coffee</a>
          </div>
        </div>
      </div>

      <h3 style="font-size:14px;color:#b388ff;margin:0 0 8px;">🛠️ このツールについて</h3>
      <p>モンテカルロ法・マルコフ連鎖・t分布を組み合わせた本格的な資産シミュレーターです。「たまたま運が良かっただけのFIRE計画」を排除し、最悪シナリオ（シーケンス・オブ・リターン・リスク）への耐性を検証することを目的として個人で開発しました。</p>
      <p style="margin-top:8px;">完全にブラウザ上で動作し、入力データは外部サーバーへ一切送信されません。</p>

      <h3 style="font-size:14px;color:#b388ff;margin:20px 0 8px;">🔧 使用技術スタック</h3>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px;">
        ${[
          ['HTML / CSS / JS','バニラ実装'],
          ['Chart.js 4.4','グラフ描画'],
          ['モンテカルロ法','N=2000回試行'],
          ['マルコフ連鎖','4レジーム遷移'],
          ['t分布（Fat-tail）','df=5推奨'],
          ['簡易税金計算エンジン','超過累進課税'],
          ['LocalStorage','設定の永続化'],
          ['MathJax','数式描画'],
        ].map(([t,d])=>`
          <div style="padding:4px 10px;background:rgba(179,136,255,0.08);border:1px solid rgba(179,136,255,0.25);border-radius:16px;font-size:11px;">
            <span style="color:#b388ff;font-weight:700;">${t}</span>
            <span style="color:var(--text-dim);margin-left:4px;">${d}</span>
          </div>
        `).join('')}
      </div>

      <h3 style="font-size:14px;color:#b388ff;margin:20px 0 8px;">📋 更新履歴</h3>
      <div style="display:grid;gap:5px;">
        ${[
          ['v12','2025年','トルネードチャート・感度分析・税金エンジン・共働き・子ども教育費・安全率計算を追加'],
          ['v11','2025年','ヒートマップ分析・マルコフビジュアライザー・Fat-tailアナライザー・ボラドラッグ体験ツールを追加'],
          ['v10','2024年','シミュレーション解説文・改善アドバイス自動生成を追加'],
          ['v9','2024年','定常分布円グラフ・Regime Performance Matrix・スマホUI大幅改善'],
          ['v4','2024年','UI全面刷新・ダークテーマ・解説パネル群追加'],
          ['v1','2024年','初版リリース（モンテカルロ基本実装）'],
        ].map(([v,y,d])=>`
          <div style="display:flex;gap:8px;align-items:start;padding:8px 10px;background:rgba(255,255,255,0.02);border-radius:5px;border:1px solid var(--border);">
            <span style="font-family:var(--font-mono);font-size:11px;font-weight:700;color:#b388ff;flex-shrink:0;min-width:28px;">${v}</span>
            <span style="font-size:11px;color:var(--text-dim);flex-shrink:0;min-width:40px;">${y}</span>
            <span style="font-size:12px;color:var(--text-mid);">${d}</span>
          </div>
        `).join('')}
      </div>

      <h3 style="font-size:14px;color:#b388ff;margin:20px 0 8px;">💖 開発を続ける原動力</h3>
      <p>「FIRE計画の数理的な検証ツールが欲しい」という個人的な動機から開発を始めました。統計的に正直なシミュレーターとして、楽観的な皮算用を防ぐことを最重視しています。</p>
      <div style="margin-top:12px;padding:14px;background:rgba(255,129,63,0.06);border:1px solid rgba(255,129,63,0.2);border-radius:8px;text-align:center;">
        <div style="font-size:13px;color:var(--text-mid);margin-bottom:10px;">シミュレーターがお役に立ちましたら、コーヒー1杯分の支援をいただけると大変嬉しいです ☕</div>
        <a href="https://buymeacoffee.com/start.simu" target="_blank" style="text-decoration:none;">
          <img src="https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=☕&slug=start.simu&button_colour=FF813F&font_colour=ffffff&font_family=Lato&outline_colour=ffffff&coffee_colour=FFDD00"
               alt="Buy Me A Coffee" style="max-width:180px;border-radius:6px;">
        </a>
      </div>
    </div>
  `,
};

function openModal(key) {
  // 許可リスト検証 — 意図しないキーアクセス（プロトタイプ汚染等）を防止
  const ALLOWED_KEYS = ['privacy', 'disclaimer', 'contact', 'profile'];
  if (!ALLOWED_KEYS.includes(key)) return;
  const modal = document.getElementById('site-modal');
  const content = document.getElementById('modal-content');
  if (!modal || !content || !Object.prototype.hasOwnProperty.call(MODAL_CONTENT, key)) return;
  content.innerHTML = MODAL_CONTENT[key]; // MODAL_CONTENT はハードコード定数のため安全
  modal.style.display = 'block';
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  const modal = document.getElementById('site-modal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
}

// ESCキーで閉じる
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });


// ============================================================
// ★ マルコフ遷移ビジュアライザー（リニューアル版）
// ============================================================
let vizChart = null; // 後方互換用
let vizStateIdx = 1;
let vizCounts = [0,0,0,0];
let vizTotal = 0;
let vizPlaying = false;
let vizTimer = null;
let vizHistory = [];

const VIZ_LABELS  = ['🐂 強気', '📈 通常', '🐻 弱気', '🔥 インフレ'];
const VIZ_NAMES   = ['強気相場', '通常相場', '弱気相場', 'インフレ相場'];
const VIZ_EMOJIS  = ['🐂', '📈', '🐻', '🔥'];
const VIZ_COLORS  = ['#a8ff78', '#00d4ff', '#ff4757', '#ffd166'];
const VIZ_SPEEDS  = [1200, 700, 400, 200, 60];
const VIZ_SPEED_LABELS = ['ゆっくり', '遅め', '普通', '速め', '高速'];

function initMarkovVisualizer() {
  vizStateIdx = 1; vizCounts = [0,0,0,0]; vizTotal = 0; vizHistory = [];
  vizPlaying = false;
  if (vizTimer) { clearInterval(vizTimer); vizTimer = null; }
  const btn = document.getElementById('viz-play-btn');
  if (btn) {
    btn.textContent = '▶ 再生';
    btn.style.background = 'linear-gradient(135deg,#a8ff78,#00d4ff)';
  }
  const spd = document.getElementById('viz-speed');
  if (spd) {
    spd.addEventListener('input', () => {
      const lbl = document.getElementById('viz-speed-label');
      if (lbl) lbl.textContent = VIZ_SPEED_LABELS[parseInt(spd.value)-1];
      if (vizPlaying) {
        clearInterval(vizTimer);
        vizTimer = setInterval(vizStep, VIZ_SPEEDS[parseInt(spd.value)-1]);
      }
    });
  }
  updateVizCard(1);
  renderVizBars();
  renderVizFlow();
  buildVizMatrix();
}

function updateVizCard(idx) {
  const card  = document.getElementById('viz-state-card');
  const emoji = document.getElementById('viz-emoji');
  const name  = document.getElementById('viz-name');
  const year  = document.getElementById('viz-year');
  const glow  = document.getElementById('viz-glow-bar');
  const color = VIZ_COLORS[idx];
  if (!card) return;
  card.style.borderColor = color;
  card.style.background  = color + '12';
  if (emoji) {
    emoji.style.transform = 'scale(1.3)';
    emoji.textContent = VIZ_EMOJIS[idx];
    setTimeout(() => { if (emoji) emoji.style.transform = 'scale(1)'; }, 200);
  }
  if (name)  { name.textContent = VIZ_NAMES[idx]; name.style.color = color; }
  if (year)  year.textContent = vizTotal + '年目';
  if (glow)  glow.style.background = color;
}

function renderVizBars() {
  const container = document.getElementById('viz-bars');
  if (!container) return;
  const total = Math.max(1, vizTotal);
  let stationary = [0.25,0.25,0.25,0.25];
  try {
    const raw = computeStationaryDist(tmValues);
    const s = raw.reduce((a,b)=>a+b,0);
    stationary = raw.map(v=>v/s);
  } catch(e) {}
  container.innerHTML = VIZ_NAMES.map((nm, i) => {
    const actual = vizCounts[i] / total * 100;
    const theory = stationary[i] * 100;
    const color  = VIZ_COLORS[i];
    return '<div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">' +
        '<span style="font-size:12px;font-weight:700;color:' + color + ';">' + VIZ_EMOJIS[i] + ' ' + nm + '</span>' +
        '<span style="font-size:12px;font-family:var(--font-mono);color:' + color + ';">' + actual.toFixed(1) + '%</span>' +
      '</div>' +
      '<div style="background:var(--border);border-radius:4px;height:16px;overflow:hidden;position:relative;">' +
        '<div style="height:100%;width:' + actual.toFixed(1) + '%;background:' + color + ';border-radius:4px;transition:width .35s ease;"></div>' +
        '<div style="position:absolute;top:0;bottom:0;left:' + theory.toFixed(1) + '%;width:2px;background:rgba(255,255,255,0.5);"></div>' +
      '</div>' +
      '<div style="font-size:10px;color:var(--text-dim);margin-top:2px;">理論値 ' + theory.toFixed(0) + '%（白線）/ 年数: ' + vizCounts[i] + '年</div>' +
    '</div>';
  }).join('');
}

function renderVizFlow() {
  const container = document.getElementById('viz-flow');
  if (!container) return;
  if (vizHistory.length === 0) {
    container.innerHTML = '<span style="font-size:12px;color:var(--text-dim);">再生すると表示されます</span>';
    return;
  }
  const recent = vizHistory.slice(-5);
  container.innerHTML = recent.map((idx, i) => {
    const color = VIZ_COLORS[idx];
    const isLatest = i === recent.length - 1;
    const chip = '<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;background:' + color + '22;border:1px solid ' + color + ';font-size:12px;font-weight:' + (isLatest ? '700' : '400') + ';color:' + color + ';' + (isLatest ? 'box-shadow:0 0 8px ' + color + '55;' : 'opacity:0.65;') + '">' + VIZ_EMOJIS[idx] + ' ' + VIZ_NAMES[idx] + '</span>';
    const arrow = i < recent.length-1 ? '<span style="color:var(--text-dim);font-size:12px;">→</span>' : '';
    return chip + arrow;
  }).join('');
}

function vizStep() {
  const row = tmValues[vizStateIdx];
  const sum = row.reduce((a,b)=>a+b,0) || 1;
  const r = Math.random() * sum;
  let cum=0, next=0;
  for (let i=0;i<row.length;i++) { cum+=row[i]; if(r<cum){next=i;break;} }
  vizStateIdx = next;
  vizCounts[next]++;
  vizTotal++;
  vizHistory.push(next);
  if (vizHistory.length > 5) vizHistory.shift();
  updateVizCard(next);
  renderVizBars();
  renderVizFlow();
}

function vizTogglePlay() {
  vizPlaying = !vizPlaying;
  const btn = document.getElementById('viz-play-btn');
  if (vizPlaying) {
    const spd = parseInt(document.getElementById('viz-speed') ? document.getElementById('viz-speed').value : 3);
    vizTimer = setInterval(vizStep, VIZ_SPEEDS[spd-1]);
    if (btn) { btn.textContent = '⏸ 一時停止'; btn.style.background = 'linear-gradient(135deg,#ff9a3c,#ff4757)'; }
  } else {
    clearInterval(vizTimer); vizTimer = null;
    if (btn) { btn.textContent = '▶ 再生'; btn.style.background = 'linear-gradient(135deg,#a8ff78,#00d4ff)'; }
  }
}

function vizReset() {
  vizPlaying = false;
  if (vizTimer) { clearInterval(vizTimer); vizTimer = null; }
  initMarkovVisualizer();
}

function buildVizMatrix() {
  const table = document.getElementById('viz-matrix-table');
  if (!table) return;
  const names = ['強気', '通常', '弱気', 'インフレ'];
  const normalized = tmValues.map(row => {
    const s = row.reduce((a,b)=>a+b,0)||1;
    return row.map(v=>v/s*100);
  });
  let html = '<tr style="background:rgba(0,212,255,0.06);"><th style="padding:6px 8px;color:var(--text-dim);border:1px solid var(--border);font-size:10px;">現在↓ 次→</th>' +
    names.map((n,i) => '<th style="padding:6px 8px;color:' + VIZ_COLORS[i] + ';border:1px solid var(--border);font-size:11px;text-align:center;">' + VIZ_EMOJIS[i] + '<br>' + n + '</th>').join('') + '</tr>';
  names.forEach((name,i) => {
    html += '<tr><td style="padding:6px 8px;font-weight:700;color:' + VIZ_COLORS[i] + ';border:1px solid var(--border);font-size:11px;">' + VIZ_EMOJIS[i] + ' ' + name + '</td>';
    normalized[i].forEach((v,j) => {
      const alpha = Math.min(255, Math.round(v/100*0.85*255)).toString(16).padStart(2,'0');
      const isDiag = i===j;
      html += '<td style="padding:6px 8px;text-align:center;border:1px solid var(--border);background:' + VIZ_COLORS[j] + alpha + ';font-weight:' + (v>=40?'700':'400') + ';font-size:11px;color:' + (v>=55?'#000':'var(--text)') + ';' + (isDiag?'outline:2px solid rgba(255,255,255,0.3);outline-offset:-2px;':'') + '">' + v.toFixed(0) + '%</td>';
    });
    html += '</tr>';
  });
  table.innerHTML = html;
}


// ============================================================
// ★ レジーム・スイッチング比較チャート（SVGで描画）
// ============================================================
function drawRegimeSwitchChart() {
  const container = document.getElementById('regime-switch-chart');
  if (!container) return;

  // 簡易シミュレーション: 30年間
  const years = 30, base = 1000;
  const uniform = [base]; // 一律5%
  const markov  = [base]; // マルコフ連鎖
  const returns = { 0:[0.10,0.15], 1:[0.05,0.12], 2:[-0.10,0.25], 3:[0.02,0.20] }; // [μ, σ]
  let state = 1;
  const seed = [0.62,0.18,0.74,0.33,0.91,0.05,0.47,0.82,0.29,0.66,0.11,0.55,0.39,0.77,0.23,0.68,0.04,0.51,0.88,0.15,0.72,0.36,0.93,0.08,0.44,0.79,0.21,0.63,0.07,0.57];
  const shocks= [0.8,1.2,-0.5,1.1,2.1,-1.8,0.3,1.5,-0.9,0.7,1.3,-0.4,2.3,-1.2,0.6,1.0,-0.8,1.7,0.2,-1.5,0.9,1.4,-0.3,1.1,-1.0,0.5,1.6,-0.7,1.2,0.4];

  for (let t=0;t<years;t++){
    uniform.push(uniform[uniform.length-1]*1.05);
    const [mu,sigma] = returns[state];
    const ret = mu + sigma * (shocks[t]||0) * 0.4;
    markov.push(Math.max(100, markov[markov.length-1]*(1+ret)));
    // 簡易遷移
    const r = seed[t]||0.5;
    const row = tmValues[state]; const s = row.reduce((a,b)=>a+b,0)||1;
    let cum=0; let ns=0; for(let i=0;i<row.length;i++){cum+=row[i]/s;if(r<cum){ns=i;break;}} state=ns;
  }

  const maxVal = Math.max(...uniform, ...markov);
  const minVal = Math.min(...markov) * 0.95;
  const W=300, H=140, PL=40, PR=10, PT=10, PB=24;
  const cW=W-PL-PR, cH=H-PT-PB;
  const xS = t => PL + t/years*cW;
  const yS = v => PT + cH - (v-minVal)/(maxVal-minVal)*cH;
  const pathU = uniform.map((v,i)=>`${i===0?'M':'L'}${xS(i)},${yS(v)}`).join(' ');
  const pathM = markov .map((v,i)=>`${i===0?'M':'L'}${xS(i)},${yS(v)}`).join(' ');

  // ゼロライン
  const y0 = yS(base);

  container.innerHTML = `
    <div style="font-size:11px;color:var(--text-dim);margin-bottom:6px;font-family:var(--font-mono);">資産推移イメージ（初期資産1,000万円・30年）</div>
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;" xmlns="http://www.w3.org/2000/svg">
      <!-- グリッド -->
      ${[0.25,0.5,0.75,1].map(f=>{
        const yg=PT+cH*(1-f);
        return `<line x1="${PL}" y1="${yg}" x2="${W-PR}" y2="${yg}" stroke="#1e2d45" stroke-width="0.5"/>
                <text x="${PL-2}" y="${yg+3}" fill="#5a7090" font-size="8" text-anchor="end">${Math.round(minVal+(maxVal-minVal)*f)}万</text>`;
      }).join('')}
      <!-- X軸ラベル -->
      ${[0,10,20,30].map(t=>`<text x="${xS(t)}" y="${H-4}" fill="#5a7090" font-size="8" text-anchor="middle">${t}年</text>`).join('')}
      <!-- 一律リターン（青） -->
      <path d="${pathU}" fill="none" stroke="#00d4ff" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.7"/>
      <!-- マルコフ連鎖（オレンジ） -->
      <path d="${pathM}" fill="none" stroke="#ff9a3c" stroke-width="2" opacity="0.9"/>
      <!-- 凡例 -->
      <line x1="${PL}" y1="${PT+6}" x2="${PL+18}" y2="${PT+6}" stroke="#00d4ff" stroke-width="1.5" stroke-dasharray="4,3"/>
      <text x="${PL+22}" y="${PT+10}" fill="#00d4ff" font-size="9">一律リターン(5%/年)</text>
      <line x1="${PL+105}" y1="${PT+6}" x2="${PL+123}" y2="${PT+6}" stroke="#ff9a3c" stroke-width="2"/>
      <text x="${PL+127}" y="${PT+10}" fill="#ff9a3c" font-size="9">マルコフ連鎖</text>
    </svg>
  `;
}



// ============================================================
// ★ 新機能 1: 簡易税金計算エンジン
// ============================================================
function calcTax(grossYen) {
  if (!grossYen || grossYen <= 0) return { socialIns:0, incomeTax:0, residTax:0, takeHomeYen:0, rate:0, taxable:0 };
  // 社会保険料（約15%、上限考慮）
  const socialIns = Math.min(grossYen * 0.15, 1_400_000);
  // 給与所得控除
  let empDed;
  if      (grossYen <= 1_625_000)  empDed = 550_000;
  else if (grossYen <= 1_800_000)  empDed = grossYen * 0.4 - 100_000;
  else if (grossYen <= 3_600_000)  empDed = grossYen * 0.3 + 80_000;
  else if (grossYen <= 6_600_000)  empDed = grossYen * 0.2 + 440_000;
  else if (grossYen <= 8_500_000)  empDed = grossYen * 0.1 + 1_100_000;
  else                             empDed = 1_950_000;
  // 基礎控除
  const basicDed = 480_000;
  // 課税所得
  const taxable = Math.max(0, grossYen - socialIns - empDed - basicDed);
  // 所得税（超過累進）
  const brackets = [
    [1_949_000, 0.05], [3_299_000, 0.10], [6_949_000, 0.20],
    [8_999_000, 0.23], [17_999_000, 0.33], [39_999_000, 0.40], [Infinity, 0.45]
  ];
  let incomeTax = 0, prev = 0;
  for (const [limit, rate] of brackets) {
    if (taxable <= prev) break;
    incomeTax += (Math.min(taxable, limit) - prev) * rate;
    prev = limit;
  }
  incomeTax *= 1.021; // 復興特別所得税
  // 住民税
  const residTax = taxable * 0.10;
  const takeHomeYen = grossYen - socialIns - incomeTax - residTax;
  const rate = takeHomeYen / grossYen;
  return { socialIns, incomeTax, residTax, takeHomeYen, rate, taxable };
}

function updateTaxDisplay() {
  const grossA = parseInt(document.getElementById('income').value || 500) * 10000;
  const isDual = currentHousehold === 'dual';
  const grossB = isDual ? parseInt(document.getElementById('income-b').value || 300) * 10000 : 0;

  const tA = calcTaxPrecise(grossA);
  const tB = isDual ? calcTaxPrecise(grossB) : null;

  const fmt = v => (v / 10000).toFixed(0) + '万';
  const totalGross = grossA + grossB;
  const totalTake  = tA.takeHomeYen + (tB ? tB.takeHomeYen : 0);
  const effRate    = (totalTake / totalGross * 100).toFixed(1);

  // 内訳表示
  let html = `
    <div style="display:grid;grid-template-columns:1fr auto;gap:2px 8px;">
      <span style="color:var(--text-dim);">社会保険料</span><span style="color:var(--warning);">−${fmt(tA.socialIns + (tB?.socialIns||0))}</span>
      <span style="color:var(--text-dim);">所得税</span><span style="color:var(--danger);">−${fmt(tA.incomeTax + (tB?.incomeTax||0))}</span>
      <span style="color:var(--text-dim);">住民税</span><span style="color:var(--danger);">−${fmt(tA.residTax + (tB?.residTax||0))}</span>
    </div>`;
  document.getElementById('tax-breakdown').innerHTML = html;
  document.getElementById('effective-takehome').textContent = effRate + '%';
  document.getElementById('takehome-amount').textContent = fmt(totalTake) + '円/年';

  // 後方互換：隠しスライダーを実効手取り率で更新
  const hiddenSlider = document.getElementById('take-home');
  hiddenSlider.value = Math.round(Math.min(95, Math.max(60, effRate)));
}

// ============================================================
// ★ 新機能 2: 世帯タイプ切り替え
// ============================================================
let currentHousehold = 'single';

function setHousehold(type) {
  currentHousehold = type;
  const isDual = type === 'dual';
  document.getElementById('income-section-b').style.display = isDual ? '' : 'none';
  document.getElementById('income-a-label').textContent = isDual ? '─ 本人収入' : '─ 収入';
  ['single','dual'].forEach(t => {
    document.getElementById(`hh-${t}`).classList.toggle('diff-btn-active', t === type);
  });
  updateTaxDisplay();
  updateChildBenefitSummary();
}

// ============================================================
// ★ 新機能 3: 子ども・教育費自動ステージング
// ============================================================
// 文科省データ準拠の年間学習費（万円）
const EDU_COST = {
  preschool:  { public: 22, private: 53 },  // 幼稚園（3〜5歳）
  elementary: { public: 35, private: 167 }, // 小学校（6〜11歳）
  juniorHigh: { public: 53, private: 143 }, // 中学（12〜14歳）
  highSchool: { public: 51, private: 105 }, // 高校（15〜17歳）
  university: { public: 108, private: 152 },// 大学（18〜21歳）
};
// 児童手当（月額・万円）
const CHILD_BENEFIT = { under3: 1.5, child12: 1.0, child3rd: 3.0, over15: 0 }; // 2024年改正: 所得制限撤廃

let children = []; // [{birthYear, schoolType}]

function addChild() {
  const currentYear = new Date().getFullYear();
  const id = Date.now();
  children.push({ id, birthYear: currentYear - 5, schoolType: 'public' });
  renderChildrenList();
  applyChildEducationStages();
  updateChildBenefitSummary();
}

function removeChild(id) {
  children = children.filter(c => c.id !== id);
  renderChildrenList();
  applyChildEducationStages();
  updateChildBenefitSummary();
}

function updateChild(id, field, value) {
  const c = children.find(c => c.id === id);
  if (c) { c[field] = field === 'birthYear' ? parseInt(value) : value; }
  applyChildEducationStages();
  updateChildBenefitSummary();
}

function renderChildrenList() {
  const container = document.getElementById('children-list');
  if (!container) return;
  const currentYear = new Date().getFullYear();

  // 既存の子どもカードをすべて削除（ボタン・サマリーには触らない）
  Array.from(container.querySelectorAll('.child-card')).forEach(el => el.remove());

  children.forEach((c, i) => {
    const card = document.createElement('div');
    card.className = 'child-card';
    card.dataset.childId = c.id;
    card.style.cssText = 'background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:10px 12px;margin-bottom:8px;';

    const isChild3rd = (i >= 2);
    const benefitLabel = c.birthYear >= currentYear - 2
      ? '15,000円/月（3歳未満）'
      : isChild3rd ? '30,000円/月（第3子以降）' : '10,000円/月（第1・2子）';

    card.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <span style="font-size:13px;font-weight:700;color:var(--text);">第${i+1}子</span>
        <button class="child-remove-btn" data-id="${c.id}"
          style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:18px;line-height:1;padding:2px 6px;">✕</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div>
          <div style="font-size:11px;color:var(--text-dim);margin-bottom:4px;">生まれ年</div>
          <input type="number" value="${c.birthYear}" min="${currentYear-20}" max="${currentYear+5}"
            data-id="${c.id}" data-field="birthYear"
            style="width:100%;background:var(--surface);border:1px solid var(--border);border-radius:4px;color:var(--accent);font-family:var(--font-mono);font-size:13px;font-weight:700;text-align:center;padding:6px 4px;outline:none;">
        </div>
        <div>
          <div style="font-size:11px;color:var(--text-dim);margin-bottom:4px;">学校種別</div>
          <select data-id="${c.id}" data-field="schoolType"
            style="width:100%;background:var(--surface);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:13px;padding:6px 4px;outline:none;">
            <option value="public" ${c.schoolType==='public'?'selected':''}>公立</option>
            <option value="private" ${c.schoolType==='private'?'selected':''}>私立</option>
          </select>
        </div>
      </div>
      <div style="font-size:11px;color:var(--accent3);margin-top:6px;">
        🎁 児童手当: ${benefitLabel}
      </div>
      <div style="font-size:11px;color:var(--text-dim);margin-top:2px;" id="child-cost-${c.id}"></div>
    `;
    container.appendChild(card);

    // 教育費表示
    const totalCost = calcChildTotalCost(c);
    const costEl = card.querySelector(`#child-cost-${c.id}`);
    if (costEl) costEl.textContent = `教育費合計 約 ${(totalCost/10000).toFixed(0)}万円`;
  });
}

// イベント委任（一度だけ登録）
(function initChildrenListEvents() {
  const container = document.getElementById('children-list');
  if (!container || container._delegated) return;
  container._delegated = true;

  container.addEventListener('click', e => {
    const btn = e.target.closest('.child-remove-btn');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    removeChild(id);
  });

  container.addEventListener('change', e => {
    const el = e.target;
    if (!el.dataset.id || !el.dataset.field) return;
    const id = Number(el.dataset.id);
    updateChild(id, el.dataset.field, el.value);
  });
})();

function calcChildTotalCost(child) {
  const t = child.schoolType;
  return (EDU_COST.preschool[t] * 3 + EDU_COST.elementary[t] * 6 +
          EDU_COST.juniorHigh[t] * 3 + EDU_COST.highSchool[t] * 3 +
          EDU_COST.university[t] * 4) * 10000;
}

function applyChildEducationStages() {
  // 既存のステージから教育費ステージを削除してから再追加
  expStages = expStages.filter(s => !s._autoEdu);
  const currentYear = new Date().getFullYear();
  const startAge = parseInt(document.getElementById('start-age')?.value || 30);

  children.forEach(child => {
    const birthYear = child.birthYear;
    const t = child.schoolType;
    // 各教育段階の年齢→シミュ開始年齢からの相対年
    const stages = [
      { label: `幼稚園(第${children.indexOf(child)+1}子)`, ageStart: birthYear+3-currentYear+startAge, ageEnd: birthYear+5-currentYear+startAge+1, cost: EDU_COST.preschool[t] },
      { label: `小学校(第${children.indexOf(child)+1}子)`, ageStart: birthYear+6-currentYear+startAge, ageEnd: birthYear+11-currentYear+startAge+1, cost: EDU_COST.elementary[t] },
      { label: `中学(第${children.indexOf(child)+1}子)`,   ageStart: birthYear+12-currentYear+startAge, ageEnd: birthYear+14-currentYear+startAge+1, cost: EDU_COST.juniorHigh[t] },
      { label: `高校(第${children.indexOf(child)+1}子)`,   ageStart: birthYear+15-currentYear+startAge, ageEnd: birthYear+17-currentYear+startAge+1, cost: EDU_COST.highSchool[t] },
      { label: `大学(第${children.indexOf(child)+1}子)`,   ageStart: birthYear+18-currentYear+startAge, ageEnd: birthYear+21-currentYear+startAge+1, cost: EDU_COST.university[t] },
    ];
    stages.forEach(s => {
      if (s.ageEnd > startAge) {
        expStages.push({
          id: `edu_${child.id}_${s.label}`,
          label: s.label,
          from: Math.max(startAge, s.ageStart),
          to: s.ageEnd,
          exp: s.cost,
          _autoEdu: true,
        });
      }
    });
  });
  if (typeof renderTimeline === 'function') renderTimeline();
  if (typeof renderStages === 'function') renderStages();
}

function calcChildBenefitAnnual() {
  const currentYear = new Date().getFullYear();
  let totalAnnual = 0;
  // 2024年改正: 所得制限撤廃・第3子以降3万円・高校生年代まで延長
  children.forEach((child, idx) => {
    const childAge = currentYear - child.birthYear;
    if (childAge < 0 || childAge > 18) return; // 高校生年代（18歳到達後の3月末）まで
    let monthly = 0;
    if (childAge < 3) {
      monthly = 1.5;                  // 3歳未満: 15,000円（一律）
    } else {
      monthly = (idx >= 2) ? 3.0 : 1.0; // 第3子以降3万円 / 第1・2子1万円
    }
    totalAnnual += monthly * 12;
  });
  return totalAnnual; // 万円/年
}

function updateChildBenefitSummary() {
  const annual = calcChildBenefitAnnual();
  const el = document.getElementById('child-benefit-summary');
  if (!el) return;
  if (children.length === 0) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  if (annual > 0) {
    el.textContent = `✅ 児童手当: 約 ${annual}万円/年（2024年改正・所得制限なし）`;
    el.style.color = 'var(--accent3)';
  } else {
    el.textContent = '児童手当: 対象なし（18歳超または未入力）';
    el.style.color = 'var(--text-dim)';
  }
}

// ============================================================
// ★ 新機能 4: 難易度モード — df値連動 + TM スライダー制御
// ============================================================
const DIFFICULTY_DF = { hard: 3, normal: 5, easy: 30 };

function setDifficultyEnhanced(mode) {
  // df スライダーを更新
  const dfVal = DIFFICULTY_DF[mode];
  const dfSlider = document.getElementById('tdof');
  const dfDisplay = document.getElementById('val-tdof');
  if (dfSlider) { dfSlider.value = dfVal; updateSliderFill(dfSlider); }
  if (dfDisplay) dfDisplay.textContent = `t(df=${dfVal})`;

  // TM スライダーを難易度中は disabled に
  const isAdvanced = document.getElementById('advanced-mode-toggle')?.checked;
  document.querySelectorAll('.tm-sl').forEach(sl => {
    sl.disabled = !isAdvanced;
    sl.style.opacity = isAdvanced ? '1' : '0.4';
  });
}

// ============================================================
// ★ 新機能 6: トルネードチャート & 安全率計算
// ============================================================

// ============================================================
// 軽量シングルシム：期待資産寿命スコアを返す
//
// スコア = Σ(各試行の生存年齢) / N  ← 全試行の平均
//   成功(95歳到達) → 95
//   失敗(60歳で破綻) → 60
//   全成功なら95、全失敗なら早期の平均年齢
//
// これにより 0%/100% どちらでも差分が出る
// ============================================================
// ============================================================
// 安全率計算用の軽量シム（資産残高ベース）
// 戻り値: 95歳時点の資産 / 95歳までの総支出 の平均比率
//   1.0超 = 生涯で使う金より資産が多い（安全）
//   1.0以下 = 資産が生涯支出を賄えない（危険）
// ============================================================
function runSafetyMarginSim(cfg) {
  const N = 300;
  const TM = tmValues.map(row => {
    const s = row.reduce((a,b)=>a+b,0)||1;
    return row.map(v=>v/s);
  });
  let totalMarginRatio = 0;

  for (let n=0; n<N; n++) {
    let assets  = cfg.initAssets;
    let retired = false;
    let cumInf  = 1.0;
    let regIdx  = 1;
    let totalExp = 0;

    for (let age=cfg.startAge; age<=95; age++) {
      const t  = age - cfg.startAge;
      const rg = REGIMES[regIdx];
      const w  = retired ? cfg.wRetire : cfg.wWork;

      const zS  = tRandom(cfg.tDof);
      const zB  = normalRandom();
      const zBc = rg.corr*zS + Math.sqrt(Math.max(0,1-rg.corr*rg.corr))*zB;
      assets *= (w*(1+rg.mu[0]+rg.sigma[0]*zS) + (1-w)*(1+rg.mu[1]+rg.sigma[1]*zBc));

      if (!retired && assets >= cfg.fireThr) retired = true;

      let income = 0;
      if (!retired && age<60) income = cfg.annualIncome * cfg.takeHome * Math.pow(1+cfg.raiseRate,t);
      if (age>=65) income += cfg.monthlyPension*12*0.85;

      cumInf *= (1 + cfg.baseInfl + rg.inf);
      const exp = getExpenseForAge(age) * cumInf * cfg.expScale;
      totalExp += exp;
      assets = assets + income - exp;

      // レジーム遷移
      let r=Math.random(), s2=0;
      for (let ri=0;ri<TM[regIdx].length;ri++){
        s2+=TM[regIdx][ri];
        if(r<s2){regIdx=ri;break;}
      }
      if (assets <= 0) break;
    }

    // 95歳時点の資産 / 95歳までの総支出
    const margin = assets / (totalExp || 1);
    totalMarginRatio += Math.max(-0.5, margin); // 極端な負値をクリップ
  }
  return totalMarginRatio / N;
}

// 後方互換：既存コードが runSingleSimFast を参照している箇所用
function runSingleSimFast(cfg) { return runSafetyMarginSim(cfg); }

// 現在のUI設定からベースラインcfgを作る
function buildBaselineCfg() {
  const annualIncome = Math.max(1, parseInt(document.getElementById('income').value)||500) * 10000;
  const taxResult = calcTaxPrecise(annualIncome);
  return {
    startAge:      parseInt(document.getElementById('start-age').value)||30,
    initAssets:    (parseInt(document.getElementById('initial-assets').value)||0)*10000,
    fireThr:       (parseInt(document.getElementById('fire-threshold').value)||10000)*10000,
    annualIncome,
    takeHome:      isFinite(taxResult.rate) ? taxResult.rate : 0.75,
    raiseRate:     parseFloat(document.getElementById('raise').value)/100 || 0,
    monthlyPension:(parseInt(document.getElementById('pension').value)||0)*10000,
    baseInfl:      parseFloat(document.getElementById('base-infl').value)/100 || 0.01,
    wWork:         (parseInt(document.getElementById('w-working').value)||70)/100,
    wRetire:       (parseInt(document.getElementById('w-retired').value)||40)/100,
    tDof:          parseInt(document.getElementById('tdof').value)||5,
    expScale:      1.0,
  };
}

// ============================================================
// ブレークイーブン点の自動算出
// 「支出が今の何倍になると破綻するか」を二分探索で算出
// ============================================================
function calcBreakEven(baseCfg) {
  // runSafetyMarginSim が 1.0 を下回る expScale を探す
  let lo = 1.0, hi = 3.0;
  for (let iter=0; iter<8; iter++) {
    const mid = (lo + hi) / 2;
    const val = runSafetyMarginSim({...baseCfg, expScale: mid});
    if (val < 1.0) hi = mid;
    else           lo = mid;
  }
  return (lo + hi) / 2;
}

// トルネード分析本体
let tornadoChartInstance = null;

async function runTornadoAnalysis() {
  const btn     = document.getElementById('btn-tornado');
  const progWrap = document.getElementById('tornado-progress-wrap');
  const progBar  = document.getElementById('tornado-progress-bar');
  btn.disabled = true;
  btn.textContent = '計算中…';
  progWrap.style.display = 'block';
  progBar.style.width = '0%';

  try {
    const base    = buildBaselineCfg();
    const baseVal = runSafetyMarginSim(base); // 安全率比率（ベースライン）

    if (baseVal == null || isNaN(baseVal)) {
      throw new Error('パラメータの読み取りに失敗しました。ページをリロードして再度お試しください。');
    }

    // 感度対象パラメータ
    const factors = [
      { label:'年間収入',
        plus:  c=>({...c, annualIncome: c.annualIncome*1.10, takeHome: calcTaxPrecise(c.annualIncome*1.10).rate }),
        minus: c=>({...c, annualIncome: c.annualIncome*0.90, takeHome: calcTaxPrecise(c.annualIncome*0.90).rate }) },
      { label:'年間支出',
        plus:  c=>({...c, expScale: Math.max(0.1, c.expScale*0.90) }), // 支出−10%→有利
        minus: c=>({...c, expScale: c.expScale*1.10 }) },
      { label:'インフレ率',
        plus:  c=>({...c, baseInfl: Math.max(0, c.baseInfl - 0.005) }),
        minus: c=>({...c, baseInfl: c.baseInfl + 0.005 }) },
      { label:'株式比率（現役）',
        plus:  c=>({...c, wWork: Math.min(1, c.wWork + 0.10) }),
        minus: c=>({...c, wWork: Math.max(0, c.wWork - 0.10) }) },
      { label:'昇給率',
        plus:  c=>({...c, raiseRate: c.raiseRate + 0.005 }),
        minus: c=>({...c, raiseRate: Math.max(0, c.raiseRate - 0.005) }) },
      { label:'月額年金',
        plus:  c=>({...c, monthlyPension: c.monthlyPension * 1.20 }),
        minus: c=>({...c, monthlyPension: c.monthlyPension * 0.80 }) },
    ];

    const results = [];
    for (let i=0; i<factors.length; i++) {
      const f = factors[i];
      progBar.style.width = `${Math.round(i/factors.length*65)}%`;
      await new Promise(r=>setTimeout(r,0));

      const valPlus  = runSafetyMarginSim(f.plus(base));
      const valMinus = runSafetyMarginSim(f.minus(base));

      // 相対変化率（ベースラインからの%変化）
      const relPlus  = baseVal > 0 ? (valPlus  - baseVal) / baseVal * 100 : 0;
      const relMinus = baseVal > 0 ? (valMinus - baseVal) / baseVal * 100 : 0;

      results.push({
        label:    f.label,
        high:     relPlus,
        low:      relMinus,
        range:    Math.abs(valPlus - valMinus),
        absRange: Math.abs(relPlus - relMinus), // チャートソート用
      });
    }

    results.sort((a,b) => b.absRange - a.absRange);
    progBar.style.width = '75%';
    await new Promise(r=>setTimeout(r,0));

    // ブレークイーブン計算
    const breakEven = calcBreakEven(base);
    progBar.style.width = '85%';
    await new Promise(r=>setTimeout(r,0));

    drawTornadoChart(results, baseVal);
    progBar.style.width = '92%';
    await new Promise(r=>setTimeout(r,0));

    const safetyResult = calcSafetyAndTradeoff(base, baseVal);
    safetyResult.breakEven = breakEven;
    safetyResult.topFactor = results[0]?.label || '—';
    displaySafetyResults(safetyResult, baseVal);

    progBar.style.width = '100%';
    await new Promise(r=>setTimeout(r,100));

  } catch(err) {
    console.error('トルネード分析エラー:', err);
    const wrap = document.getElementById('tornado-chart-wrap');
    if (wrap) {
      wrap.style.display = 'block';
      wrap.innerHTML = `<div style="padding:24px;text-align:center;color:var(--danger);font-family:var(--font-mono);font-size:12px;">
        ⚠️ 感度分析エラー<br><span style="color:var(--text-dim);font-size:11px;">${err.message || err}</span>
      </div>`;
    }
  } finally {
    progWrap.style.display = 'none';
    btn.disabled = false;
    btn.textContent = '🌪️ 再実行';
  }
}

function drawTornadoChart(results, baseVal) {
  const wrap = document.getElementById('tornado-chart-wrap');
  wrap.style.display = 'block';

  // 行数に応じて高さを動的に決定（1行あたり最低50px、タイトル・凡例分60px追加）
  const rowH = Math.max(50, Math.min(70, Math.floor(window.innerWidth / results.length / 2)));
  const dynamicHeight = results.length * rowH + 60;
  wrap.style.height = dynamicHeight + 'px';

  if (tornadoChartInstance) { tornadoChartInstance.destroy(); tornadoChartInstance = null; }
  const oldCanvas = document.getElementById('tornadoChart');
  if (oldCanvas) oldCanvas.remove();
  const newCanvas = document.createElement('canvas');
  newCanvas.id = 'tornadoChart';
  wrap.appendChild(newCanvas);

  const ctx = newCanvas.getContext('2d');

  // 有利方向（プラス）・不利方向（マイナス）を明示的に分離
  const favorable   = results.map(r => Math.max(r.high, r.low));  // 右（緑）
  const unfavorable = results.map(r => Math.min(r.high, r.low));  // 左（赤）
  const labels = results.map((r,i) => i===0 ? `⚡ ${r.label}` : r.label); // 最大影響に警告

  const safeLabel = `安全率 ${baseVal >= 1.2 ? '✅' : baseVal >= 1.0 ? '⚠️' : '❌'} ${baseVal.toFixed(2)}`;

  tornadoChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: '▶ 改善時の安全率変化',
          data: favorable,
          backgroundColor: favorable.map(v => v >= 0 ? 'rgba(168,255,120,0.80)' : 'rgba(255,71,87,0.80)'),
          borderColor:     favorable.map(v => v >= 0 ? '#a8ff78' : '#ff4757'),
          borderWidth: 1.5, borderRadius: 4,
        },
        {
          label: '◀ 悪化時の安全率変化',
          data: unfavorable,
          backgroundColor: unfavorable.map(v => v < 0 ? 'rgba(255,71,87,0.80)' : 'rgba(168,255,120,0.80)'),
          borderColor:     unfavorable.map(v => v < 0 ? '#ff4757' : '#a8ff78'),
          borderWidth: 1.5, borderRadius: 4,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { left: 10, right: 60 } },
      plugins: {
        title: {
          display: true,
          text: `感度分析：各レバーが安全率に与える相対影響度（ベース ${safeLabel}）`,
          color: '#dce8f5',
          font: { size: 12, family: 'Noto Sans JP' },
          padding: { bottom: 14 },
        },
        legend: { labels: { color: '#8a9fba', font: { size: 11 }, padding: 12 } },
        tooltip: {
          callbacks: {
            label: ctx => {
              const v = ctx.parsed.x;
              return `${ctx.dataset.label}: ${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
            },
          },
        },
      },
      scales: {
        x: {
          stacked: false,
          grid: { color: 'rgba(26,45,74,0.8)' },
          ticks: {
            color: '#8a9fba', font: { size: 11 },
            callback: v => `${v>=0?'+':''}${v.toFixed(0)}%`,
          },
          title: {
            display: true,
            text: '← 安全率の低下（不利）　　安全率の上昇（有利） →',
            color: '#5a7090', font: { size: 11 },
          },
        },
        y: {
          stacked: false,
          grid: { color: 'rgba(26,45,74,0.6)' },
          ticks: {
            color: '#dce8f5',
            font: { size: 13, family: 'Noto Sans JP', weight: 'bold' },
            padding: 6,
          },
        },
      },
    },
    plugins: [
      {
        id: 'centerLine',
        afterDraw(chart) {
          const { ctx, chartArea, scales } = chart;
          const x0 = scales.x.getPixelForValue(0);
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(x0, chartArea.top);
          ctx.lineTo(x0, chartArea.bottom);
          ctx.strokeStyle = 'rgba(255,255,255,0.3)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([5,4]);
          ctx.stroke();
          ctx.restore();
        },
      },
      {
        // バーの端に値ラベルを直接描画
        id: 'barValueLabels',
        afterDatasetsDraw(chart) {
          const { ctx, scales } = chart;
          chart.data.datasets.forEach((dataset, di) => {
            const meta = chart.getDatasetMeta(di);
            meta.data.forEach((bar, idx) => {
              const v = dataset.data[idx];
              if (v === 0 || v == null) return;
              const text = `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
              const color = v >= 0 ? '#a8ff78' : '#ff9a9a';
              // バーの右端（プラス）または左端（マイナス）の外側
              const xPx  = scales.x.getPixelForValue(v);
              const x0px = scales.x.getPixelForValue(0);
              const yPx  = bar.y;
              ctx.save();
              ctx.font = 'bold 11px "Space Mono", monospace';
              ctx.fillStyle = color;
              ctx.textBaseline = 'middle';
              if (v >= 0) {
                ctx.textAlign = 'left';
                ctx.fillText(text, xPx + 5, yPx);
              } else {
                ctx.textAlign = 'right';
                ctx.fillText(text, xPx - 5, yPx);
              }
              ctx.restore();
            });
          });
        },
      },
    ],
  });
}

function calcSafetyAndTradeoff(base, planVal) {
  // planVal = runSafetyMarginSim() の戻り値（安全率比率）
  let worstVal = null;
  let worstSource = 'approx';

  if (lastFinalAssets && lastFinalAssets.length >= 10) {
    const bottom10 = lastFinalAssets.slice(0, Math.ceil(lastFinalAssets.length * 0.10));
    const bottom10median = bottom10[Math.floor(bottom10.length * 0.5)];
    const planAssets = lastFinalAssets[Math.floor(lastFinalAssets.length * 0.5)] || 1;
    const stressRatio = planAssets > 0
      ? Math.max(1.0, 1.0 + (planAssets - bottom10median) / planAssets * 0.3)
      : 1.2;
    const worstCfg = { ...base, expScale: Math.min(2.0, base.expScale * stressRatio) };
    worstVal = runSafetyMarginSim(worstCfg);
    worstSource = 'sim';
  } else {
    const worstCfg = { ...base, expScale: base.expScale * 1.20, baseInfl: base.baseInfl + 0.01 };
    worstVal = runSafetyMarginSim(worstCfg);
    worstSource = 'approx';
  }

  // 安全率 = planVal / (planVal - worstVal)（機械設計の定義と同形）
  let safetyFactor;
  if (worstVal >= planVal) {
    safetyFactor = '≥2.0';
  } else if (worstVal <= 0) {
    safetyFactor = '0.00';
  } else {
    const denom = planVal - worstVal;
    safetyFactor = denom > 0 ? (planVal / denom).toFixed(2) : '≥2.0';
  }

  // トレードオフ：支出3%増による安全率低下
  const degradedCfg = { ...base, expScale: base.expScale + 0.03 };
  const degradedVal = runSafetyMarginSim(degradedCfg);
  const marginLoss = planVal - degradedVal;

  // 収入5%増でどれだけ安全率が改善するか
  const incomeDelta = base.annualIncome * 0.05;
  const boostedCfg = {
    ...base,
    annualIncome: base.annualIncome + incomeDelta,
    takeHome: calcTaxPrecise(base.annualIncome + incomeDelta).rate,
  };
  const boostedVal = runSafetyMarginSim(boostedCfg);
  const marginGainPerIncome = boostedVal - planVal;
  const requiredExtraIncome = marginLoss > 0 && marginGainPerIncome > 0
    ? Math.round(incomeDelta / 10000 * marginLoss / marginGainPerIncome)
    : 0;

  return { safetyFactor, worstVal, planVal, requiredExtraIncome, worstSource, marginLoss };
}

function displaySafetyResults({ safetyFactor, worstVal, planVal, requiredExtraIncome, worstSource, marginLoss, breakEven, topFactor }) {
  document.getElementById('safety-section').style.display = 'block';

  const sfNum = (safetyFactor === '≥2.0') ? 99
              : (safetyFactor === '0.00')  ? 0
              : parseFloat(safetyFactor)   || 0;

  const sfEl = document.getElementById('safety-factor-val');
  sfEl.textContent = safetyFactor;
  sfEl.style.color = sfNum >= 1.5 ? '#a8ff78' : sfNum >= 1.2 ? '#ffd166' : '#ff4757';

  // 安全率の定義を明確にした説明文
  const sfDescEl = document.getElementById('safety-factor-desc');
  if      (sfNum >= 1.5) sfDescEl.textContent = '✅ 堅牢：生涯支出に対して十分な資産があります';
  else if (sfNum >= 1.2) sfDescEl.textContent = '⚠️ 許容範囲：改善の余地あり';
  else if (sfNum >= 1.0) sfDescEl.textContent = '🔶 ギリギリ：支出削減を検討してください';
  else                   sfDescEl.textContent = '❌ 危険：生涯支出が資産を上回る可能性があります';

  // 安全率の定義テキスト
  const defEl = document.getElementById('safety-factor-def');
  if (defEl) {
    defEl.innerHTML = `
      <div style="font-size:12px;color:var(--text-dim);margin-top:8px;padding:10px 12px;background:rgba(255,255,255,0.03);border-radius:6px;line-height:1.8;">
        <b style="color:var(--text);">安全率の定義：</b>生涯総支出に対する生涯総収入（資産含む）の比率ベース。
        <span style="color:#a8ff78;">1.2以上</span>＝安全圏 ／ <span style="color:#ffd166;">1.0〜1.2</span>＝要注意 ／ <span style="color:#ff4757;">1.0未満</span>＝危険
      </div>`;
  }

  // ブレークイーブン
  const beEl = document.getElementById('safety-breakeven');
  if (beEl && breakEven != null) {
    const pct = Math.round((breakEven - 1) * 100);
    beEl.innerHTML = `
      <div style="font-size:12px;color:var(--text-dim);margin-top:8px;padding:10px 12px;background:rgba(255,71,87,0.05);border:1px solid rgba(255,71,87,0.2);border-radius:6px;line-height:1.8;">
        📌 <b style="color:var(--warning);">支出ブレークイーブン点：</b>
        現在の支出が <b style="color:#ff4757;">+${pct}%</b> 増加すると安全率が1.0を下回ります
        （現在の${breakEven.toFixed(2)}倍まで許容）
      </div>`;
  }

  // クリティカル要因
  const critEl = document.getElementById('safety-critical');
  if (critEl && topFactor) {
    critEl.innerHTML = `
      <div style="font-size:12px;padding:10px 12px;background:rgba(255,209,102,0.07);border:1px solid rgba(255,209,102,0.25);border-radius:6px;margin-top:8px;line-height:1.8;">
        ⚡ <b style="color:#ffd166;">最注目レバー：${topFactor}</b> — この項目が安全率に最も大きな影響を与えています。優先的に改善を検討してください。
      </div>`;
  }

  // トレードオフ
  document.getElementById('tradeoff-val').textContent =
    requiredExtraIncome > 0 ? `+${requiredExtraIncome.toLocaleString()}万円/年` : '影響軽微';
  document.getElementById('tradeoff-desc').textContent =
    marginLoss > 0
      ? `支出3%増による安全率低下を収入増で補うには年間約${requiredExtraIncome.toLocaleString()}万円必要`
      : '支出増加の影響は軽微です';

  // 最悪シナリオ
  const sourceLabel = worstSource === 'sim'
    ? 'SIMULATE下位10%の分布から推定'
    : '近似計算（先にSIMULATEを実行すると精度向上）';

  document.getElementById('worst-scenario-detail').innerHTML = `
    <span style="color:var(--text-dim);font-size:12px;">${sourceLabel}</span><br><br>
    計画シナリオ 安全率: <b style="color:#a8ff78;">${planVal.toFixed(2)}</b><br>
    最悪ケース 安全率: <b style="color:#ff4757;">${worstVal.toFixed(2)}</b><br>
    差分: <b style="color:#ffd166;">${(planVal - worstVal).toFixed(2)}</b>
    ${worstSource === 'sim' && lastFinalAssets
      ? `<br><span style="font-size:12px;color:var(--text-dim);">試行数 ${lastFinalAssets.length}件の下位10%から推定</span>`
      : ''}
  `;
}


function computeStationaryDist(tm) {
  // べき乗法で定常分布を近似
  let dist = [0.25, 0.25, 0.25, 0.25];
  for (let iter = 0; iter < 1000; iter++) {
    const next = [0, 0, 0, 0];
    for (let j = 0; j < 4; j++) {
      for (let i = 0; i < 4; i++) next[j] += dist[i] * (tm[i][j] / 100);
    }
    dist = next;
  }
  return dist;
}

function renderRegimeDashboard() {
  const el = document.getElementById('regime-dashboard');
  if (!el) return;
  const dist = computeStationaryDist(tmValues);
  const labels = ['強気', '通常', '弱気', 'インフレ'];
  const colors = ['#a8ff78','#00d4ff','#ff4757','#ffd166'];
  const total = dist.reduce((a,b)=>a+b,0);
  // SVG 円グラフ
  const cx=60, cy=60, r=50;
  let startAngle = -Math.PI/2;
  let arcs = '';
  dist.forEach((v, i) => {
    const frac = v / total;
    const angle = frac * 2 * Math.PI;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(startAngle + angle);
    const y2 = cy + r * Math.sin(startAngle + angle);
    const large = angle > Math.PI ? 1 : 0;
    arcs += `<path d="M${cx},${cy} L${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 ${large},1 ${x2.toFixed(1)},${y2.toFixed(1)} Z" fill="${colors[i]}" opacity="0.85"/>`;
    startAngle += angle;
  });
  const legend = dist.map((v,i) => `
    <div style="display:flex;align-items:center;gap:6px;font-size:12px;">
      <span style="width:10px;height:10px;border-radius:2px;background:${colors[i]};display:inline-block;flex-shrink:0;"></span>
      <span style="color:var(--text-mid);">${labels[i]}</span>
      <span style="color:${colors[i]};font-family:var(--font-mono);font-weight:700;margin-left:auto;">${(v/total*100).toFixed(1)}%</span>
    </div>`).join('');
  el.innerHTML = `
    <div style="font-size:12px;color:var(--text-dim);margin-bottom:8px;">定常分布（長期的な市場状態の割合）</div>
    <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
      <svg width="120" height="120" viewBox="0 0 120 120">${arcs}</svg>
      <div style="flex:1;display:flex;flex-direction:column;gap:6px;">${legend}</div>
    </div>
    <div style="font-size:11px;color:var(--text-dim);margin-top:8px;">
      ※ この人生で不況下を過ごす割合: <b style="color:var(--danger);">${(dist[2]/total*100).toFixed(1)}%</b>
    </div>`;
}

///// 長寿リスクシミュレータ
let longevityChart = null;
let currentGender = 'male'; // 現在選択されている性別を保持する変数

function initLongevityExplorer() {
    // HTMLのIDに合わせて取得対象を修正
    const medEl    = document.getElementById('med-adv');
    const canvas   = document.getElementById('longevity-chart');
    
    // 要素が見つからない場合は中断
    if (!medEl || !canvas) return;

    if (longevityChart) { longevityChart.destroy(); }

    const startAge = 32; // ユーザーの現在年齢
    const ages = Array.from({length: 115 - startAge + 1}, (_, i) => startAge + i);

    longevityChart = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: ages,
            datasets: [{
                label: '生存確率 (%)',
                borderColor: '#00d4ff',
                backgroundColor: 'rgba(0,212,255,0.1)',
                fill: true,
                data: [],
                pointRadius: 0,
                tension: 0.2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { min: 0, max: 100, ticks: { callback: v => v + '%' } },
                x: { title: { display: true, text: '年齢' } }
            }
        }
    });

    // 性別ボタンを切り替えるための関数をグローバル（window）に定義
    window.setGender = function(gender) {
        // 不正値ガード: mobile での localStorage 復元時に備える
        if (gender !== 'male' && gender !== 'female') gender = 'male';
        currentGender = gender;
        // グローバル変数も同期
        selectedGender = gender;
        
        // ボタンの見た目（アクティブ状態）を更新
        const btnMale = document.getElementById('btn-male');
        const btnFemale = document.getElementById('btn-female');
        
        if (btnMale && btnFemale) {
            btnMale.classList.toggle('active-m', gender === 'male');
            btnFemale.classList.toggle('active-f', gender === 'female');
            btnMale.classList.toggle('active-f', false);
            btnFemale.classList.toggle('active-m', false);
        }

        // mortality-box の表示を更新
        const m = MORTALITY[gender];
        const box = document.getElementById('mortality-box');
        if (box && m) {
            box.innerHTML =
                `<span style="color:${gender === 'male' ? 'var(--accent)' : 'var(--pink)'}">` +
                (gender === 'male' ? '♂ 男性' : '♀ 女性') + `</span><br>` +
                `${m.desc}<br>` +
                `<span style="color:var(--text-dim);">Gompertz-Makeham: \\(h(x) = \\alpha e^{\\beta x} + \\gamma\\)` +
                (gender === 'male'
                    ? ', α=4.5×10⁻⁵, β=0.091, γ=6.0×10⁻⁴'
                    : ', α=1.5×10⁻⁵, β=0.096, γ=2.5×10⁻⁴') +
                `</span>`;
            // MathJax 再レンダリング
            if (window.MathJax) {
                if (MathJax.typesetPromise) {
                    MathJax.typesetPromise([box]);
                } else if (MathJax.Hub && MathJax.Hub.Queue) {
                    MathJax.Hub.Queue(['Typeset', MathJax.Hub, box]);
                }
            }
        }
        
        // 性別が変わったので再計算
        updateLongevity();
    };

    function updateLongevity() {
        // スライダーの値を取得
        const medAdv = parseFloat(medEl.value) / 100;
        
        // 数値表示の更新（HTML側のIDに合わせて sim-med-val を使用）
        const valDisp = document.getElementById('sim-med-val');
        if (valDisp) valDisp.textContent = (medAdv * 100).toFixed(1) + '%';

        let survivalProb = 100;
        const data = [];
        let p95 = 0, p100 = 0, maxAge = startAge;

        ages.forEach((age, t) => {
            // 現在保持している currentGender を使用
            const dp = (typeof deathProb === 'function' ? deathProb : window.deathProb)(age, t, currentGender, medAdv);
            survivalProb *= (1 - dp);
            
            const displayVal = Math.max(0, survivalProb);
            data.push(displayVal);

            if (age === 95) p95 = displayVal;
            if (age === 100) p100 = displayVal;
            if (displayVal > 0.1) maxAge = age;
        });

        longevityChart.data.datasets[0].data = data;
        longevityChart.update();

        // 各種表示の更新
        const p95El = document.getElementById('prob-95');
        const p100El = document.getElementById('prob-100');
        const maxAgeEl = document.getElementById('max-age-est');

        if (p95El) p95El.textContent = p95.toFixed(1) + '%';
        if (p100El) p100El.textContent = p100.toFixed(1) + '%';
        if (maxAgeEl) maxAgeEl.textContent = maxAge + '歳';
    }

    // スライダーのイベントリスナー
    medEl.addEventListener('input', updateLongevity);
    
    // 初回実行
    updateLongevity();
}

document.addEventListener('DOMContentLoaded', () => {
    // deathProb は simulation.js の末尾で window に公開されるため、
    // DOMContentLoaded 時点では参照できない場合がある。
    // window の load イベント後（全スクリプト解析済み）に遅延して実行する。
    if (typeof deathProb === 'function' || typeof window.deathProb === 'function') {
        initLongevityExplorer();
    } else {
        window.addEventListener('load', () => initLongevityExplorer());
    }
});

function toggleGuidePanel() {
  const body = document.getElementById('guide-body');
  const icon = document.getElementById('guide-toggle-icon');
  const btn  = document.getElementById('guide-toggle-btn');
  if (!body) return;
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  if (icon) icon.style.transform = isOpen ? 'rotate(-90deg)' : 'rotate(0deg)';
  if (btn)  btn.setAttribute('aria-expanded', String(!isOpen));
}


// ============================================================
// toggleAdv / updateSliderFill — app.jsから移動
// (app.jsにも後方互換でシムが残るが、正規定義はここ)
// ============================================================
// ※ app.jsに既存の定義があるため、未定義の場合のみ定義する
if (typeof window._uiHelpersRegistered === 'undefined') {
  window._uiHelpersRegistered = true;

  // Advanced Settings Accordion
  window.toggleAdv = function(sectionId) {
    const section = document.getElementById(sectionId);
    if (!section) return;
    const btn  = section.querySelector('.adv-toggle');
    const body = section.querySelector('.adv-body');
    const isOpen = body.classList.contains('open');
    if (isOpen) {
      body.classList.remove('open');
      if (btn) { btn.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
    } else {
      body.classList.add('open');
      if (btn) { btn.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); }
      section.querySelectorAll('input[type="range"]').forEach(s => updateSliderFill(s));
    }
  };

  // Dynamic slider gradient
  window.updateSliderFill = function(slider) {
    const min = parseFloat(slider.min) || 0;
    const max = parseFloat(slider.max) || 100;
    const val = parseFloat(slider.value);
    const pct = ((val - min) / (max - min) * 100).toFixed(1);
    slider.style.setProperty('--pct', pct + '%');
  };
}

// ============================================================
// updateRegimeTable — 遷移行列の確率をテーブルに反映する
//
// HTML に id="regime-table" が存在する場合のみ描画する。
// 存在しない場合は何もしない（安全なスタブ）。
// simulation.js からコールバック経由で呼ばれる。
// ============================================================
function updateRegimeTable() {
  const el = document.getElementById('regime-table');
  if (!el) return; // HTMLに要素がなければ無視

  // tmValues と RNAMES / REMOJI は simulation.js のグローバル変数
  if (typeof tmValues === 'undefined' || typeof RNAMES === 'undefined') return;

  const labels = (typeof REMOJI !== 'undefined')
    ? RNAMES.map((n, i) => REMOJI[i] + ' ' + n)
    : RNAMES;
  const colors = ['var(--bull)','var(--normal)','var(--bear)','var(--infla)'];

  let html = `
    <table style="width:100%;border-collapse:collapse;font-size:11px;font-family:var(--font-mono);">
      <thead>
        <tr>
          <th style="padding:6px 8px;text-align:left;color:var(--text-dim);border-bottom:1px solid var(--border);">遷移元 → 先</th>
          ${labels.map((l, i) => `<th style="padding:6px 8px;text-align:center;color:${colors[i]};border-bottom:1px solid var(--border);">${l}</th>`).join('')}
          <th style="padding:6px 8px;text-align:center;color:var(--text-dim);border-bottom:1px solid var(--border);">合計</th>
        </tr>
      </thead>
      <tbody>
        ${tmValues.map((row, ri) => {
          const sum = row.reduce((a, b) => a + b, 0);
          const sumColor = sum === 100 ? 'var(--success, #a8ff78)' : 'var(--danger, #ff4757)';
          return `<tr>
            <td style="padding:6px 8px;color:${colors[ri]};font-weight:700;">${labels[ri]}</td>
            ${row.map((v, ci) => `<td style="padding:6px 8px;text-align:center;color:${ri === ci ? colors[ci] : 'var(--text-mid)'};">${v}%</td>`).join('')}
            <td style="padding:6px 8px;text-align:center;color:${sumColor};font-weight:700;">${sum}%</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;

  el.innerHTML = html;
}

// ============================================================
// initUiCallbacks — ui.js のコールバック注入口
// ============================================================
let _uiCallbacks = {};

function initUiCallbacks(callbacks) {
  _uiCallbacks = callbacks || {};
}

// ============================================================
// ★ CustomEvent 受信層 — simulation.js / pwa.js からの通知を処理
//
// simulation.js が alert() を廃止して CustomEvent に切り替えたため、
// DOM 操作の責務を ui.js に集約する。
// ============================================================

/**
 * showSimNotification — トーストまたはバナーでメッセージを表示。
 * DOM 操作はここのみ。呼び出し元は CustomEvent を発火するだけでよい。
 */
function showSimNotification(message, type = 'error') {
  // 既存のエラーバナー要素を再利用（なければ動的生成）
  let toast = document.getElementById('sim-notification-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'sim-notification-toast';
    toast.style.cssText = [
      'position:fixed', 'bottom:80px', 'left:50%', 'transform:translateX(-50%)',
      'max-width:90vw', 'padding:14px 20px', 'border-radius:10px',
      'font-size:13px', 'line-height:1.7', 'z-index:9999',
      'box-shadow:0 8px 32px rgba(0,0,0,.5)', 'white-space:pre-wrap',
      'text-align:center', 'pointer-events:none',
      'transition:opacity .3s', 'opacity:0',
    ].join(';');
    document.body.appendChild(toast);
  }

  const isError = type === 'error';
  toast.style.background = isError ? 'rgba(255,71,87,.95)' : 'rgba(0,212,255,.15)';
  toast.style.border      = isError ? '1px solid #ff4757' : '1px solid rgba(0,212,255,.4)';
  toast.style.color       = isError ? '#fff' : 'var(--accent)';
  toast.textContent       = message;
  toast.style.opacity     = '1';

  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => { toast.style.opacity = '0'; }, isError ? 5000 : 3000);
}

// simulation.js からのバリデーションエラー通知
window.addEventListener('sim:validationError', e => {
  showSimNotification(e.detail?.message || '入力エラーが発生しました。', 'error');
});

// simulation.js からのシミュレーションエラー通知
window.addEventListener('sim:error', e => {
  showSimNotification(e.detail?.message || 'シミュレーションエラーが発生しました。', 'error');
});

// pwa.js からのインストール案内通知
window.addEventListener('pwa:notify', e => {
  showSimNotification(e.detail?.message || '', 'info');
});
