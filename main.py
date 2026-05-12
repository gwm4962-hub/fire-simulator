import os
import traceback

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from google import genai
from google.genai import types

app = FastAPI()

# =========================
# CORS
# =========================
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://fire-simulator-rho-swart.vercel.app"
    ],
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
# システムプロンプト（役割定義を分離）
# contentsに混ぜず system_instruction に置くことで
# ・データと役割の混同を防ぎ診断精度が上がる
# ・temperature低めで金融診断の出力を安定させる
# =========================
SYSTEM_PROMPT = """あなたはFIREプランナーAI「FLOW診断」。
モンテカルロ法で試算した資産シミュレーション結果を読み取り、
日本語で核心的な2〜3文の診断コメントを返す専門家。
出力ルール：
- マークダウン・箇条書き・見出し禁止。文章のみ。
- 数字を必ず使って根拠を示す。
- 老後資金が赤字なら必ず冒頭で不足額と深刻度を指摘。
- 成功率と過不足に矛盾がある場合（例：高成功率なのに赤字）はその理由を推察。
- 最後に最優先アクションを1つだけ具体的に提案。
- 120字以内に収める。"""

# =========================
# Request Model
# =========================
class DiagnosisRequest(BaseModel):
    success_rate: float
    assets_65man: float
    fire_age: int | None = None
    monthly_expense: float | None = None   # 老後の月支出見込み（万円）
    surplus_65man: float | None = None
    need_at_65man: float | None = None

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

        # --- 数値の整形 ---
        pct     = round(data.success_rate * 100, 1)
        assets  = int(data.assets_65man)
        surplus = int(data.surplus_65man or 0)   # 負=不足
        need    = int(data.need_at_65man or 0)
        monthly = data.monthly_expense           # 老後の月支出見込み（万円）
        fire_age = data.fire_age                 # 歳 or None

        # --- 文脈ラベル（Geminiの判断材料を前処理で補強） ---
        if pct >= 95:   sr_label = "優秀"
        elif pct >= 85: sr_label = "良好"
        elif pct >= 70: sr_label = "要改善"
        else:           sr_label = "危険"

        surplus_label = (
            f"黒字{surplus:,}万"
            if surplus >= 0
            else f"赤字{abs(surplus):,}万（要対策）"
        )

        fire_str = f"{fire_age}歳でFIRE達成" if fire_age else "FIRE未達成"
        exp_str  = f"老後月支出{monthly}万" if monthly else ""

        # カバー率（資産/必要額）：高成功率なのに赤字などの矛盾検出に有効
        cover_str = (
            f"カバー率{round(assets / need * 100)}%"
            if need > 0 else ""
        )

        # --- データのみをcontentsに渡す（役割定義はsystem_instructionで分離済み） ---
        prompt = (
            f"成功率:{pct}%({sr_label})|"
            f"65歳資産:{assets:,}万|必要額:{need:,}万|過不足:{surplus_label}|"
            f"{fire_str}|{exp_str}|{cover_str}"
        )

        print(f"DEBUG: prompt chars={len(prompt)}")

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                max_output_tokens=200,   # 120字 ≒ 200トークン以内で抑制
                temperature=0.4,         # 金融診断は低めで安定させる
            ),
            contents=prompt,
        )

        print("===== GEMINI SUCCESS =====")
        print(response.text)

        return {"analysis": response.text}

    except Exception as e:
        err_type = type(e).__name__
        err_msg  = str(e)
        print(f"ERROR TYPE: {err_type}")
        print(f"ERROR MSG : {err_msg}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=err_msg)
