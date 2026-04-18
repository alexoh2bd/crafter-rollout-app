"""Policy inference and registry."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np

CHECKPOINTS_DIR = Path(__file__).parent.parent / "checkpoints"
N_ACTIONS = 17


@dataclass
class CheckpointMeta:
    checkpoint_id: str
    display_name: str
    ckpt_type: str
    path: str
    description: str = ""


@dataclass
class ActionResult:
    action: int
    action_probs: np.ndarray  # (17,) float32
    value: float | None
    logits: np.ndarray  # (17,) float32


class Policy:
    """Runs inference for a single policy checkpoint."""

    def __init__(self, checkpoint_path: str, ckpt_type: str) -> None:
        self._ckpt_type = ckpt_type
        self._rng = np.random.default_rng()

    def act(self, obs: np.ndarray) -> ActionResult:
        # Uniform random policy — placeholder until real weights land
        logits = np.zeros(N_ACTIONS, dtype=np.float32)
        probs = np.full(N_ACTIONS, 1.0 / N_ACTIONS, dtype=np.float32)
        action = int(self._rng.integers(0, N_ACTIONS))
        return ActionResult(action=action, action_probs=probs, value=None, logits=logits)


class PolicyRegistry:
    """Central registry for available policy checkpoints."""

    _cache: dict[str, Policy] = {}

    @classmethod
    def _manifest(cls) -> list[dict]:
        with (CHECKPOINTS_DIR / "manifest.json").open() as f:
            return json.load(f)["checkpoints"]

    @classmethod
    def get(cls, checkpoint_id: str) -> Policy:
        if checkpoint_id in cls._cache:
            return cls._cache[checkpoint_id]
        for entry in cls._manifest():
            if entry["checkpoint_id"] == checkpoint_id:
                policy = Policy(
                    checkpoint_path=str(CHECKPOINTS_DIR / entry["path"]),
                    ckpt_type=entry["ckpt_type"],
                )
                cls._cache[checkpoint_id] = policy
                return policy
        raise KeyError(f"Checkpoint not found: {checkpoint_id!r}")

    @classmethod
    def list_available(cls) -> list[CheckpointMeta]:
        return [CheckpointMeta(**e) for e in cls._manifest()]
