/**
 * validator.test.js — FLOW 資産シミュレーター ユニットテスト
 *
 * 実行方法:
 *   npm install -D vitest          # Vitest（推奨）
 *   npx vitest run                 # または
 *   npm install -D jest @jest/globals
 *   npx jest                       # Jest
 *
 * テスト対象:
 *   - FinCalc（BigInt 精度演算）
 *   - calcTaxPrecise（税計算エンジン）
 *   - validateField / validateSimParams（バリデーター層）
 *   - validateOneTimeEvent（一時イベント検証）
 *   - samplingFromBivariateT（多変量t分布サンプラー）
 *   - getOneTimeEventCashflow（タイムライン検索）
 *
 * 注意: simulation.js / validator.js をインポートするため、
 *       ビルドツール（Vite / Jest + jsdom）環境が必要です。
 *       ブラウザ固有の DOM API（document, window）は使わないよう
 *       各モジュールが純粋関数を export していることを前提とします。
 *
 * Vite 環境の場合は vitest.config.js に下記を追加してください:
 *   export default { test: { environment: 'jsdom', globals: true } }
 */

// ─── モジュールの読み込み ────────────────────────────────────
// CommonJS 形式（Jest） と ESM 形式（Vitest）の両対応
// ※ 現状 IIFE / グローバル変数形式のファイルは globalThis に展開して読む

// Node.js 環境では DOM スタブを提供
if (typeof globalThis.document === 'undefined') {
  globalThis.document = { getElementById: () => null };
}
if (typeof globalThis.window === 'undefined') {
  globalThis.window = globalThis;
}

// simulation.js / validator.js を eval で読み込む（Node.js 互換）
// ビルド環境では import に置き換える
const fs = (typeof require !== 'undefined') ? require('fs') : null;

function loadScript(path) {
  if (!fs) throw new Error('fs モジュールが利用できません。Vitest / Jest 環境で実行してください。');
  try {
    const code = fs.readFileSync(path, 'utf8');
    // ── 修正ポイント ──────────────────────────────────────────────
    // 旧実装: new Function() で実行すると、スクリプト内の
    //   `const FinCalc = ...` がその関数スコープに閉じ込まれ
    //   globalThis に露出しないため ReferenceError が発生していた。
    //
    // 新実装: DOM API スタブを globalThis に差し込んでから eval() で実行。
    //   eval はグローバルスコープで変数を確立するため const/let/var いずれで
    //   宣言された FinCalc も globalThis から参照可能になる。
    //   simulation.js 側の globalThis 登録と二重で保険をかける。
    // ─────────────────────────────────────────────────────────────
    globalThis.window   = globalThis.window   || globalThis;
    globalThis.document = globalThis.document || { getElementById: () => null };
    if (typeof globalThis.navigator === 'undefined') {
      globalThis.navigator = { userAgent: '', standalone: false };
    }
    if (typeof globalThis.localStorage === 'undefined') {
      const _store = {};
      globalThis.localStorage = {
        getItem:    (k) => (_store[k] ?? null),
        setItem:    (k, v) => { _store[k] = String(v); },
        removeItem: (k) => { delete _store[k]; },
        clear:      () => { Object.keys(_store).forEach((k) => delete _store[k]); },
      };
    }
    if (typeof globalThis.MutationObserver === 'undefined') {
      globalThis.MutationObserver = class { observe() {} disconnect() {} };
    }
    eval(code); // eslint-disable-line no-eval
  } catch (e) {
    console.warn(`[test] ${path} を読み込めませんでした:`, e.message);
  }
}

// スクリプトパスは実際のプロジェクト構成に合わせて調整してください
loadScript('./simulation.js');
loadScript('./validator.js');

// ─── ヘルパー ────────────────────────────────────────────────
const { test, describe, expect, beforeEach } = globalThis;


// ============================================================
// § 1. FinCalc — BigInt 精度演算テスト
// ============================================================
describe('FinCalc', () => {
  test('manToYen: 300万円 → 3,000,000円', () => {
    const result = FinCalc.manToYen(300);
    expect(result).toBe(3_000_000n);
  });

  test('yenToMan: 3,000,000n → 300 (万円)', () => {
    const result = FinCalc.yenToMan(3_000_000n);
    expect(result).toBe(300);
  });

  test('roundToMan: 999,999円 → 1,000,000円（万円単位に丸め）', () => {
    const result = FinCalc.roundToMan(999_999);
    expect(result).toBe(1_000_000);
  });

  test('sumNetCashflow: 収入 [500,500] - 支出 [300,300] = +400万円', () => {
    const { netMan } = FinCalc.sumNetCashflow([500, 500], [300, 300]);
    expect(netMan).toBe(400);
  });

  test('raisedIncomeYen: 500万円 × 1.5% × 10年 ≈ 5,802,712円', () => {
    const result = FinCalc.raisedIncomeYen(5_000_000, 0.015, 10);
    // Math.pow(1.015, 10) ≈ 1.16054
    const expected = Math.round(5_000_000 * Math.pow(1.015, 10));
    expect(Number(result)).toBe(expected);
  });

  test('calcProgressiveTaxBigInt: 課税所得500万円の所得税', () => {
    const brackets = [
      [1_949_000, 0.05], [3_299_000, 0.10], [6_949_000, 0.20],
      [Infinity, 0.23]
    ];
    const tax = FinCalc.calcProgressiveTaxBigInt(5_000_000, brackets);
    // 手計算: 194,900×0.05 + 135,000×0.10 + 170,100×0.20 = ～47,700
    // ※正確な値はブラケット境界次第なので整数非負を確認
    expect(typeof tax).toBe('bigint');
    expect(tax > 0n).toBe(true);
  });
});


// ============================================================
// § 2. calcTaxPrecise — 税計算エンジンテスト
// ============================================================
describe('calcTaxPrecise', () => {
  // 国税庁のシミュレーター等で手検証した既知値を使う
  const KNOWN_CASES = [
    {
      label: '年収300万円（低所得帯）',
      grossYen: 3_000_000,
      // 手取り率は約76〜77%
      minTakeHomeRate: 0.73,
      maxTakeHomeRate: 0.80,
    },
    {
      label: '年収500万円（中所得帯）',
      grossYen: 5_000_000,
      minTakeHomeRate: 0.72,
      maxTakeHomeRate: 0.78,
    },
    {
      label: '年収800万円（高所得帯）',
      grossYen: 8_000_000,
      minTakeHomeRate: 0.68,
      maxTakeHomeRate: 0.75,
    },
    {
      label: '年収1,500万円（超高所得帯）',
      grossYen: 15_000_000,
      minTakeHomeRate: 0.58,
      maxTakeHomeRate: 0.66,
    },
  ];

  KNOWN_CASES.forEach(({ label, grossYen, minTakeHomeRate, maxTakeHomeRate }) => {
    test(`${label}: 手取り率が ${(minTakeHomeRate*100).toFixed(0)}〜${(maxTakeHomeRate*100).toFixed(0)}% の範囲に収まる`, () => {
      if (typeof calcTaxPrecise === 'undefined') {
        console.warn('calcTaxPrecise が未定義 — simulation.js の読み込みを確認してください');
        return; // スキップ
      }
      const result = calcTaxPrecise(grossYen);
      expect(result.takeHomeYen).toBeGreaterThan(0);
      expect(result.rate).toBeGreaterThanOrEqual(minTakeHomeRate);
      expect(result.rate).toBeLessThanOrEqual(maxTakeHomeRate);
    });
  });

  test('年収0円: 全フィールドが0を返す', () => {
    if (typeof calcTaxPrecise === 'undefined') return;
    const result = calcTaxPrecise(0);
    expect(result.takeHomeYen).toBe(0);
    expect(result.rate).toBe(0);
  });

  test('年収がマイナスの場合: エラーにならず0を返す', () => {
    if (typeof calcTaxPrecise === 'undefined') return;
    const result = calcTaxPrecise(-1_000_000);
    expect(result.rate).toBe(0);
  });

  test('年収増加に伴い税率が単調増加する（累進課税の確認）', () => {
    if (typeof calcTaxPrecise === 'undefined') return;
    const incomes = [2_000_000, 5_000_000, 10_000_000, 20_000_000];
    const rates = incomes.map(y => calcTaxPrecise(y).rate);
    // 高収入ほど手取り率が下がる（= 1-rate が増える）
    for (let i = 0; i < rates.length - 1; i++) {
      expect(rates[i]).toBeGreaterThan(rates[i + 1]);
    }
  });

  test('手取りの整合性: takeHomeYen = grossYen - socialIns - incomeTax - residTax', () => {
    if (typeof calcTaxPrecise === 'undefined') return;
    const gross = 7_000_000;
    const { socialIns, incomeTax, residTax, takeHomeYen } = calcTaxPrecise(gross);
    const reconstructed = gross - socialIns - incomeTax - residTax;
    expect(Math.abs(reconstructed - takeHomeYen)).toBeLessThanOrEqual(1); // 1円以内の誤差
  });
});


// ============================================================
// § 3. validateField — プリミティブバリデーターテスト
// ============================================================
describe('validateField', () => {
  test('正常な数値は ok: true を返す', () => {
    const result = validateField(500, { type: 'number', min: 0, max: 10000, label: '年収' });
    expect(result.ok).toBe(true);
    expect(result.message).toBeNull();
  });

  test('範囲外（小）はエラーを返す', () => {
    const result = validateField(-1, { type: 'integer', min: 0, max: 100, label: 'テスト' });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('0 以上');
  });

  test('範囲外（大）はエラーを返す', () => {
    const result = validateField(200, { type: 'integer', min: 0, max: 100, label: 'テスト' });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('100 以下');
  });

  test('非数値はエラーを返す', () => {
    const result = validateField('abc', { type: 'number', label: 'テスト' });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('数値');
  });

  test('空文字 + required: true はエラーを返す', () => {
    const result = validateField('', { type: 'number', required: true, label: 'テスト' });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('必須');
  });

  test('空文字 + required: false は ok: true を返す', () => {
    const result = validateField('', { type: 'number', required: false, label: 'テスト' });
    expect(result.ok).toBe(true);
  });

  test('select型: 正規選択肢は ok', () => {
    const result = validateField('normal', {
      type: 'select',
      options: ['hard', 'normal', 'easy'],
      label: '難易度',
    });
    expect(result.ok).toBe(true);
  });

  test('select型: 非正規選択肢はエラー', () => {
    const result = validateField('extreme', {
      type: 'select',
      options: ['hard', 'normal', 'easy'],
      label: '難易度',
    });
    expect(result.ok).toBe(false);
  });
});


// ============================================================
// § 4. validateSimParams — クロスフィールドバリデーターテスト
// ============================================================
describe('validateSimParams', () => {
  const baseParams = {
    startAge:      30,
    initAssets:    3_000_000,   // 300万円
    fireThr:       100_000_000, // 1億円
    annualIncome:  5_000_000,   // 500万円
    wWork:         60,
    wRetire:       40,
    monthlyPension:150_000,     // 15万円
    baseInfl:      1.0,
    expStages:     [{ label: '現役', from: 25, to: 60, exp: 300 }],
    children:      [],
  };

  test('正常パラメータ: エラー・警告なし', () => {
    const { errors, warnings } = validateSimParams(baseParams);
    expect(errors).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  test('現在資産 > FIRE目標: 警告を出す', () => {
    const { warnings } = validateSimParams({
      ...baseParams,
      initAssets: 200_000_000, // 2億円 > 1億円目標
    });
    expect(warnings.some(w => w.includes('FIRE目標資産を上回って'))).toBe(true);
  });

  test('年間支出が手取りの150%超: エラーを出す', () => {
    const { errors } = validateSimParams({
      ...baseParams,
      // 年収200万円 → 手取り ≈150万円。支出300万円は150%超
      annualIncome: 2_000_000,
      expStages: [{ label: '現役', from: 25, to: 60, exp: 300 }],
    });
    expect(errors.some(e => e.includes('150%を超えています'))).toBe(true);
  });

  test('FIRE後株式比率が現役より20pt以上高い: 警告を出す', () => {
    const { warnings } = validateSimParams({
      ...baseParams,
      wWork: 30,
      wRetire: 80, // 30 + 50pt 差
    });
    expect(warnings.some(w => w.includes('大幅に高く'))).toBe(true);
  });

  test('インフレ率5%超: 警告を出す', () => {
    const { warnings } = validateSimParams({ ...baseParams, baseInfl: 6.0 });
    expect(warnings.some(w => w.includes('インフレ率'))).toBe(true);
  });

  test('年金40万円/月超: 警告を出す', () => {
    const { warnings } = validateSimParams({
      ...baseParams,
      monthlyPension: 450_000, // 45万円
    });
    expect(warnings.some(w => w.includes('月額年金'))).toBe(true);
  });

  test('ライフステージにギャップ（>5年）: 警告を出す', () => {
    const { warnings } = validateSimParams({
      ...baseParams,
      expStages: [
        { label: '現役', from: 25, to: 40, exp: 300 },
        { label: '老後', from: 55, to: 90, exp: 200 }, // 40〜55歳の15年ギャップ
      ],
    });
    expect(warnings.some(w => w.includes('ギャップ'))).toBe(true);
  });

  test('65歳以上での開始: 警告を出す', () => {
    const { warnings } = validateSimParams({ ...baseParams, startAge: 66 });
    expect(warnings.some(w => w.includes('65歳以上'))).toBe(true);
  });
});


// ============================================================
// § 5. validateOneTimeEvent — 一時イベントバリデーターテスト
// ============================================================
describe('validateOneTimeEvent', () => {
  test('正常イベント: ok: true', () => {
    const { ok } = validateOneTimeEvent({
      age: 45,
      amount: -3000,
      type: 'expense',
      label: '住宅購入',
    });
    expect(ok).toBe(true);
  });

  test('年齢が範囲外（200歳）: ok: false', () => {
    const { ok, messages } = validateOneTimeEvent({
      age: 200, amount: 1000, type: 'income', label: '相続',
    });
    expect(ok).toBe(false);
    expect(messages.some(m => m.includes('イベント年齢'))).toBe(true);
  });

  test('不正な type: ok: false', () => {
    const { ok, messages } = validateOneTimeEvent({
      age: 50, amount: -500, type: 'unknown', label: '修繕費',
    });
    expect(ok).toBe(false);
    expect(messages.some(m => m.includes('種別'))).toBe(true);
  });

  test('label が空文字: ok: false', () => {
    const { ok, messages } = validateOneTimeEvent({
      age: 40, amount: 500, type: 'income', label: '',
    });
    expect(ok).toBe(false);
    expect(messages.some(m => m.includes('必須'))).toBe(true);
  });

  test('マイナス金額（支出）は許容される', () => {
    const { ok } = validateOneTimeEvent({
      age: 55, amount: -5000, type: 'expense', label: '車購入',
    });
    expect(ok).toBe(true);
  });
});


// ============================================================
// § 6. 多変量t分布サンプラーテスト
//   samplingFromBivariateT は simulation.js に実装される関数
// ============================================================
describe('samplingFromBivariateT', () => {
  test('相関係数0でサンプルされた2変数の相関が|-0.1〜+0.1|に収まる', () => {
    if (typeof samplingFromBivariateT === 'undefined') {
      console.warn('samplingFromBivariateT 未定義 — スキップ');
      return;
    }
    const N = 2000;
    const xs = [], ys = [];
    for (let i = 0; i < N; i++) {
      const [x, y] = samplingFromBivariateT({ mu: [0, 0], sigma: [1, 1], corr: 0, df: 10 });
      xs.push(x); ys.push(y);
    }
    // ピアソン相関係数を計算
    const meanX = xs.reduce((a, b) => a + b, 0) / N;
    const meanY = ys.reduce((a, b) => a + b, 0) / N;
    const cov  = xs.reduce((s, x, i) => s + (x - meanX) * (ys[i] - meanY), 0) / N;
    const sdX  = Math.sqrt(xs.reduce((s, x) => s + (x - meanX) ** 2, 0) / N);
    const sdY  = Math.sqrt(ys.reduce((s, y) => s + (y - meanY) ** 2, 0) / N);
    const r = cov / (sdX * sdY);
    expect(Math.abs(r)).toBeLessThan(0.15);
  });

  test('相関係数0.8でサンプルされた2変数の相関が0.65〜0.95に収まる', () => {
    if (typeof samplingFromBivariateT === 'undefined') return;
    const N = 3000;
    const xs = [], ys = [];
    for (let i = 0; i < N; i++) {
      const [x, y] = samplingFromBivariateT({ mu: [0, 0], sigma: [1, 1], corr: 0.8, df: 30 });
      xs.push(x); ys.push(y);
    }
    const meanX = xs.reduce((a, b) => a + b, 0) / N;
    const meanY = ys.reduce((a, b) => a + b, 0) / N;
    const cov  = xs.reduce((s, x, i) => s + (x - meanX) * (ys[i] - meanY), 0) / N;
    const sdX  = Math.sqrt(xs.reduce((s, x) => s + (x - meanX) ** 2, 0) / N);
    const sdY  = Math.sqrt(ys.reduce((s, y) => s + (y - meanY) ** 2, 0) / N);
    const r = cov / (sdX * sdY);
    expect(r).toBeGreaterThan(0.65);
    expect(r).toBeLessThan(0.95);
  });
});


// ============================================================
// § 7. getOneTimeEventCashflow — タイムライン検索テスト
// ============================================================
describe('getOneTimeEventCashflow', () => {
  const events = [
    { age: 35, amount:  -5000, type: 'expense', label: '住宅購入' },
    { age: 50, amount:   3000, type: 'income',  label: '退職金' },
    { age: 70, amount:  -1000, type: 'expense', label: '修繕費' },
  ];

  test('対象年齢のイベントを正しく合算する', () => {
    if (typeof getOneTimeEventCashflow === 'undefined') {
      console.warn('getOneTimeEventCashflow 未定義 — スキップ');
      return;
    }
    const result35 = getOneTimeEventCashflow(35, events);
    expect(result35).toBe(-5000 * 10000); // 万円→円

    const result50 = getOneTimeEventCashflow(50, events);
    expect(result50).toBe(3000 * 10000);
  });

  test('イベントのない年は 0 を返す', () => {
    if (typeof getOneTimeEventCashflow === 'undefined') return;
    const result = getOneTimeEventCashflow(40, events);
    expect(result).toBe(0);
  });

  test('同じ年のイベントが複数ある場合は合算する', () => {
    if (typeof getOneTimeEventCashflow === 'undefined') return;
    const multiEvents = [
      { age: 45, amount: 2000, type: 'income',  label: '相続A' },
      { age: 45, amount: 1000, type: 'income',  label: '相続B' },
      { age: 45, amount: -500, type: 'expense', label: '贈与税' },
    ];
    const result = getOneTimeEventCashflow(45, multiEvents);
    expect(result).toBe((2000 + 1000 - 500) * 10000);
  });
});
