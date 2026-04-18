"""World model: imagination rollouts in latent space.

Interface defined here; implemented in PR 6 (world model inference).
"""

from __future__ import annotations

import numpy as np


class WorldModel:
    """Latent dynamics model for imagining future states."""

    def __init__(self, checkpoint_path: str) -> None:
        """Load world model weights from *checkpoint_path*.

        Implemented in PR 6.
        """
        raise NotImplementedError

    def imagine(
        self,
        z0: np.ndarray,
        actions: np.ndarray,
        horizon: int,
    ) -> np.ndarray:
        """Roll out a fixed action sequence from an initial latent.

        Args:
            z0: (128,) float32 initial latent.
            actions: (H,) int array of action indices.
            horizon: H, number of steps to imagine.

        Returns:
            (H+1, 128) float32 trajectory (includes z0 at index 0).

        Implemented in PR 6.
        """
        raise NotImplementedError

    def sample_rollouts(
        self,
        z0: np.ndarray,
        K: int,
        horizon: int,
    ) -> np.ndarray:
        """Sample K random-action trajectories from an initial latent.

        Args:
            z0: (128,) float32 initial latent.
            K: number of rollouts.
            horizon: H, steps per rollout.

        Returns:
            (K, H+1, 128) float32 array.

        Implemented in PR 6.
        """
        raise NotImplementedError
