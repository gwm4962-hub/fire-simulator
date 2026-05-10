# sharecard.js 組み込みガイド
## FLOW | 老後資産シミュレーター — シェアカード＋改善提案エンジン

---

## 1. ファイル配置

```
your-project/
├── index.html
├── app.js
├── simulation.js
├── ui.js
├── charts.js
├── storage.js
├── wizard.js
├── pwa.js
├── splash.js
├── validator.js
└── sharecard.js   ← ★ 追加
```

---

## 2. index.html へのスクリプト追加

`</body>` の直前（`pwa.js` の後ろ）に1行追加するだけです。

```html
<!-- 既存スクリプト群（順序は変えない） -->
<script src="app.js"></script>
<script src="storage.js"></script>
<script src="simulation.js"></script>
<script src="charts.js"></script>
<script src="ui.js"></script>
<script src="wizard.js"></script>
<script src="pwa.js"></script>

<!-- ★ 追加 -->
<script src="sharecard.js"></script>
</body>
```

> **注意**: `simulation.js` より後に読み込んでください。
> `sharecard.js` は `runSimulation` を非侵襲的にラップするため、
> simulation.js がロード済みである必要があります。

---

## 3. sw.js（Service Worker）のキャッシュ更新

`sw.js` の `CACHE_NAME` バージョンを上げてください（既存キャッシュを破棄するため）。

```js
// 変更前
const CACHE_NAME = 'fire-sim-v19-cache';

// 変更後
const CACHE_NAME = 'fire-sim-v20-cache';
```

また `CORE_URLS` に `sharecard.js` を追加します。

```js
const CORE_URLS = [
  './index.html',
  './manifest.json',
  './sharecard.js',   // ← 追加
];
```

---

## 4. 動作の流れ（コード変更不要）

```
ユーザーがシミュレーション実行
        ↓
runSimulation() 完了
        ↓
sharecard.js が自動的に結果を収集
（window._lastSimData と KPI DOM から読み取り）
        ↓
┌─────────────────────────────────────────┐
│  share-card-section                     │
│  ┌──────────────────────────────────┐   │
│  │   老後安心ランクカード（S〜D）   │   │
│  │   ・偏差値                       │   │
│  │   ・資産寿命スコア               │   │
│  │   ・肩書きキャラクター           │   │
│  └──────────────────────────────────┘   │
│  [📥 画像を保存]  [𝕏 Xにシェア]         │
└─────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────┐
│  improvement-engine-section             │
│  現状 52% → 改善シナリオ比較            │
│  ・💹 NISA満額 → 68%（+16pt）           │
│  ・✂️ 支出-2万 → 64%（+12pt）           │
│  ・🕐 退職+3年 → 67%（+15pt）           │
│  全部合わせると → 81%（+29pt）          │
│  [▶ パラメータを変えて再シミュレーション] │
└─────────────────────────────────────────┘
```

---

## 5. ランク定義

| ランク | 成功率 | 肩書き |
|--------|--------|--------|
| **S** | 90%以上 | 悠々自適な逃げ切り世代 |
| **A** | 75〜89% | 盤石な資産防衛族 |
| **B** | 60〜74% | 着実な老後設計者 |
| **C** | 45〜59% | 綱渡りの現役続行おじさん |
| **D** | 44%以下 | 労働の果てなき旅人 |

偏差値は `25 + 成功率 × 50` で算出（0%→25点、100%→75点）。

---

## 6. SNSシェア文言の例

```
【FLOW老後診断】
現在35歳 / 老後安心ランク【B】
📈 着実な老後設計者
資産寿命スコア: 68% / 老後偏差値: 59点
#老後資産診断 #FLOW家計シミュレーター
```

**金額は一切含まれません** — 具体額を晒したくない日本人の国民性に配慮した設計です。

---

## 7. カスタマイズ

### ランク定義の変更

`sharecard.js` 冒頭の `RANKS` 配列を編集します。

```js
const RANKS = [
  { min: 0.90, rank: 'S', label: '悠々自適な逃げ切り世代', color: '#a8ff78', ... },
  // ↑ min: 成功率の下限（0.0〜1.0）
  // ↑ color: カードのアクセントカラー（CSS color文字列）
  ...
];
```

### 改善感度係数の調整

`estimateImprovedRate()` 内の係数を変えると、各シナリオの効果量が変わります。

```js
const nisaFutureVal = nisaBoostMan * Math.pow(1.05, remainYears); // 5%複利 → 変更可
const nisaEffect    = Math.min(0.30, nisaFutureVal / 3000 * 0.18); // 0.18 = 感度係数
```

### セクションの挿入位置

`sharecard.js` は `kpi-section` または `chart-container` の直後に自動挿入します。
任意の位置に挿入したい場合は、`index.html` に空の `<section>` を置いてください。

```html
<!-- シェアカード -->
<section id="share-card-section" class="panel"></section>

<!-- 改善提案エンジン -->
<section id="improvement-engine-section" class="panel"></section>
```

空要素として置いておけば、`sharecard.js` が自動でコンテンツを注入します（自動生成は行いません）。

---

## 8. 依存ライブラリ

| ライブラリ | 用途 | 読み込み |
|-----------|------|--------|
| `html2canvas 1.4.1` | カードのPNG化 | 画像保存ボタン押下時に CDN から遅延ロード |

オフライン環境では画像保存機能のみ動作しません。Xシェア（テキスト）は常に動作します。

---

## 9. プライバシー

- シェアカードには**金額を一切含みません**
- 偏差値・ランク・肩書きのみ表示
- html2canvas はローカル処理のみで外部送信なし
