import os
import traceback

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from google import genai

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
# Request Model
# =========================
class DiagnosisRequest(BaseModel):
    success_rate: float
    assets_65man: float
    fire_age: int | None = None
    monthly_expense: float | None = None
    surplus_65man: float | None = None  # 追加
    need_at_65man: float | None = None  # 追加
# =========================
# Health Check
# =========================
@app.get("/")
def root():
    return {"status": "ok"}

# =========================
# Diagnosis API
# =========================
# =========================
# Diagnosis API
# =========================
@app.post("/api/diagnosis")
async def diagnosis(data: DiagnosisRequest):
    try:
        print("===== REQUEST =====")
        print(data)

        success_percent = round(data.success_rate * 100, 1)
        surplus = data.surplus_65man if data.surplus_65man is not None else 0
        shortage_text = f"老後資金{abs(int(surplus))}万円不足" if surplus < 0 else "老後資金は黒字"

        # 指摘1: ここをtryの配下（半角スペース8つ分）に揃える
        prompt = f"""
FIRE計画を診断。80字以内で日本語回答。
成功率:{success_percent}% 65歳資産:{data.assets_65man}万円 必要額:{data.need_at_65man}万円 過不足:{surplus}万円 FIRE年齢:{data.fire_age}歳 月支出:{data.monthly_expense}万円

ルール:
- 過不足がマイナス → 成功率問わず「{shortage_text}」を必ず冒頭に指摘
- 成功率<80% → 要改善
- 成功率≧95% かつ 過不足>0 → 合格
- 数値根拠で1文、核心を突く"""

        # 指摘2: ここも同じ深さに揃える
        print("DEBUG: Calling Gemini API...")

        response = client.models.generate_content(
            model="gemini-2.5-flash", # 画像に基づき修正
            contents=prompt
        )

        print("===== GEMINI SUCCESS =====")
        print(response.text)

        return {"analysis": response.text}

    except Exception as e: # 指摘3: tryと縦のラインを完全に合わせる
        err_type = type(e).__name__
        err_msg = str(e)
        print(f"ERROR TYPE: {err_type}")
        print(f"ERROR MESSAGE: {err_msg}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=err_msg)