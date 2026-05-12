import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import google.generativeai as genai
import traceback

app = FastAPI()

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://fire-simulator-rho-swart.vercel.app"],
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    print(f"--- Received Request ---")
    print(f"Success Rate: {data.success_rate}, Assets: {data.assets_65man}")
    
    if not API_KEY:
        print("ERROR: GEMINI_API_KEY is not set!")
        raise HTTPException(status_code=500, detail="API Key Missing")

    # ここから下のインデントが関数の内側に入っている必要があります
    try:
        # モデル名を明示的に指定
        model = genai.GenerativeModel('models/gemini-1.5-flash-latest')
        
        prompt = f"成功率{data.success_rate * 100}%、65歳資産{data.assets_65man}万円のFIRE計画を、エンジニア視点で100文字以内で分析して。"
        
        print("DEBUG: Attempting to generate content...")
        response = model.generate_content(prompt)
        
        print("DEBUG: Gemini API Response Success")
        return {"analysis": response.text}

    except Exception as e:
        print(f"!!! CRITICAL ERROR !!!")
        print(str(e))
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))