"""Smoke-test LeWM inference (encode + predictor rollouts).

Run from the backend directory:

    cd backend
    python scripts/world_model_smoke.py

    python scripts/world_model_smoke.py --checkpoint checkpoints/lewm_base.pt --horizon 16 --K 4
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import numpy as np

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import crafter  # noqa: E402

from app.world_model import WorldModel  # noqa: E402


def main() -> None:
    p = argparse.ArgumentParser(description="Load LeWM and run encode / rollout inference")
    p.add_argument(
        "--checkpoint",
        type=Path,
        default=BACKEND_ROOT / "checkpoints" / "lewm_base.pt",
        help="Path to letrain.py checkpoint (.pt)",
    )
    p.add_argument("--seed", type=int, default=0, help="Crafter env seed")
    p.add_argument("--K", type=int, default=4, help="Parallel random-action rollouts")
    p.add_argument("--horizon", type=int, default=16, help="Rollout length (steps)")
    p.add_argument(
        "--actions",
        type=str,
        default="",
        help="Optional comma-separated action indices for a fixed imagine() path (length = horizon)",
    )
    args = p.parse_args()

    ckpt = args.checkpoint.resolve()
    if not ckpt.is_file():
        print(f"Checkpoint not found: {ckpt}", file=sys.stderr)
        sys.exit(1)

    print(f"Loading {ckpt} …")
    t0 = time.perf_counter()
    wm = WorldModel(str(ckpt))
    print(f"  latent_dim={wm.latent_dim}  ({time.perf_counter() - t0:.2f}s)")

    env = crafter.Env(seed=args.seed)
    obs = env.reset()
    assert obs.shape == (64, 64, 3), obs.shape

    t0 = time.perf_counter()
    z0 = wm.encode(obs)
    print(
        f"encode(obs)  shape={z0.shape}  L2={float(np.linalg.norm(z0)):.4f}  "
        f"({(time.perf_counter() - t0) * 1000:.1f}ms)"
    )

    np.random.seed(args.seed)
    t0 = time.perf_counter()
    trajs = wm.sample_rollouts(z0, K=args.K, horizon=args.horizon)
    dt = time.perf_counter() - t0
    print(
        f"sample_rollouts(K={args.K}, H={args.horizon})  shape={trajs.shape}  "
        f"({dt * 1000:.1f}ms, {dt / max(args.K, 1) * 1000:.1f}ms per rollout)"
    )

    if args.actions.strip():
        parts = [int(x.strip()) for x in args.actions.split(",")]
        if len(parts) != args.horizon:
            print(
                f"--actions must have exactly --horizon ({args.horizon}) integers, got {len(parts)}",
                file=sys.stderr,
            )
            sys.exit(2)
        for a in parts:
            if not (0 <= a < 17):
                print(f"Invalid action index {a} (Crafter has 17 actions 0..16)", file=sys.stderr)
                sys.exit(2)
        actions = np.array(parts, dtype=np.int64)
        t0 = time.perf_counter()
        fixed = wm.imagine(z0, actions, horizon=args.horizon)
        print(
            f"imagine(fixed actions)  shape={fixed.shape}  "
            f"({(time.perf_counter() - t0) * 1000:.1f}ms)"
        )

    print("OK")


if __name__ == "__main__":
    main()
