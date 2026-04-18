"""Pydantic request/response schemas."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel

ACTION_NAMES: list[str] = [
    "noop",
    "move_left",
    "move_right",
    "move_up",
    "move_down",
    "do",
    "sleep",
    "place_stone",
    "place_table",
    "place_furnace",
    "place_plant",
    "make_wood_pickaxe",
    "make_stone_pickaxe",
    "make_iron_pickaxe",
    "make_wood_sword",
    "make_stone_sword",
    "make_iron_sword",
]


class InventoryState(BaseModel):
    health: int = 0
    food: int = 0
    drink: int = 0
    energy: int = 0
    sapling: int = 0
    wood: int = 0
    stone: int = 0
    coal: int = 0
    iron: int = 0
    diamond: int = 0
    wood_pickaxe: int = 0
    stone_pickaxe: int = 0
    iron_pickaxe: int = 0
    wood_sword: int = 0
    stone_sword: int = 0
    iron_sword: int = 0


class FrameMessage(BaseModel):
    step: int
    obs: str  # base64-encoded PNG
    latent: list[float] | None
    action: int
    action_name: str
    reward: float
    done: bool
    inventory: InventoryState
    achievements_unlocked_this_step: list[str]
    source: Literal["human", "agent"]
    checkpoint_id: str | None
    action_probs: list[float] | None
    value_estimate: float | None
    seed: int
    timestamp: datetime


class StartSessionRequest(BaseModel):
    mode: Literal["human", "agent", "imagination"] = "human"
    seed: int | None = None


class StartSessionResponse(BaseModel):
    session_id: str
    seed: int
