"""Policy inference and registry.

Interface defined here; implemented in PR 5 (policy inference + registry).
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass
class CheckpointMeta:
    checkpoint_id: str
    display_name: str
    ckpt_type: str  # e.g. "ppo", "random"
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
        """Load policy weights from *checkpoint_path*.

        Implemented in PR 5.
        """
        raise NotImplementedError

    def act(self, obs: np.ndarray) -> ActionResult:
        """Select an action given an observation.

        Args:
            obs: (64, 64, 3) uint8 RGB array.

        Returns:
            ActionResult with action, probs, value, and logits.

        Implemented in PR 5.
        """
        raise NotImplementedError


class PolicyRegistry:
    """Central registry for available policy checkpoints."""

    @classmethod
    def get(cls, checkpoint_id: str) -> Policy:
        """Return a loaded Policy for *checkpoint_id*.

        Raises KeyError if not found.

        Implemented in PR 5.
        """
        raise NotImplementedError

    @classmethod
    def list_available(cls) -> list[CheckpointMeta]:
        """Return metadata for all registered checkpoints.

        Implemented in PR 5.
        """
        raise NotImplementedError
