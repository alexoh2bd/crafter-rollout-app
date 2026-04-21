#!/usr/bin/env python3
"""Smoke-test Railway bucket credentials (same resolution as the FastAPI app).

Run from the ``backend`` directory::

  cd backend
  python scripts/test_bucket_connection.py --env-file ../.env

Or with variables already exported (e.g. ``railway run`` from the service root)::

  railway run --service <backend> -- python backend/scripts/test_bucket_connection.py

Nothing secret is printed — only which env *names* were used and S3 HEAD/GET results.

Supported names (first non-empty wins):

  BUCKET or AWS_S3_BUCKET or AWS_S3_BUCKET_NAME or S3_BUCKET
  ENDPOINT or AWS_ENDPOINT_URL or AWS_S3_ENDPOINT or S3_ENDPOINT
  ACCESS_KEY_ID or AWS_ACCESS_KEY_ID
  SECRET_ACCESS_KEY or AWS_SECRET_ACCESS_KEY
  REGION or AWS_DEFAULT_REGION or AWS_REGION
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

_BACKEND = Path(__file__).resolve().parent.parent
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))


def _load_env_file(path: Path) -> None:
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = val


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--env-file",
        type=Path,
        default=None,
        help="Optional .env (e.g. crafter-rollout-app/.env when cwd is backend/)",
    )
    args = ap.parse_args()
    if args.env_file:
        _load_env_file(args.env_file)

    from botocore.exceptions import ClientError

    from app.checkpoint_bucket import (
        _s3_key,
        bucket_credentials,
        build_s3_client,
        describe_bucket_env_sources,
        fetch_object_bytes,
        s3_prefix,
    )

    sources = describe_bucket_env_sources()
    print("Env keys used (values hidden):")
    for role, key_name in sources.items():
        print(f"  {role}: {key_name or '(unset — may use default for REGION)'}")

    b, e, a, s, r = bucket_credentials()
    if not all([b, e, a, s]):
        print(
            "\nERROR: Need bucket, endpoint, access key id, and secret access key.\n"
            "• Local test:  cd backend && python scripts/test_bucket_connection.py --env-file ../.env\n"
            "• railway run:  does not load .env — set variables on the service in Railway "
            "(Dashboard → service → Variables), or reference your Bucket resource, or run:\n"
            "    railway variable set BUCKET=… ENDPOINT=… ACCESS_KEY_ID=… SECRET_ACCESS_KEY=…\n"
            "  (multiple KEY=VALUE arguments; use quotes if values contain spaces)\n"
            "  Aliases also work: AWS_S3_BUCKET_NAME, AWS_ENDPOINT_URL, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY.",
            file=sys.stderr,
        )
        return 1

    print(f"\nBucket id: {b}")
    print(f"Endpoint: {e[:96]}{'…' if len(e) > 96 else ''}")
    print(f"Region: {r}")

    prefix = s3_prefix()
    mk = _s3_key(prefix, "manifest.json")
    print(f"Object prefix: {prefix!r} → manifest key: {mk}")

    try:
        client, bucket_name = build_s3_client()
    except ValueError as exc:
        print(f"\nERROR: {exc}", file=sys.stderr)
        return 1

    try:
        head = client.head_object(Bucket=bucket_name, Key=mk)
        cl = head.get("ContentLength", "?")
        print(f"\nOK  head_object: ContentLength={cl}")
    except ClientError as exc:
        print(f"\nFAIL head_object {mk!r}: {exc}", file=sys.stderr)
        print(
            "Check CHECKPOINTS_S3_PREFIX matches upload layout (default: checkpoints).",
            file=sys.stderr,
        )
        return 2

    try:
        raw = fetch_object_bytes("manifest.json")
        print(f"OK  get_object manifest.json: {len(raw)} bytes")
    except Exception as exc:
        print(f"\nFAIL get_object (app path): {exc}", file=sys.stderr)
        return 3

    print("\nSuccess — same env resolution as `app.checkpoint_bucket` / production.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
