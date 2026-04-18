"""FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Crafter Rollout Collector", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tightened via CORS_ORIGIN env var in prod (PR 7)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok"}


# REST routes and WebSocket handlers added in PR 7
