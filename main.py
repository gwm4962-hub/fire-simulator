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
- JSON以外の文字列を出力するな。"""

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
    inflation_rate:     float | None = None
    stock_ratio_work:   float | None = None
    stock_ratio_retire: float | None = None

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
            max_output_tokens=400,
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

        pct      = round(data.success_rate * 100, 1)
        assets   = int(data.assets_65man)   if data.assets_65man   is not None else None
        surplus  = int(data.surplus_65man)  if data.surplus_65man  is not None else None
        need     = int(data.need_at_65man)  if data.need_at_65man  is not None else None
        monthly  = data.monthly_expense
        fire_age = data.fire_age

        if pct >= 95:   sr_label = "一見合格圏だが油断は禁物"
        elif pct >= 85: sr_label = "合格水準だが改善余地あり"
        elif pct >= 70: sr_label = "要改善・現状維持では危険"
        else:           sr_label = "深刻・早急な対策が必要"

        surplus_label = (
            f"黒字{surplus:,}万（インフレ未考慮）" if surplus is not None and surplus > 0
            else "収支ゼロ（バッファなし）"          if surplus == 0
            else f"赤字{abs(surplus):,}万（不足確定）" if surplus is not None
            else "過不足：データなし"
        )

        fire_str  = f"{fire_age}歳FIRE" if fire_age else "FIRE未達成（65歳まで就労前提）"
        exp_str   = f"老後月支出{monthly}万円" if monthly else "老後月支出：未入力"
        cover_str = f"必要額カバー率{round(assets/need*100)}%" if (assets and need) else ""

        infl_rate    = data.inflation_rate if data.inflation_rate is not None else 0.015
        infl_pct     = round(infl_rate * 100, 1)
        years_to_85  = max(0, 85 - (fire_age or 65))
        real_monthly = round(monthly * (1 + infl_rate) ** years_to_85, 1) if monthly else None
        infl_str = (
            f"設定インフレ率{infl_pct}%／85歳時の月支出は{real_monthly}万円相当"
            if real_monthly else f"設定インフレ率{infl_pct}%"
        )

        longevity_str = (
            f"95歳まで生存した場合さらに{round(monthly*12*10):,}万円必要"
            if (monthly and need) else ""
        )

        sw   = data.stock_ratio_work
        sr_r = data.stock_ratio_retire
        if sw is not None and sr_r is not None:
            portfolio_str = (
                f"ポートフォリオ：現役時 株式{int(sw)}%／現金{100-int(sw)}%、"
                f"FIRE後 株式{int(sr_r)}%／現金{100-int(sr_r)}%"
            )
            if   int(sr_r) == 0:  portfolio_risk = "⚠️ FIRE後全額現金→インフレ耐性ゼロ"
            elif int(sr_r) >= 90: portfolio_risk = "⚠️ FIRE後株式集中→暴落時の配列リスクが極めて高い"
            elif int(sw)   == 0:  portfolio_risk = "⚠️ 現役時も全額現金→資産形成が極めて非効率"
            else:                 portfolio_risk = ""
        else:
            portfolio_str  = "ポートフォリオ構成：不明"
            portfolio_risk = ""

        lines = [
            "【シミュレーション結果】",
            f"成功率: {pct}%（{sr_label}）",
        ]
        if assets is not None: lines.append(f"65歳時点の資産: {assets:,}万円")
        if need   is not None: lines.append(f"老後必要総額: {need:,}万円")
        lines.append(f"過不足: {surplus_label}")
        if cover_str:      lines.append(cover_str)
        lines += [f"FIRE: {fire_str}", exp_str, infl_str]
        if longevity_str:  lines.append(longevity_str)
        lines.append(portfolio_str)
        if portfolio_risk: lines.append(portfolio_risk)

        prompt = "\n".join(lines)
        print(f"DEBUG: prompt chars={len(prompt)}")

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
