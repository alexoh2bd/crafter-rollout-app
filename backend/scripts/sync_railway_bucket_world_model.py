#!/usr/bin/env python3
"""Sync world-model checkpoint files with Railway's S3-compatible bucket (CLI)."""

from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

try:
    from boto3.exceptions import S3UploadFailedError
    from boto3.s3.transfer import TransferConfig
    from botocore.exceptions import BotoCoreError, ClientError
except ImportError:
    print("Missing dependency: install with  pip install boto3", file=sys.stderr)
    sys.exit(1)

from app.checkpoint_bucket import build_s3_client  # noqa: E402


DEFAULT_RELATIVE_FILES = (
    "lewm_base.pt",
    "hwm_high.pt",
    "goal_library.npz",
    "manifest.json",
)


def _default_checkpoints_dir() -> Path:
    return Path(__file__).resolve().parent.parent / "checkpoints"


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


def _s3_client():
    try:
        return build_s3_client()
    except ValueError as e:
        print(str(e), file=sys.stderr)
        print(
            "Tip: copy from Railway bucket Credentials or use --env-file. "
            "AWS_ACCESS_KEY_ID / AWS_ENDPOINT_URL also work.",
            file=sys.stderr,
        )
        raise SystemExit(1) from e


# Above this size boto3 uses multipart upload; keep checkpoints as single PutObject by default.
_TRANSFER_SINGLE = TransferConfig(multipart_threshold=16 * 1024 * 1024 * 1024)


def _object_key(prefix: str, name: str) -> str:
    p = prefix.strip().strip("/")
    if p:
        return f"{p}/{name}"
    return name


def cmd_upload(args: argparse.Namespace) -> int:
    src = Path(args.source_dir).resolve()
    client, bucket = _s3_client()
    prefix = args.prefix or ""

    ok = 0
    for name in args.files:
        local = src / name
        if not local.is_file():
            print(f"skip (missing): {local}", file=sys.stderr)
            continue
        key = _object_key(prefix, name)
        size = local.stat().st_size
        print(f"upload {local.name} ({size} bytes) -> s3://{bucket}/{key}")
        t0 = time.perf_counter()
        try:
            # Single PutObject avoids CreateMultipartUpload (large files default to multipart in boto3).
            client.upload_file(str(local), bucket, key, Config=_TRANSFER_SINGLE)
        except S3UploadFailedError as e:
            print(f"ERROR upload {key}: {e}", file=sys.stderr)
            if "404" in str(e) or "Not Found" in str(e):
                print(
                    "If you see 404 on CreateMultipartUpload: set ENDPOINT to the bucket S3 URL from\n"
                    "Railway → Bucket → Credentials (e.g. https://storage.railway.app), not your app URL.",
                    file=sys.stderr,
                )
            return 1
        except (ClientError, BotoCoreError) as e:
            print(f"ERROR upload {key}: {e}", file=sys.stderr)
            return 1
        dt = time.perf_counter() - t0

        head = client.head_object(Bucket=bucket, Key=key)
        remote_size = int(head["ContentLength"])
        if remote_size != size:
            print(
                f"ERROR size mismatch for {key}: local={size} remote={remote_size}",
                file=sys.stderr,
            )
            return 1
        print(f"  verified {remote_size} bytes in {dt:.1f}s")
        ok += 1

    if ok == 0:
        print("No files uploaded.", file=sys.stderr)
        return 1
    return 0


def cmd_download(args: argparse.Namespace) -> int:
    dest = Path(args.dest).resolve()
    dest.mkdir(parents=True, exist_ok=True)
    client, bucket = _s3_client()
    prefix = args.prefix or ""

    ok = 0
    for name in args.files:
        key = _object_key(prefix, name)
        out = dest / name
        print(f"download s3://{bucket}/{key} -> {out}")
        t0 = time.perf_counter()
        try:
            client.download_file(bucket, key, str(out))
        except ClientError as e:
            if e.response.get("Error", {}).get("Code") == "404":
                print(f"skip (not in bucket): {key}", file=sys.stderr)
                continue
            print(f"ERROR download {key}: {e}", file=sys.stderr)
            return 1
        except BotoCoreError as e:
            print(f"ERROR download {key}: {e}", file=sys.stderr)
            return 1
        dt = time.perf_counter() - t0

        head = client.head_object(Bucket=bucket, Key=key)
        remote_size = int(head["ContentLength"])
        local_size = out.stat().st_size
        if local_size != remote_size:
            print(
                f"ERROR size mismatch for {name}: local={local_size} remote={remote_size}",
                file=sys.stderr,
            )
            return 1

        print(f"  verified {local_size} bytes in {dt:.1f}s")
        ok += 1

    if ok == 0:
        print("No files downloaded.", file=sys.stderr)
        return 1
    return 0


def main() -> int:
    # --env-file must be accepted in BOTH positions:
    #   %(prog)s upload --env-file ../.env
    #   %(prog)s --env-file .env upload
    # Use separate dests on root vs subparser and merge (see below).
    env_parent = argparse.ArgumentParser(add_help=False)
    env_parent.add_argument(
        "--env-file",
        type=Path,
        default=None,
        dest="env_file_sub",
        help="Optional .env path (e.g. crafter-rollout-app/.env). Keys already in the environment win.",
    )

    ap = argparse.ArgumentParser(
        description=(
            "Upload or download world-model assets using BUCKET, REGION, ENDPOINT, "
            "ACCESS_KEY_ID, SECRET_ACCESS_KEY (Railway bucket Credentials tab). "
            "From your laptop, use a public ENDPOINT such as https://storage.railway.app "
            "(internal hostnames only work inside Railway)."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
examples:
  %(prog)s upload --env-file .env
  %(prog)s --env-file .env upload
  %(prog)s download --dest ./checkpoints --env-file ../.env
  %(prog)s upload --files lewm_base.pt hwm_high.pt --prefix world-model/v1
""",
    )
    ap.add_argument(
        "--env-file",
        type=Path,
        default=None,
        dest="env_file_root",
        help="Same as --env-file on upload/download; use before the subcommand if you prefer.",
    )
    sub = ap.add_subparsers(dest="cmd", required=True)

    up = sub.add_parser(
        "upload",
        parents=[env_parent],
        help="Upload world-model files into the bucket",
    )
    up.add_argument(
        "--source-dir",
        type=Path,
        default=_default_checkpoints_dir(),
        help="Directory containing checkpoint files (default: backend/checkpoints)",
    )
    up.add_argument(
        "--prefix",
        default=os.getenv("WORLD_MODEL_S3_PREFIX", "checkpoints"),
        help='Object key prefix (default: env WORLD_MODEL_S3_PREFIX or "checkpoints")',
    )
    up.add_argument("--files", nargs="*", default=list(DEFAULT_RELATIVE_FILES))

    down = sub.add_parser(
        "download",
        parents=[env_parent],
        help="Download world-model files from the bucket",
    )
    down.add_argument(
        "--dest",
        type=Path,
        default=_default_checkpoints_dir(),
        help="Local directory to write files (default: backend/checkpoints)",
    )
    down.add_argument(
        "--prefix",
        default=os.getenv("WORLD_MODEL_S3_PREFIX", "checkpoints"),
        help='Object key prefix (default: env WORLD_MODEL_S3_PREFIX or "checkpoints")',
    )
    down.add_argument("--files", nargs="*", default=list(DEFAULT_RELATIVE_FILES))

    args = ap.parse_args()
    env_path = args.env_file_sub or args.env_file_root
    if env_path:
        _load_env_file(env_path)

    if args.cmd == "upload":
        return cmd_upload(args)
    if args.cmd == "download":
        return cmd_download(args)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
