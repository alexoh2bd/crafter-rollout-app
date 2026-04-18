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
from .schemas import ACTION_NAMES, FrameMessage, InventoryState

if TYPE_CHECKING:
    from .encoder import Encoder


class ImaginationMessage:
    """Payload describing K imagination rollouts. Schema defined in PR 6."""


def _obs_to_base64(obs: np.ndarray) -> str:
    buf = BytesIO()
    Image.fromarray(obs).save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


class GameSession:
    """Holds all state for one Crafter session."""

    def __init__(
        self,
        mode: Literal["human", "agent", "imagination"] = "human",
        seed: int | None = None,
        encoder: Encoder | None = None,
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

    def imagine_rollouts(self, K: int, H: int) -> ImaginationMessage:
        """Generate K imagination rollouts of length H. PR 6."""
        raise NotImplementedError

    def close(self) -> None:
        if hasattr(self.env, "close"):
            self.env.close()
