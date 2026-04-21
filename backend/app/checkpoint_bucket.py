# Cursor (AI-assisted).
"""Railway S3 bucket integration for checkpoints.

Primary env names (Railway bucket → service references):

  BUCKET, ENDPOINT, ACCESS_KEY_ID, SECRET_ACCESS_KEY, REGION (optional, default auto)

Also accepted (AWS-style / other templates; first non-empty wins):

  AWS_S3_BUCKET, AWS_S3_BUCKET_NAME, or S3_BUCKET for bucket name
  AWS_ENDPOINT_URL or AWS_S3_ENDPOINT or S3_ENDPOINT for the S3 API URL
  AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
  AWS_DEFAULT_REGION or AWS_REGION

Other:

  CHECKPOINTS_S3_PREFIX — object key prefix (default: checkpoints), must match upload script
  CHECKPOINTS_S3_DISABLE — if 1/true, never sync from bucket
  CHECKPOINTS_S3_FORCE — if 1/true, re-download even when files already exist locally
  CHECKPOINTS_INFERENCE_SOURCE — if s3/bucket/1/true, load weights from the bucket into RAM at
    startup (and for policies on first use). Skips downloading weights to disk (sync_checkpoints_from_bucket).

Use ``describe_bucket_env_sources()`` to log which variable names resolved (no secrets).
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

_DEFAULT_PREFIX = "checkpoints"

# Railway bucket UI uses BUCKET / ENDPOINT / ACCESS_KEY_ID / SECRET_ACCESS_KEY.
# AWS SDK presets (and some templates) often expose AWS_* names — accept both.
_BUCKET_KEYS = ("BUCKET", "AWS_S3_BUCKET", "AWS_S3_BUCKET_NAME", "S3_BUCKET")
_ENDPOINT_KEYS = ("ENDPOINT", "AWS_ENDPOINT_URL", "AWS_S3_ENDPOINT", "S3_ENDPOINT")
_ACCESS_KEYS = ("ACCESS_KEY_ID", "AWS_ACCESS_KEY_ID")
_SECRET_KEYS = ("SECRET_ACCESS_KEY", "AWS_SECRET_ACCESS_KEY")
_REGION_KEYS = ("REGION", "AWS_DEFAULT_REGION", "AWS_REGION")


def _env_first(*keys: str) -> tuple[str, str | None]:
    """Return (value, first env key that was set and non-empty)."""
    for k in keys:
        v = os.getenv(k, "").strip()
        if v:
            return v, k
    return "", None


def bucket_credentials() -> tuple[str, str, str, str, str]:
    """Resolve (bucket, endpoint, access_key, secret, region) from environment."""
    bucket, _ = _env_first(*_BUCKET_KEYS)
    endpoint, _ = _env_first(*_ENDPOINT_KEYS)
    access, _ = _env_first(*_ACCESS_KEYS)
    secret, _ = _env_first(*_SECRET_KEYS)
    region, _ = _env_first(*_REGION_KEYS)
    if not region:
        region = "auto"
    return bucket, endpoint, access, secret, region


def describe_bucket_env_sources() -> dict[str, str | None]:
    """Which env var names were used (no secret values). For debugging Railway vs local."""
    _, kb = _env_first(*_BUCKET_KEYS)
    _, ke = _env_first(*_ENDPOINT_KEYS)
    _, ka = _env_first(*_ACCESS_KEYS)
    _, ks = _env_first(*_SECRET_KEYS)
    _, kr = _env_first(*_REGION_KEYS)
    return {
        "BUCKET": kb,
        "ENDPOINT": ke,
        "ACCESS_KEY_ID": ka,
        "SECRET_ACCESS_KEY": ks,
        "REGION": kr,
    }


def _validate_s3_endpoint(endpoint: str) -> None:
    e = endpoint.strip().lower().rstrip("/")
    if ".up.railway.app" in e:
        raise ValueError(
            "ENDPOINT looks like a Railway app URL, not the bucket S3 API. "
            "Use the value from Bucket → Credentials (e.g. https://storage.railway.app)."
        )


def credentials_configured() -> bool:
    b, e, a, s, _ = bucket_credentials()
    return bool(b and e and a and s)


def wants_s3_inference_env() -> bool:
    v = os.getenv("CHECKPOINTS_INFERENCE_SOURCE", "").strip().lower()
    return v in ("s3", "bucket", "1", "true", "yes", "on")


def inference_from_bucket() -> bool:
    """When True, models load from S3 into memory; large files are not mirrored to disk."""
    return wants_s3_inference_env() and credentials_configured()


def should_sync_from_bucket() -> bool:
    if os.getenv("CHECKPOINTS_S3_DISABLE", "").strip().lower() in ("1", "true", "yes", "on"):
        return False
    if inference_from_bucket():
        return False
    return credentials_configured()


def s3_prefix() -> str:
    return os.getenv("CHECKPOINTS_S3_PREFIX", _DEFAULT_PREFIX).strip().strip("/")


def _s3_key(prefix: str, filename: str) -> str:
    p = prefix.strip().strip("/")
    if p:
        return f"{p}/{filename}"
    return filename


def build_s3_client() -> tuple[Any, str]:
    """Create a boto3 S3 client from resolved :func:`bucket_credentials`."""
    bucket, endpoint, access, secret, region = bucket_credentials()
    missing: list[str] = []
    if not bucket:
        missing.append("BUCKET (or AWS_S3_BUCKET / AWS_S3_BUCKET_NAME)")
    if not endpoint:
        missing.append("ENDPOINT (or AWS_ENDPOINT_URL)")
    if not access:
        missing.append("ACCESS_KEY_ID (or AWS_ACCESS_KEY_ID)")
    if not secret:
        missing.append("SECRET_ACCESS_KEY (or AWS_SECRET_ACCESS_KEY)")
    if missing:
        raise ValueError(
            "Missing bucket configuration: " + ", ".join(missing)
        )

    _validate_s3_endpoint(endpoint)
    cfg = Config(
        retries={"max_attempts": 10, "mode": "adaptive"},
        connect_timeout=60,
        read_timeout=300,
        s3={"addressing_style": "auto"},
    )
    client = boto3.client(
        "s3",
        endpoint_url=endpoint.rstrip("/"),
        aws_access_key_id=access,
        aws_secret_access_key=secret,
        region_name=region,
        config=cfg,
    )
    return client, bucket


def _s3_client():
    try:
        return build_s3_client()
    except ValueError as e:
        raise RuntimeError(str(e)) from e


def _collect_paths_from_manifest(data: dict[str, Any]) -> list[str]:
    paths: list[str] = []
    for section in ("checkpoints", "world_models", "goal_libraries"):
        for entry in data.get(section, []) or []:
            rel = entry.get("path")
            if not rel or not isinstance(rel, str):
                continue
            if ".placeholder" in rel:
                continue
            paths.append(rel)
    # de-dupe, stable order
    seen: set[str] = set()
    out: list[str] = []
    for p in paths:
        if p not in seen:
            seen.add(p)
            out.append(p)
    return out


def _default_paths_if_no_manifest() -> list[str]:
    """Fallback asset list when manifest has no path entries (manifest.json is already on disk)."""
    return [
        "lewm_base.pt",
        "hwm_high.pt",
        "goal_library.npz",
    ]


def fetch_object_bytes(rel: str) -> bytes:
    """Fetch ``{prefix}/{rel}`` from the bucket and return raw bytes (full object in memory)."""
    client, bucket = _s3_client()
    prefix = s3_prefix()
    key = _s3_key(prefix, rel)
    try:
        resp = client.get_object(Bucket=bucket, Key=key)
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "")
        if code in ("404", "NoSuchKey"):
            raise FileNotFoundError(f"s3://{bucket}/{key}") from e
        raise RuntimeError(f"Failed to get s3://{bucket}/{key}: {e}") from e
    except BotoCoreError as e:
        raise RuntimeError(f"Failed to get s3://{bucket}/{key}: {e}") from e
    return resp["Body"].read()


def object_exists(rel: str) -> bool:
    """Return True if ``{prefix}/{rel}`` exists in the bucket."""
    client, bucket = _s3_client()
    key = _s3_key(s3_prefix(), rel)
    try:
        client.head_object(Bucket=bucket, Key=key)
        return True
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "")
        if code in ("404", "NotFound", "NoSuchKey"):
            return False
        raise


def sync_manifest_to_disk(dest: Path) -> None:
    """Download only ``manifest.json`` for PolicyRegistry / listing when using S3 inference."""
    client, bucket = _s3_client()
    prefix = s3_prefix()
    key = _s3_key(prefix, "manifest.json")
    dest = dest.resolve()
    dest.mkdir(parents=True, exist_ok=True)
    manifest_path = dest / "manifest.json"
    print(f"checkpoint_bucket: fetching manifest s3://{bucket}/{key} -> {manifest_path}")
    _atomic_download(client, bucket, key, manifest_path)


def _atomic_download(client, bucket: str, key: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_name(dest.name + ".part")
    try:
        client.download_file(bucket, key, str(tmp))
        tmp.replace(dest)
    except Exception:
        if tmp.is_file():
            tmp.unlink(missing_ok=True)
        raise


def sync_checkpoints_from_bucket(dest: Path) -> dict[str, Any]:
    """Pull manifest and all referenced assets from the bucket into ``dest``.

    Returns a small summary dict for logging. Raises on hard failures (e.g. missing manifest in bucket).
    """
    client, bucket = _s3_client()
    prefix = s3_prefix()
    force = os.getenv("CHECKPOINTS_S3_FORCE", "").strip().lower() in ("1", "true", "yes", "on")

    dest = dest.resolve()
    dest.mkdir(parents=True, exist_ok=True)

    manifest_key = _s3_key(prefix, "manifest.json")
    manifest_path = dest / "manifest.json"

    print(f"checkpoint_bucket: fetching s3://{bucket}/{manifest_key}")
    try:
        _atomic_download(client, bucket, manifest_key, manifest_path)
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "")
        if code in ("404", "NoSuchKey"):
            raise RuntimeError(
                f"Manifest not found at s3://{bucket}/{manifest_key}. "
                "Upload with scripts/sync_railway_bucket_world_model.py or fix CHECKPOINTS_S3_PREFIX."
            ) from e
        raise RuntimeError(f"Failed to download manifest: {e}") from e
    except BotoCoreError as e:
        raise RuntimeError(f"Failed to download manifest: {e}") from e

    try:
        data = json.loads(manifest_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Invalid manifest.json from bucket: {e}") from e

    rel_paths = _collect_paths_from_manifest(data)
    if not rel_paths:
        rel_paths = _default_paths_if_no_manifest()

    # Ensure manifest.json is not listed twice; downloads use relative paths under dest
    to_fetch = []
    for rel in rel_paths:
        rel = rel.strip().lstrip("/")
        if not rel or ".placeholder" in rel:
            continue
        to_fetch.append(rel)

    summary: dict[str, Any] = {"downloaded": [], "skipped": [], "errors": []}

    for rel in to_fetch:
        local = dest / rel
        if (
            not force
            and local.is_file()
            and local.stat().st_size > 0
        ):
            summary["skipped"].append(rel)
            continue
        key = _s3_key(prefix, rel)
        try:
            print(f"checkpoint_bucket: downloading s3://{bucket}/{key} -> {local}")
            _atomic_download(client, bucket, key, local)
            summary["downloaded"].append(rel)
        except ClientError as e:
            code = e.response.get("Error", {}).get("Code", "")
            msg = f"{rel}: {e}"
            summary["errors"].append(msg)
            if code in ("404", "NoSuchKey"):
                print(f"checkpoint_bucket: warning — object missing in bucket: {key}")
            else:
                print(f"checkpoint_bucket: error — {msg}")
        except BotoCoreError as e:
            summary["errors"].append(f"{rel}: {e}")
            print(f"checkpoint_bucket: error — {rel}: {e}")

    print(
        f"checkpoint_bucket: done — downloaded={len(summary['downloaded'])} "
        f"skipped={len(summary['skipped'])} errors={len(summary['errors'])}"
    )
    return summary
