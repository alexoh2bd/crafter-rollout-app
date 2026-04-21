"""Policy inference and registry."""

from __future__ import annotations

import io
import json
import os
import re
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn

N_ACTIONS = 17


def checkpoints_dir() -> Path:
    """Directory for manifest + .pt files. Override with CHECKPOINTS_DIR (e.g. Railway volume)."""
    override = os.getenv("CHECKPOINTS_DIR")
    if override:
        return Path(override)
    return Path(__file__).resolve().parent.parent / "checkpoints"


@dataclass
class CheckpointMeta:
    checkpoint_id: str
    display_name: str
    ckpt_type: str
    path: str
    description: str = ""


@dataclass
class ActionResult:
    action: int
    action_probs: np.ndarray  # (17,) float32
    value: float | None
    logits: np.ndarray  # (17,) float32


class _CrafterActorCritic(nn.Module):
    """CNN actor-critic matching teacherPPO.ActorCritic exactly.

    Architecture (64×64×3 → 17 logits + value):
      cnn:    Conv(3→32,k=8,s=4) → Conv(32→64,k=4,s=2) → Conv(64→64,k=3,s=1) → Flatten
      shared: Linear(1024→512) + ReLU
      actor:  Linear(512→17)
      critic: Linear(512→1)

    Key names mirror the training checkpoint so load_state_dict works directly.
    """

    def __init__(self) -> None:
        super().__init__()
        self.cnn = nn.Sequential(
            nn.Conv2d(3, 32, kernel_size=8, stride=4),   # (B,3,64,64) → (B,32,15,15)
            nn.ReLU(),
            nn.Conv2d(32, 64, kernel_size=4, stride=2),  # → (B,64,6,6)
            nn.ReLU(),
            nn.Conv2d(64, 64, kernel_size=3, stride=1),  # → (B,64,4,4)
            nn.ReLU(),
            nn.Flatten(),                                 # → (B,1024)
        )
        cnn_out = 64 * 4 * 4  # 1024
        self.shared = nn.Sequential(
            nn.Linear(cnn_out, 512),
            nn.ReLU(),
        )
        self.actor = nn.Linear(512, N_ACTIONS)
        self.critic = nn.Linear(512, 1)

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        # x: (B, 3, 64, 64) float32 in [0, 1]
        h = self.shared(self.cnn(x))
        return self.actor(h), self.critic(h)


def _obs_to_tensor(obs: np.ndarray) -> torch.Tensor:
    x = torch.from_numpy(obs.astype(np.float32))
    if x.ndim == 3 and x.shape[2] == 3:
        x = x.permute(2, 0, 1)
    if x.dtype == torch.uint8:
        x = x.float().div(255.0)
    elif x.max() > 1.5:
        x = x.div(255.0)
    return x.unsqueeze(0)


def _strip_prefix(state: dict[str, torch.Tensor], prefixes: list[str]) -> dict[str, torch.Tensor]:
    out: dict[str, torch.Tensor] = {}
    for k, v in state.items():
        nk = k
        for p in prefixes:
            if nk.startswith(p):
                nk = nk[len(p) :]
        out[nk] = v
    return out


def _logits_value_from_output(
    out: torch.Tensor | tuple[torch.Tensor, ...] | list[torch.Tensor],
) -> tuple[torch.Tensor, torch.Tensor | None]:
    if isinstance(out, torch.Tensor):
        if out.shape[-1] == N_ACTIONS:
            return out, None
        if out.numel() == N_ACTIONS:
            return out.flatten(), None
        raise ValueError(f"Unexpected tensor shape from policy forward: {out.shape}")
    if isinstance(out, (tuple, list)) and len(out) >= 1:
        logits = out[0]
        value = out[1] if len(out) > 1 else None
        return logits, value
    raise TypeError(f"Unexpected forward output type: {type(out)}")


class _TorchPolicyBackend:
    """Runs forward on obs; supports JIT, nn.Module, or state_dict into _CrafterActorCritic."""

    def __init__(
        self,
        checkpoint_path: str | None = None,
        *,
        checkpoint_bytes: bytes | None = None,
    ) -> None:
        if (checkpoint_path is None) == (checkpoint_bytes is None):
            raise ValueError("Provide exactly one of checkpoint_path or checkpoint_bytes")

        # 1) TorchScript
        if checkpoint_bytes is not None:
            try:
                m = torch.jit.load(io.BytesIO(checkpoint_bytes), map_location="cpu")
                m.eval()
                self._model = m
                return
            except Exception:
                pass
            obj = torch.load(
                io.BytesIO(checkpoint_bytes), map_location="cpu", weights_only=False
            )
        else:
            path = Path(checkpoint_path)
            if not path.is_file():
                raise FileNotFoundError(f"Checkpoint file not found: {path}")
            try:
                m = torch.jit.load(str(path), map_location="cpu")
                m.eval()
                self._model = m
                return
            except Exception:
                pass
            obj = torch.load(str(path), map_location="cpu", weights_only=False)

        # 2) nn.Module
        if isinstance(obj, nn.Module):
            obj.eval()
            self._model = obj
            return

        # 3) state dict (possibly nested dict)
        state: dict[str, torch.Tensor]
        if isinstance(obj, dict):
            if "state_dict" in obj and isinstance(obj["state_dict"], dict):
                state = obj["state_dict"]  # type: ignore[assignment]
            elif "model_state_dict" in obj and isinstance(obj["model_state_dict"], dict):
                state = obj["model_state_dict"]  # type: ignore[assignment]
            # teacherPPO.py saves {"policy": policy.state_dict()}
            elif "policy" in obj and isinstance(obj["policy"], dict):
                state = obj["policy"]  # type: ignore[assignment]
            elif all(isinstance(v, torch.Tensor) for v in obj.values()):
                state = obj  # type: ignore[assignment]
            else:
                # last resort: collect any nested dict that contains tensors
                for candidate_key in obj:
                    candidate = obj[candidate_key]
                    if isinstance(candidate, dict) and candidate and all(
                        isinstance(v, torch.Tensor) for v in candidate.values()
                    ):
                        state = candidate  # type: ignore[assignment]
                        break
                else:
                    state = {k: v for k, v in obj.items() if isinstance(v, torch.Tensor)}
                if not state:
                    raise ValueError(
                        f"Could not interpret checkpoint dict keys: {list(obj.keys())[:20]}"
                    )
        else:
            raise ValueError(f"Unsupported checkpoint type: {type(obj)}")

        # Strip DataParallel / wrapper prefixes but NOT "actor." since that is
        # a legitimate module name in the teacherPPO architecture.
        for prefix in ("module.", "net."):
            state = _strip_prefix(state, [prefix])

        net = _CrafterActorCritic()
        net.load_state_dict(state, strict=False)
        net.eval()
        self._model = net

    def forward(self, obs: np.ndarray) -> tuple[torch.Tensor, torch.Tensor | None]:
        x = _obs_to_tensor(obs)
        with torch.no_grad():
            out = self._model(x)
        return _logits_value_from_output(out)


class Policy:
    """Runs inference for a single policy checkpoint."""

    def __init__(
        self,
        checkpoint_path: str | None = None,
        ckpt_type: str = "random",
        *,
        checkpoint_bytes: bytes | None = None,
    ) -> None:
        self._ckpt_type = ckpt_type
        self._rng = np.random.default_rng()
        self._torch: _TorchPolicyBackend | None = None
        if ckpt_type == "ppo":
            if checkpoint_bytes is not None:
                self._torch = _TorchPolicyBackend(checkpoint_bytes=checkpoint_bytes)
            elif checkpoint_path is not None:
                self._torch = _TorchPolicyBackend(checkpoint_path)
            else:
                raise ValueError("ppo policy requires checkpoint_path or checkpoint_bytes")

    def act(self, obs: np.ndarray) -> ActionResult:
        if self._ckpt_type == "random" or self._torch is None:
            logits = np.zeros(N_ACTIONS, dtype=np.float32)
            probs = np.full(N_ACTIONS, 1.0 / N_ACTIONS, dtype=np.float32)
            action = int(self._rng.integers(0, N_ACTIONS))
            return ActionResult(action=action, action_probs=probs, value=None, logits=logits)

        logits_t, value_t = self._torch.forward(obs)
        logits_np = logits_t.squeeze(0).detach().cpu().numpy().astype(np.float32)
        probs_t = torch.softmax(logits_t.squeeze(0), dim=-1)
        probs = probs_t.detach().cpu().numpy().astype(np.float32)
        action = int(torch.argmax(probs_t).item())
        value: float | None = None
        if value_t is not None:
            value = float(value_t.squeeze().item())
        return ActionResult(
            action=action,
            action_probs=probs,
            value=value,
            logits=logits_np,
        )


class PolicyRegistry:
    """Central registry for available policy checkpoints."""

    _cache: dict[str, Policy] = {}

    @classmethod
    def _manifest_path(cls) -> Path:
        return checkpoints_dir() / "manifest.json"

    @classmethod
    def _manifest(cls) -> list[dict]:
        mp = cls._manifest_path()
        if not mp.is_file():
            return []
        with mp.open() as f:
            return json.load(f).get("checkpoints", [])

    @classmethod
    def clear_cache(cls) -> None:
        cls._cache.clear()

    @classmethod
    def upsert_manifest_entry(cls, entry: dict) -> None:
        mp = cls._manifest_path()
        checkpoints_dir().mkdir(parents=True, exist_ok=True)
        data: dict = {"checkpoints": []}
        if mp.is_file():
            data = json.loads(mp.read_text())
        data.setdefault("checkpoints", [])
        ids = [c["checkpoint_id"] for c in data["checkpoints"]]
        if entry["checkpoint_id"] in ids:
            data["checkpoints"][ids.index(entry["checkpoint_id"])] = entry
        else:
            data["checkpoints"].append(entry)
        mp.write_text(json.dumps(data, indent=2) + "\n")
        cls.clear_cache()

    @classmethod
    def get(cls, checkpoint_id: str) -> Policy:
        if checkpoint_id in cls._cache:
            return cls._cache[checkpoint_id]
        for entry in cls._manifest():
            if entry["checkpoint_id"] == checkpoint_id:
                rel = entry["path"]
                from .checkpoint_bucket import fetch_object_bytes, inference_from_bucket, object_exists

                if inference_from_bucket():
                    if not object_exists(rel):
                        raise KeyError(
                            f"Checkpoint object missing in bucket: {rel!r} (id={checkpoint_id!r})"
                        )
                    try:
                        policy = Policy(
                            ckpt_type=entry["ckpt_type"],
                            checkpoint_bytes=fetch_object_bytes(rel),
                        )
                    except (FileNotFoundError, ValueError, RuntimeError) as e:
                        raise KeyError(str(e)) from e
                    cls._cache[checkpoint_id] = policy
                    return policy

                full = checkpoints_dir() / rel
                if not full.is_file():
                    raise KeyError(
                        f"Checkpoint file missing on disk: {full} (id={checkpoint_id!r})"
                    )
                try:
                    policy = Policy(
                        checkpoint_path=str(full),
                        ckpt_type=entry["ckpt_type"],
                    )
                except (FileNotFoundError, ValueError) as e:
                    raise KeyError(str(e)) from e
                cls._cache[checkpoint_id] = policy
                return policy
        raise KeyError(f"Checkpoint not found: {checkpoint_id!r}")

    @classmethod
    def list_available(cls) -> list[CheckpointMeta]:
        return [CheckpointMeta(**e) for e in cls._manifest()]
