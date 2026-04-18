"""Rollout storage: JSONL writer and SQLite metadata store."""

from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DATA_DIR = Path(os.getenv("DATA_DIR", "data"))


class RolloutWriter:
    """Appends JSON-serialisable frame dicts to a per-session JSONL file."""

    def __init__(self, session_id: str, data_dir: Path = DATA_DIR) -> None:
        rollout_dir = data_dir / "rollouts"
        rollout_dir.mkdir(parents=True, exist_ok=True)
        self._path = rollout_dir / f"{session_id}.jsonl"
        self._f = self._path.open("a")

    def write(self, frame: dict[str, Any]) -> None:
        self._f.write(json.dumps(frame) + "\n")
        self._f.flush()

    def close(self) -> None:
        self._f.close()

    @property
    def path(self) -> Path:
        return self._path


class MetadataStore:
    """SQLite-backed session metadata store."""

    def __init__(self, data_dir: Path = DATA_DIR) -> None:
        data_dir.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(
            str(data_dir / "metadata.db"), check_same_thread=False
        )
        self._conn.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                session_id  TEXT PRIMARY KEY,
                mode        TEXT,
                seed        INTEGER,
                checkpoint_id TEXT,
                source      TEXT,
                started_at  TEXT,
                ended_at    TEXT,
                step_count  INTEGER DEFAULT 0,
                jsonl_path  TEXT
            )
        """)
        self._conn.commit()

    def create_session(
        self,
        session_id: str,
        mode: str,
        seed: int,
        checkpoint_id: str | None,
        source: str,
        jsonl_path: Path,
    ) -> None:
        self._conn.execute(
            "INSERT INTO sessions VALUES (?,?,?,?,?,?,?,?,?)",
            (
                session_id, mode, seed, checkpoint_id, source,
                datetime.now(timezone.utc).isoformat(),
                None, 0, str(jsonl_path),
            ),
        )
        self._conn.commit()

    def end_session(self, session_id: str, step_count: int) -> None:
        self._conn.execute(
            "UPDATE sessions SET ended_at=?, step_count=? WHERE session_id=?",
            (datetime.now(timezone.utc).isoformat(), step_count, session_id),
        )
        self._conn.commit()

    def get_session(self, session_id: str) -> dict[str, Any] | None:
        cur = self._conn.execute(
            "SELECT * FROM sessions WHERE session_id=?", (session_id,)
        )
        row = cur.fetchone()
        if row is None:
            return None
        return dict(zip([d[0] for d in cur.description], row))
