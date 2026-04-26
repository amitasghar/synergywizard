"""Extract PoE2 game data from local installation via PyPoE and write poe2_seed.json."""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from slugify import slugify

# Mechanic tags from PoE2 ActiveSkillType enum names
SKILL_TYPE_TO_MECHANIC: dict[str, str] = {
    "Attack": "attack",
    "Spell": "spell",
    "Slam": "slam",
    "Area": "aoe",
    "Projectile": "projectile",
    "Melee": "melee",
    "Ranged": "ranged",
    "Totem": "totem",
    "Trap": "trap",
    "Mine": "mine",
    "Minion": "minion",
    "Channelled": "channelling",
    "Channeling": "channelling",
    "Movement": "movement",
    "Travel": "travel",
    "Warcry": "warcry",
    "Trigger": "trigger",
    "Duration": "duration",
    "Brand": "brand",
    "Herald": "herald",
    "Aura": "aura",
    "Curse": "curse",
    "Mark": "mark",
    "Bow": "bow",
    "Shield": "shield",
}

# Damage tags from PoE2 ActiveSkillType enum names
SKILL_TYPE_TO_DAMAGE: dict[str, str] = {
    "Fire": "fire",
    "Cold": "cold",
    "Lightning": "lightning",
    "Physical": "physical",
    "Chaos": "chaos",
}

# PoE2 class ID → tag name (CharacterClass enum values)
CLASS_ID_TO_TAG: dict[int, str] = {
    1: "warrior",
    2: "ranger",
    3: "witch",
    4: "sorceress",
    5: "mercenary",
    6: "monk",
}


def map_skill_types(type_names: list[str]) -> tuple[list[str], list[str]]:
    """Convert PoE2 ActiveSkillType names to (mechanic_tags, damage_tags)."""
    mechanic: set[str] = set()
    damage: set[str] = set()
    for name in type_names:
        if name in SKILL_TYPE_TO_MECHANIC:
            mechanic.add(SKILL_TYPE_TO_MECHANIC[name])
        if name in SKILL_TYPE_TO_DAMAGE:
            damage.add(SKILL_TYPE_TO_DAMAGE[name])
    return sorted(mechanic), sorted(damage)
