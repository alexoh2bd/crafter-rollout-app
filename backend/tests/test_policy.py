"""Policy smoke tests."""

import numpy as np

from app.policy import PolicyRegistry


def test_list_checkpoints_has_random():
    checkpoints = PolicyRegistry.list_available()
    assert len(checkpoints) >= 1
    assert any(c.checkpoint_id == "random" for c in checkpoints)


def test_random_policy_act():
    policy = PolicyRegistry.get("random")
    obs = np.zeros((64, 64, 3), dtype=np.uint8)
    result = policy.act(obs)

    assert 0 <= result.action < 17
    assert result.action_probs.shape == (17,)
    assert result.action_probs.dtype == np.float32
    assert abs(result.action_probs.sum() - 1.0) < 1e-5
    assert result.logits.shape == (17,)
    assert result.value is None


def test_get_unknown_checkpoint_raises():
    try:
        PolicyRegistry.get("does-not-exist")
        assert False, "Expected KeyError"
    except KeyError:
        pass
