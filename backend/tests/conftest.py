"""Shared pytest fixtures."""

import pytest
import torch

from app.encoder import _EncoderCNN


@pytest.fixture(scope="session")
def encoder_ckpt(tmp_path_factory: pytest.TempPathFactory) -> str:
    path = tmp_path_factory.mktemp("ckpts") / "encoder_v0.pt"
    torch.save(_EncoderCNN().state_dict(), path)
    return str(path)