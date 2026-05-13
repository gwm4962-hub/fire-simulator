import os
import json
import traceback

from fastapi import FastAPI
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

# ① モデル優先度を逆転
#    通常は gemini-2.0-flash（quota余裕大）を使い、
#    失敗時のみ gemini-2.5-flash へフォールバック
PRIMARY_MODEL  = "gemini-2.0-flash"
FALLBACK_MODEL = "gemini-2.5-flash"

# =========================
# システムプロンプト
#    response_mime_type="application/json" と組み合わせ
#    マークダウン混入をプロトコルレベルで防止
# =========================
SYSTEM_PROMPT = """\
あなたは元・金融庁検査官で現在はFIREコンサルタントとして活動する辛口の資産審査の専門家。
モンテカルロ法による老後シミュレーション結果と、ユーザーの実際のポートフォリオ設定を受け取り、
以下のJSON形式のみで回答せよ。前置き・後書き・コードブロックは一切不要。

{
  "diagnosis": "現状の断定（1〜2文、必ず数字を含む）",
  "blind_spot": "ユーザーが気づいていない潜在リスク（1〜2文）。ポートフォリオ構成・インフレ・長寿・税制変更のいずれかに必ず言及",
  "action":    "今すぐ着手すべき具体的な行動を1つ（数値を使って指示）"
}

厳守ルール：
- 「素晴らしい」「安心」「このまま継続」などの肯定的表現は禁止。
- すべての文に数字を含める。「十分」「余裕」などの根拠なき抽象語は禁止。
- JSON以外の文字列を出力するな。\
"""

# =========================
# Request Model
# =========================
class DiagnosisRequest(BaseModel):
    success_rate:       float
    assets_65man:       float
    fire_age:           int   | None = None
    monthly_expense:    float | None = None
    surplus_65man:      float | None = None
    need_at_65man:      float | None = None
    inflation_rate:     float | None = None   # ユーザー設定値 例: 0.015
    stock_ratio_work:   float | None = None   # 現役時株式比率 0〜100
    stock_ratio_retire: float | None = None   # FIRE後株式比率 0〜100

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
    return 500,  "INTERNAL_ERROR",   "診断サービスで予期しないエラーが発生しました。"

# =========================
# Gemini呼び出しヘルパー
# =========================
def call_gemini(prompt: str, model: str) -> str:
    response = client.models.generate_content(
        model=model,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            max_output_tokens=400,
            temperature=0.3,
            response_mime_type="application/json",  # JSON出力をプロトコル強制
        ),
        contents=prompt,
    )
    return response.text

# =========================
# JSONパース共通処理
#   - フェンス除去
#   - パース
#   - キー補完
#   - すべてのvalueを必ずstr型に正規化  ← [object Object]対策の核心
# =========================
def parse_gemini_json(raw_text: str) -> dict:
    cleaned = (
        raw_text.strip()
        .removeprefix("```json").removeprefix("```")
        .removesuffix("```").strip()
    )
    try:
        parsed = json.loads(cleaned)
        # ネストしたオブジェクトが返ってきた場合もstr化して防衛
        if not isinstance(parsed, dict):
            parsed = {"diagnosis": cleaned, "blind_spot": "", "action": ""}
    except json.JSONDecodeError:
        parsed = {"diagnosis": cleaned, "blind_spot": "", "action": ""}

    # 必須キーが無ければ空文字で補完、値はすべてstrに正規化
    for key in ("diagnosis", "blind_spot", "action"):
        val = parsed.get(key, "")
        # dict / list など非文字列が入っていた場合は JSON 文字列化
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
async def diagnosis(data: DiagnosisRequest):
    try:
        print("===== REQUEST =====")
        print(data)

        # ─ 数値の整形 ─
        pct      = round(data.success_rate * 100, 1)
        assets   = int(data.assets_65man)
        surplus  = int(data.surplus_65man or 0)
        need     = int(data.need_at_65man or 0)
        monthly  = data.monthly_expense
        fire_age = data.fire_age

        # ─ 文脈ラベル ─
        if pct >= 95:   sr_label = "一見合格圏だが油断は禁物"
        elif pct >= 85: sr_label = "合格水準だが改善余地あり"
        elif pct >= 70: sr_label = "要改善・現状維持では危険"
        else:           sr_label = "深刻・早急な対策が必要"

        surplus_label = (
            f"黒字{surplus:,}万（インフレ未考慮）" if surplus > 0
            else "収支ゼロ（バッファなし）"          if surplus == 0
            else f"赤字{abs(surplus):,}万（不足確定）"
        )

        fire_str  = f"{fire_age}歳FIRE" if fire_age else "FIRE未達成（65歳まで就労前提）"
        exp_str   = f"老後月支出{monthly}万円" if monthly else "老後月支出不明"
        cover_str = f"必要額カバー率{round(assets/need*100)}%" if need > 0 else ""

        # ユーザーの実際のインフレ率で動的計算
        infl_rate    = data.inflation_rate if data.inflation_rate is not None else 0.015
        infl_pct     = round(infl_rate * 100, 1)
        years_to_85  = max(0, 85 - (fire_age or 65))
        real_monthly = round(monthly * (1 + infl_rate) ** years_to_85, 1) if monthly else None
        infl_str = (
            f"設定インフレ率{infl_pct}%／85歳時の月支出は{real_monthly}万円相当"
            if real_monthly else f"設定インフレ率{infl_pct}%"
        )

        # 長寿リスク
        longevity_str = (
            f"95歳まで生存した場合さらに{round(monthly*12*10):,}万円必要"
            if monthly and need > 0 else ""
        )

        # ポートフォリオ構成
        sw   = data.stock_ratio_work
        sr_r = data.stock_ratio_retire
        if sw is not None and sr_r is not None:
            portfolio_str = (
                f"ポートフォリオ：現役時 株式{int(sw)}%／現金{100-int(sw)}%、"
                f"FIRE後 株式{int(sr_r)}%／現金{100-int(sr_r)}%"
            )
            if   int(sr_r) == 0:   portfolio_risk = "⚠️ FIRE後全額現金→インフレ耐性ゼロ"
            elif int(sr_r) >= 90:  portfolio_risk = "⚠️ FIRE後株式集中→暴落時の配列リスクが極めて高い"
            elif int(sw)   == 0:   portfolio_risk = "⚠️ 現役時も全額現金→資産形成が極めて非効率"
            else:                  portfolio_risk = ""
        else:
            portfolio_str  = "ポートフォリオ構成：不明"
            portfolio_risk = ""

        # ─ プロンプト構築 ─
        lines = [
            "【シミュレーション結果】",
            f"成功率: {pct}%（{sr_label}）",
            f"65歳時点の資産: {assets:,}万円",
            f"老後必要総額: {need:,}万円",
            f"過不足: {surplus_label}",
        ]
        if cover_str:      lines.append(cover_str)
        lines += [f"FIRE: {fire_str}", exp_str, infl_str]
        if longevity_str:  lines.append(longevity_str)
        lines.append(portfolio_str)
        if portfolio_risk: lines.append(portfolio_risk)

        prompt = "\n".join(lines)
        print(f"DEBUG: prompt chars={len(prompt)}")

        # ① PRIMARY(2.0-flash) → FALLBACK(2.5-flash) の順で試行
        raw_text   = None
        used_model = PRIMARY_MODEL
        try:
            raw_text = call_gemini(prompt, PRIMARY_MODEL)
            print(f"===== GEMINI SUCCESS ({PRIMARY_MODEL}) =====")
        except Exception as primary_err:
            if any(k in str(primary_err).lower() for k in
                   ("quota", "rate", "429", "overloaded", "unavailable")):
                print(f"WARN: primary failed, falling back to {FALLBACK_MODEL}: {primary_err}")
                used_model = FALLBACK_MODEL
                raw_text   = call_gemini(prompt, FALLBACK_MODEL)
                print(f"===== GEMINI SUCCESS ({FALLBACK_MODEL}) =====")
            else:
                raise

        print(raw_text)

        # ② JSONパース（str正規化込み）
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
