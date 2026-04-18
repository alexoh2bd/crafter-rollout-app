"""GameSession: manages a single Crafter episode.

Interface defined here; human mode implemented in PR 2, encoder integration
in PR 3, agent loop in PR 5, imagination in PR 6, WebSocket in PR 7.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Literal

if TYPE_CHECKING:
    import crafter


class FrameMessage:
    """Payload sent to client after each human step.

    Schema defined in PR 2 (schemas.py).
    """


class ImaginationMessage:
    """Payload describing K imagination rollouts.

    Schema defined in PR 6 (schemas.py).
    """


class GameSession:
    """Holds all state for one Crafter session."""

    mode: Literal["human", "agent", "imagination"]
    session_id: str
    seed: int
    env: "crafter.Env"

    def __init__(
        self,
        mode: Literal["human", "agent", "imagination"],
        seed: int | None = None,
    ) -> None:
        """Create and reset a new Crafter environment.

        Implemented in PR 2.
        """
        raise NotImplementedError

    def step_human(self, action: int) -> FrameMessage:
        """Apply *action* and return the resulting frame data.

        Implemented in PR 2.
        """
        raise NotImplementedError

    async def run_agent_loop(self, checkpoint_id: str, fps: int) -> None:
        """Drive the env with the named policy at *fps* frames-per-second.

        Streams FrameMessages over the session's WebSocket connection.

        Implemented in PR 5 + PR 7.
        """
        raise NotImplementedError

    def imagine_rollouts(self, K: int, H: int) -> ImaginationMessage:
        """Generate K imagination rollouts of length H from current latent.

        Implemented in PR 6.
        """
        raise NotImplementedError

    def close(self) -> None:
        """Release environment resources.

        Implemented in PR 2.
        """
        raise NotImplementedError
