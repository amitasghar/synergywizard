# Multi-Game Support Design

## Goal

Restructure SynergyWizard into a multi-game platform where each game has its own DB table, API functions, frontend component tree, and pipeline extractor — all under a single app with a game tab selector.

## Constraints

- Only games with a local installation are supported; data extraction always reads local game files
- Game experiences are completely independent: no cross-game search, no shared filters
- PoE2 behavior stays identical after the restructure (rename/move only, no UX changes)
- D4 extractor is deferred until after the upcoming expansion drops

---

## Database

Each game gets its own table with game-specific columns. No shared `entities` table.

**Migration:**
- Rename `entities` → `poe2_entities`
- Drop the `game` column (redundant in a game-specific table)
- The pgvector `embedding` column and index move with the table

**`poe2_entities` schema (unchanged columns, just renamed table):**
```sql
ALTER TABLE entities RENAME TO poe2_entities;
ALTER TABLE poe2_entities DROP COLUMN game;
-- recreate index if needed
CREATE INDEX ON poe2_entities USING hnsw (embedding vector_cosine_ops);
```

**Future game example (`d4_entities`):**
```sql
CREATE TABLE d4_entities (
  id SERIAL PRIMARY KEY,
  entity_slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  entity_type TEXT NOT NULL,        -- "skill", "passive", "aspect", "paragon"
  class_tags TEXT[] DEFAULT '{}',   -- "barbarian", "druid", "sorcerer", etc.
  mechanic_tags TEXT[] DEFAULT '{}',
  damage_tags TEXT[] DEFAULT '{}',
  description TEXT DEFAULT '',
  embedding vector(384),
  indexed_at TIMESTAMPTZ
);
CREATE INDEX ON d4_entities USING hnsw (embedding vector_cosine_ops);
```

Each game table owns its schema. Columns are added freely without touching other games.

---

## API Layer

Netlify Functions are game-namespaced. Each function is self-contained and knows its own table and field names. Shared plumbing (DB connection, CORS headers, error format) lives in `netlify/lib/`.

**File structure:**
```
netlify/functions/
  poe2-search.ts          # renamed from search.ts
  poe2-semantic.ts        # renamed from semantic-search.ts
  poe2-seed-status.ts     # renamed from seed-status.ts
  d4-search.ts            # future
  lib/
    db.ts                 # shared: DB connection pool, query helpers
    response.ts           # shared: CORS headers, JSON response format
```

**URL mapping:**
- `/api/poe2-search` (was `/api/search`)
- `/api/poe2-semantic` (was `/api/semantic-search`)
- `/api/poe2-seed-status` (was `/api/seed-status`)

No generic `?game=` routing. Each function is independently deployable and independently testable.

**Frontend API client** gets game-prefixed methods:
- `poe2Search()`, `poe2SemanticSearch()` (was `search()`, `semanticSearch()`)
- `d4Search()` — future

---

## Frontend

A `GameSelector` tab bar at the top of the app controls which game experience renders. Each game is a self-contained component tree with its own filters, labels, and layout.

**File structure:**
```
src/
  components/
    GameSelector.tsx          # tab bar: "Path of Exile 2" | future games
    Header.tsx                # unchanged, hosts GameSelector
    AdminPage.tsx             # updated: one seed-status card per game
    poe2/
      LeftPanel.tsx           # moved from components/LeftPanel.tsx (unchanged)
      RightPanel.tsx          # moved from components/RightPanel.tsx (unchanged)
      NaturalSearchBar.tsx    # moved from components/NaturalSearchBar.tsx
      SearchFilters.tsx       # poe2-specific: class, mechanic, damage tag filters
    d4/                       # empty dir for now
  App.tsx                     # renders GameSelector + active game's component tree
  api.ts                      # updated: game-prefixed API methods
```

**`App.tsx` routing:**
```tsx
const [activeGame, setActiveGame] = useState<"poe2">("poe2");

return (
  <>
    <GameSelector active={activeGame} onChange={setActiveGame} />
    {activeGame === "poe2" && <Poe2App />}
  </>
);
```

**`GameSelector`** renders future games as disabled "coming soon" tabs so the UI communicates the roadmap without requiring working implementations.

Each game's component tree manages its own filter state. No conditional filter logic in shared components.

---

## Pipeline

`run_pipeline.py` takes `--game` and dispatches to the right game config and extractor.

**File structure:**
```
pipeline/
  games/
    poe2/
      config.py       # tag vocabularies, entity types, table name, valid tags
      extractor.py    # replaces scraper_poe2.py + extract_game_data.py (those files are deleted)
    d4/
      config.py       # future
      extractor.py    # future
  run_pipeline.py     # --game poe2|d4 dispatcher
  indexer.py          # reads table name from game config (minor update)
  data/
    poe2_seed.json    # unchanged location
```

**`config.py` contract (each game implements this):**
```python
GAME_ID = "poe2"
TABLE_NAME = "poe2_entities"
SEED_PATH = Path(__file__).parent.parent.parent / "data" / "poe2_seed.json"
VALID_MECHANIC_TAGS = {"slam", "fire", "aoe", ...}
VALID_DAMAGE_TAGS = {"fire", "cold", "lightning", "physical", "chaos"}
ENTITY_TYPES = {"skill", "support", "passive"}
```

**`run_pipeline.py` invocation:**
```bash
python -m pipeline.run_pipeline --game poe2
```

Drop-in replacement for the current pipeline invocation. CI/CD and the admin page run command update to use this form.

---

## Admin Page

The admin page shows one seed-status card per registered game. Each card has its own extracted date, entity counts, staleness badge, and run command.

Adding a new game = adding a new card. No conditional logic for existing games.

---

## What Does Not Change

- PoE2 seed file location (`pipeline/data/poe2_seed.json`)
- PoE2 entity schema (same fields, same values)
- PoE2 UX (identical after move to `poe2/` directory)
- Netlify build process
- pgvector embedding model (384-dim, `Xenova/all-MiniLM-L6-v2`)
- Claude enrichment logic in `indexer.py`

---

## Out of Scope

- D4 extractor (deferred until post-expansion)
- Cross-game search or shared filter components
- Any changes to PoE2 UX or data
