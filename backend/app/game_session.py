"""GameSession: manages a single Crafter episode."""

from __future__ import annotations

import base64
import random
import uuid
from datetime import datetime, timezone
from io import BytesIO
from typing import TYPE_CHECKING, Literal

import numpy as np
from PIL import Image

from .achievements import ACHIEVEMENT_NAMES, diff_achievements
from .schemas import ACTION_NAMES, FrameMessage, ImaginationMessage, ImaginationRollout, InventoryState
from .world_model import WorldModel, pca_project

if TYPE_CHECKING:
    from .encoder import Encoder


def _obs_to_base64(obs: np.ndarray) -> str:
    buf = BytesIO()
    Image.fromarray(obs).save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


class GameSession:
    """Holds all state for one Crafter session."""

    def __init__(
        self,
        mode: Literal["human", "agent", "imagination", "wm_base", "hwm"] = "human",
        seed: int | None = None,
        encoder: Encoder | None = None,
        world_model: WorldModel | None = None,
    ) -> None:
        import crafter

        self.session_id = str(uuid.uuid4())
        self.mode = mode
        self.seed = seed if seed is not None else random.randint(0, 2**31 - 1)
        self.env = crafter.Env(seed=self.seed)
        self._obs: np.ndarray = self.env.reset()
        self._prev_achievements: dict[str, int] = {k: 0 for k in ACHIEVEMENT_NAMES}
        self._step_count = 0
        self._encoder = encoder
        self._world_model = world_model
        # Running history of encoded latents for consistent PCA projection
        self._latent_history: list[np.ndarray] = []

    @property
    def obs(self) -> np.ndarray:
        return self._obs

    def step_human(
        self,
        action: int,
        source: Literal["human", "agent"] = "human",
        checkpoint_id: str | None = None,
        action_probs: list[float] | None = None,
        value_estimate: float | None = None,
    ) -> FrameMessage:
        obs, reward, done, info = self.env.step(action)
        self._step_count += 1

        achievements_curr: dict[str, int] = info.get("achievements", {})
        new_achievements = diff_achievements(self._prev_achievements, achievements_curr)
        self._prev_achievements = {**self._prev_achievements, **achievements_curr}
        self._obs = obs

        latent: list[float] | None = None
        if self._encoder is not None:
            latent = self._encoder.encode(obs).tolist()
        elif self._world_model is not None:
            # Use the LeWM encoder when no separate CNN encoder is provided
            latent = self._world_model.encode(obs).tolist()

        return FrameMessage(
            step=self._step_count,
            obs=_obs_to_base64(obs),
            latent=latent,
            action=action,
            action_name=ACTION_NAMES[action],
            reward=float(reward),
            done=bool(done),
            inventory=InventoryState(**info.get("inventory", {})),
            achievements_unlocked_this_step=new_achievements,
            source=source,
            checkpoint_id=checkpoint_id,
            action_probs=action_probs,
            value_estimate=value_estimate,
            seed=self.seed,
            timestamp=datetime.now(timezone.utc),
        )

    async def run_agent_loop(self, checkpoint_id: str, fps: int) -> None:
        """Drive the env with the named policy at fps frames-per-second. PR 5+7."""
        raise NotImplementedError

    def imagine_rollouts(self, K: int = 4, H: int = 16) -> ImaginationMessage:
        """Encode the current observation and sample K world-model rollouts of length H.

        Args:
            K: number of parallel imagined trajectories.
            H: horizon (steps) per trajectory.

        Returns:
            ImaginationMessage with K rollouts and the PCA-projected real latent history.

        Raises:
            RuntimeError: if no world model was provided at construction time.
        """
        if self._world_model is None:
            raise RuntimeError(
                "No world model loaded for this session. "
                "Pass world_model= when creating the GameSession."
            )

        # Encode current frame and accumulate real latent history
        z0 = self._world_model.encode(self._obs)  # (latent_dim,)
        self._latent_history.append(z0)

        # Sample K random-action rollouts: (K, H+1, latent_dim)
        trajs = self._world_model.sample_rollouts(z0, K=K, horizon=H)

        # Compute PCA on all latents together for a consistent 2-D basis:
        #   real history  (N_real, D)
        #   imagination   (K*(H+1), D)
        real_arr = np.stack(self._latent_history, axis=0)              # (N_real, D)
        imag_arr = trajs.reshape(K * (H + 1), trajs.shape[-1])         # (K*(H+1), D)
        joint = np.concatenate([real_arr, imag_arr], axis=0)           # (N_total, D)

        joint_2d = pca_project(joint)                                  # (N_total, 2)

        n_real = real_arr.shape[0]
        real_pca = joint_2d[:n_real]          # (N_real, 2)
        imag_pca = joint_2d[n_real:]          # (K*(H+1), 2)

        rollouts: list[ImaginationRollout] = []
        for k in range(K):
            start = k * (H + 1)
            end = start + (H + 1)
            rollouts.append(
                ImaginationRollout(
                    latents=trajs[k].tolist(),
                    pca_2d=imag_pca[start:end].tolist(),
                )
            )

        return ImaginationMessage(
            rollouts=rollouts,
            real_pca_2d=real_pca.tolist(),
        )

    def close(self) -> None:
        if hasattr(self.env, "close"):
            self.env.close()
