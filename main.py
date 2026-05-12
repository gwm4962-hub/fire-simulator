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

# =========================
# Health Check
# =========================
@app.get("/")
def root():
    return {
        "status": "ok"
    }

# =========================
# Diagnosis API
# =========================
@app.post("/api/diagnosis")
async def diagnosis(data: DiagnosisRequest):

    try:

        print("===== REQUEST =====")
        print(data)

        success_percent = round(data.success_rate * 100, 1)

        prompt = f"""
あなたは冷静な資産アドバイザーです。

成功率:
{success_percent}%

65歳時点資産:
{data.assets_65man}万円

このFIRE計画を100文字以内で分析してください。
短く、具体的に。
"""

        response = client.models.generate_content(
            model="gemini-2.0-flash-001",
            contents=prompt
        )

        print("===== GEMINI SUCCESS =====")

        return {
            "analysis": response.text
        }

    except Exception as e:

        print("===== ERROR =====")
        traceback.print_exc()

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )