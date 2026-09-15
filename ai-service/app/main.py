import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.ocr import router as ocr_router
from app.api.v1.risk import router as risk_router
from app.api.v1.analytics import router as analytics_router

app = FastAPI(
    title="R-NLAM AI Microservice API",
    description=(
        "AI/ML Microservice for Real-Time National Land Acquisition & Management System (R-NLAM). "
        "Provides OCR Document AI entity extraction, AI Delay-Risk scoring engine, "
        "and Natural Language Analytics parser to SQL/GIS query translator."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# CORS Middleware Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers under /api/v1
app.include_router(ocr_router, prefix="/api/v1")
app.include_router(risk_router, prefix="/api/v1")
app.include_router(analytics_router, prefix="/api/v1")

@app.get("/", tags=["Health"])
async def root():
    return {
        "service": "R-NLAM AI Microservice",
        "status": "HEALTHY",
        "version": "1.0.0",
        "endpoints": [
            "/api/v1/ocr/extract-document",
            "/api/v1/risk/assess-delay",
            "/api/v1/analytics/nlp-query"
        ]
    }

@app.get("/health", tags=["Health"])
@app.get("/api/v1/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "service": "r-nlam-ai-service"}

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
