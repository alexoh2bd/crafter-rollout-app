# Cursor (AI-assisted).
"""Storage smoke tests."""

import json

from app.storage import MetadataStore, RolloutWriter


def test_rollout_write_read(tmp_path):
    writer = RolloutWriter("sess-abc", data_dir=tmp_path)
    frames = [{"step": i, "obs": "abc", "action": 0, "reward": 0.0} for i in range(10)]
    for f in frames:
        writer.write(f)
    writer.close()

    lines = writer.path.read_text().strip().split("\n")
    assert len(lines) == 10
    assert json.loads(lines[0]) == frames[0]
    assert json.loads(lines[-1]) == frames[-1]


def test_metadata_session_lifecycle(tmp_path):
    store = MetadataStore(data_dir=tmp_path)
    store.create_session("sess-1", "human", 42, None, "human", tmp_path / "sess-1.jsonl")
    store.end_session("sess-1", 10)

    meta = store.get_session("sess-1")
    assert meta["session_id"] == "sess-1"
    assert meta["seed"] == 42
    assert meta["step_count"] == 10
    assert meta["ended_at"] is not None


def test_metadata_missing_returns_none(tmp_path):
    store = MetadataStore(data_dir=tmp_path)
    assert store.get_session("nonexistent") is None
