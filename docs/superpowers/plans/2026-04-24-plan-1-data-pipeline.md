# Data Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a GitHub Actions pipeline that detects POE2 patches daily, scrapes the wiki.gg + PathOfBuilding data, runs Claude Sonnet indexing on changed entities, and upserts results into Netlify DB (Postgres) with Netlify Blobs as a raw artifact backup.

**Architecture:** A set of composable Python scripts orchestrated by a GitHub Actions workflow. Patch detector decides whether a run is needed; scraper pulls raw data; hasher computes content deltas; indexer sends changed entities to Claude with a controlled vocabulary few-shot prompt; DB writer upserts into `entities` and `synergy_edges`; blobs writer archives the raw pull.

**Tech Stack:** Python 3.11, `requests`, `anthropic`, `psycopg2-binary`, `beautifulsoup4`, `mwparserfromhell`, GitHub Actions, Netlify Blobs REST API, Neon Postgres, Anthropic Claude Sonnet.

---

### Task 1: Repository setup and dependency manifest

**Files:**
- Create: `pipeline/__init__.py`
- Create: `pipeline/requirements.txt`
- Create: `pipeline/README.md`
- Create: `.gitignore`

- [ ] **Step 1: Create the `pipeline/` package marker**

Create `pipeline/__init__.py`:

```python
"""Synergy Wizard data pipeline package."""

__version__ = "0.1.0"
```

- [ ] **Step 2: Pin pipeline dependencies**

Create `pipeline/requirements.txt`:

```
requests==2.32.3
anthropic==0.39.0
psycopg2-binary==2.9.10
beautifulsoup4==4.12.3
mwparserfromhell==0.6.6
python-slugify==8.0.4
pytest==8.3.3
```

- [ ] **Step 3: Write a short README describing entrypoints**

Create `pipeline/README.md`:

```markdown
# Synergy Wizard Pipeline

Daily cron (GitHub Actions) that keeps the Synergy Wizard DB in sync with POE2 patches.

## Entrypoints

| Script | Purpose |
|---|---|
| `patch_detector.py` | Exit 0 = new patch detected; exit 78 = no change |
| `scraper_poe2.py` | Pull wiki.gg + PathOfBuilding data, dump raw JSON to stdout |
| `hasher.py` | Compare content hashes against DB, print slugs of changed entities |
| `indexer.py` | Send changed entities to Claude Sonnet, write JSON output |
| `db_writer.py` | Upsert entities + edges into Netlify DB |
| `blobs_backup.py` | Upload raw JSON to Netlify Blobs, keyed by patch version |

## Environment variables

- `ANTHROPIC_API_KEY`
- `NETLIFY_DATABASE_URL`
- `NETLIFY_BLOBS_CONTEXT` (base64 JSON with siteID + token)
```

- [ ] **Step 4: Add a root `.gitignore`**

Create `.gitignore`:

```
# Python
__pycache__/
*.pyc
.pytest_cache/
.venv/
venv/

# Pipeline runtime artifacts
pipeline/artifacts/
pipeline/last_known_version.json.bak
pipeline/PathOfBuilding/

# Node / Netlify
node_modules/
.netlify/
dist/

# Editor
.vscode/
.idea/
```

- [ ] **Step 5: Verify dependencies install**

Run: `python -m venv .venv && source .venv/Scripts/activate && pip install -r pipeline/requirements.txt`
Expected: `Successfully installed anthropic-0.39.0 beautifulsoup4-4.12.3 ...` with no errors.

- [ ] **Step 6: Commit**

```bash
git add pipeline/__init__.py pipeline/requirements.txt pipeline/README.md .gitignore
git commit -m "feat(pipeline): scaffold pipeline package and pinned deps"
```

---

### Task 2: Patch detector

**Files:**
- Create: `pipeline/last_known_version.json`
- Create: `pipeline/patch_detector.py`
- Create: `pipeline/tests/__init__.py`
- Create: `pipeline/tests/test_patch_detector.py`

- [ ] **Step 1: Seed the state file with a bootstrap value**

Create `pipeline/last_known_version.json`:

```json
{
  "ggg_version": "",
  "steam_latest_gid": "",
  "checked_at": ""
}
```

- [ ] **Step 2: Write the failing test**

Create `pipeline/tests/__init__.py` (empty file).

Create `pipeline/tests/test_patch_detector.py`:

```python
import json
from pathlib import Path
from unittest.mock import patch

from pipeline import patch_detector


def test_detects_new_ggg_version(tmp_path, monkeypatch):
    state = tmp_path / "state.json"
    state.write_text(json.dumps({"ggg_version": "1.0.0", "steam_latest_gid": "G1", "checked_at": ""}))
    monkeypatch.setattr(patch_detector, "STATE_PATH", state)

    with patch.object(patch_detector, "fetch_ggg_version", return_value="1.0.1"), \
         patch.object(patch_detector, "fetch_steam_latest_gid", return_value="G1"):
        result = patch_detector.detect()

    assert result.changed is True
    assert result.ggg_version == "1.0.1"


def test_no_change_returns_false(tmp_path, monkeypatch):
    state = tmp_path / "state.json"
    state.write_text(json.dumps({"ggg_version": "1.0.0", "steam_latest_gid": "G1", "checked_at": ""}))
    monkeypatch.setattr(patch_detector, "STATE_PATH", state)

    with patch.object(patch_detector, "fetch_ggg_version", return_value="1.0.0"), \
         patch.object(patch_detector, "fetch_steam_latest_gid", return_value="G1"):
        result = patch_detector.detect()

    assert result.changed is False


def test_steam_gid_change_triggers(tmp_path, monkeypatch):
    state = tmp_path / "state.json"
    state.write_text(json.dumps({"ggg_version": "1.0.0", "steam_latest_gid": "G1", "checked_at": ""}))
    monkeypatch.setattr(patch_detector, "STATE_PATH", state)

    with patch.object(patch_detector, "fetch_ggg_version", return_value="1.0.0"), \
         patch.object(patch_detector, "fetch_steam_latest_gid", return_value="G2"):
        result = patch_detector.detect()

    assert result.changed is True
```

- [ ] **Step 3: Run the test and verify it fails**

Run: `pytest pipeline/tests/test_patch_detector.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'pipeline.patch_detector'` (or `AttributeError: ... 'detect'`).

- [ ] **Step 4: Implement the detector**

Create `pipeline/patch_detector.py`:

```python
"""Detect POE2 patches by comparing GGG CDN version + Steam news GID to stored state."""

from __future__ import annotations

import json
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import requests

GGG_CDN_URL = "http://patchcdn.pathofexile.com/pathofexile2/"
STEAM_NEWS_URL = (
    "https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/"
    "?appid=2694490&count=5&format=json"
)
STATE_PATH = Path(__file__).parent / "last_known_version.json"
USER_AGENT = "synergywizard-pipeline/0.1 (+https://github.com/)"


@dataclass
class DetectionResult:
    changed: bool
    ggg_version: str
    steam_latest_gid: str


def fetch_ggg_version() -> str:
    resp = requests.get(GGG_CDN_URL, headers={"User-Agent": USER_AGENT}, timeout=15)
    resp.raise_for_status()
    text = resp.text.strip()
    # GGG patch CDN serves a short version string on the index path
    return text.splitlines()[0].strip() if text else ""


def fetch_steam_latest_gid() -> str:
    resp = requests.get(STEAM_NEWS_URL, headers={"User-Agent": USER_AGENT}, timeout=15)
    resp.raise_for_status()
    items = resp.json().get("appnews", {}).get("newsitems", [])
    return str(items[0]["gid"]) if items else ""


def load_state() -> dict:
    if not STATE_PATH.exists():
        return {"ggg_version": "", "steam_latest_gid": "", "checked_at": ""}
    return json.loads(STATE_PATH.read_text())


def save_state(ggg_version: str, steam_gid: str) -> None:
    STATE_PATH.write_text(
        json.dumps(
            {
                "ggg_version": ggg_version,
                "steam_latest_gid": steam_gid,
                "checked_at": datetime.now(timezone.utc).isoformat(),
            },
            indent=2,
        )
    )


def detect() -> DetectionResult:
    state = load_state()
    ggg_version = fetch_ggg_version()
    steam_gid = fetch_steam_latest_gid()

    changed = (
        ggg_version != state.get("ggg_version", "")
        or steam_gid != state.get("steam_latest_gid", "")
    )

    return DetectionResult(changed=changed, ggg_version=ggg_version, steam_latest_gid=steam_gid)


def main() -> int:
    result = detect()
    if result.changed:
        save_state(result.ggg_version, result.steam_latest_gid)
        print(f"PATCH_DETECTED version={result.ggg_version} steam_gid={result.steam_latest_gid}")
        # Write patch version to GITHUB_OUTPUT for downstream steps
        gh_output = os.environ.get("GITHUB_OUTPUT")
        if gh_output:
            with open(gh_output, "a", encoding="utf-8") as fh:
                fh.write(f"patch_version={result.ggg_version}\n")
                fh.write("changed=true\n")
        return 0
    print("NO_CHANGE")
    gh_output = os.environ.get("GITHUB_OUTPUT")
    if gh_output:
        with open(gh_output, "a", encoding="utf-8") as fh:
            fh.write("changed=false\n")
    return 78  # neutral exit: signals "skip downstream"


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 5: Run the tests and verify they pass**

Run: `pytest pipeline/tests/test_patch_detector.py -v`
Expected: `3 passed`.

- [ ] **Step 6: Commit**

```bash
git add pipeline/patch_detector.py pipeline/last_known_version.json pipeline/tests/__init__.py pipeline/tests/test_patch_detector.py
git commit -m "feat(pipeline): GGG CDN + Steam News patch detector"
```

---

### Task 3: POE2 scraper

**Files:**
- Create: `pipeline/scraper_poe2.py`
- Create: `pipeline/tests/test_scraper_poe2.py`
- Create: `pipeline/tests/fixtures/volcanic_fissure_wikitext.txt`
- Create: `pipeline/tests/fixtures/volcanic_fissure.lua`

- [ ] **Step 1: Add a wiki fixture**

Create `pipeline/tests/fixtures/volcanic_fissure_wikitext.txt`:

```
{{Skill
|name         = Volcanic Fissure
|class        = Warrior
|skill_tags   = slam, fire, aoe, ground_effect
|damage_types = fire, physical
|description  = Slam the ground, unleashing a fissure of molten rock that erupts in waves.
}}
```

- [ ] **Step 2: Add a PathOfBuilding Lua fixture**

Create `pipeline/tests/fixtures/volcanic_fissure.lua`:

```lua
skills["VolcanicFissure"] = {
    name = "Volcanic Fissure",
    color = 1,
    skillTypes = { [SkillType.Slam] = true, [SkillType.Fire] = true, [SkillType.AreaSpell] = true },
    baseMods = { },
    qualityStats = { { "damage_+%_while_active", 20 } },
    stats = {
        "base_skill_effect_duration",
        "fire_damage_+%_final",
    },
}
```

- [ ] **Step 3: Write the failing tests**

Create `pipeline/tests/test_scraper_poe2.py`:

```python
from pathlib import Path

from pipeline import scraper_poe2

FIX = Path(__file__).parent / "fixtures"


def test_parse_wiki_infobox_extracts_fields():
    wikitext = (FIX / "volcanic_fissure_wikitext.txt").read_text()
    entity = scraper_poe2.parse_wiki_infobox("Volcanic Fissure", wikitext)

    assert entity["entity_slug"] == "volcanic_fissure"
    assert entity["display_name"] == "Volcanic Fissure"
    assert entity["class_tags"] == ["warrior"]
    assert "slam" in entity["mechanic_tags"]
    assert "fire" in entity["mechanic_tags"]
    assert "aoe" in entity["mechanic_tags"]
    assert "ground_effect" in entity["mechanic_tags"]
    assert "fire" in entity["damage_tags"]
    assert "physical" in entity["damage_tags"]
    assert "molten rock" in entity["description"]


def test_parse_pob_lua_extracts_skill_types():
    lua = (FIX / "volcanic_fissure.lua").read_text()
    data = scraper_poe2.parse_pob_lua(lua)

    assert "VolcanicFissure" in data
    assert data["VolcanicFissure"]["name"] == "Volcanic Fissure"
    assert "Slam" in data["VolcanicFissure"]["skill_types"]
    assert "Fire" in data["VolcanicFissure"]["skill_types"]


def test_merge_sources_combines_wiki_and_pob():
    wiki = {
        "entity_slug": "volcanic_fissure",
        "display_name": "Volcanic Fissure",
        "mechanic_tags": ["slam", "fire"],
        "damage_tags": ["fire"],
        "class_tags": ["warrior"],
        "description": "Slam",
        "entity_type": "skill",
    }
    pob = {"VolcanicFissure": {"name": "Volcanic Fissure", "skill_types": ["Slam", "AreaSpell"]}}

    merged = scraper_poe2.merge_sources(wiki, pob)
    assert "areaspell" in merged["mechanic_tags"] or "aoe" in merged["mechanic_tags"]
    assert merged["entity_slug"] == "volcanic_fissure"
```

- [ ] **Step 4: Run the test to confirm it fails**

Run: `pytest pipeline/tests/test_scraper_poe2.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'pipeline.scraper_poe2'`.

- [ ] **Step 5: Implement the scraper**

Create `pipeline/scraper_poe2.py`:

```python
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
POB_REPO = "https://github.com/PathOfBuildingCommunity/PathOfBuilding.git"
POB_DIR = Path(__file__).parent / "PathOfBuilding"
REQUEST_DELAY_SECONDS = 1.0

# Map PathOfBuilding skill type keywords to our controlled mechanic_tags vocabulary.
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
    """Return all page titles in a given MediaWiki category, paginating via cmcontinue."""
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
    """Parse a {{Skill}}-style infobox into our entity dict shape."""
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
    """Parse `skills["Foo"] = { name=..., skillTypes = { [SkillType.Foo] = true } }` blocks."""
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
    """Enrich wiki entity with PathOfBuilding skill types mapped to our vocabulary."""
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


def scrape_all() -> list[dict]:
    pob_skills_dir = ensure_pob_repo()
    pob_data = load_all_pob_data(pob_skills_dir)
    entities: list[dict] = []

    for entity_type, category in CATEGORIES.items():
        for title in fetch_category_members(category):
            wikitext = fetch_page_wikitext(title)
            entity = parse_wiki_infobox(title, wikitext)
            entity["entity_type"] = entity_type
            entity = merge_sources(entity, pob_data)
            entities.append(entity)
    return entities


def main() -> int:
    patch_version = os.environ.get("PATCH_VERSION", "unknown")
    entities = scrape_all()
    out = {"patch_version": patch_version, "entities": entities}
    sys.stdout.write(json.dumps(out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 6: Run the tests and verify they pass**

Run: `pytest pipeline/tests/test_scraper_poe2.py -v`
Expected: `3 passed`.

- [ ] **Step 7: Commit**

```bash
git add pipeline/scraper_poe2.py pipeline/tests/test_scraper_poe2.py pipeline/tests/fixtures/volcanic_fissure_wikitext.txt pipeline/tests/fixtures/volcanic_fissure.lua
git commit -m "feat(pipeline): wiki.gg + PathOfBuilding scraper with merge logic"
```

---

### Task 4: Content hasher / diff

**Files:**
- Create: `pipeline/hasher.py`
- Create: `pipeline/tests/test_hasher.py`

- [ ] **Step 1: Write the failing test**

Create `pipeline/tests/test_hasher.py`:

```python
from pipeline import hasher


def test_stable_hash_is_deterministic():
    entity = {
        "entity_slug": "volcanic_fissure",
        "description": "Slam the ground",
        "mechanic_tags": ["slam", "fire"],
        "damage_tags": ["fire", "physical"],
    }
    assert hasher.content_hash(entity) == hasher.content_hash(entity)


def test_hash_ignores_tag_order():
    a = {"entity_slug": "x", "description": "d", "mechanic_tags": ["a", "b"], "damage_tags": ["x"]}
    b = {"entity_slug": "x", "description": "d", "mechanic_tags": ["b", "a"], "damage_tags": ["x"]}
    assert hasher.content_hash(a) == hasher.content_hash(b)


def test_diff_returns_changed_slugs():
    scraped = [
        {"entity_slug": "a", "description": "1", "mechanic_tags": [], "damage_tags": []},
        {"entity_slug": "b", "description": "2", "mechanic_tags": [], "damage_tags": []},
        {"entity_slug": "c", "description": "3", "mechanic_tags": [], "damage_tags": []},
    ]
    # DB returned hashes: a unchanged, b stale, c missing entirely.
    db_hashes = {
        "a": hasher.content_hash(scraped[0]),
        "b": "stale",
    }
    changed = hasher.diff(scraped, db_hashes)
    assert set(changed) == {"b", "c"}
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `pytest pipeline/tests/test_hasher.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'pipeline.hasher'`.

- [ ] **Step 3: Implement the hasher**

Create `pipeline/hasher.py`:

```python
"""SHA-256 diff utilities for the pipeline."""

from __future__ import annotations

import hashlib
import json
from typing import Iterable


def _canonical(entity: dict) -> str:
    payload = {
        "description": entity.get("description", "") or "",
        "mechanic_tags": sorted(entity.get("mechanic_tags", []) or []),
        "damage_tags": sorted(entity.get("damage_tags", []) or []),
        "class_tags": sorted(entity.get("class_tags", []) or []),
    }
    return json.dumps(payload, sort_keys=True, ensure_ascii=False)


def content_hash(entity: dict) -> str:
    return hashlib.sha256(_canonical(entity).encode("utf-8")).hexdigest()


def diff(scraped: Iterable[dict], db_hashes: dict[str, str]) -> list[str]:
    """Return slugs for entities whose content_hash differs from (or is missing from) the DB."""
    changed: list[str] = []
    for entity in scraped:
        slug = entity["entity_slug"]
        if db_hashes.get(slug) != content_hash(entity):
            changed.append(slug)
    return changed
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `pytest pipeline/tests/test_hasher.py -v`
Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add pipeline/hasher.py pipeline/tests/test_hasher.py
git commit -m "feat(pipeline): content hash + diff utility"
```

---

### Task 5: Claude Sonnet indexer

**Files:**
- Create: `pipeline/indexer.py`
- Create: `pipeline/prompts/indexing_system.txt`
- Create: `pipeline/prompts/few_shot_examples.json`
- Create: `pipeline/tests/test_indexer.py`

- [ ] **Step 1: Write the controlled-vocabulary system prompt**

Create `pipeline/prompts/indexing_system.txt`:

```
You are the Synergy Wizard indexer for Path of Exile 2. For every entity (skill / support gem / passive) you are given, you MUST return a single JSON object matching the schema below.

Allowed mechanic_tags (use ONLY these, lowercase, underscores):
slam, fire, cold, lightning, physical, chaos, aoe, duration, projectile, melee, totem, trap, mine, minion, channelling, movement, travel, warcry, trigger, ground_effect, debuff, buff, charge, stance, brand

Allowed damage_tags: fire, cold, lightning, physical, chaos

Schema:
{
  "entity_slug": "<as provided>",
  "mechanic_tags": ["..."],
  "damage_tags": ["..."],
  "creates": ["ground_effect_slug", ...],
  "triggered_by": ["entity_slug", ...],
  "synergizes_with": [
    {"entity_id": "<target_slug>", "reason": "<one sentence>", "interaction_type": "direct|extended|conditional"}
  ],
  "recommended_supports": ["support_slug", ...],
  "relevant_passives": ["passive_slug", ...],
  "conversions_available": [
    {"from": "fire", "to": "lightning", "requires": "<condition or empty string>"}
  ]
}

Return ONLY JSON. No preamble, no markdown.
```

- [ ] **Step 2: Add few-shot examples (Volcanic Fissure)**

Create `pipeline/prompts/few_shot_examples.json`:

```json
[
  {
    "input": {
      "entity_slug": "volcanic_fissure",
      "display_name": "Volcanic Fissure",
      "entity_type": "skill",
      "class_tags": ["warrior"],
      "mechanic_tags": ["slam", "fire", "aoe", "ground_effect"],
      "damage_tags": ["fire", "physical"],
      "description": "Slam the ground, unleashing a fissure of molten rock that erupts in waves."
    },
    "output": {
      "entity_slug": "volcanic_fissure",
      "mechanic_tags": ["slam", "fire", "aoe", "ground_effect", "duration"],
      "damage_tags": ["fire", "physical"],
      "creates": ["molten_fissure"],
      "triggered_by": [],
      "synergizes_with": [
        {"entity_id": "stampede", "reason": "Stampede's aftershock repeatedly triggers the fissure along the slam line.", "interaction_type": "direct"},
        {"entity_id": "earthquake", "reason": "Both leave persistent ground effects that overlap in AoE.", "interaction_type": "extended"}
      ],
      "recommended_supports": ["upheaval_support", "fire_infusion_support"],
      "relevant_passives": ["aftershocks_notable"],
      "conversions_available": [
        {"from": "fire", "to": "lightning", "requires": "lightning conversion support"},
        {"from": "fire", "to": "cold", "requires": "cold conversion support"}
      ]
    }
  }
]
```

- [ ] **Step 3: Write the failing test**

Create `pipeline/tests/test_indexer.py`:

```python
import json
from unittest.mock import MagicMock, patch

from pipeline import indexer


FAKE_CLAUDE_JSON = {
    "entity_slug": "stampede",
    "mechanic_tags": ["slam", "aoe", "movement"],
    "damage_tags": ["physical"],
    "creates": [],
    "triggered_by": [],
    "synergizes_with": [
        {"entity_id": "volcanic_fissure", "reason": "Stampede repeatedly triggers the fissure.", "interaction_type": "direct"}
    ],
    "recommended_supports": [],
    "relevant_passives": [],
    "conversions_available": []
}


def _mock_message(text):
    msg = MagicMock()
    msg.content = [MagicMock(text=text)]
    return msg


def test_index_one_returns_parsed_output():
    entity = {"entity_slug": "stampede", "display_name": "Stampede", "entity_type": "skill",
              "class_tags": ["warrior"], "mechanic_tags": ["slam", "movement"], "damage_tags": ["physical"],
              "description": "Charge forward, knocking enemies aside."}

    with patch.object(indexer, "_client") as client:
        client.messages.create.return_value = _mock_message(json.dumps(FAKE_CLAUDE_JSON))
        result = indexer.index_one(entity)

    assert result["entity_slug"] == "stampede"
    assert "volcanic_fissure" in {s["entity_id"] for s in result["synergizes_with"]}


def test_cost_guard_raises_when_too_many_entities():
    entities = [{"entity_slug": f"x{i}"} for i in range(51)]
    try:
        indexer.check_cost_guard(entities, threshold=50)
        assert False, "expected CostGuardError"
    except indexer.CostGuardError as exc:
        assert "51" in str(exc)


def test_cost_guard_passes_under_threshold():
    indexer.check_cost_guard([{"entity_slug": "a"}], threshold=50)


def test_validate_output_rejects_bad_tag():
    bad = dict(FAKE_CLAUDE_JSON)
    bad["mechanic_tags"] = ["slam", "made_up_tag"]
    try:
        indexer.validate_output(bad)
        assert False, "expected ValueError"
    except ValueError as exc:
        assert "made_up_tag" in str(exc)
```

- [ ] **Step 4: Run the tests to confirm they fail**

Run: `pytest pipeline/tests/test_indexer.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'pipeline.indexer'`.

- [ ] **Step 5: Implement the indexer**

Create `pipeline/indexer.py`:

```python
"""Send changed entities to Claude Sonnet and return structured synergy output."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Iterable

from anthropic import Anthropic

PROMPT_DIR = Path(__file__).parent / "prompts"
SYSTEM_PROMPT = (PROMPT_DIR / "indexing_system.txt").read_text(encoding="utf-8")
FEW_SHOT = json.loads((PROMPT_DIR / "few_shot_examples.json").read_text(encoding="utf-8"))

ALLOWED_MECHANIC_TAGS = {
    "slam", "fire", "cold", "lightning", "physical", "chaos", "aoe", "duration",
    "projectile", "melee", "totem", "trap", "mine", "minion", "channelling",
    "movement", "travel", "warcry", "trigger", "ground_effect", "debuff", "buff",
    "charge", "stance", "brand",
}
ALLOWED_DAMAGE_TAGS = {"fire", "cold", "lightning", "physical", "chaos"}
ALLOWED_INTERACTION_TYPES = {"direct", "extended", "conditional"}

MODEL = "claude-sonnet-4-5-20250929"
MAX_TOKENS = 1500

_client = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))


class CostGuardError(RuntimeError):
    pass


def check_cost_guard(entities: list[dict], threshold: int = 50) -> None:
    if len(entities) > threshold:
        raise CostGuardError(
            f"Cost guard tripped: {len(entities)} entities queued for reindex (threshold={threshold}). "
            "Abort the pipeline run and investigate."
        )


def _build_messages(entity: dict) -> list[dict]:
    messages: list[dict] = []
    for example in FEW_SHOT:
        messages.append({"role": "user", "content": json.dumps(example["input"])})
        messages.append({"role": "assistant", "content": json.dumps(example["output"])})
    messages.append({"role": "user", "content": json.dumps(entity)})
    return messages


def validate_output(payload: dict) -> None:
    mech = set(payload.get("mechanic_tags", []))
    bad_mech = mech - ALLOWED_MECHANIC_TAGS
    if bad_mech:
        raise ValueError(f"Unknown mechanic_tags: {sorted(bad_mech)}")

    dmg = set(payload.get("damage_tags", []))
    bad_dmg = dmg - ALLOWED_DAMAGE_TAGS
    if bad_dmg:
        raise ValueError(f"Unknown damage_tags: {sorted(bad_dmg)}")

    for edge in payload.get("synergizes_with", []):
        if edge.get("interaction_type") not in ALLOWED_INTERACTION_TYPES:
            raise ValueError(f"Bad interaction_type: {edge.get('interaction_type')}")
        if not edge.get("entity_id"):
            raise ValueError("synergizes_with entry missing entity_id")


def index_one(entity: dict) -> dict:
    response = _client.messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        system=SYSTEM_PROMPT,
        messages=_build_messages(entity),
    )
    text = response.content[0].text.strip()
    if text.startswith("```"):
        # Strip accidental markdown fencing
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:].strip()
    payload = json.loads(text)
    validate_output(payload)
    return payload


def index_many(entities: Iterable[dict]) -> list[dict]:
    entities_list = list(entities)
    check_cost_guard(entities_list)
    results: list[dict] = []
    for entity in entities_list:
        results.append(index_one(entity))
    return results


def main() -> int:
    data = json.loads(sys.stdin.read())
    entities = data["entities"]
    changed_slugs = set(data.get("changed_slugs", [e["entity_slug"] for e in entities]))
    to_index = [e for e in entities if e["entity_slug"] in changed_slugs]
    try:
        indexed = index_many(to_index)
    except CostGuardError as exc:
        sys.stderr.write(f"ERROR: {exc}\n")
        return 1
    sys.stdout.write(json.dumps({"entities": entities, "indexed": indexed}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 6: Run the tests and verify they pass**

Run: `pytest pipeline/tests/test_indexer.py -v`
Expected: `4 passed`.

- [ ] **Step 7: Commit**

```bash
git add pipeline/indexer.py pipeline/prompts/indexing_system.txt pipeline/prompts/few_shot_examples.json pipeline/tests/test_indexer.py
git commit -m "feat(pipeline): Claude Sonnet indexer with cost guard + vocab validator"
```

---

### Task 6: Database writer

**Files:**
- Create: `pipeline/db_writer.py`
- Create: `pipeline/sql/schema.sql`
- Create: `pipeline/tests/test_db_writer.py`

- [ ] **Step 1: Write the Postgres schema SQL (authoritative copy, matches Drizzle migration in Plan 2)**

Create `pipeline/sql/schema.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS entities (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game                  TEXT NOT NULL,
    entity_type           TEXT NOT NULL,
    entity_slug           TEXT NOT NULL,
    display_name          TEXT NOT NULL,
    description           TEXT,
    class_tags            TEXT[] NOT NULL DEFAULT '{}',
    mechanic_tags         TEXT[] NOT NULL DEFAULT '{}',
    damage_tags           TEXT[] NOT NULL DEFAULT '{}',
    creates               TEXT[] NOT NULL DEFAULT '{}',
    triggered_by          TEXT[] NOT NULL DEFAULT '{}',
    conversions_available JSONB NOT NULL DEFAULT '[]'::jsonb,
    recommended_supports  TEXT[] NOT NULL DEFAULT '{}',
    relevant_passives     TEXT[] NOT NULL DEFAULT '{}',
    patch_version         TEXT,
    content_hash          TEXT,
    raw_ai_output         JSONB,
    UNIQUE(game, entity_slug)
);

CREATE TABLE IF NOT EXISTS synergy_edges (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game             TEXT NOT NULL,
    from_entity_id   UUID REFERENCES entities(id) ON DELETE CASCADE,
    to_entity_id     UUID REFERENCES entities(id) ON DELETE CASCADE,
    interaction_type TEXT,
    reason           TEXT,
    UNIQUE(from_entity_id, to_entity_id)
);

CREATE INDEX IF NOT EXISTS entities_mechanic_tags_idx ON entities USING GIN(mechanic_tags);
CREATE INDEX IF NOT EXISTS entities_damage_tags_idx   ON entities USING GIN(damage_tags);
CREATE INDEX IF NOT EXISTS entities_class_tags_idx    ON entities USING GIN(class_tags);
CREATE INDEX IF NOT EXISTS entities_tsv_idx           ON entities USING GIN(
    to_tsvector('english', display_name || ' ' || coalesce(description,''))
);
CREATE INDEX IF NOT EXISTS entities_name_trgm_idx     ON entities USING GIN(display_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS edges_from_idx             ON synergy_edges(from_entity_id);
CREATE INDEX IF NOT EXISTS edges_to_idx               ON synergy_edges(to_entity_id);
```

- [ ] **Step 2: Write the failing test (uses a stub connection)**

Create `pipeline/tests/test_db_writer.py`:

```python
from unittest.mock import MagicMock

from pipeline import db_writer


def test_upsert_entity_issues_insert_on_conflict():
    conn = MagicMock()
    cursor = MagicMock()
    conn.cursor.return_value.__enter__.return_value = cursor
    cursor.fetchone.return_value = ("11111111-1111-1111-1111-111111111111",)

    entity = {
        "entity_slug": "volcanic_fissure",
        "display_name": "Volcanic Fissure",
        "entity_type": "skill",
        "class_tags": ["warrior"],
        "mechanic_tags": ["slam", "fire"],
        "damage_tags": ["fire", "physical"],
        "description": "Slam",
        "creates": [],
        "triggered_by": [],
        "recommended_supports": [],
        "relevant_passives": [],
        "conversions_available": [],
    }
    entity_id = db_writer.upsert_entity(
        conn, entity, patch_version="1.0.0", content_hash_value="h", raw_ai_output={}
    )
    assert entity_id == "11111111-1111-1111-1111-111111111111"
    sql_called = cursor.execute.call_args_list[0][0][0]
    assert "INSERT INTO entities" in sql_called
    assert "ON CONFLICT" in sql_called


def test_upsert_edge_issues_insert_on_conflict():
    conn = MagicMock()
    cursor = MagicMock()
    conn.cursor.return_value.__enter__.return_value = cursor

    db_writer.upsert_edge(
        conn,
        game="poe2",
        from_id="a",
        to_id="b",
        interaction_type="direct",
        reason="x",
    )
    sql_called = cursor.execute.call_args_list[0][0][0]
    assert "INSERT INTO synergy_edges" in sql_called
    assert "ON CONFLICT" in sql_called
```

- [ ] **Step 3: Run the tests to confirm they fail**

Run: `pytest pipeline/tests/test_db_writer.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'pipeline.db_writer'`.

- [ ] **Step 4: Implement the writer**

Create `pipeline/db_writer.py`:

```python
"""Upsert scraped + indexed entities and edges into Netlify DB (Neon Postgres)."""

from __future__ import annotations

import json
import os
import sys

import psycopg2
import psycopg2.extras

from pipeline import hasher


UPSERT_ENTITY_SQL = """
INSERT INTO entities (
    game, entity_type, entity_slug, display_name, description,
    class_tags, mechanic_tags, damage_tags, creates, triggered_by,
    conversions_available, recommended_supports, relevant_passives,
    patch_version, content_hash, raw_ai_output
) VALUES (
    %(game)s, %(entity_type)s, %(entity_slug)s, %(display_name)s, %(description)s,
    %(class_tags)s, %(mechanic_tags)s, %(damage_tags)s, %(creates)s, %(triggered_by)s,
    %(conversions_available)s, %(recommended_supports)s, %(relevant_passives)s,
    %(patch_version)s, %(content_hash)s, %(raw_ai_output)s
)
ON CONFLICT (game, entity_slug) DO UPDATE SET
    entity_type           = EXCLUDED.entity_type,
    display_name          = EXCLUDED.display_name,
    description           = EXCLUDED.description,
    class_tags            = EXCLUDED.class_tags,
    mechanic_tags         = EXCLUDED.mechanic_tags,
    damage_tags           = EXCLUDED.damage_tags,
    creates               = EXCLUDED.creates,
    triggered_by          = EXCLUDED.triggered_by,
    conversions_available = EXCLUDED.conversions_available,
    recommended_supports  = EXCLUDED.recommended_supports,
    relevant_passives     = EXCLUDED.relevant_passives,
    patch_version         = EXCLUDED.patch_version,
    content_hash          = EXCLUDED.content_hash,
    raw_ai_output         = EXCLUDED.raw_ai_output
RETURNING id;
"""

UPSERT_EDGE_SQL = """
INSERT INTO synergy_edges (game, from_entity_id, to_entity_id, interaction_type, reason)
VALUES (%(game)s, %(from_id)s, %(to_id)s, %(interaction_type)s, %(reason)s)
ON CONFLICT (from_entity_id, to_entity_id) DO UPDATE SET
    interaction_type = EXCLUDED.interaction_type,
    reason           = EXCLUDED.reason;
"""

LOOKUP_SQL = "SELECT id FROM entities WHERE game = %s AND entity_slug = %s;"


def connect() -> psycopg2.extensions.connection:
    url = os.environ["NETLIFY_DATABASE_URL"]
    return psycopg2.connect(url, sslmode="require")


def upsert_entity(
    conn,
    entity: dict,
    *,
    patch_version: str,
    content_hash_value: str,
    raw_ai_output: dict,
    game: str = "poe2",
) -> str:
    params = {
        "game": game,
        "entity_type": entity["entity_type"],
        "entity_slug": entity["entity_slug"],
        "display_name": entity["display_name"],
        "description": entity.get("description", ""),
        "class_tags": entity.get("class_tags", []),
        "mechanic_tags": entity.get("mechanic_tags", []),
        "damage_tags": entity.get("damage_tags", []),
        "creates": entity.get("creates", []),
        "triggered_by": entity.get("triggered_by", []),
        "conversions_available": json.dumps(entity.get("conversions_available", [])),
        "recommended_supports": entity.get("recommended_supports", []),
        "relevant_passives": entity.get("relevant_passives", []),
        "patch_version": patch_version,
        "content_hash": content_hash_value,
        "raw_ai_output": json.dumps(raw_ai_output),
    }
    with conn.cursor() as cur:
        cur.execute(UPSERT_ENTITY_SQL, params)
        row = cur.fetchone()
    return str(row[0])


def upsert_edge(
    conn,
    *,
    game: str,
    from_id: str,
    to_id: str,
    interaction_type: str,
    reason: str,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            UPSERT_EDGE_SQL,
            {
                "game": game,
                "from_id": from_id,
                "to_id": to_id,
                "interaction_type": interaction_type,
                "reason": reason,
            },
        )


def lookup_id(conn, slug: str, game: str = "poe2") -> str | None:
    with conn.cursor() as cur:
        cur.execute(LOOKUP_SQL, (game, slug))
        row = cur.fetchone()
    return str(row[0]) if row else None


def write_all(scraped: list[dict], indexed: list[dict], patch_version: str) -> None:
    indexed_by_slug = {row["entity_slug"]: row for row in indexed}
    conn = connect()
    try:
        # First pass: upsert every entity so we can resolve slugs to ids.
        for entity in scraped:
            ai = indexed_by_slug.get(entity["entity_slug"], {})
            merged = dict(entity)
            if ai:
                merged["mechanic_tags"] = sorted(set(merged.get("mechanic_tags", [])) | set(ai.get("mechanic_tags", [])))
                merged["damage_tags"] = sorted(set(merged.get("damage_tags", [])) | set(ai.get("damage_tags", [])))
                merged["creates"] = ai.get("creates", [])
                merged["triggered_by"] = ai.get("triggered_by", [])
                merged["recommended_supports"] = ai.get("recommended_supports", [])
                merged["relevant_passives"] = ai.get("relevant_passives", [])
                merged["conversions_available"] = ai.get("conversions_available", [])
            upsert_entity(
                conn,
                merged,
                patch_version=patch_version,
                content_hash_value=hasher.content_hash(merged),
                raw_ai_output=ai,
            )
        conn.commit()

        # Second pass: write edges now that all ids exist.
        for ai in indexed:
            from_id = lookup_id(conn, ai["entity_slug"])
            if not from_id:
                continue
            for edge in ai.get("synergizes_with", []):
                to_id = lookup_id(conn, edge["entity_id"])
                if not to_id:
                    continue
                upsert_edge(
                    conn,
                    game="poe2",
                    from_id=from_id,
                    to_id=to_id,
                    interaction_type=edge.get("interaction_type", "direct"),
                    reason=edge.get("reason", ""),
                )
        conn.commit()
    finally:
        conn.close()


def main() -> int:
    payload = json.loads(sys.stdin.read())
    write_all(
        scraped=payload["entities"],
        indexed=payload.get("indexed", []),
        patch_version=payload.get("patch_version", "unknown"),
    )
    print(f"Wrote {len(payload['entities'])} entities / {len(payload.get('indexed', []))} indexed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 5: Run the tests and verify they pass**

Run: `pytest pipeline/tests/test_db_writer.py -v`
Expected: `2 passed`.

- [ ] **Step 6: Commit**

```bash
git add pipeline/db_writer.py pipeline/sql/schema.sql pipeline/tests/test_db_writer.py
git commit -m "feat(pipeline): Postgres upsert writer + schema.sql"
```

---

### Task 7: Netlify Blobs raw artifact backup

**Files:**
- Create: `pipeline/blobs_backup.py`
- Create: `pipeline/tests/test_blobs_backup.py`

- [ ] **Step 1: Write the failing test**

Create `pipeline/tests/test_blobs_backup.py`:

```python
import base64
import json
from unittest.mock import MagicMock, patch

from pipeline import blobs_backup


def test_decode_context_returns_site_and_token():
    raw = base64.b64encode(
        json.dumps({"siteID": "abc", "token": "t0ken", "primaryRegion": "us-east-1"}).encode()
    ).decode()
    ctx = blobs_backup.decode_context(raw)
    assert ctx["siteID"] == "abc"
    assert ctx["token"] == "t0ken"


def test_upload_posts_to_blobs_endpoint():
    raw = base64.b64encode(
        json.dumps({"siteID": "SITE", "token": "TOKEN", "primaryRegion": "us-east-1"}).encode()
    ).decode()
    with patch.object(blobs_backup, "requests") as req:
        resp = MagicMock(status_code=200)
        req.put.return_value = resp
        blobs_backup.upload(raw, key="poe2/raw/1.0.0.json", payload={"hello": "world"})
        called_url = req.put.call_args.args[0]
        headers = req.put.call_args.kwargs["headers"]
    assert "SITE" in called_url
    assert "poe2/raw/1.0.0.json" in called_url
    assert headers["Authorization"] == "Bearer TOKEN"
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pytest pipeline/tests/test_blobs_backup.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'pipeline.blobs_backup'`.

- [ ] **Step 3: Implement the blobs backup**

Create `pipeline/blobs_backup.py`:

```python
"""Upload raw scraped JSON to Netlify Blobs keyed by patch version."""

from __future__ import annotations

import base64
import json
import os
import sys
from urllib.parse import quote

import requests


STORE_NAME = "synergywizard-raw"


def decode_context(ctx_b64: str) -> dict:
    return json.loads(base64.b64decode(ctx_b64).decode("utf-8"))


def upload(ctx_b64: str, *, key: str, payload: dict) -> None:
    ctx = decode_context(ctx_b64)
    site_id = ctx["siteID"]
    token = ctx["token"]
    url = (
        f"https://api.netlify.com/api/v1/blobs/{site_id}/{STORE_NAME}/"
        f"{quote(key, safe='/')}"
    )
    resp = requests.put(
        url,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        data=json.dumps(payload),
        timeout=30,
    )
    if resp.status_code >= 300:
        raise RuntimeError(f"Blob upload failed: {resp.status_code} {resp.text}")


def main() -> int:
    ctx = os.environ["NETLIFY_BLOBS_CONTEXT"]
    patch_version = os.environ.get("PATCH_VERSION", "unknown")
    data = json.loads(sys.stdin.read())
    upload(ctx, key=f"poe2/raw/{patch_version}.json", payload=data)
    print(f"Uploaded poe2/raw/{patch_version}.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pytest pipeline/tests/test_blobs_backup.py -v`
Expected: `2 passed`.

- [ ] **Step 5: Commit**

```bash
git add pipeline/blobs_backup.py pipeline/tests/test_blobs_backup.py
git commit -m "feat(pipeline): Netlify Blobs raw artifact uploader"
```

---

### Task 8: Orchestration entrypoint

**Files:**
- Create: `pipeline/run_pipeline.py`

- [ ] **Step 1: Implement the orchestration script**

Create `pipeline/run_pipeline.py`:

```python
"""End-to-end pipeline orchestration invoked by GitHub Actions."""

from __future__ import annotations

import json
import os
import sys

from pipeline import blobs_backup, db_writer, hasher, indexer, patch_detector, scraper_poe2


def fetch_db_hashes(conn) -> dict[str, str]:
    with conn.cursor() as cur:
        cur.execute("SELECT entity_slug, content_hash FROM entities WHERE game = 'poe2';")
        rows = cur.fetchall()
    return {slug: h for slug, h in rows if h}


def main() -> int:
    # 1. Detect
    detection = patch_detector.detect()
    if not detection.changed:
        print("NO_CHANGE - skipping scrape")
        return 0
    patch_detector.save_state(detection.ggg_version, detection.steam_latest_gid)
    patch_version = detection.ggg_version or "unknown"

    # 2. Scrape
    print(f"Scraping for patch {patch_version}")
    entities = scraper_poe2.scrape_all()
    print(f"Scraped {len(entities)} entities")

    # 3. Backup raw
    ctx = os.environ.get("NETLIFY_BLOBS_CONTEXT")
    if ctx:
        blobs_backup.upload(
            ctx,
            key=f"poe2/raw/{patch_version}.json",
            payload={"patch_version": patch_version, "entities": entities},
        )

    # 4. Diff against DB
    conn = db_writer.connect()
    try:
        db_hashes = fetch_db_hashes(conn)
    finally:
        conn.close()
    changed_slugs = hasher.diff(entities, db_hashes)
    print(f"{len(changed_slugs)} entities changed")

    # 5. Cost guard + index
    to_index = [e for e in entities if e["entity_slug"] in set(changed_slugs)]
    try:
        indexer.check_cost_guard(to_index)
    except indexer.CostGuardError as exc:
        sys.stderr.write(f"ABORT: {exc}\n")
        return 1
    indexed = indexer.index_many(to_index)

    # 6. Write
    db_writer.write_all(entities, indexed, patch_version)
    print("Pipeline complete")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Smoke-compile the module**

Run: `python -c "import pipeline.run_pipeline"`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add pipeline/run_pipeline.py
git commit -m "feat(pipeline): end-to-end orchestration entrypoint"
```

---

### Task 9: GitHub Actions workflow

**Files:**
- Create: `.github/workflows/pipeline.yml`

- [ ] **Step 1: Author the workflow**

Create `.github/workflows/pipeline.yml`:

```yaml
name: Synergy Wizard Pipeline

on:
  schedule:
    - cron: '0 8 * * *'  # 08:00 UTC daily
  workflow_dispatch:

permissions:
  contents: write

jobs:
  run:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    env:
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      NETLIFY_DATABASE_URL: ${{ secrets.NETLIFY_DATABASE_URL }}
      NETLIFY_BLOBS_CONTEXT: ${{ secrets.NETLIFY_BLOBS_CONTEXT }}
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: 'pip'
          cache-dependency-path: 'pipeline/requirements.txt'

      - name: Install deps
        run: pip install -r pipeline/requirements.txt

      - name: Run pipeline
        id: run
        run: python -m pipeline.run_pipeline

      - name: Commit updated last_known_version.json
        if: success()
        run: |
          if git diff --quiet pipeline/last_known_version.json; then
            echo "No state change"
          else
            git config user.name "synergy-wizard-bot"
            git config user.email "aasghar@gmail.com"
            git add pipeline/last_known_version.json
            git commit -m "chore(pipeline): update last_known_version [skip ci]"
            git push
          fi
```

- [ ] **Step 2: Validate the YAML**

Run: `python -c "import yaml, pathlib; yaml.safe_load(pathlib.Path('.github/workflows/pipeline.yml').read_text())"`
Expected: no output (valid YAML).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/pipeline.yml
git commit -m "ci(pipeline): daily cron + manual dispatch workflow"
```

---

### Task 10: Integration test against 5 known skills

**Files:**
- Create: `pipeline/tests/integration/__init__.py`
- Create: `pipeline/tests/integration/test_known_synergies.py`
- Create: `pipeline/tests/integration/fixtures/known_five.json`

- [ ] **Step 1: Add the fixture for 5 known skills**

Create `pipeline/tests/integration/__init__.py` (empty file).

Create `pipeline/tests/integration/fixtures/known_five.json`:

```json
[
  {
    "entity_slug": "volcanic_fissure",
    "display_name": "Volcanic Fissure",
    "entity_type": "skill",
    "class_tags": ["warrior"],
    "mechanic_tags": ["slam", "fire", "aoe", "ground_effect"],
    "damage_tags": ["fire", "physical"],
    "description": "Slam the ground, unleashing a fissure of molten rock that erupts in waves."
  },
  {
    "entity_slug": "stampede",
    "display_name": "Stampede",
    "entity_type": "skill",
    "class_tags": ["warrior"],
    "mechanic_tags": ["slam", "aoe", "movement"],
    "damage_tags": ["physical"],
    "description": "Charge forward, knocking enemies aside and slamming the ground at the end."
  },
  {
    "entity_slug": "shockwave_totem",
    "display_name": "Shockwave Totem",
    "entity_type": "skill",
    "class_tags": ["warrior"],
    "mechanic_tags": ["totem", "slam", "aoe"],
    "damage_tags": ["physical"],
    "description": "Summons a totem that repeatedly slams the ground."
  },
  {
    "entity_slug": "earthquake",
    "display_name": "Earthquake",
    "entity_type": "skill",
    "class_tags": ["warrior"],
    "mechanic_tags": ["slam", "aoe", "duration", "ground_effect"],
    "damage_tags": ["physical"],
    "description": "Slam the ground to create an aftershock after a delay."
  },
  {
    "entity_slug": "leap_slam",
    "display_name": "Leap Slam",
    "entity_type": "skill",
    "class_tags": ["warrior"],
    "mechanic_tags": ["slam", "aoe", "movement", "melee"],
    "damage_tags": ["physical"],
    "description": "Leap into the air, crashing down with a slam that damages enemies near your landing."
  }
]
```

- [ ] **Step 2: Write the integration test**

Create `pipeline/tests/integration/test_known_synergies.py`:

```python
"""Integration test: runs the indexer against 5 known POE2 skills and verifies
that Volcanic Fissure + Stampede produces a direct interaction.

Requires ANTHROPIC_API_KEY. Skipped automatically when not set.
"""

import json
import os
from pathlib import Path

import pytest

from pipeline import indexer

FIX = Path(__file__).parent / "fixtures" / "known_five.json"


@pytest.mark.skipif(not os.environ.get("ANTHROPIC_API_KEY"), reason="no ANTHROPIC_API_KEY")
def test_volcanic_fissure_stampede_direct_edge():
    entities = json.loads(FIX.read_text())
    results = indexer.index_many(entities)
    by_slug = {r["entity_slug"]: r for r in results}

    vf = by_slug["volcanic_fissure"]
    stampede = by_slug["stampede"]

    vf_targets = {e["entity_id"] for e in vf["synergizes_with"] if e.get("interaction_type") == "direct"}
    st_targets = {e["entity_id"] for e in stampede["synergizes_with"] if e.get("interaction_type") == "direct"}

    assert "stampede" in vf_targets or "volcanic_fissure" in st_targets, (
        "Expected Volcanic Fissure + Stampede to produce at least one direct edge; "
        f"got vf={vf['synergizes_with']}, st={stampede['synergizes_with']}"
    )
```

- [ ] **Step 3: Run the integration test (with key) to confirm it passes**

Run: `ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY pytest pipeline/tests/integration -v`
Expected: `1 passed` (or `1 skipped` if no key is set in the environment).

- [ ] **Step 4: Commit**

```bash
git add pipeline/tests/integration/__init__.py pipeline/tests/integration/test_known_synergies.py pipeline/tests/integration/fixtures/known_five.json
git commit -m "test(pipeline): integration test for 5 known POE2 synergies"
```
