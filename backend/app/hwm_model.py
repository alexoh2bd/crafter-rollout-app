"""Hierarchical World Model (HWM) inference for the backend.

Provides:
  - ActionEncoder / HighLevelPredictor   (ported from src/hwm/models.py)
  - cem_low / cem_high                   (ported from src/hwm/plan_hwm.py)
  - WMBaseAgent   — flat CEM planner using only the base LeWM
  - HWMAgent      — two-level CEM planner with ActionEncoder + HighLevelPredictor

Checkpoint layout under CHECKPOINTS_DIR:
  lewm_base.pt       — base LeWM (loaded by WorldModel in world_model.py)
  hwm_high.pt        — ActionEncoder + HighLevelPredictor weights
  goal_library.npz   — goal_frames, goal_names, goal_achievement_steps
"""

from __future__ import annotations

import io
import time
from pathlib import Path
from typing import Optional

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

from .lemodel import PredictorBlock
from .world_model import WorldModel

ACTION_DIM = 17
LATENT_DIM = 256


# ── ActionEncoder ──────────────────────────────────────────────────────────────

class ActionEncoder(nn.Module):
    """Encode a primitive action sequence into a single macro-action vector.

    CLS token + 2-layer bidirectional TransformerEncoder + linear projection to
    latent_dim.  Mirrors src/hwm/models.py:ActionEncoder exactly so that saved
    checkpoints are compatible.
    """

    def __init__(
        self,
        action_dim: int = ACTION_DIM,
        hidden_dim: int = 192,
        latent_dim: int = LATENT_DIM,
        depth: int = 2,
        num_heads: int = 3,
        max_len: int = 64,
    ) -> None:
        super().__init__()
        self.hidden_dim = hidden_dim
        self.latent_dim = latent_dim

        self.action_proj = nn.Linear(action_dim, hidden_dim)

        self.cls_token = nn.Parameter(torch.zeros(1, 1, hidden_dim))
        nn.init.trunc_normal_(self.cls_token, std=0.02)

        self.pos_embed = nn.Parameter(torch.zeros(1, max_len + 1, hidden_dim))
        nn.init.trunc_normal_(self.pos_embed, std=0.02)

        self.blocks = nn.ModuleList([
            nn.TransformerEncoderLayer(
                d_model=hidden_dim,
                nhead=num_heads,
                dim_feedforward=hidden_dim * 4,
                dropout=0.0,
                batch_first=True,
                norm_first=True,
            )
            for _ in range(depth)
        ])
        self.norm = nn.LayerNorm(hidden_dim)
        self.projector = nn.Sequential(
            nn.Linear(hidden_dim, latent_dim),
            nn.BatchNorm1d(latent_dim),
        )

    def forward(self, a_seq: torch.Tensor) -> torch.Tensor:
        """a_seq: (B, L, action_dim) → l: (B, latent_dim)"""
        B, L, _ = a_seq.shape
        x = self.action_proj(a_seq)
        cls = self.cls_token.expand(B, -1, -1)
        x = torch.cat([cls, x], dim=1)
        seq_len = x.shape[1]
        x = x + self.pos_embed[:, :seq_len, :]
        for block in self.blocks:
            x = block(x)
        x = self.norm(x)
        return self.projector(x[:, 0])


# ── HighLevelPredictor ─────────────────────────────────────────────────────────

class HighLevelPredictor(nn.Module):
    """Single-step latent predictor conditioned on macro-action vectors.

    Uses the same PredictorBlock / AdaLN architecture as lemodel.Predictor but
    accepts l ∈ R^{latent_dim} macro-actions instead of one-hot primitives.
    Mirrors src/hwm/models.py:HighLevelPredictor for checkpoint compatibility.
    """

    def __init__(
        self,
        latent_dim: int = LATENT_DIM,
        depth: int = 6,
        num_heads: int = 16,
        mlp_ratio: float = 4.0,
        dropout: float = 0.1,
        context_len: int = 3,
    ) -> None:
        super().__init__()
        self.latent_dim = latent_dim
        self.context_len = context_len

        self.action_embed = nn.Sequential(
            nn.Linear(latent_dim, latent_dim),
            nn.SiLU(),
            nn.Linear(latent_dim, latent_dim),
        )

        self.pos_embed = nn.Parameter(torch.zeros(1, context_len, latent_dim))
        nn.init.trunc_normal_(self.pos_embed, std=0.02)

        self.blocks = nn.ModuleList([
            PredictorBlock(latent_dim, num_heads, latent_dim, mlp_ratio, dropout)
            for _ in range(depth)
        ])

        self.projector = nn.Sequential(
            nn.Linear(latent_dim, latent_dim),
            nn.BatchNorm1d(latent_dim),
        )

    def forward(self, z_seq: torch.Tensor, l_seq: torch.Tensor) -> torch.Tensor:
        """z_seq: (B,T,D), l_seq: (B,T,D) → z_hat: (B,T,D)"""
        B, T, D = z_seq.shape
        cond = self.action_embed(l_seq)
        x = z_seq + self.pos_embed[:, :T, :]

        causal_mask = torch.triu(
            torch.ones(T, T, device=z_seq.device), diagonal=1
        ).bool().masked_fill(
            torch.triu(torch.ones(T, T, device=z_seq.device), diagonal=1).bool(),
            float("-inf"),
        )

        for block in self.blocks:
            x = block(x, cond, causal_mask=causal_mask)

        x_flat = x.reshape(B * T, D)
        return self.projector(x_flat).reshape(B, T, D)

    @torch.no_grad()
    def rollout(self, z0: torch.Tensor, l_seq: torch.Tensor) -> torch.Tensor:
        """Autoregressive rollout.

        z0: (B, D), l_seq: (B, H, D) → z_traj: (B, H+1, D)
        """
        B, H, _ = l_seq.shape
        z_history = [z0]

        for t in range(H):
            z_stack = torch.stack(z_history, dim=1)  # (B, t+1, D)
            l_stack = l_seq[:, : t + 1]
            z_hat = self.forward(z_stack, l_stack)
            z_history.append(z_hat[:, -1])

        return torch.stack(z_history, dim=1)  # (B, H+1, D)


# ── CEM planning algorithms ────────────────────────────────────────────────────

def _one_hot(actions: np.ndarray, n: int = ACTION_DIM, device: torch.device = torch.device("cpu")) -> torch.Tensor:
    t = torch.from_numpy(actions.astype(np.int64)).to(device)
    return F.one_hot(t, num_classes=n).float()


def cem_low(
    lewm_model: "_LeWMRolloutWrapper",
    z_curr: torch.Tensor,
    z_subgoal: torch.Tensor,
    H: int = 10,
    n_samples: int = 100,
    n_elite: int = 10,
    n_iters: int = 3,
    device: torch.device = torch.device("cpu"),
) -> int:
    """Flat CEM: pick the first action of the sequence that minimises L1 to z_subgoal.

    Args:
        lewm_model: object with .rollout(z_exp, a_oh) → (B, H+1, D) tensor
        z_curr:     (1, D) current latent
        z_subgoal:  (1, D) subgoal latent
    Returns:
        Scalar int action index (0..ACTION_DIM-1)
    """
    logits = torch.zeros(H, ACTION_DIM, device=device)
    z_curr_exp = z_curr.expand(n_samples, -1)
    z_sub_exp = z_subgoal.expand(n_samples, -1)

    for _ in range(n_iters):
        probs = torch.softmax(logits, dim=-1)
        a_samples = torch.multinomial(
            probs.unsqueeze(0).expand(n_samples, -1, -1).reshape(n_samples * H, ACTION_DIM),
            num_samples=1,
        ).reshape(n_samples, H)

        a_oh = _one_hot(a_samples.cpu().numpy(), ACTION_DIM, device)

        with torch.no_grad():
            z_traj = lewm_model.rollout(z_curr_exp, a_oh)  # (n_samples, H+1, D)

        z_final = z_traj[:, -1]
        costs = F.l1_loss(z_final, z_sub_exp, reduction="none").sum(dim=-1)

        elite_idx = torch.argsort(costs)[:n_elite]
        elite_actions = a_samples[elite_idx]

        for t in range(H):
            counts = torch.bincount(elite_actions[:, t], minlength=ACTION_DIM).float()
            logits[t] = logits[t] * 0.5 + (counts / counts.sum()).log().clamp(min=-10) * 0.5

    return int(torch.argmax(logits[0]).item())


def cem_high(
    high_pred: HighLevelPredictor,
    z_curr: torch.Tensor,
    z_goal: torch.Tensor,
    H_hi: int = 3,
    n_samples: int = 100,
    n_elite: int = 10,
    n_iters: int = 3,
    device: torch.device = torch.device("cpu"),
    macro_action_mean: Optional[torch.Tensor] = None,
    macro_action_std: Optional[torch.Tensor] = None,
) -> tuple[torch.Tensor, torch.Tensor]:
    """Gaussian CEM over H_hi macro-actions in R^{latent_dim}.

    Returns (best_l_seq (1,H_hi,D), z_subgoal (1,D)).
    """
    D = z_curr.shape[-1]

    mu = (
        macro_action_mean.to(device).unsqueeze(0).expand(H_hi, -1).clone()
        if macro_action_mean is not None
        else torch.zeros(H_hi, D, device=device)
    )
    sigma = (
        macro_action_std.to(device).unsqueeze(0).expand(H_hi, -1).clone()
        if macro_action_std is not None
        else torch.ones(H_hi, D, device=device)
    )

    z_curr_exp = z_curr.expand(n_samples, -1)
    z_goal_exp = z_goal.expand(n_samples, -1)
    best_l_seq = mu.unsqueeze(0)

    for iteration in range(n_iters):
        eps = torch.randn(n_samples, H_hi, D, device=device)
        l_samples = mu.unsqueeze(0) + sigma.unsqueeze(0) * eps  # (n_samples, H_hi, D)

        with torch.no_grad():
            z_traj = high_pred.rollout(z_curr_exp, l_samples)  # (n_samples, H_hi+1, D)

        costs = F.l1_loss(z_traj[:, -1], z_goal_exp, reduction="none").sum(dim=-1)
        elite_idx = torch.argsort(costs)[:n_elite]
        elite_l = l_samples[elite_idx]

        mu = elite_l.mean(dim=0)
        sigma = elite_l.std(dim=0) + 1e-4

        if iteration == n_iters - 1:
            best_l_seq = mu.unsqueeze(0)

    with torch.no_grad():
        z_subgoal = high_pred(
            z_curr.unsqueeze(1),
            best_l_seq[:, :1, :],
        ).squeeze(1)

    return best_l_seq, z_subgoal


# ── LeWM rollout wrapper ───────────────────────────────────────────────────────

class _LeWMRolloutWrapper:
    """Thin wrapper so cem_low can call .rollout() on the LeWM predictor."""

    def __init__(self, world_model: WorldModel) -> None:
        self._wm = world_model

    def rollout(self, z_exp: torch.Tensor, a_oh: torch.Tensor) -> torch.Tensor:
        """z_exp: (B,D), a_oh: (B,H,A) → (B,H+1,D)"""
        return self._wm._model.rollout(z_exp, a_oh)


# ── HWM checkpoint loader ──────────────────────────────────────────────────────

def _load_hwm_high(
    *,
    ckpt_path: str | None = None,
    ckpt_bytes: bytes | None = None,
    device: torch.device,
) -> tuple[ActionEncoder, HighLevelPredictor, torch.Tensor, torch.Tensor]:
    """Load ActionEncoder + HighLevelPredictor from a saved HWM checkpoint."""
    if (ckpt_path is None) == (ckpt_bytes is None):
        raise ValueError("Provide exactly one of ckpt_path or ckpt_bytes")
    if ckpt_bytes is not None:
        ckpt = torch.load(io.BytesIO(ckpt_bytes), map_location=device, weights_only=False)
    else:
        ckpt = torch.load(ckpt_path, map_location=device, weights_only=False)
    saved_args = ckpt.get("args", {})

    action_enc = ActionEncoder(
        action_dim=ACTION_DIM,
        latent_dim=LATENT_DIM,
        max_len=saved_args.get("max_subseq_len", 32),
    ).to(device)
    action_enc.load_state_dict(ckpt["action_encoder"])
    action_enc.eval()
    for p in action_enc.parameters():
        p.requires_grad_(False)

    high_pred = HighLevelPredictor(
        latent_dim=LATENT_DIM,
        depth=6,
        num_heads=16,
        dropout=0.1,
        context_len=3,
    ).to(device)
    high_pred.load_state_dict(ckpt["high_predictor"])
    high_pred.eval()
    for p in high_pred.parameters():
        p.requires_grad_(False)

    macro_mean = ckpt.get("macro_action_mean", torch.zeros(LATENT_DIM)).to(device)
    macro_std = ckpt.get("macro_action_std", torch.ones(LATENT_DIM)).to(device)

    return action_enc, high_pred, macro_mean, macro_std


# ── Goal library ───────────────────────────────────────────────────────────────

class GoalLibrary:
    """Thin wrapper around goal_library.npz."""

    def __init__(self, path: str | None = None, *, npz_bytes: bytes | None = None) -> None:
        if (path is None) == (npz_bytes is None):
            raise ValueError("Provide exactly one of path or npz_bytes")
        if npz_bytes is not None:
            data = np.load(io.BytesIO(npz_bytes), allow_pickle=True)
        else:
            data = np.load(path, allow_pickle=True)
        self.goal_names: list[str] = list(data["goal_names"])
        self.goal_frames: np.ndarray = data["goal_frames"]  # (N, 64, 64, 3) uint8
        self.goal_achievement_steps: list[int] = [int(x) for x in data["goal_achievement_steps"]]

    def list_achievements(self) -> list[str]:
        return list(self.goal_names)

    def get_goal_frame(self, achievement: str) -> np.ndarray:
        idx = self.goal_names.index(achievement)
        return self.goal_frames[idx]  # (64, 64, 3) uint8


# ── WMBaseAgent ────────────────────────────────────────────────────────────────

class WMBaseAgent:
    """Autonomous agent using flat CEM planning with the base LeWM only.

    One instance is shared across sessions (stateless except for the device
    and model weights).  Per-session state (z_goal) is passed into plan_step.
    """

    def __init__(
        self,
        world_model: WorldModel,
        goal_library_path: Optional[str] = None,
        *,
        goal_library_bytes: bytes | None = None,
    ) -> None:
        self._wm = world_model
        self._rollout = _LeWMRolloutWrapper(world_model)
        self._device = world_model._device
        self._goal_lib: Optional[GoalLibrary] = None
        if goal_library_bytes is not None:
            self._goal_lib = GoalLibrary(npz_bytes=goal_library_bytes)
        elif goal_library_path and Path(goal_library_path).is_file():
            self._goal_lib = GoalLibrary(goal_library_path)

    def list_achievements(self) -> list[str]:
        return self._goal_lib.list_achievements() if self._goal_lib else []

    def encode_goal(self, achievement: str) -> np.ndarray:
        """Encode the goal frame for the given achievement → (latent_dim,) float32."""
        if self._goal_lib is None:
            raise RuntimeError("No goal library loaded.")
        frame = self._goal_lib.get_goal_frame(achievement)
        return self._wm.encode(frame)  # (D,)

    def plan_step(
        self,
        obs: np.ndarray,
        z_goal: np.ndarray,
        H_lo: int = 10,
        n_samples: int = 100,
        n_elite: int = 10,
        n_iters: int = 3,
    ) -> tuple[int, float, float]:
        """Plan one action using flat CEM toward z_goal.

        Args:
            obs:      (64,64,3) uint8 current observation.
            z_goal:   (latent_dim,) float32 goal latent.

        Returns:
            (action, planning_ms, z_goal_dist)
        """
        t0 = time.perf_counter()

        z_curr_np = self._wm.encode(obs)  # (D,)
        z_curr = torch.from_numpy(z_curr_np).float().unsqueeze(0).to(self._device)
        z_goal_t = torch.from_numpy(z_goal).float().unsqueeze(0).to(self._device)

        action = cem_low(
            self._rollout,
            z_curr,
            z_goal_t,
            H=H_lo,
            n_samples=n_samples,
            n_elite=n_elite,
            n_iters=n_iters,
            device=self._device,
        )

        planning_ms = (time.perf_counter() - t0) * 1000.0
        z_goal_dist = float(
            F.l1_loss(z_curr, z_goal_t, reduction="none").sum().item()
        )

        return action, planning_ms, z_goal_dist


# ── HWMAgent ───────────────────────────────────────────────────────────────────

class HWMAgent:
    """Autonomous agent using two-level CEM (ActionEncoder + HighLevelPredictor + LeWM).

    Create a *fresh instance per WebSocket session* so that subgoal state
    (z_subgoal, steps_since_replan) is correctly reset between episodes.
    """

    def __init__(
        self,
        world_model: WorldModel,
        hwm_ckpt_path: str | None = None,
        goal_library_path: Optional[str] = None,
        *,
        hwm_checkpoint_bytes: bytes | None = None,
        goal_library_bytes: bytes | None = None,
    ) -> None:
        self._wm = world_model
        self._rollout = _LeWMRolloutWrapper(world_model)
        self._device = world_model._device

        if hwm_checkpoint_bytes is not None:
            self._action_enc, self._high_pred, self._macro_mean, self._macro_std = (
                _load_hwm_high(ckpt_bytes=hwm_checkpoint_bytes, device=self._device)
            )
        elif hwm_ckpt_path is not None:
            self._action_enc, self._high_pred, self._macro_mean, self._macro_std = (
                _load_hwm_high(ckpt_path=hwm_ckpt_path, device=self._device)
            )
        else:
            raise ValueError("Provide hwm_ckpt_path or hwm_checkpoint_bytes")

        self._goal_lib: Optional[GoalLibrary] = None
        if goal_library_bytes is not None:
            self._goal_lib = GoalLibrary(npz_bytes=goal_library_bytes)
        elif goal_library_path and Path(goal_library_path).is_file():
            self._goal_lib = GoalLibrary(goal_library_path)

        # Per-session state — reset via reset_episode()
        self._z_subgoal: Optional[torch.Tensor] = None
        self._steps_since_replan: int = 999  # force replan on first step

    def reset_episode(self) -> None:
        self._z_subgoal = None
        self._steps_since_replan = 999

    def list_achievements(self) -> list[str]:
        return self._goal_lib.list_achievements() if self._goal_lib else []

    def encode_goal(self, achievement: str) -> np.ndarray:
        if self._goal_lib is None:
            raise RuntimeError("No goal library loaded.")
        frame = self._goal_lib.get_goal_frame(achievement)
        return self._wm.encode(frame)

    def plan_step(
        self,
        obs: np.ndarray,
        z_goal: np.ndarray,
        H_lo: int = 10,
        H_hi: int = 3,
        n_samples_lo: int = 100,
        n_samples_hi: int = 100,
        n_elite_lo: int = 10,
        n_elite_hi: int = 10,
        n_iters: int = 3,
        subgoal_threshold: float = 2.0,
    ) -> tuple[int, float, float]:
        """Two-level CEM step.

        Returns:
            (action, planning_ms, z_goal_dist) where z_goal_dist is the L1
            distance from the current latent to the *final* goal (not subgoal).
        """
        t0 = time.perf_counter()

        z_curr_np = self._wm.encode(obs)
        z_curr = torch.from_numpy(z_curr_np).float().unsqueeze(0).to(self._device)
        z_goal_t = torch.from_numpy(z_goal).float().unsqueeze(0).to(self._device)

        # Decide whether to run high-level replan
        need_replan = self._z_subgoal is None or self._steps_since_replan >= H_lo
        if self._z_subgoal is not None and not need_replan:
            dist = F.l1_loss(z_curr, self._z_subgoal, reduction="none").sum().item()
            need_replan = dist < subgoal_threshold

        if need_replan:
            _, self._z_subgoal = cem_high(
                self._high_pred,
                z_curr,
                z_goal_t,
                H_hi=H_hi,
                n_samples=n_samples_hi,
                n_elite=n_elite_hi,
                n_iters=n_iters,
                device=self._device,
                macro_action_mean=self._macro_mean,
                macro_action_std=self._macro_std,
            )
            self._steps_since_replan = 0

        action = cem_low(
            self._rollout,
            z_curr,
            self._z_subgoal,
            H=H_lo,
            n_samples=n_samples_lo,
            n_elite=n_elite_lo,
            n_iters=n_iters,
            device=self._device,
        )
        self._steps_since_replan += 1

        planning_ms = (time.perf_counter() - t0) * 1000.0
        z_goal_dist = float(
            F.l1_loss(z_curr, z_goal_t, reduction="none").sum().item()
        )

        return action, planning_ms, z_goal_dist

    def clone_for_session(self) -> HWMAgent:
        """New session with fresh subgoal state; reuses loaded weights (no disk / S3 reload)."""
        o = HWMAgent.__new__(HWMAgent)
        o._wm = self._wm
        o._rollout = _LeWMRolloutWrapper(self._wm)
        o._device = self._device
        o._action_enc = self._action_enc
        o._high_pred = self._high_pred
        o._macro_mean = self._macro_mean
        o._macro_std = self._macro_std
        o._goal_lib = self._goal_lib
        o._z_subgoal = None
        o._steps_since_replan = 999
        return o
