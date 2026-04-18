"""Encoder smoke tests."""

import numpy as np

from app.encoder import Encoder


def test_encode_shape(encoder_ckpt: str) -> None:
    enc = Encoder(encoder_ckpt)
    obs = np.zeros((64, 64, 3), dtype=np.uint8)
    z = enc.encode(obs)
    assert z.shape == (128,)
    assert z.dtype == np.float32


def test_encode_deterministic(encoder_ckpt: str) -> None:
    enc = Encoder(encoder_ckpt)
    obs = np.random.default_rng(0).integers(0, 255, (64, 64, 3), dtype=np.uint8)
    assert np.array_equal(enc.encode(obs), enc.encode(obs))