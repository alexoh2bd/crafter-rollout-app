# Cursor (AI-assisted).
"""Register a new policy checkpoint in manifest.json.

Usage:
    python scripts/add_checkpoint.py \\
        --id ppo-10m \\
        --name "PPO 10M steps" \\
        --type ppo \\
        --path policy_ppo_10m.pt \\
        --desc "PPO policy trained for 10M environment steps"
"""

import argparse
import json
from pathlib import Path

MANIFEST = Path(__file__).resolve().parent.parent / "checkpoints" / "manifest.json"


def main() -> None:
    p = argparse.ArgumentParser(description="Register a checkpoint in manifest.json")
    p.add_argument("--id", required=True, help="Unique checkpoint ID")
    p.add_argument("--name", required=True, help="Human-readable display name")
    p.add_argument("--type", required=True, dest="ckpt_type", help="Type: ppo/random")
    p.add_argument("--path", required=True, help="Filename inside checkpoints/")
    p.add_argument("--desc", default="", help="Optional description")
    args = p.parse_args()

    data = json.loads(MANIFEST.read_text())
    entry = {
        "checkpoint_id": args.id,
        "display_name": args.name,
        "ckpt_type": args.ckpt_type,
        "path": args.path,
        "description": args.desc,
    }

    ids = [c["checkpoint_id"] for c in data["checkpoints"]]
    if args.id in ids:
        data["checkpoints"][ids.index(args.id)] = entry
    else:
        data["checkpoints"].append(entry)

    MANIFEST.write_text(json.dumps(data, indent=2) + "\n")
    print(f"Registered '{args.id}' in {MANIFEST}")


if __name__ == "__main__":
    main()
