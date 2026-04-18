"""World model: imagination rollouts in latent space using LeWM.

Loads lewm_base.pt (or any checkpoint saved by src/letrain.py) and
exposes encode / imagine / sample_rollouts for use by GameSession.

Checkpoint format (from letrain.py):
    {
        'model':     OrderedDict,      # may have 'module.' prefix from DataParallel
        'args':      dict | Namespace, # training hyperparams
        'epoch':     int,
        'step':      int,
        'val_loss':  float,
    }
"""

from __future__ import annotations

import numpy as np
import torch
import torch.nn.functional as F

from .lemodel import LeWM

ACTION_DIM = 17  # Crafter has 17 discrete actions


def _strip_dataparallel(sd: dict) -> dict:
    """Remove 'module.' prefix added by nn.DataParallel during training."""
    if any(k.startswith("module.") for k in sd):
        return {k.replace("module.", "", 1): v for k, v in sd.items()}
    return dict(sd)


def pca_project(latents: np.ndarray, n_components: int = 2) -> np.ndarray:
    """SVD-based PCA for visualizing latent trajectories.

    Args:
        latents: (N, D) float32 array of latent vectors.
        n_components: target dimensionality (default 2).

    Returns:
        (N, n_components) float32 projected array.
    """
    N = latents.shape[0]
    if N <= 1:
        return np.zeros((N, n_components), dtype=np.float32)
    centered = latents - latents.mean(axis=0, keepdims=True)
    _, _, Vt = np.linalg.svd(centered, full_matrices=False)
    components = Vt[:n_components]  # (n_components, D)
    return (centered @ components.T).astype(np.float32)


class WorldModel:
    """Latent dynamics model backed by Le-World Model (LeWM).

    Handles basic inference only — no planning. Use encode() to get a
    latent from an observation, then imagine() / sample_rollouts() to
    unroll the predictor forward.
    """

    def __init__(self, checkpoint_path: str) -> None:
        self._device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        ckpt = torch.load(checkpoint_path, map_location=self._device, weights_only=False)
        args: dict = ckpt.get("args", {})
        if not isinstance(args, dict):
            args = vars(args)

        self._latent_dim: int = int(args.get("latent_dim", 256))
        self._context_len: int = int(args.get("context_len", 16))

        self._model = LeWM(
            img_size=64,
            patch_size=8,
            latent_dim=self._latent_dim,
            action_dim=ACTION_DIM,
            encoder_depth=int(args.get("encoder_depth", 12)),
            encoder_heads=int(args.get("encoder_heads", 3)),
            predictor_depth=int(args.get("predictor_depth", 6)),
            predictor_heads=int(args.get("predictor_heads", 16)),
            context_len=self._context_len,
            sigreg_M=int(args.get("sigreg_M", 1024)),
            sigreg_lambda=float(args.get("sigreg_lambda", 0.1)),
        ).to(self._device)

        sd = _strip_dataparallel(ckpt["model"])
        self._model.load_state_dict(sd)
        self._model.eval()

    @property
    def latent_dim(self) -> int:
        return self._latent_dim

    def encode(self, obs: np.ndarray) -> np.ndarray:
        """Encode a single Crafter observation into the latent space.

        Args:
            obs: (64, 64, 3) uint8 RGB frame.

        Returns:
            (latent_dim,) float32 latent vector.
        """
        x = (
            torch.from_numpy(obs)
            .float()
            .div(255.0)
            .permute(2, 0, 1)   # HWC -> CHW
            .unsqueeze(0)        # add batch dim
            .to(self._device)
        )
        with torch.no_grad():
            z = self._model.encode(x)  # (1, latent_dim)
        return z.squeeze(0).cpu().numpy().astype(np.float32)

    def _to_one_hot(self, actions: np.ndarray) -> torch.Tensor:
        """actions: (B, H) int64 -> (B, H, ACTION_DIM) float32 on device."""
        t = torch.from_numpy(actions.astype(np.int64)).to(self._device)
        return F.one_hot(t, num_classes=ACTION_DIM).float()

    def imagine(
        self,
        z0: np.ndarray,
        actions: np.ndarray,
        horizon: int,
    ) -> np.ndarray:
        """Roll out a fixed action sequence from an initial latent.

        Args:
            z0:      (latent_dim,) float32 initial latent.
            actions: (H,) int array of Crafter action indices.
            horizon: H, number of forward steps to simulate.

        Returns:
            (horizon+1, latent_dim) float32 — z0 at index 0,
            then one predicted state per step.
        """
        z0_t = torch.from_numpy(z0).float().unsqueeze(0).to(self._device)  # (1, D)
        a = actions[:horizon].astype(np.int64)[np.newaxis]                 # (1, H)
        a_oh = self._to_one_hot(a)                                         # (1, H, A)

        with torch.no_grad():
            traj = self._model.rollout(z0_t, a_oh)  # (1, H+1, D)

        return traj.squeeze(0).cpu().numpy().astype(np.float32)

    def sample_rollouts(
        self,
        z0: np.ndarray,
        K: int,
        horizon: int,
    ) -> np.ndarray:
        """Sample K independent random-action trajectories from z0.

        Args:
            z0:      (latent_dim,) float32 initial latent.
            K:       number of parallel rollouts.
            horizon: steps per rollout.

        Returns:
            (K, horizon+1, latent_dim) float32.
        """
        z0_t = (
            torch.from_numpy(z0)
            .float()
            .unsqueeze(0)
            .expand(K, -1)
            .contiguous()
            .to(self._device)
        )  # (K, D)

        actions = np.random.randint(0, ACTION_DIM, size=(K, horizon), dtype=np.int64)
        a_oh = self._to_one_hot(actions)  # (K, H, A)

        with torch.no_grad():
            traj = self._model.rollout(z0_t, a_oh)  # (K, H+1, D)

        return traj.cpu().numpy().astype(np.float32)
