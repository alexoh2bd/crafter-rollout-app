"""Generate and save a randomly-initialized placeholder encoder checkpoint.

Usage:
    python scripts/export_encoder.py
"""

from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import torch  # noqa: E402

from app.encoder import _EncoderCNN  # noqa: E402


def main() -> None:
    out = Path(__file__).resolve().parent.parent / "checkpoints" / "encoder_v0.pt"
    torch.save(_EncoderCNN().state_dict(), out)
    print(f"Saved placeholder encoder to {out}")


if __name__ == "__main__":
    main()