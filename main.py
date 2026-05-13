import os
import json
import time
import traceback
from collections import defaultdict

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from google import genai
from google.genai import types

app = FastAPI()

# =========================
# CORS
# =========================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://fire-simulator-rho-swart.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# Gemini Client
# =========================
API_KEY = os.environ.get("GEMINI_API_KEY")
if not API_KEY:
    raise RuntimeError("GEMINI_API_KEY not found")

client = genai.Client(api_key=API_KEY)

# =========================
# モデル設定
#   gemini-2.0-flash は 2026/3/6 以降 新規プロジェクト利用不可・2026/6/1 廃止予定
#   → PRIMARY を 2.5-flash-lite、quota 超過時は軽量な 2.5-flash-lite へフォールバック
# =========================
PRIMARY_MODEL  = "gemini-2.5-flash-lite"
FALLBACK_MODEL = "gemini-2.5-flash"

# =========================
# サーバー側クールタイム（IP単位・30秒に1回まで）
# =========================
COOLTIME_SECONDS = 30
_last_call: dict[str, float] = defaultdict(float)

# =========================
# システムプロンプト
# =========================
SYSTEM_PROMPT = """\
あなたは元・金融庁検査官で現在はFIREコンサルタントとして活動する辛口の資産審査の専門家。
モンテカルロ法によるシミュレーション結果（成功率・破産率・シナリオ幅）とユーザーの詳細な財務パラメータを受け取り、
以下のJSON形式のみで回答せよ。前置き・後書き・コードブロックは一切不要。

{
  "diagnosis": "現状の本質的な断定（2〜3文）。成功率だけでなく破産率・p10悲観シナリオ・年金充足率・シナリオ幅のうち最も危険な指標を軸に診断せよ",
  "blind_spot": "ユーザーが数字を見ても気づいていない構造的リスク（2〜3文）。以下のいずれかを必ず定量化して指摘せよ：①FIRE後の配列リスク（退職時株式比率と暴落シナリオの影響額）②年金依存の落とし穴（充足率が低い場合の不足月数・不足額）③インフレ複利による実質目減り額（85歳時の購買力）④長寿リスクとp10シナリオでの破産年齢",
  "action":    "今すぐ着手すべき最優先アクションを1つ（具体的な数値・金額・期限を明記。「節約」「見直し」などの曖昧指示禁止）"
}

厳守ルール：
- 「素晴らしい」「安心」「問題ありません」「このまま継続」などの肯定表現は禁止。
- すべての文に受け取ったデータの数字を1つ以上使え。抽象的な言葉（「十分」「余裕」「リスクがあります」）は禁止。
- 成功率だけを根拠にするな。破産率・p10・年金充足率・シナリオ幅を使え。
- JSON以外の文字列を出力するな。"""

# =========================
# Request Model
# =========================
class DiagnosisRequest(BaseModel):
    # 基本成果
    success_rate:        float
    bankrupt_rate:       float | None = None
    assets_65man:        float
    fire_age:            int   | None = None
    monthly_expense:     float | None = None
    surplus_65man:       float | None = None
    need_at_65man:       float | None = None
    # 65歳時シナリオ幅
    p10_at65_man:        int   | None = None
    p90_at65_man:        int   | None = None
    # 入力パラメータ
    inflation_rate:      float | None = None
    stock_ratio_work:    float | None = None
    stock_ratio_retire:  float | None = None
    init_assets_man:     int   | None = None
    fire_thr_man:        int   | None = None
    annual_income_man:   int   | None = None
    is_dual:             bool  | None = None
    raise_rate_pct:      float | None = None
    monthly_pension_man: int   | None = None
    inheritance_man:     int   | None = None
    retire_years:        int   | None = None
    med_death_age:       int   | None = None
    fire_gap_man:        int   | None = None
    years_to_fire:       int   | None = None

# =========================
# エラー種別の分類
# =========================
def classify_error(e: Exception) -> tuple[int, str, str]:
    msg = str(e).lower()
    if any(k in msg for k in ("quota", "rate", "429", "overloaded")):
        return 429, "RATE_LIMIT",    "審査官が対応中です。しばらく待ってから再試行してください。"
    if any(k in msg for k in ("api_key", "401", "403")):
        return 503, "AUTH_ERROR",    "診断サービスに接続できません。"
    if any(k in msg for k in ("timeout", "deadline")):
        return 504, "TIMEOUT",       "分析に時間がかかりすぎました。再試行してください。"
    if any(k in msg for k in ("content", "safety", "blocked")):
        return 422, "CONTENT_BLOCK", "この入力に対して診断を生成できませんでした。"
    return 500, "INTERNAL_ERROR",    "診断サービスで予期しないエラーが発生しました。"

# =========================
# Gemini 呼び出しヘルパー
# =========================
def call_gemini(prompt: str, model: str) -> str:
    response = client.models.generate_content(
        model=model,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            max_output_tokens=600,
            temperature=0.3,
            response_mime_type="application/json",
        ),
        contents=prompt,
    )
    return response.text

# =========================
# JSON パース共通処理
#   すべての value を str 型に正規化（[object Object] 対策）
# =========================
def parse_gemini_json(raw_text) -> dict:
    if not isinstance(raw_text, str) or not raw_text.strip():
        return {"diagnosis": "AI応答が空または不正でした。再実行してください。", "blind_spot": "", "action": ""}
    cleaned = (
        raw_text.strip()
        .removeprefix("```json").removeprefix("```")
        .removesuffix("```").strip()
    )
    try:
        parsed = json.loads(cleaned)
        if not isinstance(parsed, dict):
            parsed = {"diagnosis": cleaned, "blind_spot": "", "action": ""}
    except json.JSONDecodeError:
        parsed = {"diagnosis": cleaned, "blind_spot": "", "action": ""}

    for key in ("diagnosis", "blind_spot", "action"):
        val = parsed.get(key, "")
        parsed[key] = val if isinstance(val, str) else json.dumps(val, ensure_ascii=False)

    return parsed

# =========================
# Health Check
# =========================
@app.get("/")
def root():
    return {"status": "ok"}

# =========================
# Diagnosis API
# =========================
@app.post("/api/diagnosis")
async def diagnosis(request: Request, data: DiagnosisRequest):
    # ── サーバー側クールタイムチェック ──
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    elapsed = now - _last_call[client_ip]
    if elapsed < COOLTIME_SECONDS:
        wait = int(COOLTIME_SECONDS - elapsed) + 1
        return JSONResponse(
            status_code=429,
            content={
                "error_code": "COOLTIME",
                "message": f"診断は{COOLTIME_SECONDS}秒に1回までです。あと{wait}秒お待ちください。",
                "retry_after": wait,
            },
        )
    _last_call[client_ip] = now

    try:
        print("===== REQUEST =====")
        print(data)

        # ── 基本値の取り出し ──
        pct        = round(data.success_rate * 100, 1)
        bankrupt   = round((data.bankrupt_rate or 0) * 100, 1) if data.bankrupt_rate is not None else None
        assets     = int(data.assets_65man)      if data.assets_65man      is not None else None
        surplus    = int(data.surplus_65man)     if data.surplus_65man     is not None else None
        need       = int(data.need_at_65man)     if data.need_at_65man     is not None else None
        p10        = data.p10_at65_man
        p90        = data.p90_at65_man
        monthly    = data.monthly_expense
        fire_age   = data.fire_age
        start_age  = data.years_to_fire and (fire_age - data.years_to_fire) or None  # 逆算
        init_a     = data.init_assets_man
        fire_thr   = data.fire_thr_man
        income     = data.annual_income_man
        is_dual    = data.is_dual
        raise_pct  = data.raise_rate_pct
        pension    = data.monthly_pension_man
        inherit    = data.inheritance_man
        retire_yrs = data.retire_years
        death_age  = data.med_death_age
        fire_gap   = data.fire_gap_man
        yrs_fire   = data.years_to_fire
        sw         = data.stock_ratio_work
        sr_r       = data.stock_ratio_retire
        infl_rate  = data.inflation_rate if data.inflation_rate is not None else 0.015

        # ── 成功率ラベル ──
        if pct >= 95:   sr_label = "一見合格圏だが油断は禁物"
        elif pct >= 85: sr_label = "合格水準だが改善余地あり"
        elif pct >= 70: sr_label = "要改善・現状維持では危険"
        else:           sr_label = "深刻・早急な対策が必要"

        # ── 各指標の計算 ──
        infl_pct     = round(infl_rate * 100, 1)
        fire_ref_age = fire_age or 65
        years_to_85  = max(0, 85 - fire_ref_age)
        real_monthly = round(monthly * (1 + infl_rate) ** years_to_85, 1) if monthly else None

        # 年金充足率
        pension_dep = round(pension / monthly * 100) if (pension and monthly and monthly > 0) else None

        # 65歳時シナリオ幅
        p_spread = (p90 - p10) if (p90 is not None and p10 is not None) else None

        # カバー率
        cover_pct = round(assets / need * 100) if (assets is not None and need and need > 0) else None

        # 現在資産が年収の何倍か
        income_multiple = round(init_a / income, 1) if (init_a is not None and income and income > 0) else None

        # 過不足ラベル
        if surplus is not None and surplus > 0:
            surplus_label = f"黒字{surplus:,}万（インフレ未考慮・名目値）"
        elif surplus == 0:
            surplus_label = "収支ゼロ（バッファなし）"
        elif surplus is not None:
            surplus_label = f"赤字{abs(surplus):,}万（不足確定）"
        else:
            surplus_label = "過不足：データなし"

        # ポートフォリオ
        if sw is not None and sr_r is not None:
            portfolio_str = (
                f"現役時 株式{int(sw)}%／現金{100-int(sw)}%  →  FIRE後 株式{int(sr_r)}%／現金{100-int(sr_r)}%"
            )
            if   int(sr_r) == 0:   portfolio_warn = "FIRE後全額現金→インフレ率{:.1f}%複利で実質資産が年々目減り".format(infl_pct)
            elif int(sr_r) >= 80:  portfolio_warn = "FIRE後株式{:d}%→退職直後の30%暴落で資産が一時{:,.0f}万円まで急落するリスク".format(int(sr_r), (assets or 0) * 0.7 if assets else 0)
            elif int(sw)   == 0:   portfolio_warn = "現役時全額現金→複利効果ゼロで機会損失が累積"
            else:                  portfolio_warn = ""
        else:
            portfolio_str = "ポートフォリオ構成：不明"
            portfolio_warn = ""

        # ── プロンプト構築 ──
        lines = ["【シミュレーション結果】"]
        lines.append(f"成功率: {pct}%（{sr_label}）")
        if bankrupt is not None:
            lines.append(f"破産率: {bankrupt}%（2,000回試算中約{round(bankrupt*20)}回が資産ゼロ到達）")

        lines.append("")
        lines.append("【資産予測】")
        if init_a is not None:
            lines.append(f"現在資産: {init_a:,}万円" + (f"（年収の{income_multiple}倍）" if income_multiple else ""))
        if fire_thr is not None:
            if fire_gap is not None and fire_gap > 0:
                lines.append(f"FIRE目標: {fire_thr:,}万円（残り{fire_gap:,}万円不足、あと{yrs_fire}年で達成見込み）" if yrs_fire else f"FIRE目標: {fire_thr:,}万円（残り{fire_gap:,}万円不足）")
            else:
                lines.append(f"FIRE目標: {fire_thr:,}万円（達成済み → {fire_age}歳でFIRE）")
        if assets is not None:
            lines.append(f"65歳時資産: 中央値{assets:,}万円" + (f" / 悲観p10={p10:,}万円 / 楽観p90={p90:,}万円（シナリオ幅{p_spread:,}万円）" if p_spread is not None else ""))
        if need is not None:
            lines.append(f"老後必要総額: {need:,}万円（{retire_yrs}年間）" if retire_yrs else f"老後必要総額: {need:,}万円")
        lines.append(f"過不足: {surplus_label}")
        if cover_pct is not None:
            lines.append(f"必要額カバー率: {cover_pct}%")

        lines.append("")
        lines.append("【収入・支出構造】")
        if income is not None:
            dual_str = "（共働き合算）" if is_dual else "（単身）"
            lines.append(f"年収: {income:,}万円{dual_str}、昇給率: {raise_pct}%/年" if raise_pct is not None else f"年収: {income:,}万円{dual_str}")
        if inherit is not None and inherit > 0:
            lines.append(f"相続予定: {inherit:,}万円（55〜70歳ごろ）")
        if monthly:
            pension_str = f"月額年金: {pension}万円（老後月支出の{pension_dep}%をカバー）" if pension_dep is not None else (f"月額年金: {pension}万円" if pension else "年金：未入力")
            lines.append(f"老後月支出: {monthly}万円 / {pension_str}")
        if real_monthly:
            lines.append(f"インフレ率{infl_pct}%適用 → 85歳時の月支出は{real_monthly}万円相当（現在比+{round(real_monthly - monthly, 1)}万円）")
        if death_age:
            lines.append(f"推定寿命（中央値）: {death_age}歳（老後{retire_yrs}年間）" if retire_yrs else f"推定寿命（中央値）: {death_age}歳")

        lines.append("")
        lines.append("【ポートフォリオ】")
        lines.append(portfolio_str)
        if portfolio_warn:
            lines.append(f"⚠️ {portfolio_warn}")

        prompt = "\n".join(lines)
        print(f"DEBUG: prompt chars={len(prompt)}")
        print(prompt)

        # PRIMARY(2.5-flash) → FALLBACK(2.5-flash-lite)
        raw_text   = None
        used_model = PRIMARY_MODEL
        try:
            raw_text = call_gemini(prompt, PRIMARY_MODEL)
            print(f"===== GEMINI SUCCESS ({PRIMARY_MODEL}) =====")
        except Exception as primary_err:
            if any(k in str(primary_err).lower() for k in
                   ("quota", "rate", "429", "overloaded", "unavailable")):
                print(f"WARN: primary failed → fallback to {FALLBACK_MODEL}: {primary_err}")
                used_model = FALLBACK_MODEL
                raw_text   = call_gemini(prompt, FALLBACK_MODEL)
                print(f"===== GEMINI SUCCESS ({FALLBACK_MODEL}) =====")
            else:
                raise

        print(raw_text)

        parsed = parse_gemini_json(raw_text)
        return {"analysis": parsed, "used_model": used_model}

    except Exception as e:
        status, code, user_msg = classify_error(e)
        print(f"ERROR [{code}] {type(e).__name__}: {e}")
        traceback.print_exc()
        return JSONResponse(
            status_code=status,
            content={"error_code": code, "message": user_msg},
        )
