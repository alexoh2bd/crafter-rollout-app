"""Encoder: maps Crafter observations to 128-d latent vectors."""

from __future__ import annotations

import numpy as np
import torch
import torch.nn as nn


class _EncoderCNN(nn.Module):
    """Small CNN: (3, 64, 64) → (128,).

    Conv shapes: 64→31→14→6, then flatten 128*6*6=4608 → fc 128.
    """

    def __init__(self) -> None:
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv2d(3, 32, kernel_size=4, stride=2),    # → 32×31×31
            nn.ReLU(),
            nn.Conv2d(32, 64, kernel_size=4, stride=2),   # → 64×14×14
            nn.ReLU(),
            nn.Conv2d(64, 128, kernel_size=4, stride=2),  # → 128×6×6
            nn.ReLU(),
        )
        self.fc = nn.Linear(128 * 6 * 6, 128)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.fc(self.conv(x).flatten(1))


class Encoder:
    """CNN encoder that maps a Crafter observation to a 128-d latent vector."""

    def __init__(self, checkpoint_path: str) -> None:
        self._net = _EncoderCNN()
        state = torch.load(checkpoint_path, map_location="cpu", weights_only=True)
        self._net.load_state_dict(state)
        self._net.eval()

    def encode(self, obs: np.ndarray) -> np.ndarray:
        """obs: (64, 64, 3) uint8 → (128,) float32."""
        x = torch.from_numpy(obs).permute(2, 0, 1).float().div(255.0).unsqueeze(0)
        with torch.no_grad():
            z = self._net(x)
        return z.squeeze(0).numpy().astype(np.float32)