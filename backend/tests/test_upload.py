"""Checkpoint upload API tests."""

import json

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.policy import PolicyRegistry


@pytest.fixture
def client():
    return TestClient(app)


def test_upload_disabled_without_secret(client: TestClient) -> None:
    r = client.post(
        "/api/checkpoints/upload",
        files={"file": ("x.pt", b"fake-bytes", "application/octet-stream")},
        data={
            "checkpoint_id": "test_ckpt",
            "display_name": "Test",
            "ckpt_type": "random",
        },
    )
    assert r.status_code == 503


def test_upload_ok_writes_file_and_manifest(
    client: TestClient, tmp_path, monkeypatch
) -> None:
    monkeypatch.setenv("CHECKPOINT_UPLOAD_SECRET", "test-secret-123")
    monkeypatch.setenv("CHECKPOINTS_DIR", str(tmp_path))
    PolicyRegistry.clear_cache()

    payload = b"torch-bytes-placeholder"
    r = client.post(
        "/api/checkpoints/upload",
        files={"file": ("ignored.pt", payload, "application/octet-stream")},
        data={
            "checkpoint_id": "uploaded_policy",
            "display_name": "Uploaded",
            "ckpt_type": "random",
            "description": "from test",
        },
        headers={"X-Upload-Secret": "test-secret-123"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["checkpoint_id"] == "uploaded_policy"

    pt = tmp_path / "uploaded_policy.pt"
    assert pt.read_bytes() == payload

    manifest = json.loads((tmp_path / "manifest.json").read_text())
    ids = [c["checkpoint_id"] for c in manifest["checkpoints"]]
    assert "uploaded_policy" in ids


def test_upload_rejects_bad_secret(client: TestClient, tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("CHECKPOINT_UPLOAD_SECRET", "correct")
    monkeypatch.setenv("CHECKPOINTS_DIR", str(tmp_path))
    PolicyRegistry.clear_cache()

    r = client.post(
        "/api/checkpoints/upload",
        files={"file": ("x.pt", b"x", "application/octet-stream")},
        data={"checkpoint_id": "a", "display_name": "A"},
        headers={"X-Upload-Secret": "wrong"},
    )
    assert r.status_code == 403
