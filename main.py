import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import google.generativeai as genai
import traceback

app = FastAPI()

# CORS設定（あなたのVercelドメインを許可）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://fire-simulator-rho-swart.vercel.app"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# RenderのEnvironmentタブで設定した名前と一致させる
API_KEY = os.environ.get("GEMINI_API_KEY")
genai.configure(api_key=API_KEY)

class DiagnosisRequest(BaseModel):
    success_rate: float
    assets_65man: float

@app.get("/")
def read_root():
    return {"status": "running"}

@app.post("/api/diagnosis")
async def analyze_life_plan(data: DiagnosisRequest):
    # 1. ログ出力（RenderのLogsで確認するため）
    print(f"--- Received Request ---")
    print(f"Success Rate: {data.success_rate}, Assets: {data.assets_65man}")
    
    if not API_KEY:
        print("ERROR: GEMINI_API_KEY is not set!")
        raise HTTPException(status_code=500, detail="API Key Missing")

    try:
        # 2. 最新のモデル名を指定
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        prompt = f"成功率{data.success_rate * 100}%、65歳資産{data.assets_65man}万円のFIRE計画を、エンジニア視点で100文字以内で分析して。"
        
        # 3. AIに送信
        response = model.generate_content(prompt)
        
        print("DEBUG: Gemini API Response Success")
        return {"analysis": response.text}

    except Exception as e:
        # 4. エラーの正体をログに叩き出す
        print(f"!!! CRITICAL ERROR !!!")
        print(str(e))
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))