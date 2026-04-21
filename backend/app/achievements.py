# Cursor (AI-assisted).
"""Crafter achievement tracking utilities."""

ACHIEVEMENT_NAMES: list[str] = [
    "collect_coal",
    "collect_diamond",
    "collect_drink",
    "collect_iron",
    "collect_sapling",
    "collect_stone",
    "collect_wood",
    "defeat_skeleton",
    "defeat_zombie",
    "eat_cow",
    "eat_plant",
    "make_iron_pickaxe",
    "make_iron_sword",
    "make_stone_pickaxe",
    "make_stone_sword",
    "make_wood_pickaxe",
    "make_wood_sword",
    "place_furnace",
    "place_plant",
    "place_stone",
    "place_table",
    "wake_up",
]


def diff_achievements(
    prev: dict[str, int],
    curr: dict[str, int],
) -> list[str]:
    """Return achievement keys newly reached (0 → ≥1) between two snapshots."""
    return [k for k, v in curr.items() if v > 0 and prev.get(k, 0) == 0]