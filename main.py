import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import google.generativeai as genai

app = FastAPI()

# 【重要】CORS設定：Vercelからのアクセスを許可する
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://fire-simulator-rho-swart.vercel.app", # あなたのVercelドメイン
        "http://localhost:3000", # ローカル開発用
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

# APIキーは、コードに直接書かず「環境変数」から読み込むのがプロの鉄則です
API_KEY = os.environ.get("GEMINI_API_KEY")
genai.configure(api_key=API_KEY)

class DiagnosisRequest(BaseModel):
    success_rate: float
    assets_65man: float

@app.post("/api/diagnosis")
async def analyze_life_plan(data: DiagnosisRequest):
    print(f"DEBUG: Received data - success_rate: {data.success_rate}, assets: {data.assets_65man}")
    if not API_KEY:
        print("ERROR: API_KEY is missing from environment variables!")
        raise HTTPException(status_code=500, detail="API Key not configured")
    
    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        prompt = f"成功率{data.success_rate * 100}%、65歳資産{data.assets_65man}万円の計画を分析して。"
        response = model.generate_content(prompt)
        return {"analysis": response.text}
    except Exception as e:
        # ここが重要！エラーの詳細をRenderのログに出力させる
        print(f"CRITICAL ERROR: {str(e)}") 
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # サーバーがポートを指定できるようにする
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)