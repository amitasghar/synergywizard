"""Extract PoE2 game data from local installation via PyPoE and write poe2_seed.json."""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from slugify import slugify
from PyPoE.poe.file.file_system import FileSystem
from PyPoE.poe.file.dat import RelationalReader
from PyPoE.poe.file.specification.data import poe2 as poe2_spec

# Maps ActiveSkillWeaponRequirement.Id → canonical weapon_tags list.
# Multi-weapon IDs expand to every weapon type they cover so filtering by any
# one of them returns the skill.
WEAPON_REQ_TO_TAGS: dict[str, list[str]] = {
    "Bow":                              ["bow"],
    "WandBow":                          ["wand", "bow"],
    "Crossbow":                         ["crossbow"],
    "Spear":                            ["spear"],
    "SpearBow":                         ["spear", "bow"],
    "SpearBowCrossbow":                 ["spear", "bow", "crossbow"],
    "Wand":                             ["wand"],
    "Dagger":                           ["dagger"],
    "DaggerClaw":                       ["dagger"],
    "One Hand Sword":                   ["sword"],
    "Two Hand Sword":                   ["sword"],
    "Any Sword":                        ["sword"],
    "One Hand Axe":                     ["axe"],
    "Two Hand Axe":                     ["axe"],
    "Any Axe":                          ["axe"],
    "One Hand Mace":                    ["mace"],
    "Two Hand Mace":                    ["mace"],
    "Any Mace":                         ["mace"],
    "Any Blunt Weapon":                 ["mace", "flail"],
    "Flail":                            ["flail"],
    "FlailShield":                      ["flail", "shield"],
    "Quarterstaff":                     ["staff"],
    "PalmQuaterstaff":                  ["staff"],
    "Any Staff":                        ["staff"],
    "Shield":                           ["shield"],
    "Any Shield":                       ["shield"],
    "Buckler":                          ["shield"],
    "Unarmed":                          ["unarmed"],
    "Any SwordAxe":                     ["sword", "axe"],
    "Any MaceSwordAxe":                 ["mace", "sword", "axe"],
    "Any MaceSwordAxeStaff":            ["mace", "sword", "axe", "staff"],
    "One Hand MaceSwordAxe":            ["mace", "sword", "axe"],
    "One Hand Sharp":                   ["sword", "dagger"],
    "Any Dual Wieldable Weapon":        ["sword", "axe", "mace", "dagger", "wand"],
    "Any Melee One Hand and Unarmed":   ["sword", "axe", "mace", "dagger", "unarmed"],
    "Any Melee Weapon":                 ["mace", "sword", "axe", "dagger", "spear", "staff", "flail"],
    "Any Melee Weapon and Unarmed":     ["mace", "sword", "axe", "dagger", "spear", "staff", "flail", "unarmed"],
    "Non-Talisman Melee Weapon":        ["mace", "sword", "axe", "dagger", "spear", "staff", "flail"],
    "Any Martial Weapon":               ["bow", "crossbow", "mace", "sword", "axe", "dagger", "spear", "staff", "flail", "wand"],
    "Any Martial Weapon and Unarmed":   ["bow", "crossbow", "mace", "sword", "axe", "dagger", "spear", "staff", "flail", "wand", "unarmed"],
}

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


def find_ooz(poe2_dir: Path) -> Path:
    """Find ooz.dll for PyPoE bundle decompression.

    Note: PyPoE uses the 'ooz' Python package (ooz.pyd) which is installed as a
    dependency — no manual DLL path is needed. This function is kept for
    compatibility and returns a sentinel path; the actual decompression is handled
    by the ooz Python extension automatically.
    """
    candidates = [
        poe2_dir / "ooz64.dll",
        poe2_dir / "ooz.dll",
        Path(__file__).parent / "bin" / "ooz64.dll",
        Path(__file__).parent / "bin" / "ooz.dll",
    ]
    for path in candidates:
        if path.exists():
            return path
    # The ooz Python package handles decompression internally; a DLL is not required.
    # Return a dummy sentinel so callers don't need to change their interface.
    try:
        import ooz  # noqa: F401 — verify the package is installed
    except ImportError as exc:
        raise FileNotFoundError(
            "ooz Python package not installed and no ooz.dll found.\n"
            "Run: pip install ooz\n"
            "Or download: https://github.com/zao/ooz/releases/download/v0.2.4/bun-0.2.4-x64-Release.zip"
        ) from exc
    return Path("ooz_python_package")  # sentinel — not used for file I/O


def open_bundle_index(poe2_dir: Path, ooz_path: Path) -> RelationalReader:  # ooz_path kept for API compatibility
    """Open the PoE2 bundle index and return a RelationalReader for dat extraction.

    Uses PyPoE's FileSystem abstraction which handles bundle loading on demand.
    The ooz_path argument is accepted for API compatibility but is not used —
    the 'ooz' Python package handles decompression automatically.
    """
    index_path = poe2_dir / "Bundles2" / "_.index.bin"
    if not index_path.exists():
        raise FileNotFoundError(f"Bundle index not found: {index_path}")

    fs = FileSystem(root_path=str(poe2_dir))
    if fs.index is None:
        raise RuntimeError(f"PyPoE could not load bundle index from {poe2_dir}")

    rr = RelationalReader(
        path_or_file_system=fs,
        specification=poe2_spec.specification,
        raise_error_on_missing_relation=False,
        read_options={"x64": True},
    )
    return rr


def read_dat(index: RelationalReader, dat_name: str) -> list[dict]:
    """Extract and parse a .dat64 file via the bundle index RelationalReader.

    Parameters
    ----------
    index:
        RelationalReader returned by open_bundle_index().
    dat_name:
        File name like 'SkillGems.dat64' (without path prefix).

    Returns
    -------
    list of DatRecord rows — access fields by string key, e.g. row['Name'].
    """
    # RelationalReader.__getitem__ accepts 'SkillGems.dat64' and auto-prefixes
    # 'Data/Balance/' for PoE2.
    reader = index[dat_name]
    return reader.table_data


def extract_skill_gems(index) -> list[dict]:
    """Parse SkillGems.dat64 → list of skill/support entities.

    Field names discovered from live smoke test:
    - BaseItemType: DatRecord with 'Name' field (resolved foreign key)
    - GemType: int — 0 = active skill, >0 = support gem
    - IsVaalVariant: bool — skip vaal variants (duplicates)

    Note: PoE2 SkillGems.dat64 has no CharacterClass field — class restrictions
    do not exist at the gem data level in PoE2, so class_tags is always [].
    """
    rows = read_dat(index, "SkillGems.dat64")
    entities: list[dict] = []
    for row in rows:
        try:
            # Skip vaal variants — they duplicate the base gem name
            if row["IsVaalVariant"]:
                continue

            base_item = row["BaseItemType"]
            if not base_item:
                continue
            name = base_item["Name"]
            if not name or not str(name).strip():
                continue

            # GemType: 0 = active skill, 1/2 = support gem variants
            is_support = int(row["GemType"]) != 0
            entity_type = "support" if is_support else "skill"

            entities.append({
                "entity_slug": slugify(name, separator="_"),
                "display_name": name,
                "entity_type": entity_type,
                "class_tags": [],
                "mechanic_tags": [],
                "damage_tags": [],
                "weapon_tags": [],
                "description": "",
            })
        except (KeyError, AttributeError, TypeError):
            continue
    return entities


def enrich_with_active_skills(index, entities: list[dict]) -> list[dict]:
    """Parse ActiveSkills.dat64 and enrich matching entities with mechanic/damage tags.

    Field names discovered from live smoke test:
    - DisplayedName: str skill name
    - ActiveSkillTypes: list of DatRecords, each with 'Id' field (e.g. 'Attack', 'Spell')
    - Description: str
    """
    rows = read_dat(index, "ActiveSkills.dat64")

    active_map: dict[str, dict] = {}
    for row in rows:
        try:
            name = row["DisplayedName"]
            if not name:
                continue

            # ActiveSkillTypes is a list of DatRecords; each has an 'Id' string field
            skill_types = row["ActiveSkillTypes"] or []
            type_names: list[str] = []
            for st in skill_types:
                try:
                    if isinstance(st, str):
                        type_names.append(st)
                    elif hasattr(st, "__getitem__"):
                        type_names.append(str(st["Id"]))
                    elif hasattr(st, "Id"):
                        type_names.append(str(st.Id))
                except (KeyError, AttributeError):
                    pass

            mechanic, damage = map_skill_types(type_names)
            desc = row["Description"] or ""

            weapon_tags: list[str] = []
            try:
                wr = row["WeaponRequirements"]
                if wr:
                    req_id = str(wr["Id"]).strip()
                    if req_id and req_id != "None":
                        weapon_tags = WEAPON_REQ_TO_TAGS.get(req_id, [])
            except (KeyError, TypeError, AttributeError):
                pass

            key = name.lower()
            if key in active_map:
                # Merge duplicate entries (same skill name, different dat rows)
                existing = active_map[key]
                mechanic = sorted(set(existing["mechanic_tags"]) | set(mechanic))
                damage = sorted(set(existing["damage_tags"]) | set(damage))
                weapon_tags = sorted(set(existing["weapon_tags"]) | set(weapon_tags))
                desc = existing["description"] or str(desc)
            active_map[name.lower()] = {
                "mechanic_tags": mechanic,
                "damage_tags": damage,
                "description": str(desc),
                "weapon_tags": weapon_tags,
            }
        except (KeyError, AttributeError, TypeError):
            continue

    enriched = []
    for entity in entities:
        key = entity["display_name"].lower()
        if key in active_map:
            merged = dict(entity)
            merged["mechanic_tags"] = active_map[key]["mechanic_tags"]
            merged["damage_tags"] = active_map[key]["damage_tags"]
            merged["description"] = active_map[key]["description"]
            merged["weapon_tags"] = active_map[key]["weapon_tags"]
            enriched.append(merged)
        else:
            entity.setdefault("weapon_tags", [])
            enriched.append(entity)
    return enriched


def enrich_with_support_text(index, entities: list[dict]) -> list[dict]:
    """Read SupportText from SkillGems.GemEffects for support gems.

    Active skills get descriptions from ActiveSkills.dat64; supports have no
    equivalent table. Instead, SkillGems → GemEffects[0] → SupportText holds
    the human-readable description for each support gem.
    """
    rows = read_dat(index, "SkillGems.dat64")
    support_text_map: dict[str, str] = {}
    for row in rows:
        try:
            is_support = int(row["GemType"]) != 0
            if not is_support:
                continue
            name = row["BaseItemType"]["Name"]
            if not name:
                continue
            gem_effects = row["GemEffects"]
            if not gem_effects:
                continue
            text = str(gem_effects[0]["SupportText"] or "").strip()
            if text:
                support_text_map[str(name).lower()] = text
        except (KeyError, AttributeError, TypeError, IndexError):
            continue

    enriched = []
    for entity in entities:
        if not entity.get("description") and entity["entity_type"] == "support":
            text = support_text_map.get(entity["display_name"].lower())
            if text:
                entity = dict(entity)
                entity["description"] = text
        enriched.append(entity)
    return enriched


def extract_passives(index) -> list[dict]:
    """Parse PassiveSkills.dat64 → list of passive entities.

    Field names discovered from live smoke test:
    - Name: str passive name (may be empty for icon-only nodes)
    - FlavourText: str flavour/description text
    """
    rows = read_dat(index, "PassiveSkills.dat64")
    entities: list[dict] = []
    for row in rows:
        try:
            name = row["Name"]
            if not name or not str(name).strip():
                continue
            name = str(name).strip()

            desc = row["FlavourText"] or ""

            entities.append({
                "entity_slug": slugify(name, separator="_"),
                "display_name": name,
                "entity_type": "passive",
                "class_tags": [],
                "mechanic_tags": [],
                "damage_tags": [],
                "weapon_tags": [],
                "description": str(desc),
            })
        except (KeyError, AttributeError, TypeError):
            continue

    seen: set[str] = set()
    unique: list[dict] = []
    for e in entities:
        if e["entity_slug"] not in seen:
            seen.add(e["entity_slug"])
            unique.append(e)
    return unique


SEED_PATH = Path(__file__).parent / "data" / "poe2_seed.json"


def pob_enrich(entities: list[dict]) -> list[dict]:
    """Reuse POB mechanic_tag enrichment from scraper_poe2.

    Imports are deferred — scraper_poe2 imports requests/mwparserfromhell and
    triggers ensure_pob_repo() (git clone/pull) at call time, not module load.
    """
    from pipeline.scraper_poe2 import ensure_pob_repo, load_all_pob_data, merge_sources

    pob_skills_dir = ensure_pob_repo()
    pob_data = load_all_pob_data(pob_skills_dir)
    return [merge_sources(e, pob_data) for e in entities]


def extract_all(poe2_dir: Path, output_path: Path) -> None:
    """Full extraction pipeline — reads bundles, enriches with POB, writes seed."""
    ooz_path = find_ooz(poe2_dir)
    print(f"Using ooz: {ooz_path}")

    print("Opening bundle index...")
    index = open_bundle_index(poe2_dir, ooz_path)

    print("Extracting SkillGems.dat64...")
    skill_entities = extract_skill_gems(index)
    print(f"  Found {len(skill_entities)} skill/support gems")

    print("Enriching with ActiveSkills.dat64...")
    skill_entities = enrich_with_active_skills(index, skill_entities)

    print("Enriching support gem descriptions from GemEffects.SupportText...")
    skill_entities = enrich_with_support_text(index, skill_entities)

    print("Extracting PassiveSkills.dat64...")
    passive_entities = extract_passives(index)
    print(f"  Found {len(passive_entities)} passives")

    all_entities = skill_entities + passive_entities

    print("Enriching mechanic_tags from POB...")
    try:
        all_entities = pob_enrich(all_entities)
    except Exception as exc:
        print(f"WARNING: POB enrichment failed ({exc}), writing seed without POB tags", file=sys.stderr)

    skills = [e for e in all_entities if e["entity_type"] == "skill"]
    supports = [e for e in all_entities if e["entity_type"] == "support"]
    passives = [e for e in all_entities if e["entity_type"] == "passive"]

    seed = {
        "extracted_at": datetime.now(tz=timezone.utc).isoformat(),
        "patch_version": "unknown",
        "entity_counts": {
            "skill": len(skills),
            "support": len(supports),
            "passive": len(passives),
        },
        "entities": all_entities,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(seed, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Seed written to {output_path}")
    print(f"  skills: {len(skills)}, supports: {len(supports)}, passives: {len(passives)}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract PoE2 game data into poe2_seed.json")
    parser.add_argument(
        "--poe2-dir",
        default=os.environ.get("POE2_DIR", r"F:\SteamLibrary\steamapps\common\Path of Exile 2"),
        help="Path to PoE2 installation directory (env: POE2_DIR; hardcoded fallback is local-dev only)",
    )
    parser.add_argument(
        "--output",
        default=str(SEED_PATH),
        help="Output path for poe2_seed.json",
    )
    parser.add_argument(
        "--patch-version",
        default="",
        help="PoE2 patch version string (e.g. 3.25.0)",
    )
    args = parser.parse_args()

    poe2_dir = Path(args.poe2_dir)
    if not poe2_dir.exists():
        print(f"ERROR: PoE2 directory not found: {poe2_dir}", file=sys.stderr)
        return 1

    try:
        extract_all(poe2_dir, Path(args.output))
        if args.patch_version:
            data = json.loads(Path(args.output).read_text(encoding="utf-8"))
            data["patch_version"] = args.patch_version
            Path(args.output).write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
            print(f"Patch version set to {args.patch_version}")
    except (FileNotFoundError, RuntimeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"FATAL: {exc}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
