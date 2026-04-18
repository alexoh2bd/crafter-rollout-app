"""Encoder: maps observations to latent vectors.

Interface defined here; implemented in PR 3 (encoder inference).
"""

from __future__ import annotations

import numpy as np


class Encoder:
    """CNN encoder that maps a Crafter observation to a 128-d latent vector."""

    def __init__(self, checkpoint_path: str) -> None:
        """Load encoder weights from *checkpoint_path*.

        Implemented in PR 3.
        """
        raise NotImplementedError

    def encode(self, obs: np.ndarray) -> np.ndarray:
        """Encode a single observation.

        Args:
            obs: (64, 64, 3) uint8 RGB array.

        Returns:
            (128,) float32 latent vector.

        Implemented in PR 3.
        """
        raise NotImplementedError
