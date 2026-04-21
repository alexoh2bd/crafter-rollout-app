#!/usr/bin/env python3
"""Load LeWM + HWM weights from the S3 bucket (same as CHECKPOINTS_INFERENCE_SOURCE=s3) and run one HWM plan_step.

Run from ``backend/``::

  cd backend
  python scripts/test_hwm_bucket_inference.py --env-file ../.env

Uses ``fetch_object_bytes`` + in-memory ``torch.load`` — no checkpoint files on disk.
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

import numpy as np

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
    ap.add_argument("--env-file", type=Path, default=None)
    ap.add_argument(
        "--quick",
        action="store_true",
        help="Smaller CEM (faster CPU run)",
    )
    args = ap.parse_args()
    if args.env_file:
        _load_env_file(args.env_file)

    from app.checkpoint_bucket import credentials_configured, describe_bucket_env_sources, fetch_object_bytes

    if not credentials_configured():
        print(
            "ERROR: Bucket credentials missing. Use --env-file ../.env or set "
            "BUCKET, ENDPOINT, ACCESS_KEY_ID, SECRET_ACCESS_KEY (or AWS_* aliases).",
            file=sys.stderr,
        )
        return 1

    print("Env sources:", describe_bucket_env_sources())
    t0 = time.perf_counter()
    print("Fetching lewm_base.pt, hwm_high.pt from bucket…")
    lewm = fetch_object_bytes("lewm_base.pt")
    hwm = fetch_object_bytes("hwm_high.pt")
    goal_bytes: bytes | None = None
    try:
        goal_bytes = fetch_object_bytes("goal_library.npz")
        print(f"  goal_library.npz: {len(goal_bytes)} bytes")
    except (FileNotFoundError, RuntimeError) as e:
        print(f"  goal_library.npz: skipped ({e})")

    from app.hwm_model import HWMAgent
    from app.world_model import WorldModel

    print(f"  lewm_base.pt: {len(lewm)} bytes, hwm_high.pt: {len(hwm)} bytes")
    print(f"  download + read prep: {time.perf_counter() - t0:.1f}s")

    t1 = time.perf_counter()
    wm = WorldModel(checkpoint_bytes=lewm)
    agent = HWMAgent(
        wm,
        hwm_checkpoint_bytes=hwm,
        goal_library_bytes=goal_bytes,
    )
    print(f"  WorldModel + HWMAgent build: {time.perf_counter() - t1:.1f}s (latent_dim={wm.latent_dim})")

    rng = np.random.default_rng(0)
    obs = rng.integers(0, 256, size=(64, 64, 3), dtype=np.uint8)
    z_goal = rng.standard_normal(wm.latent_dim).astype(np.float32)

    if args.quick:
        n_lo, n_hi, n_elite, iters = 24, 24, 4, 2
        h_lo, h_hi = 4, 2
    else:
        n_lo, n_hi, n_elite, iters = 48, 48, 8, 2
        h_lo, h_hi = 8, 3

    t2 = time.perf_counter()
    action, planning_ms, z_dist = agent.plan_step(
        obs,
        z_goal,
        H_lo=h_lo,
        H_hi=h_hi,
        n_samples_lo=n_lo,
        n_samples_hi=n_hi,
        n_elite_lo=n_elite,
        n_elite_hi=n_elite,
        n_iters=iters,
    )
    print(
        f"  plan_step: action={action} planning_ms={planning_ms:.1f} z_goal_dist={z_dist:.4f} "
        f"(H_lo={h_lo} H_hi={h_hi} n={n_lo}/{n_hi})"
    )
    print(f"  plan_step wall time: {time.perf_counter() - t2:.2f}s")

    a2 = agent.clone_for_session()
    action2, _, _ = a2.plan_step(obs, z_goal, H_lo=h_lo, H_hi=h_hi, n_samples_lo=n_lo, n_samples_hi=n_hi, n_elite_lo=n_elite, n_elite_hi=n_elite, n_iters=iters)
    print(f"  clone_for_session plan_step: action={action2} (fresh subgoal state)")

    print("OK — HWM inference from bucket bytes.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
