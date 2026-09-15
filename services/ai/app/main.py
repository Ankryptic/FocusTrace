from fastapi import FastAPI

app = FastAPI(
    title="FocusTrace AI Service",
    version="0.1.0",
)


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