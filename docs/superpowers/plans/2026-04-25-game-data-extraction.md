# Game Data Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract complete PoE2 entity data (skills, supports, passives) from the local game installation into a committed seed file that the CI pipeline uses automatically instead of the blocked wiki API.

**Architecture:** A local Python script reads `.dat64` files from the PoE2 Bundles2 directory via PyPoE (wiki fork), maps game keyword tags to our mechanic/damage/class schema, enriches with POB data, and writes `pipeline/data/poe2_seed.json`. `scraper_poe2.py` checks for this seed first before falling back to wiki/POB-only. An `/admin` page shows seed staleness and a copyable run command. A Netlify Function `/api/seed-status` provides the runtime data.

**Tech Stack:** Python 3.11+, PyPoE wiki fork (git install), ooz.dll for bundle decompression, TypeScript/React (no router — pathname check), Netlify Functions (Deno/Node edge)

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `pipeline/extract_game_data.py` | CLI entry point — reads bundles, writes seed |
| Create | `pipeline/data/.gitkeep` | Makes `pipeline/data/` tracked; seed JSON added after first extraction |
| Create | `pipeline/tests/test_extract_game_data.py` | Unit tests for keyword mapping function |
| Modify | `pipeline/requirements.txt` | Add PyPoE wiki fork |
| Modify | `pipeline/scraper_poe2.py` | Add `load_from_seed()`, update `scrape_all()` |
| Modify | `pipeline/tests/test_scraper_poe2.py` | Extend with seed path test |
| Create | `netlify/functions/seed-status.ts` | `/api/seed-status` — returns seed metadata |
| Create | `src/components/AdminPage.tsx` | Status card + command box |
| Modify | `src/main.tsx` | Render `AdminPage` when `pathname` starts with `/admin` |

---

### Task 1: Add PyPoE dependency

**Files:**
- Modify: `pipeline/requirements.txt`

- [ ] **Step 1: Add PyPoE to requirements.txt**

Replace the contents of `pipeline/requirements.txt` with:

```
requests==2.32.3
anthropic>=0.50.0
psycopg2-binary==2.9.10
beautifulsoup4==4.12.3
mwparserfromhell==0.6.6
python-slugify==8.0.4
fastembed==0.8.0
pytest==8.3.3
git+https://github.com/Project-Path-of-Exile-Wiki/PyPoE.git@dev
```

- [ ] **Step 2: Install the dependency**

```bash
cd F:\Code\2025projects\games\synergywizard
pip install git+https://github.com/Project-Path-of-Exile-Wiki/PyPoE.git@dev
```

Expected: PyPoE installs without error. It will pull in its own dependencies (dacite, pydantic, etc.).

- [ ] **Step 3: Verify import works**

```bash
python -c "from PyPoE.poe.file.bundle import IndexFile; from PyPoE.poe.file.dat import DatFile; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Create `pipeline/data/` directory tracking**

```bash
mkdir pipeline\data
echo. > pipeline\data\.gitkeep
```

- [ ] **Step 5: Commit**

```bash
git add pipeline/requirements.txt pipeline/data/.gitkeep
git commit -m "chore: add PyPoE wiki fork dependency and pipeline/data dir"
```

---

### Task 2: Keyword → tag mapping + unit tests

**Files:**
- Create: `pipeline/extract_game_data.py` (skeleton with mapping only)
- Create: `pipeline/tests/test_extract_game_data.py`

The mapping converts PoE2 `ActiveSkillType` enum names (from PyPoE) to our mechanic/damage tag vocabulary.

- [ ] **Step 1: Create `pipeline/extract_game_data.py` with the mapping only**

```python
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
```

- [ ] **Step 2: Write the failing tests**

Create `pipeline/tests/test_extract_game_data.py`:

```python
from pipeline.extract_game_data import map_skill_types, CLASS_ID_TO_TAG


def test_map_skill_types_mechanic():
    mechanic, damage = map_skill_types(["Attack", "Melee", "Slam"])
    assert "attack" in mechanic
    assert "melee" in mechanic
    assert "slam" in mechanic
    assert damage == []


def test_map_skill_types_damage():
    mechanic, damage = map_skill_types(["Spell", "Fire", "Cold"])
    assert "spell" in mechanic
    assert "fire" in damage
    assert "cold" in damage


def test_map_skill_types_unknown_ignored():
    mechanic, damage = map_skill_types(["UnknownType123"])
    assert mechanic == []
    assert damage == []


def test_map_skill_types_empty():
    mechanic, damage = map_skill_types([])
    assert mechanic == []
    assert damage == []


def test_class_id_map_covers_six_classes():
    assert len(CLASS_ID_TO_TAG) == 6
    assert CLASS_ID_TO_TAG[1] == "warrior"
    assert CLASS_ID_TO_TAG[6] == "monk"
```

- [ ] **Step 3: Run tests to verify they fail (module not fully importable yet)**

```bash
cd F:\Code\2025projects\games\synergywizard
python -m pytest pipeline/tests/test_extract_game_data.py -v
```

Expected: ImportError or attribute errors — the functions exist but the module may have import issues until PyPoE is installed. Once PyPoE is installed (Task 1), these should pass.

- [ ] **Step 4: Run tests to verify they pass**

```bash
python -m pytest pipeline/tests/test_extract_game_data.py -v
```

Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add pipeline/extract_game_data.py pipeline/tests/test_extract_game_data.py
git commit -m "feat(pipeline): keyword → tag mapping with unit tests"
```

---

### Task 3: Bundle reader + dat parsing

**Files:**
- Modify: `pipeline/extract_game_data.py` (add bundle reading + dat parsing functions)

This is the PyPoE integration. The script opens `Bundles2/_.index.bin`, reads three dat64 files, and returns structured dicts.

> **Note on PyPoE field names:** The field names below (e.g. `"BaseItemTypesKey"`, `"IsSupport"`, `"DisplayedName"`) are based on the PoE2 dat schema. If PyPoE raises a `KeyError`, open a Python REPL, load the dat file, and print `list(dat.reader.data[0].keys())` to see actual field names.

- [ ] **Step 1: Add ooz discovery helper to `extract_game_data.py`**

Add after the mappings section (before the end of the file):

```python
def find_ooz(poe2_dir: Path) -> Path:
    """Find ooz.dll for PyPoE bundle decompression."""
    candidates = [
        poe2_dir / "ooz64.dll",
        poe2_dir / "ooz.dll",
        Path(__file__).parent / "bin" / "ooz64.dll",
        Path(__file__).parent / "bin" / "ooz.dll",
    ]
    for path in candidates:
        if path.exists():
            return path
    raise FileNotFoundError(
        "ooz.dll not found. Check your PoE2 install dir or place it in pipeline/bin/.\n"
        "Download: https://github.com/zao/ooz/releases/download/v0.2.4/bun-0.2.4-x64-Release.zip"
    )
```

- [ ] **Step 2: Add bundle-reading function**

Add to `extract_game_data.py`:

```python
def open_bundle_index(poe2_dir: Path, ooz_path: Path):
    """Open the PoE2 bundle index for dat file extraction."""
    from PyPoE.poe.file.bundle import IndexFile

    index = IndexFile()
    index_path = poe2_dir / "Bundles2" / "_.index.bin"
    if not index_path.exists():
        raise FileNotFoundError(f"Bundle index not found: {index_path}")
    with open(index_path, "rb") as f:
        index.read(f, ooz_path=str(ooz_path))
    return index


def read_dat(index, dat_name: str):
    """Extract and parse a .dat64 file from the bundle index."""
    from PyPoE.poe.file.dat import DatFile

    raw = index.get_file_contents(f"Data/{dat_name}")
    dat = DatFile(dat_name)
    dat.read(raw, use_dat_value_notifier=False)
    return dat.reader.data
```

- [ ] **Step 3: Add skill gem extraction function**

Add to `extract_game_data.py`:

```python
def extract_skill_gems(index) -> list[dict]:
    """
    Parse SkillGems.dat64 → list of skill/support entities.
    Field names may need adjustment — run print(list(rows[0].keys())) if KeyError.
    """
    rows = read_dat(index, "SkillGems.dat64")
    entities: list[dict] = []
    for row in rows:
        try:
            # Navigate the BaseItemTypesKey foreign reference for the name
            base_item = row.get("BaseItemTypesKey") or row.get("BaseItemType")
            if not base_item:
                continue
            name = base_item.get("Name") or base_item.get("DisplayName", "")
            if not name:
                continue

            is_support = bool(row.get("IsSupport", False))
            entity_type = "support" if is_support else "skill"

            # CharacterClass: 0 = any, otherwise restricted
            char_class_id = row.get("CharacterClass", 0)
            if isinstance(char_class_id, int):
                class_tags = [CLASS_ID_TO_TAG[char_class_id]] if char_class_id in CLASS_ID_TO_TAG else []
            else:
                # May be a list or reference object — adapt as needed
                class_tags = []

            entities.append({
                "entity_slug": slugify(name, separator="_"),
                "display_name": name,
                "entity_type": entity_type,
                "class_tags": class_tags,
                "mechanic_tags": [],
                "damage_tags": [],
                "description": "",
            })
        except (KeyError, AttributeError, TypeError):
            continue
    return entities
```

- [ ] **Step 4: Add active skill enrichment function**

Add to `extract_game_data.py`:

```python
def enrich_with_active_skills(index, entities: list[dict]) -> list[dict]:
    """
    Parse ActiveSkills.dat64 and enrich matching entities with mechanic/damage tags and description.
    Field names may need adjustment — run print(list(rows[0].keys())) if KeyError.
    """
    rows = read_dat(index, "ActiveSkills.dat64")

    # Build lookup by display name (lowercase) → mechanic_tags, damage_tags, description
    active_map: dict[str, dict] = {}
    for row in rows:
        try:
            name = row.get("DisplayedName") or row.get("Name", "")
            if not name:
                continue

            skill_types = row.get("ActiveSkillTypes") or row.get("SkillTypes") or []
            type_names = []
            for st in skill_types:
                if isinstance(st, str):
                    type_names.append(st)
                elif hasattr(st, "get"):
                    type_names.append(st.get("Id", ""))
                elif hasattr(st, "Id"):
                    type_names.append(st.Id)

            mechanic, damage = map_skill_types(type_names)
            desc = row.get("Description") or row.get("Stat_Text", "")
            active_map[name.lower()] = {
                "mechanic_tags": mechanic,
                "damage_tags": damage,
                "description": str(desc),
            }
        except (KeyError, AttributeError, TypeError):
            continue

    # Enrich entities
    enriched = []
    for entity in entities:
        key = entity["display_name"].lower()
        if key in active_map:
            merged = dict(entity)
            merged["mechanic_tags"] = active_map[key]["mechanic_tags"]
            merged["damage_tags"] = active_map[key]["damage_tags"]
            merged["description"] = active_map[key]["description"]
            enriched.append(merged)
        else:
            enriched.append(entity)
    return enriched
```

- [ ] **Step 5: Add passive skill extraction**

Add to `extract_game_data.py`:

```python
def extract_passives(index) -> list[dict]:
    """
    Parse PassiveSkills.dat64 → list of passive entities.
    Field names may need adjustment — run print(list(rows[0].keys())) if KeyError.
    """
    rows = read_dat(index, "PassiveSkills.dat64")
    entities: list[dict] = []
    for row in rows:
        try:
            name = row.get("Name") or row.get("PassiveName", "")
            if not name or not str(name).strip():
                continue
            name = str(name).strip()

            desc = row.get("FlavourText") or row.get("Description", "")

            entities.append({
                "entity_slug": slugify(name, separator="_"),
                "display_name": name,
                "entity_type": "passive",
                "class_tags": [],
                "mechanic_tags": [],
                "damage_tags": [],
                "description": str(desc),
            })
        except (KeyError, AttributeError, TypeError):
            continue

    # Deduplicate by slug
    seen: set[str] = set()
    unique: list[dict] = []
    for e in entities:
        if e["entity_slug"] not in seen:
            seen.add(e["entity_slug"])
            unique.append(e)
    return unique
```

- [ ] **Step 6: Smoke test the bundle reader against the real game install**

```bash
python -c "
from pathlib import Path
from pipeline.extract_game_data import open_bundle_index, find_ooz, read_dat

poe2_dir = Path(r'F:\SteamLibrary\steamapps\common\Path of Exile 2')
ooz = find_ooz(poe2_dir)
print('ooz found:', ooz)
index = open_bundle_index(poe2_dir, ooz)
print('index loaded')
rows = read_dat(index, 'SkillGems.dat64')
print(f'SkillGems rows: {len(rows)}')
if rows:
    print('fields:', list(rows[0].keys())[:10])
"
```

Expected: prints row count and first 10 field names. If you get a KeyError anywhere, use the printed field names to fix the accessor in steps 3–5 above.

- [ ] **Step 7: Commit**

```bash
git add pipeline/extract_game_data.py
git commit -m "feat(pipeline): bundle reader + dat parsing for SkillGems, ActiveSkills, PassiveSkills"
```

---

### Task 4: Extraction script main logic + seed write

**Files:**
- Modify: `pipeline/extract_game_data.py` (add `extract_all()` and `main()`)

- [ ] **Step 1: Add POB enrichment integration**

Add to `extract_game_data.py` (imports from existing scraper — no duplication):

```python
def pob_enrich(entities: list[dict]) -> list[dict]:
    """Reuse existing POB mechanic_tag enrichment from scraper_poe2."""
    from pipeline.scraper_poe2 import ensure_pob_repo, load_all_pob_data, merge_sources

    pob_skills_dir = ensure_pob_repo()
    pob_data = load_all_pob_data(pob_skills_dir)
    return [merge_sources(e, pob_data) for e in entities]
```

- [ ] **Step 2: Add `extract_all()` orchestrator**

Add to `extract_game_data.py`:

```python
SEED_PATH = Path(__file__).parent / "data" / "poe2_seed.json"


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

    print("Extracting PassiveSkills.dat64...")
    passive_entities = extract_passives(index)
    print(f"  Found {len(passive_entities)} passives")

    all_entities = skill_entities + passive_entities

    print("Enriching mechanic_tags from POB...")
    all_entities = pob_enrich(all_entities)

    skills = [e for e in all_entities if e["entity_type"] == "skill"]
    supports = [e for e in all_entities if e["entity_type"] == "support"]
    passives = [e for e in all_entities if e["entity_type"] == "passive"]

    seed = {
        "extracted_at": datetime.now(tz=timezone.utc).isoformat(),
        "patch_version": "unknown",  # updated if --patch-version provided
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
```

- [ ] **Step 3: Add `main()` with argparse**

Add to `extract_game_data.py`:

```python
def main() -> int:
    parser = argparse.ArgumentParser(description="Extract PoE2 game data into poe2_seed.json")
    parser.add_argument(
        "--poe2-dir",
        default=os.environ.get("POE2_DIR", r"F:\SteamLibrary\steamapps\common\Path of Exile 2"),
        help="Path to PoE2 installation directory",
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
            # Patch in the version after writing (avoids threading with extract_all)
            data = json.loads(Path(args.output).read_text(encoding="utf-8"))
            data["patch_version"] = args.patch_version
            Path(args.output).write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
            print(f"Patch version set to {args.patch_version}")
    except FileNotFoundError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Run the extraction against the real game install**

```bash
python -m pipeline.extract_game_data --poe2-dir "F:\SteamLibrary\steamapps\common\Path of Exile 2"
```

Expected output (approximate):
```
Using ooz: F:\SteamLibrary\steamapps\common\Path of Exile 2\ooz64.dll
Opening bundle index...
Extracting SkillGems.dat64...
  Found ~530 skill/support gems
Enriching with ActiveSkills.dat64...
Extracting PassiveSkills.dat64...
  Found ~350 passives
Enriching mechanic_tags from POB...
Seed written to pipeline\data\poe2_seed.json
  skills: ~412, supports: ~118, passives: ~347
```

Spot-check the output: open `pipeline/data/poe2_seed.json` and verify Arc, Fireball, and Added Cold Damage Support are present with correct types and at least 1 mechanic_tag each.

- [ ] **Step 5: Commit**

```bash
git add pipeline/extract_game_data.py pipeline/data/poe2_seed.json
git commit -m "feat(pipeline): extract_game_data.py — full extraction script + initial seed"
```

---

### Task 5: Integrate seed into `scraper_poe2.py`

**Files:**
- Modify: `pipeline/scraper_poe2.py`

- [ ] **Step 1: Add `SEED_PATH` and `load_from_seed()` to `scraper_poe2.py`**

Open `pipeline/scraper_poe2.py`. After the existing imports and constants (after `POB_TYPE_MAP`), add:

```python
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
```

Note: `json` is already imported. `Path` is already imported.

- [ ] **Step 2: Update `scrape_all()` to check seed first**

Replace the existing `scrape_all()` function in `pipeline/scraper_poe2.py`:

```python
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
```

- [ ] **Step 3: Run existing scraper tests to confirm nothing broke**

```bash
python -m pytest pipeline/tests/test_scraper_poe2.py -v
```

Expected: all 3 existing tests PASS.

- [ ] **Step 4: Commit**

```bash
git add pipeline/scraper_poe2.py
git commit -m "feat(pipeline): scraper_poe2 checks seed file before wiki/POB fallback"
```

---

### Task 6: Extend scraper tests for seed path

**Files:**
- Modify: `pipeline/tests/test_scraper_poe2.py`

- [ ] **Step 1: Write the failing test**

Add to `pipeline/tests/test_scraper_poe2.py`:

```python
import json
import tempfile
from pathlib import Path
from unittest.mock import patch


def test_scrape_all_uses_seed_when_present(tmp_path):
    seed = {
        "extracted_at": "2026-04-25T00:00:00+00:00",
        "patch_version": "3.25.0",
        "entity_counts": {"skill": 1, "support": 0, "passive": 0},
        "entities": [
            {
                "entity_slug": "arc",
                "display_name": "Arc",
                "entity_type": "skill",
                "class_tags": [],
                "mechanic_tags": ["lightning", "aoe"],
                "damage_tags": ["lightning"],
                "description": "Releases a beam of lightning",
            }
        ],
    }
    seed_file = tmp_path / "poe2_seed.json"
    seed_file.write_text(json.dumps(seed), encoding="utf-8")

    pob_data: dict = {}  # empty — no POB enrichment needed for this test

    with (
        patch("pipeline.scraper_poe2.SEED_PATH", seed_file),
        patch("pipeline.scraper_poe2.ensure_pob_repo", return_value=tmp_path),
        patch("pipeline.scraper_poe2.load_all_pob_data", return_value=pob_data),
    ):
        from pipeline import scraper_poe2
        entities = scraper_poe2.scrape_all()

    assert len(entities) == 1
    assert entities[0]["entity_slug"] == "arc"
    assert "lightning" in entities[0]["mechanic_tags"]


def test_load_from_seed_returns_none_when_missing(tmp_path):
    with patch("pipeline.scraper_poe2.SEED_PATH", tmp_path / "nonexistent.json"):
        from pipeline import scraper_poe2
        result = scraper_poe2.load_from_seed()
    assert result is None
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
python -m pytest pipeline/tests/test_scraper_poe2.py::test_scrape_all_uses_seed_when_present pipeline/tests/test_scraper_poe2.py::test_load_from_seed_returns_none_when_missing -v
```

Expected: FAIL (functions don't exist yet in scraper_poe2 until Task 5 was done — if Task 5 is done, these may already pass).

- [ ] **Step 3: Run all scraper tests to verify everything passes**

```bash
python -m pytest pipeline/tests/test_scraper_poe2.py -v
```

Expected: 5 tests PASS (3 original + 2 new).

- [ ] **Step 4: Commit**

```bash
git add pipeline/tests/test_scraper_poe2.py
git commit -m "test(pipeline): scraper_poe2 seed path + load_from_seed missing tests"
```

---

### Task 7: Netlify Function `seed-status.ts`

**Files:**
- Create: `netlify/functions/seed-status.ts`

The function reads `pipeline/data/poe2_seed.json` relative to the repo root and returns seed metadata. Also returns the `POE2_DIR` env var for the frontend command box.

- [ ] **Step 1: Create `netlify/functions/seed-status.ts`**

```typescript
import type { Config, Context } from "@netlify/functions";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { json } from "./_lib/response.ts";

export const config: Config = {
  path: "/api/seed-status",
  method: ["GET"],
};

const SEED_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../pipeline/data/poe2_seed.json",
);

const DEFAULT_POE2_DIR = String.raw`F:\SteamLibrary\steamapps\common\Path of Exile 2`;

export default async function handler(_req: Request, _ctx: Context): Promise<Response> {
  const poe2Dir = process.env.POE2_DIR ?? DEFAULT_POE2_DIR;

  try {
    const raw = await readFile(SEED_PATH, "utf-8");
    const data = JSON.parse(raw) as {
      extracted_at: string;
      patch_version: string;
      entity_counts: { skill: number; support: number; passive: number };
    };
    return json(
      {
        present: true,
        extracted_at: data.extracted_at,
        patch_version: data.patch_version,
        entity_counts: data.entity_counts,
        poe2Dir,
      },
      { cache: false },
    );
  } catch {
    return json({ present: false, poe2Dir }, { cache: false });
  }
}
```

- [ ] **Step 2: Verify the function works locally**

Start `netlify dev` (if not already running), then:

```bash
curl http://localhost:8888/api/seed-status
```

Expected (if seed exists):
```json
{"present":true,"extracted_at":"2026-04-25T...","patch_version":"unknown","entity_counts":{"skill":412,"support":118,"passive":347},"poe2Dir":"F:\\SteamLibrary\\..."}
```

Expected (if seed missing):
```json
{"present":false,"poe2Dir":"F:\\SteamLibrary\\..."}
```

- [ ] **Step 3: Commit**

```bash
git add netlify/functions/seed-status.ts
git commit -m "feat(api): seed-status Netlify Function returns seed metadata and poe2Dir"
```

---

### Task 8: AdminPage component

**Files:**
- Create: `src/components/AdminPage.tsx`

The page fetches `/api/seed-status` and displays a status card + copyable command box. No library installs needed — uses existing Tailwind + fetch.

- [ ] **Step 1: Create `src/components/AdminPage.tsx`**

```tsx
import React, { useEffect, useState } from "react";

interface SeedStatus {
  present: boolean;
  extracted_at?: string;
  patch_version?: string;
  entity_counts?: { skill: number; support: number; passive: number };
  poe2Dir: string;
}

function staleness(extractedAt: string): { label: string; color: string } {
  const ageMs = Date.now() - new Date(extractedAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays < 7) return { label: "Fresh", color: "text-green-400 border-green-400" };
  if (ageDays <= 30) return { label: "Aging", color: "text-yellow-400 border-yellow-400" };
  return { label: "Stale", color: "text-red-400 border-red-400" };
}

function relativeAge(extractedAt: string): string {
  const ageMs = Date.now() - new Date(extractedAt).getTime();
  const days = Math.floor(ageMs / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export function AdminPage(): React.ReactElement {
  const [status, setStatus] = useState<SeedStatus | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/seed-status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ present: false, poe2Dir: "" }));
  }, []);

  const command = status
    ? `python -m pipeline.extract_game_data --poe2-dir "${status.poe2Dir}"`
    : "";

  function handleCopy() {
    navigator.clipboard.writeText(command).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const badge =
    status?.present && status.extracted_at
      ? staleness(status.extracted_at)
      : { label: "Missing", color: "text-red-400 border-red-400" };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <h1 className="text-2xl font-semibold mb-6">Seed Status</h1>

      {/* Status card */}
      <div className="border border-white/10 rounded-lg p-6 mb-6 max-w-lg">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-lg font-medium">
            {status === null ? "Loading..." : status.present ? "Seed present" : "Seed missing"}
          </span>
          {status !== null && (
            <span className={`px-2 py-0.5 rounded text-xs border ${badge.color}`}>
              {badge.label}
            </span>
          )}
        </div>

        {status?.present && status.extracted_at && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-white/50">Extracted</dt>
            <dd>{relativeAge(status.extracted_at)}</dd>

            <dt className="text-white/50">Patch</dt>
            <dd>{status.patch_version ?? "—"}</dd>

            {status.entity_counts && (
              <>
                <dt className="text-white/50">Skills</dt>
                <dd>{status.entity_counts.skill}</dd>

                <dt className="text-white/50">Supports</dt>
                <dd>{status.entity_counts.support}</dd>

                <dt className="text-white/50">Passives</dt>
                <dd>{status.entity_counts.passive}</dd>
              </>
            )}
          </dl>
        )}
      </div>

      {/* Command box */}
      <div className="border border-white/10 rounded-lg p-6 max-w-2xl">
        <h2 className="text-sm font-medium text-white/70 mb-3 uppercase tracking-wider">
          Run extraction
        </h2>
        <div className="flex items-stretch gap-2">
          <code className="flex-1 bg-white/5 rounded px-3 py-2 text-sm font-mono break-all">
            {command}
          </code>
          <button
            onClick={handleCopy}
            className="px-3 py-2 rounded border border-white/20 text-sm hover:border-white/40 transition-colors shrink-0"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <p className="mt-3 text-xs text-white/40">
          After running, commit{" "}
          <code className="font-mono">pipeline/data/poe2_seed.json</code> and push to trigger the
          pipeline.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the component renders without TypeScript errors**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/AdminPage.tsx
git commit -m "feat(frontend): AdminPage component with seed status card and command box"
```

---

### Task 9: Wire `/admin` routing in `main.tsx`

**Files:**
- Modify: `src/main.tsx`

No React Router needed — check `window.location.pathname` before mounting.

- [ ] **Step 1: Update `src/main.tsx`**

Replace the entire file contents with:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { AdminPage } from "./components/AdminPage.tsx";
import "./index.css";

const isAdmin = window.location.pathname.startsWith("/admin");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {isAdmin ? <AdminPage /> : <App />}
  </React.StrictMode>,
);
```

- [ ] **Step 2: Add `_redirects` rule so `/admin` serves the SPA**

Check if `public/_redirects` exists:

```bash
ls public/
```

If it exists, add this line to `public/_redirects`:
```
/admin  /index.html  200
```

If it does not exist, create `public/_redirects` with:
```
/admin  /index.html  200
/*      /index.html  200
```

- [ ] **Step 3: Verify admin route in dev**

Start `netlify dev`, then open `http://localhost:8888/admin` in a browser.

Expected: Admin page renders with "Seed Status" heading, status card, and command box. No errors in browser console.

Verify main app still works: open `http://localhost:8888` and confirm Synergy Wizard loads normally.

- [ ] **Step 4: Commit**

```bash
git add src/main.tsx public/_redirects
git commit -m "feat(frontend): /admin route renders AdminPage via pathname check"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| `extract_game_data.py` CLI script | Tasks 3–4 |
| `pipeline/data/poe2_seed.json` written | Task 4 |
| PyPoE dependency | Task 1 |
| Keyword → mechanic/damage/class mapping | Task 2 |
| POB mechanic_tag enrichment in extraction | Task 4 |
| `load_from_seed()` in scraper | Task 5 |
| `scrape_all()` seed-first priority | Task 5 |
| Existing tests still pass | Tasks 5–6 |
| CI validates seed path | Task 6 |
| `/api/seed-status` Netlify Function | Task 7 |
| `AdminPage` status card with staleness badge | Task 8 |
| Green <7d / Yellow 7-30d / Red >30d/missing | Task 8 |
| Command box pre-filled with `POE2_DIR` | Tasks 7+8 |
| Copy-to-clipboard button | Task 8 |
| `/admin` route not linked from main nav | Task 9 |
| `_redirects` so direct URL works | Task 9 |
| Error: seed missing → scrape_all falls through | Task 5 (load_from_seed returns None) |
| Error: seed-status seed unreadable → `{present:false}` | Task 7 (try/catch) |

**Placeholder scan:** No TBD or TODO items. All code blocks are complete.

**Type consistency:** `SeedStatus.entity_counts` defined in Task 8 matches shape returned by Task 7. `load_from_seed()` returns `list[dict] | None` — matches `scrape_all()` usage in Task 5. `map_skill_types()` returns `tuple[list[str], list[str]]` — used correctly in Task 3.

**One known risk:** PyPoE field names (`"BaseItemTypesKey"`, `"IsSupport"`, `"DisplayedName"`, `"ActiveSkillTypes"`) are based on the dat schema and may differ from the actual PyPoE wrapper. Task 3 Step 6 (smoke test) catches this before writing any seed data, and the fallback `.get()` calls with alternates reduce brittleness.
