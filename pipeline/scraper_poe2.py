"""Scrape POE2 wiki.gg + PathOfBuilding source for skill/support/passive data."""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path
from typing import Iterable

import mwparserfromhell
import requests
from slugify import slugify

WIKI_API = "https://poe2.wiki.gg/api.php"
USER_AGENT = "synergywizard-pipeline/0.1 (contact: aasghar@gmail.com)"
CATEGORIES = {
    "skill": "Category:Active_skill_gems",
    "support": "Category:Support_skill_gems",
    "passive": "Category:Passive_skills",
}
POB_REPO = "https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2.git"
POB_DIR = Path(__file__).parent / "PathOfBuilding"
REQUEST_DELAY_SECONDS = 1.0

POB_TYPE_MAP = {
    "Slam": "slam",
    "Fire": "fire",
    "Cold": "cold",
    "Lightning": "lightning",
    "Physical": "physical",
    "Chaos": "chaos",
    "AreaSpell": "aoe",
    "Area": "aoe",
    "Projectile": "projectile",
    "Melee": "melee",
    "Totem": "totem",
    "Trap": "trap",
    "Mine": "mine",
    "Minion": "minion",
    "Channelling": "channelling",
    "Movement": "movement",
    "Travel": "travel",
    "Warcry": "warcry",
    "Trigger": "trigger",
    "Duration": "duration",
    "Brand": "brand",
}

SEED_PATH = Path(__file__).parent / "data" / "poe2_seed.json"


def load_from_seed() -> list[dict] | None:
    if not SEED_PATH.exists():
        return None
    try:
        data = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"Warning: seed file unreadable ({exc}), skipping", file=sys.stderr)
        return None
    counts = data.get("entity_counts", {})
    print(f"Using seed file: {counts} (extracted {data.get('extracted_at', 'unknown')})")
    return data["entities"]


def _get(url: str, params: dict | None = None) -> dict:
    resp = requests.get(
        url,
        params=params or {},
        headers={"User-Agent": USER_AGENT},
        timeout=30,
    )
    resp.raise_for_status()
    time.sleep(REQUEST_DELAY_SECONDS)
    return resp.json()


def fetch_category_members(category: str) -> list[str]:
    titles: list[str] = []
    params = {
        "action": "query",
        "list": "categorymembers",
        "cmtitle": category,
        "cmlimit": "500",
        "format": "json",
    }
    while True:
        data = _get(WIKI_API, params)
        for member in data.get("query", {}).get("categorymembers", []):
            titles.append(member["title"])
        cont = data.get("continue")
        if not cont:
            break
        params.update(cont)
    return titles


def fetch_page_wikitext(title: str) -> str:
    data = _get(
        WIKI_API,
        {
            "action": "parse",
            "page": title,
            "prop": "wikitext",
            "format": "json",
            "formatversion": "2",
        },
    )
    return data.get("parse", {}).get("wikitext", "")


def _split_csv(value: str) -> list[str]:
    return [part.strip().lower().replace(" ", "_") for part in value.split(",") if part.strip()]


def parse_wiki_infobox(title: str, wikitext: str) -> dict:
    parsed = mwparserfromhell.parse(wikitext)
    templates = parsed.filter_templates()

    mechanic_tags: list[str] = []
    damage_tags: list[str] = []
    class_tags: list[str] = []
    description = ""

    for template in templates:
        tname = str(template.name).strip().lower()
        if tname not in ("skill", "support", "passive"):
            continue
        for param in template.params:
            key = str(param.name).strip().lower()
            value = str(param.value).strip()
            if key == "skill_tags":
                mechanic_tags = _split_csv(value)
            elif key == "damage_types":
                damage_tags = _split_csv(value)
            elif key == "class":
                class_tags = [value.strip().lower()]
            elif key == "description":
                description = value

    return {
        "entity_slug": slugify(title, separator="_"),
        "display_name": title,
        "entity_type": "skill",
        "class_tags": class_tags,
        "mechanic_tags": mechanic_tags,
        "damage_tags": damage_tags,
        "description": description,
    }


def parse_pob_lua(lua_text: str) -> dict:
    result: dict[str, dict] = {}
    block_pattern = re.compile(
        r'skills\["(?P<id>\w+)"\]\s*=\s*\{(?P<body>.*?)\n\}\s*',
        re.DOTALL,
    )
    for match in block_pattern.finditer(lua_text):
        body = match.group("body")
        name_match = re.search(r'name\s*=\s*"([^"]+)"', body)
        types_block = re.search(r'skillTypes\s*=\s*\{([^}]*)\}', body)
        type_keys: list[str] = []
        if types_block:
            type_keys = re.findall(r'SkillType\.(\w+)', types_block.group(1))
        result[match.group("id")] = {
            "name": name_match.group(1) if name_match else "",
            "skill_types": type_keys,
        }
    return result


def merge_sources(wiki_entity: dict, pob_data: dict) -> dict:
    merged = dict(wiki_entity)
    mech = set(merged.get("mechanic_tags", []))
    target_name = merged["display_name"].lower()
    for _, row in pob_data.items():
        if row.get("name", "").lower() != target_name:
            continue
        for pob_key in row.get("skill_types", []):
            mapped = POB_TYPE_MAP.get(pob_key)
            if mapped:
                mech.add(mapped)
    merged["mechanic_tags"] = sorted(mech)
    return merged


def ensure_pob_repo() -> Path:
    if POB_DIR.exists():
        subprocess.run(["git", "-C", str(POB_DIR), "pull", "--ff-only"], check=True)
    else:
        subprocess.run(["git", "clone", "--depth", "1", POB_REPO, str(POB_DIR)], check=True)
    return POB_DIR / "src" / "Data" / "Skills"


def load_all_pob_data(skills_dir: Path) -> dict:
    combined: dict[str, dict] = {}
    for lua_file in skills_dir.glob("*.lua"):
        combined.update(parse_pob_lua(lua_file.read_text(encoding="utf-8", errors="ignore")))
    return combined


def _pob_only_entities(pob_data: dict) -> list[dict]:
    """Build minimal entities from POB data alone when wiki is unavailable."""
    entities: list[dict] = []
    for _skill_id, row in pob_data.items():
        name = row.get("name", "").strip()
        if not name:
            continue
        mech: list[str] = []
        for pob_key in row.get("skill_types", []):
            mapped = POB_TYPE_MAP.get(pob_key)
            if mapped:
                mech.append(mapped)
        entity_type = "support" if name.lower().endswith(" support") else "skill"
        entities.append({
            "entity_slug": slugify(name, separator="_"),
            "display_name": name,
            "entity_type": entity_type,
            "class_tags": [],
            "mechanic_tags": sorted(set(mech)),
            "damage_tags": [],
            "description": "",
        })
    seen: set[str] = set()
    unique: list[dict] = []
    for e in entities:
        if e["entity_slug"] not in seen:
            seen.add(e["entity_slug"])
            unique.append(e)
    return unique


def scrape_all() -> list[dict]:
    pob_skills_dir = ensure_pob_repo()
    pob_data = load_all_pob_data(pob_skills_dir)

    # Priority 1: committed seed file (game data extraction)
    seed_entities = load_from_seed()
    if seed_entities:
        return [merge_sources(e, pob_data) for e in seed_entities]

    # Priority 2: wiki (may come back someday)
    try:
        entities: list[dict] = []
        for entity_type, category in CATEGORIES.items():
            for title in fetch_category_members(category):
                wikitext = fetch_page_wikitext(title)
                entity = parse_wiki_infobox(title, wikitext)
                entity["entity_type"] = entity_type
                entity = merge_sources(entity, pob_data)
                entities.append(entity)
        return entities
    except Exception as exc:
        print(f"Wiki scrape failed ({exc}), falling back to POB-only mode", file=sys.stderr)

    # Priority 3: POB-only fallback
    return _pob_only_entities(pob_data)


def main() -> int:
    patch_version = os.environ.get("PATCH_VERSION", "unknown")
    entities = scrape_all()
    out = {"patch_version": patch_version, "entities": entities}
    sys.stdout.write(json.dumps(out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
