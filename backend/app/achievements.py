"""Crafter achievement tracking utilities.

Implemented in PR 2 (backend core).
"""

# Crafter has 22 achievements; names are taken from crafter.constants.
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
    """Return achievement keys newly unlocked between two achievement dicts.

    Implemented in PR 2.
    """
    raise NotImplementedError
