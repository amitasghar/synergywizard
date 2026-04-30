# Diablo IV Support Design

## Goal

Add Diablo IV as the second game on SynergyWizard alongside PoE2, using the same 3-panel layout adapted for D4's class-based skill system. Users can navigate directly to `/poe2` or `/d4` via URL.

## Approach

Option B — add D4 alongside PoE2 with minimal restructure. The existing `entities` table, PoE2 functions, and PoE2 components are untouched. D4 gets its own pipeline, API functions, and component tree.

---

## Data Pipeline

**Source:** `blizzhackers/d4data` GitHub repository — community JSON dumps published after each patch, covering skills, passives, and aspects for all 6 classes including Spiritborn (Vessel of Hatred expansion).

**Script:** `pipeline/games/d4/extractor.py`
- Downloads the latest release tarball from the community repo
- Maps community JSON to the SynergyWizard entity schema
- Writes `pipeline/data/d4_seed.json`

**Entity types:**

| Type | class_tags | mechanic_tags | damage_tags | notes |
|---|---|---|---|---|
| skill | e.g. `["barbarian"]` | e.g. `["slam", "aoe"]` | e.g. `["physical"]` | one class per skill |
| passive | e.g. `["druid"]` | varies | varies | per-class tree nodes |
| aspect | `[]` or class-specific | varies | varies | Codex of Power entries |

**Classes:** barbarian, druid, necromancer, rogue, sorcerer, spiritborn

`weapon_tags` is always `{}` for D4 — skills are not weapon-gated. `recommended_supports` field is repurposed as `recommended_aspects` — the Claude enrichment pass surfaces which aspects complement a given skill.

**DB:** No migration. D4 entities insert into the existing `entities` table with `game='d4'`.

---

## API Layer

Three new Netlify functions scoped to `game='d4'`. Existing PoE2 endpoints are untouched.

### `/api/d4-search` (`d4-search.ts`)
Keyword + filter search. Filters: `class_tags`, `mechanic_tags`, `damage_tags`, `types` (skill/passive/aspect). No weapon filter.

### `/api/d4-semantic` (`d4-semantic.ts`)
Client sends pre-computed vector (same `useEmbedder` hook). Server runs pgvector cosine query scoped to `game='d4'`. Identical to `semantic-search.ts`.

### `/api/d4-analyze` (`d4-analyze.ts`)
Synergy analysis for a selected set of D4 entities:
- **Aspect→skill edges** (`direct`): aspect description references a skill name in the selected set
- **Shared damage tags**: union of damage tags across selected skills
- **Relevant passives**: passives whose mechanic/damage tags overlap the selected set
- No conversion options, no support-linking (PoE2-specific concepts omitted)

**Frontend API client additions:** `d4Search()`, `d4SemanticSearch()`, `d4Analyze()` — added alongside existing `search()`, `analyze()`, `semanticSearch()`.

---

## Routing + GameSelector

**URL scheme:**
- `/` or `/poe2` → PoE2 experience
- `/d4` → D4 experience

On load, `App.tsx` reads `window.location.pathname` to set `activeGame`. Tab switches call `history.pushState` so the URL updates and the back button works. Existing PoE2 share links (`/?s=...`) continue to work. D4 share links use `/d4?s=...`.

The existing `/* → /index.html` SPA redirect in `netlify.toml` handles deep links for both games with no changes.

**`GameSelector` component** (`src/components/GameSelector.tsx`)
Tab bar rendered inside `Header.tsx`:
```
[ Path of Exile 2 ]  [ Diablo IV ]
```

**`App.tsx` structure:**
```tsx
{activeGame === "poe2" && <Poe2Experience />}
{activeGame === "d4"   && <D4Experience />}
```

`Poe2Experience` wraps the current layout unchanged. `D4Experience` wraps the D4 layout. No conditional rendering scattered through shared components.

---

## D4 Components

**New files** under `src/components/d4/`:

### `D4FilterSidebar.tsx`
- Class filter is **primary**: Barbarian, Druid, Necromancer, Rogue, Sorcerer, Spiritborn chips
- Entity type chips: `skill | passive | aspect`
- Damage tag chips and mechanic tag chips below (same pattern as PoE2)
- No weapon chips

### `D4AnalysisPanel.tsx`
Same card structure as PoE2's `AnalysisPanel`, adapted labels:
- "Recommended Supports" → **"Recommended Aspects"**
- "Relevant Passives" stays
- Synergy edges show aspect→skill relationships
- Conversion panel removed

### `D4Experience.tsx`
Thin layout wrapper assembling:
- `D4FilterSidebar` (left)
- `CenterPanel` (center, reused as-is)
- `D4AnalysisPanel` + `SandboxPanel` (right, reused as-is)

**Reused with minor wiring:** `CenterPanel`, `BrowseTab`, `AskTab`, and `NaturalSearchBar` currently call `api.search()` and `api.semanticSearch()` directly. These are updated to accept a `game` prop (or an injected API adapter) so `D4Experience` can pass in the D4 API methods without duplicating the components. The change is a prop thread-through, not a logic rewrite.

**Reused without changes:** `SandboxPanel`, `SandboxCard`, `EntityCard`, `TagChip`, `ShareBar`.

### State isolation
D4 gets its own Zustand store slice so PoE2 and D4 sandbox state don't bleed when switching tabs.

---

## What Does Not Change

- `entities` table schema and existing data
- All PoE2 Netlify functions (`search.ts`, `analyze.ts`, `semantic-search.ts`, etc.)
- All existing PoE2 components
- PoE2 share URL format
- Embedding model (384-dim `Xenova/all-MiniLM-L6-v2`)
- Netlify build config

---

## Out of Scope

- Renaming `entities` → `poe2_entities` or restructuring to game-namespaced tables (deferred cleanup)
- Moving PoE2 components into `src/components/poe2/` (deferred cleanup)
- D4 unique item powers and paragon nodes (future v2)
- Cross-game search
