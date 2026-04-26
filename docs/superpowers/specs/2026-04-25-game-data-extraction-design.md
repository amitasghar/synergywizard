# Game Data Extraction — Design Spec

**Date:** 2026-04-25  
**Status:** Approved

## Problem

The poe2.wiki.gg API is permanently blocked by Cloudflare. The POB fallback only covers active skills and cannot distinguish support gems or provide passive data or class tags. This leaves the Browse tab filters for type and class effectively broken.

## Goal

Extract complete, accurate entity data (active skills, support gems, passives, class tags) directly from the local PoE2 game installation after each patch, commit the result as a seed file, and have CI use it automatically.

---

## Architecture

```
After each patch (local, manual):
  python -m pipeline.extract_game_data
    → reads Bundles2/_.index.bin via PyPoE (wiki fork)
    → parses SkillGems.dat64, ActiveSkills.dat64, PassiveSkills.dat64
    → enriches mechanic_tags via POB Lua files
    → writes pipeline/data/poe2_seed.json
    → user commits & pushes → CI picks it up automatically

CI (GitHub Actions, unchanged):
  scrape_all() checks seed file first
    → present: use seed + POB mechanic_tag enrichment
    → absent:  fall back to wiki → POB-only (existing behavior)
```

**New files:**
- `pipeline/extract_game_data.py` — local extraction script
- `pipeline/data/poe2_seed.json` — committed seed (output of extraction)
- `src/components/AdminPage.tsx` — admin status page
- `netlify/functions/seed-status.ts` — returns seed metadata at runtime

**Changed files:**
- `pipeline/scraper_poe2.py` — add `load_from_seed()`, update `scrape_all()` priority
- `pipeline/requirements.txt` — add PyPoE wiki fork
- `src/App.tsx` (or router) — add `/admin` route
- `.env` — add `POE2_DIR` for default game install path

**Unchanged:** `run_pipeline.py`, `db_writer.py`, `indexer.py`, GitHub Actions workflow.

---

## Section 1: Extraction Script

**Entry point:** `pipeline/extract_game_data.py`

**Usage:**
```
python -m pipeline.extract_game_data [--poe2-dir PATH] [--output PATH]
```

- `--poe2-dir` defaults to `POE2_DIR` env var if set
- `--output` defaults to `pipeline/data/poe2_seed.json`

**Steps:**
1. Initialize PyPoE bundle reader pointing at `{poe2_dir}/Bundles2`
2. Parse `Data/SkillGems.dat64` — active skills and support gems (IsSupport flag distinguishes them)
3. Parse `Data/ActiveSkills.dat64` — descriptions, keyword tags, class restrictions
4. Parse `Data/PassiveSkills.dat64` — passive skill names, descriptions, keywords
5. Map game keyword tags → our vocabulary (mechanic_tags, damage_tags, class_tags)
6. Clone/update POB repo and enrich `mechanic_tags` for active skills (same logic as today)
7. Write seed file

**Seed file format (`pipeline/data/poe2_seed.json`):**
```json
{
  "extracted_at": "2026-04-25T12:00:00Z",
  "patch_version": "3.25.0",
  "entity_counts": { "skill": 412, "support": 118, "passive": 347 },
  "entities": [
    {
      "entity_type": "skill",
      "entity_slug": "arc",
      "display_name": "Arc",
      "description": "Releases a beam of lightning...",
      "class_tags": [],
      "mechanic_tags": ["lightning", "aoe"],
      "damage_tags": ["lightning"]
    }
  ]
}
```

**PyPoE dependency:**
```
# pipeline/requirements.txt
git+https://github.com/Project-Path-of-Exile-Wiki/PyPoE.git@dev
```

PyPoE requires `ooz.dll` for bundle decompression. The script passes `{poe2_dir}/ooz.dll` (or `ooz64.dll`) explicitly to PyPoE's bundle reader — no separate download needed since it ships with the game.

---

## Section 2: Pipeline Integration

`scraper_poe2.py` is updated with:

```python
SEED_PATH = Path(__file__).parent / "data" / "poe2_seed.json"

def load_from_seed() -> list[dict] | None:
    if not SEED_PATH.exists():
        return None
    data = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    print(f"Using seed file: {data['entity_counts']} (extracted {data['extracted_at']})")
    return data["entities"]

def scrape_all() -> list[dict]:
    pob_skills_dir = ensure_pob_repo()
    pob_data = load_all_pob_data(pob_skills_dir)

    # Priority 1: committed seed file (game data extraction)
    seed_entities = load_from_seed()
    if seed_entities:
        return [merge_sources(e, pob_data) for e in seed_entities]

    # Priority 2: wiki (may come back someday)
    try:
        ...wiki scrape logic...
    except Exception as exc:
        print(f"Wiki scrape failed ({exc}), falling back to POB-only mode", file=sys.stderr)

    # Priority 3: POB-only fallback
    return _pob_only_entities(pob_data)
```

POB is still cloned and run in all cases — it enriches `mechanic_tags` on top of whatever entity list is produced.

---

## Section 3: Admin Page

**Route:** `/admin` — direct URL only, not linked from main nav.

**`/api/seed-status` Netlify Function:**
- Reads `pipeline/data/poe2_seed.json` at runtime using a path relative to the function file
- Also reads `POE2_DIR` from `process.env` (set in Netlify site env vars for production; from `.env` locally)
- Returns `{ present: false, poe2Dir: string }` if seed is missing
- Returns `{ present: true, extracted_at, patch_version, entity_counts, poe2Dir: string }` if present
- `poe2Dir` is used by the frontend to pre-fill the command box

**`AdminPage` component displays:**

1. **Status card**
   - Seed present / missing
   - Last extracted date and relative age ("3 days ago")
   - Patch version
   - Entity counts: skill / support / passive
   - Staleness badge:
     - Green — present, < 7 days old
     - Yellow — present, 7–30 days old
     - Red — missing or > 30 days old

2. **Command box**
   - Pre-filled copyable command:
     ```
     python -m pipeline.extract_game_data --poe2-dir "F:\SteamLibrary\steamapps\common\Path of Exile 2"
     ```
   - `--poe2-dir` value sourced from `POE2_DIR` env var if set; otherwise hardcoded default shown
   - Copy-to-clipboard button
   - Note below: "After running, commit `pipeline/data/poe2_seed.json` and push to trigger the pipeline."

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Seed file missing | `scrape_all()` falls through to wiki → POB fallback; admin page shows red badge |
| PyPoE / ooz error during extraction | Script exits with non-zero code and clear error message; no partial seed written |
| POB clone fails | Warning printed; entities returned without mechanic_tag enrichment |
| `/api/seed-status` seed unreadable | Returns `{ present: false }` |
| `/admin` in production with stale seed | Yellow/red badge shown; command box still displayed |

---

## Data Mapping

| Game dat field | Our schema field |
|---|---|
| `SkillGems.IsSupport = true` | `entity_type = "support"` |
| `ActiveSkills` entry | `entity_type = "skill"` |
| `PassiveSkills` entry | `entity_type = "passive"` |
| `ActiveSkills.DisplayedName` / `PassiveSkills.Name` | `display_name` |
| `ActiveSkills.Description` | `description` |
| `ActiveSkills.ActiveSkillTypes` keywords | `mechanic_tags` + `damage_tags` (via keyword map) |
| `SkillGems.CharacterClass` (if restricted) | `class_tags` |
| `slugify(display_name)` | `entity_slug` |

---

## Testing

- `extract_game_data.py` is run locally and output is spot-checked against known skills (e.g. Arc, Fireball, Added Cold Damage Support)
- Unit tests for the keyword → mechanic_tag mapping function
- CI automatically validates that `scrape_all()` returns non-empty list when seed is present (existing `test_scraper_poe2.py` extended)
