from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api.openai_routes import router as openai_router
import os

app = FastAPI(title="ECHO AI Backend (V2)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(openai_router)

@app.get("/")
def read_root():
    return {"status": "ECHO V2 is online"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
