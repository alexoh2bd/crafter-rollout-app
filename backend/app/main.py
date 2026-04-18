"""FastAPI application — routes and WebSocket handlers."""

from __future__ import annotations

import asyncio
import json
import os
import tarfile
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .game_session import GameSession
from .policy import PolicyRegistry
from .schemas import StartSessionRequest, StartSessionResponse
from .storage import MetadataStore, RolloutWriter

MAX_HUMAN_SESSIONS = 5
MAX_AGENT_SESSIONS = 2

_sessions: dict[str, GameSession] = {}
_writers: dict[str, RolloutWriter] = {}
_store: MetadataStore


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _store
    _store = MetadataStore()
    yield


app = FastAPI(title="Crafter Rollout Collector", version="0.1.0", lifespan=lifespan)

cors_origin = os.getenv("CORS_ORIGIN", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[cors_origin] if cors_origin != "*" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------


@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok"}


@app.get("/api/checkpoints")
async def list_checkpoints() -> list[dict]:
    return [c.__dict__ for c in PolicyRegistry.list_available()]


@app.post("/api/sessions", response_model=StartSessionResponse)
async def create_session(req: StartSessionRequest) -> StartSessionResponse:
    human_count = sum(1 for s in _sessions.values() if s.mode == "human")
    agent_count = sum(1 for s in _sessions.values() if s.mode == "agent")

    if req.mode == "human" and human_count >= MAX_HUMAN_SESSIONS:
        raise HTTPException(429, "Max human sessions reached")
    if req.mode == "agent" and agent_count >= MAX_AGENT_SESSIONS:
        raise HTTPException(429, "Max agent sessions reached")

    session = GameSession(mode=req.mode, seed=req.seed)
    writer = RolloutWriter(session.session_id)
    _sessions[session.session_id] = session
    _writers[session.session_id] = writer

    source = "agent" if req.mode == "agent" else "human"
    _store.create_session(
        session.session_id, req.mode, session.seed, None, source, writer.path
    )

    return StartSessionResponse(session_id=session.session_id, seed=session.seed)


@app.delete("/api/sessions/{session_id}")
async def close_session(session_id: str) -> dict:
    session = _sessions.pop(session_id, None)
    writer = _writers.pop(session_id, None)
    if session is None:
        raise HTTPException(404, "Session not found")
    _store.end_session(session_id, session._step_count)
    if writer:
        writer.close()
    session.close()
    return {"status": "closed"}


@app.get("/api/rollouts/{session_id}/download")
async def download_rollout(session_id: str) -> FileResponse:
    meta = _store.get_session(session_id)
    if meta is None:
        raise HTTPException(404, "Rollout not found")
    jsonl_path = Path(meta["jsonl_path"])
    if not jsonl_path.exists():
        raise HTTPException(404, "Rollout file not found")

    tmp = tempfile.NamedTemporaryFile(suffix=".tar.gz", delete=False)
    with tarfile.open(tmp.name, "w:gz") as tar:
        tar.add(jsonl_path, arcname=jsonl_path.name)

    return FileResponse(
        tmp.name,
        media_type="application/gzip",
        filename=f"rollout_{session_id}.tar.gz",
    )


# ---------------------------------------------------------------------------
# WebSocket
# ---------------------------------------------------------------------------


@app.websocket("/ws/{session_id}")
async def websocket_endpoint(ws: WebSocket, session_id: str) -> None:
    await ws.accept()
    session = _sessions.get(session_id)
    if session is None:
        await ws.close(code=4004, reason="Session not found")
        return

    writer = _writers[session_id]

    try:
        if session.mode == "human":
            await _human_loop(ws, session, writer)
        elif session.mode == "agent":
            init = json.loads(await ws.receive_text())
            checkpoint_id = init["checkpoint_id"]
            fps = int(init.get("fps", 4))
            await _agent_loop(ws, session, writer, checkpoint_id, fps)
    except WebSocketDisconnect:
        pass
    finally:
        _store.end_session(session_id, session._step_count)
        writer.close()
        _sessions.pop(session_id, None)
        _writers.pop(session_id, None)
        session.close()


async def _human_loop(
    ws: WebSocket, session: GameSession, writer: RolloutWriter
) -> None:
    while True:
        data = json.loads(await ws.receive_text())
        frame = session.step_human(int(data["action"]))
        row = frame.model_dump(mode="json")
        writer.write(row)
        await ws.send_text(frame.model_dump_json())


async def _agent_loop(
    ws: WebSocket,
    session: GameSession,
    writer: RolloutWriter,
    checkpoint_id: str,
    fps: int,
) -> None:
    policy = PolicyRegistry.get(checkpoint_id)
    interval = 1.0 / max(1, fps)
    while True:
        result = policy.act(session.obs)
        frame = session.step_human(
            result.action,
            source="agent",
            checkpoint_id=checkpoint_id,
            action_probs=result.action_probs.tolist(),
            value_estimate=result.value,
        )
        row = frame.model_dump(mode="json")
        writer.write(row)
        await ws.send_text(frame.model_dump_json())
        await asyncio.sleep(interval)
