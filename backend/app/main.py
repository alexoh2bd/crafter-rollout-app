"""FastAPI application — routes and WebSocket handlers."""

from __future__ import annotations

import asyncio
import concurrent.futures
import json
import os
import secrets
import re
import shutil
import tarfile
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path

import numpy as np
import torch

from fastapi import (
    FastAPI,
    File,
    Form,
    Header,
    HTTPException,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .checkpoint_bucket import (
    credentials_configured,
    fetch_object_bytes,
    inference_from_bucket,
    object_exists as s3_object_exists,
    s3_prefix,
    should_sync_from_bucket,
    sync_checkpoints_from_bucket,
    sync_manifest_to_disk,
    wants_s3_inference_env,
)
from .game_session import GameSession
from .hwm_model import HWMAgent, WMBaseAgent
from .policy import PolicyRegistry, checkpoints_dir
from .schemas import StartSessionRequest, StartSessionResponse
from .storage import MetadataStore, RolloutWriter
from .world_model import WorldModel

MAX_HUMAN_SESSIONS = 5
MAX_AGENT_SESSIONS = 2

_sessions: dict[str, GameSession] = {}
_writers: dict[str, RolloutWriter] = {}
_store: MetadataStore
_world_model: WorldModel | None = None
_wm_base_agent: WMBaseAgent | None = None
_hwm_agent_template: HWMAgent | None = None  # used as factory; per-session copies are made


def _ensure_manifest_seed() -> None:
    """If CHECKPOINTS_DIR is empty (e.g. new Railway volume), copy bundled manifest."""
    d = checkpoints_dir()
    d.mkdir(parents=True, exist_ok=True)
    mf = d / "manifest.json"
    if mf.is_file():
        return
    bundled = Path(__file__).resolve().parent.parent / "checkpoints" / "manifest.json"
    if bundled.is_file():
        shutil.copy(bundled, mf)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _store, _world_model, _wm_base_agent, _hwm_agent_template
    if wants_s3_inference_env() and not credentials_configured():
        raise RuntimeError(
            "CHECKPOINTS_INFERENCE_SOURCE is set but bucket credentials are missing "
            "(BUCKET / AWS_S3_BUCKET_NAME, ENDPOINT / AWS_ENDPOINT_URL, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)."
        )

    _ensure_manifest_seed()
    if should_sync_from_bucket():
        try:
            sync_checkpoints_from_bucket(checkpoints_dir())
        except Exception as exc:
            msg = f"checkpoint bucket sync failed: {exc}"
            if os.getenv("CHECKPOINTS_S3_REQUIRED", "").strip().lower() in ("1", "true", "yes", "on"):
                raise RuntimeError(msg) from exc
            print(f"Warning: {msg}. Using local/bundled checkpoints only.")
    _store = MetadataStore()

    wm_path = checkpoints_dir() / "lewm_base.pt"
    goal_lib_path = checkpoints_dir() / "goal_library.npz"
    hwm_path = checkpoints_dir() / "hwm_high.pt"

    if inference_from_bucket():
        try:
            sync_manifest_to_disk(checkpoints_dir())
        except Exception as exc:
            print(f"Warning: could not sync manifest.json from bucket: {exc}")

        try:
            lewm_bytes = fetch_object_bytes("lewm_base.pt")
            _world_model = WorldModel(checkpoint_bytes=lewm_bytes)
            print(
                f"World model loaded from bucket (latent_dim={_world_model.latent_dim})"
            )

            goal_lib_bytes: bytes | None = None
            try:
                goal_lib_bytes = fetch_object_bytes("goal_library.npz")
            except (FileNotFoundError, RuntimeError):
                pass

            _wm_base_agent = WMBaseAgent(
                _world_model,
                goal_library_bytes=goal_lib_bytes,
            )
            print(
                "WMBaseAgent ready"
                + (
                    f" with {len(_wm_base_agent.list_achievements())} goals"
                    if goal_lib_bytes
                    else " (no goal library)"
                )
            )

            hwm_bytes = fetch_object_bytes("hwm_high.pt")
            _hwm_agent_template = HWMAgent(
                _world_model,
                hwm_checkpoint_bytes=hwm_bytes,
                goal_library_bytes=goal_lib_bytes,
            )
            print(
                "HWMAgent loaded from bucket"
                + (
                    f" with {len(_hwm_agent_template.list_achievements())} goals"
                    if goal_lib_bytes
                    else " (no goal library)"
                )
            )
        except Exception as exc:
            print(f"Warning: failed to load models from bucket: {exc}")
    else:
        if wm_path.is_file():
            try:
                _world_model = WorldModel(str(wm_path))
                print(f"World model loaded from {wm_path} (latent_dim={_world_model.latent_dim})")

                goal_lib_str = str(goal_lib_path) if goal_lib_path.is_file() else None
                _wm_base_agent = WMBaseAgent(
                    _world_model,
                    goal_library_path=goal_lib_str,
                )
                print(
                    "WMBaseAgent ready"
                    + (
                        f" with {len(_wm_base_agent.list_achievements())} goals"
                        if goal_lib_str
                        else " (no goal library)"
                    )
                )
            except Exception as exc:
                print(f"Warning: failed to load world model from {wm_path}: {exc}")

        if wm_path.is_file() and hwm_path.is_file() and _world_model is not None:
            try:
                goal_lib_str = str(goal_lib_path) if goal_lib_path.is_file() else None
                _hwm_agent_template = HWMAgent(
                    _world_model,
                    hwm_ckpt_path=str(hwm_path),
                    goal_library_path=goal_lib_str,
                )
                print(
                    f"HWMAgent loaded from {hwm_path}"
                    + (
                        f" with {len(_hwm_agent_template.list_achievements())} goals"
                        if goal_lib_str
                        else " (no goal library)"
                    )
                )
            except Exception as exc:
                print(f"Warning: failed to load HWM from {hwm_path}: {exc}")

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


def _wm_checkpoint_source() -> str:
    """How weights are loaded: S3 inference mode, local disk, or unavailable."""
    if inference_from_bucket():
        return "s3_bucket"
    if _wm_base_agent is not None or _hwm_agent_template is not None:
        return "local_disk"
    return "none"


@app.get("/api/wm/goals")
async def list_wm_goals() -> dict:
    """Return available achievements from the goal library, plus model availability flags."""
    goals: list[str] = []
    if _wm_base_agent is not None:
        goals = _wm_base_agent.list_achievements()
    return {
        "goals": goals,
        "wm_base_available": _wm_base_agent is not None,
        "hwm_available": _hwm_agent_template is not None,
        "checkpoint_source": _wm_checkpoint_source(),
        "s3_prefix": s3_prefix() if inference_from_bucket() else None,
        "latent_dim": _world_model.latent_dim if _world_model is not None else None,
    }


@app.get("/api/checkpoints")
async def list_checkpoints() -> list[dict]:
    """List policy checkpoints that exist locally or in the bucket (S3 inference mode)."""
    out: list[dict] = []
    for c in PolicyRegistry.list_available():
        if inference_from_bucket():
            if s3_object_exists(c.path):
                out.append(c.__dict__)
        else:
            full = checkpoints_dir() / c.path
            if full.is_file():
                out.append(c.__dict__)
    return out


def _safe_checkpoint_id(checkpoint_id: str) -> str:
    cid = checkpoint_id.strip()
    if not re.match(r"^[a-zA-Z0-9_-]+$", cid):
        raise HTTPException(
            status_code=400,
            detail="checkpoint_id must contain only letters, digits, underscore, hyphen",
        )
    return cid


@app.post("/api/checkpoints/upload")
async def upload_checkpoint(
    file: UploadFile = File(...),
    checkpoint_id: str = Form(...),
    display_name: str = Form(...),
    ckpt_type: str = Form("ppo"),
    description: str = Form(""),
    x_upload_secret: str | None = Header(default=None, alias="X-Upload-Secret"),
) -> dict:
    """Upload a `.pt` file into CHECKPOINTS_DIR (e.g. Railway volume). Requires CHECKPOINT_UPLOAD_SECRET."""
    secret = os.getenv("CHECKPOINT_UPLOAD_SECRET")
    if not secret:
        raise HTTPException(
            status_code=503,
            detail="Checkpoint upload disabled. Set CHECKPOINT_UPLOAD_SECRET in the environment.",
        )
    received = (x_upload_secret or "").strip()
    expected = secret.strip()
    if len(received) != len(expected) or not secrets.compare_digest(received, expected):
        raise HTTPException(status_code=403, detail="Invalid upload secret")

    cid = _safe_checkpoint_id(checkpoint_id)
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file")

    dest_dir = checkpoints_dir()
    dest_dir.mkdir(parents=True, exist_ok=True)
    rel_name = f"{cid}.pt"
    dest_path = dest_dir / rel_name
    dest_path.write_bytes(raw)

    PolicyRegistry.upsert_manifest_entry(
        {
            "checkpoint_id": cid,
            "display_name": display_name.strip() or cid,
            "ckpt_type": ckpt_type.strip() or "ppo",
            "path": rel_name,
            "description": description.strip(),
        }
    )

    return {
        "checkpoint_id": cid,
        "path": rel_name,
        "message": "Checkpoint saved and manifest updated.",
    }


@app.post("/api/sessions", response_model=StartSessionResponse)
async def create_session(req: StartSessionRequest) -> StartSessionResponse:
    human_count = sum(1 for s in _sessions.values() if s.mode == "human")
    agent_count = sum(1 for s in _sessions.values() if s.mode in ("agent", "wm_base", "hwm"))

    if req.mode == "human" and human_count >= MAX_HUMAN_SESSIONS:
        raise HTTPException(429, "Max human sessions reached")
    if req.mode in ("agent", "wm_base", "hwm") and agent_count >= MAX_AGENT_SESSIONS:
        raise HTTPException(429, "Max agent sessions reached")
    if req.mode == "wm_base" and _wm_base_agent is None:
        raise HTTPException(503, "Base world model not loaded. Place lewm_base.pt in checkpoints/.")
    if req.mode == "hwm" and _hwm_agent_template is None:
        raise HTTPException(503, "HWM not loaded. Place lewm_base.pt and hwm_high.pt in checkpoints/.")

    session = GameSession(mode=req.mode, seed=req.seed, world_model=_world_model)
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
        elif session.mode == "imagination":
            init = json.loads(await ws.receive_text())
            K = int(init.get("K", 4))
            H = int(init.get("H", 16))
            await _imagination_loop(ws, session, writer, K, H)
        elif session.mode == "wm_base":
            init = json.loads(await ws.receive_text())
            await _wm_base_loop(ws, session, writer, init)
        elif session.mode == "hwm":
            init = json.loads(await ws.receive_text())
            await _hwm_loop(ws, session, writer, init)
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


async def _imagination_loop(
    ws: WebSocket,
    session: GameSession,
    writer: RolloutWriter,
    K: int,
    H: int,
) -> None:
    """Human-controlled game loop that also runs world-model imagination each step.

    Client sends:  {"action": int}
    Server sends:  {"frame": FrameMessage, "imagination": ImaginationMessage}

    If no world model is loaded, the imagination key is omitted.
    """
    while True:
        data = json.loads(await ws.receive_text())
        frame = session.step_human(int(data["action"]))
        row = frame.model_dump(mode="json")
        writer.write(row)

        payload: dict = {"frame": frame.model_dump(mode="json")}
        try:
            imagination = session.imagine_rollouts(K=K, H=H)
            payload["imagination"] = imagination.model_dump(mode="json")
        except RuntimeError:
            pass  # world model not loaded; client receives frame only

        await ws.send_text(json.dumps(payload))


async def _agent_loop(
    ws: WebSocket,
    session: GameSession,
    writer: RolloutWriter,
    checkpoint_id: str,
    fps: int,
) -> None:
    try:
        policy = PolicyRegistry.get(checkpoint_id)
    except KeyError as e:
        await ws.send_text(json.dumps({"error": str(e)}))
        return
    except Exception as e:
        await ws.send_text(
            json.dumps({"error": f"Failed to load checkpoint {checkpoint_id!r}: {e}"})
        )
        return

    interval = 1.0 / max(1, fps)
    try:
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
    except Exception as e:
        try:
            await ws.send_text(json.dumps({"error": f"Agent step failed: {e}"}))
        except Exception:
            pass


_wm_executor = concurrent.futures.ThreadPoolExecutor(max_workers=2)


async def _wm_base_loop(
    ws: WebSocket,
    session: GameSession,
    writer: RolloutWriter,
    init: dict,
) -> None:
    """Autonomous agent loop using flat CEM planning with the base LeWM.

    Init message fields:
        achievement  (str)  goal achievement name (required if goal library is loaded)
        H_lo         (int)  low-level CEM horizon        [default 10]
        n_samples    (int)  CEM population size          [default 100]
        n_iters      (int)  CEM refinement iterations    [default 3]
    """
    if _wm_base_agent is None:
        await ws.send_text(json.dumps({"error": "Base world model not available."}))
        return

    achievement = init.get("achievement", "")
    H_lo = int(init.get("H_lo", 10))
    n_samples = int(init.get("n_samples", 100))
    n_iters = int(init.get("n_iters", 3))
    n_elite = max(1, n_samples // 10)

    try:
        z_goal = _wm_base_agent.encode_goal(achievement) if achievement else None
    except Exception as exc:
        await ws.send_text(json.dumps({"error": f"Could not encode goal '{achievement}': {exc}"}))
        return

    if z_goal is None:
        # No goal library: sample a fixed random goal in latent space for exploration
        z_goal = torch.randn(_wm_base_agent._wm.latent_dim).numpy().astype("float32")

    loop = asyncio.get_event_loop()

    try:
        while True:
            obs = session.obs
            action, planning_ms, z_goal_dist = await loop.run_in_executor(
                _wm_executor,
                lambda: _wm_base_agent.plan_step(
                    obs, z_goal, H_lo=H_lo, n_samples=n_samples,
                    n_elite=n_elite, n_iters=n_iters,
                ),
            )
            frame = session.step_human(action, source="agent")
            # Attach planning metadata directly via model_dump + override
            row = frame.model_dump(mode="json")
            row["planning_ms"] = planning_ms
            row["z_goal_dist"] = z_goal_dist
            row["model_type"] = "wm_base"
            writer.write(row)
            await ws.send_text(json.dumps(row))
            await asyncio.sleep(0)  # yield to event loop
    except Exception as e:
        try:
            await ws.send_text(json.dumps({"error": f"WM step failed: {e}"}))
        except Exception:
            pass


async def _hwm_loop(
    ws: WebSocket,
    session: GameSession,
    writer: RolloutWriter,
    init: dict,
) -> None:
    """Autonomous agent loop using two-level CEM (ActionEncoder + HighLevelPredictor).

    Init message fields:
        achievement  (str)  goal achievement name (required)
        H_lo         (int)  low-level horizon             [default 10]
        H_hi         (int)  high-level horizon            [default 3]
        n_samples    (int)  CEM population size           [default 100]
        n_iters      (int)  CEM refinement iterations     [default 3]
    """
    if _hwm_agent_template is None:
        await ws.send_text(json.dumps({"error": "HWM not available."}))
        return

    achievement = init.get("achievement", "")
    H_lo = int(init.get("H_lo", 10))
    H_hi = int(init.get("H_hi", 3))
    n_samples = int(init.get("n_samples", 100))
    n_iters = int(init.get("n_iters", 3))
    n_elite = max(1, n_samples // 10)

    # Fresh per-session state; reuse weights loaded at startup (disk or bucket)
    hwm_agent = _hwm_agent_template.clone_for_session()

    try:
        z_goal = hwm_agent.encode_goal(achievement) if achievement else None
    except Exception as exc:
        await ws.send_text(json.dumps({"error": f"Could not encode goal '{achievement}': {exc}"}))
        return

    if z_goal is None:
        z_goal = np.zeros(hwm_agent._wm.latent_dim, dtype="float32")

    loop = asyncio.get_event_loop()

    try:
        while True:
            obs = session.obs
            action, planning_ms, z_goal_dist = await loop.run_in_executor(
                _wm_executor,
                lambda: hwm_agent.plan_step(
                    obs, z_goal,
                    H_lo=H_lo, H_hi=H_hi,
                    n_samples_lo=n_samples, n_samples_hi=n_samples,
                    n_elite_lo=n_elite, n_elite_hi=n_elite,
                    n_iters=n_iters,
                ),
            )
            frame = session.step_human(action, source="agent")
            row = frame.model_dump(mode="json")
            row["planning_ms"] = planning_ms
            row["z_goal_dist"] = z_goal_dist
            row["model_type"] = "hwm"
            writer.write(row)
            await ws.send_text(json.dumps(row))
            await asyncio.sleep(0)
    except Exception as e:
        try:
            await ws.send_text(json.dumps({"error": f"HWM step failed: {e}"}))
        except Exception:
            pass
