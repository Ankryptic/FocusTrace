from fastapi import FastAPI
from pydantic import BaseModel

from app.classifier import classify_activity


app = FastAPI(
    title="FocusTrace AI Service",
    version="0.1.0",
)

class ActivityRequest(BaseModel):
    application: str
    windowTitle: str | None = None


@app.get("/")
def root():
    return {
        "success": True,
        "service": "FocusTrace AI",
        "message": "AI service is running",
    }


@app.get("/health")
def health():
    return {
        "success": True,
        "status": "healthy",
    }


@app.post("/classify")
def classify(request: ActivityRequest):
    result = classify_activity(
        request.application,
        request.windowTitle,
    );

    return {
        "success": True,
        "classification": result,
    }