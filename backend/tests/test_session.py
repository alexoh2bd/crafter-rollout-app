# Cursor (AI-assisted).
"""GameSession smoke tests."""

from app.game_session import GameSession
from app.schemas import FrameMessage


def test_smoke_start_step_close():
    session = GameSession(mode="human", seed=42)
    for i in range(10):
        msg = session.step_human(0)  # noop
        assert isinstance(msg, FrameMessage)
        assert msg.step == i + 1
        assert msg.action == 0
        assert msg.action_name == "noop"
        assert msg.source == "human"
        assert msg.latent is None
        assert msg.checkpoint_id is None
        assert len(msg.obs) > 0
    session.close()


def test_seed_reproducible():
    s1 = GameSession(mode="human", seed=123)
    s2 = GameSession(mode="human", seed=123)
    assert s1.step_human(2).obs == s2.step_human(2).obs
    s1.close()
    s2.close()


def test_session_with_encoder(encoder_ckpt: str) -> None:
    from app.encoder import Encoder

    enc = Encoder(encoder_ckpt)
    session = GameSession(mode="human", seed=42, encoder=enc)
    msg = session.step_human(0)
    assert msg.latent is not None
    assert len(msg.latent) == 128
    session.close()
