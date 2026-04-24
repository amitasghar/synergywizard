# Synergy Wizard — Design Spec v2.0

**Date:** 2026-04-23  
**Status:** Approved for implementation planning  
**Supersedes:** docs/synergy_wizard_PRD.md (v1.1)  
**Authors:** Amit + Claude  

---

## 1. Product Summary

Synergy Wizard is an ARPG skill synergy discovery tool. Players start with any theme — a skill, tag, or mechanic keyword — and instantly explore everything that synergizes with it, including damage type conversions that open new interaction chains. What takes 2 hours of wiki-browsing takes 2 minutes here.

**MVP scope:** Path of Exile 2 only. Skills, supports, and passives. No items. No community feed. No user accounts. Fully functional as a standalone tool with share URLs and export.

---

## 2. Goals & Success Metrics

### Launch (Month 1–3)
- 10,000 monthly active users
- 500+ unique synergy URLs shared
- Average session time > 8 minutes
- Appearing in Google search for "[skill name] synergy poe2"

### Growth (Month 4–12)
- 50,000 monthly active users
- Last Epoch added
- Ad revenue covering all hosting costs
- Community Discoveries feed live (Phase 2)

### Key Metrics
- Synergy analyses per day
- Share URL click-through rate
- Return visitor rate (target: 40%+)
- Session depth (skills added per session)

---

## 3. Scope

### In Scope (MVP)
- POE2: skills, supports, passive notables
- Theme search + skill browser
- Active tray (up to 8 entries)
- Synergy analysis panel
- Conversion layer
- "Extend this combo" panel
- Share URL (client-side encoded state)
- Export: Markdown, plain text, JSON
- Ko-fi donation link
- Patch detection + incremental re-indexing pipeline
- Cost alerting

### Out of Scope (MVP — Phase 2)
- Items as graph entities
- Last Epoch (fast follow after POE2 validated)
- Diablo 4 and other games
- Community Discoveries feed
- Optional user accounts / saved history
- Conversion chain visualization
- Patch impact tracker
- "Is My Build Dead?" tool
- Build translator (cross-game)
- Mobile app
- Custom domain (until profitable)

---

## 4. Architecture

### 4.1 Overview

```
┌─────────────────────────────────────────────────────┐
│                   NETLIFY PLATFORM                  │
│                                                     │
│  React + Tailwind SPA (CDN-served)                  │
│         │                                           │
│         ▼                                           │
│  Netlify Functions (API layer)                      │
│  • GET  /api/search                                 │
│  • POST /api/analyze                                │
│  • POST /api/extend                                 │
│         │                                           │
│         ▼                                           │
│  Netlify DB — Neon Postgres (free tier, 512 MB)     │
│  • entities table                                   │
│  • synergy_edges table                              │
└─────────────────────────────────────────────────────┘
         ▲
         │ writes on patch (daily cron)
         │
┌─────────────────────────────────────────────────────┐
│           INDEXING PIPELINE (GitHub Actions)        │
│                                                     │
│  Daily cron → patch detector → scraper →            │
│  hash diff → Claude batch job → DB write            │
│  Raw JSON artifacts → Netlify Blobs                 │
└─────────────────────────────────────────────────────┘
```

### 4.2 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Tailwind CSS |
| API | Netlify Functions (Node.js) |
| Database | Netlify DB (Neon Postgres, free tier) |
| ORM | Drizzle ORM |
| Blob storage | Netlify Blobs (raw artifact archive) |
| Indexing pipeline | GitHub Actions (Python) |
| AI indexing | Claude Sonnet (Anthropic batch API) |
| E2E testing | Playwright MCP |
| Analytics | Google Analytics (existing account) |

---

## 5. Data Pipeline

### 5.1 POE2 Data Sources

| Data | Source | Method |
|---|---|---|
| Skills + supports | `poe2.wiki.gg` MediaWiki API | API call, 1 req/sec |
| Passive notables | `poe2.wiki.gg` MediaWiki API | `Category:Passive_skills` |
| Passive tree graph | GGG official CDN JSON | Direct fetch |
| Skill stats + mod IDs | PathOfBuilding POE2 repo `src/Data/Skills/` | `git clone`, MIT license |
| Raw artifact backup | Netlify Blobs | Written per patch version |

### 5.2 Patch Detection

Runs daily via GitHub Actions cron:

1. Fetch GGG CDN version manifest → compare to stored version
2. Fetch Steam News API (`appid=2694490`) → check for new patch post
3. If either signals a new patch → trigger scrape + index pipeline
4. Otherwise → log "no change", exit

Rationale: daily detection catches patches within 24 hours at $0 GitHub Actions cost (~60 min/month vs 500 min free tier).

### 5.3 Scrape → Index Pipeline

```
1. SCRAPE
   Pull all skill/support/passive pages from wiki.gg API
   Pull POB repo (git pull, read Lua data files)
   Store raw JSON → Netlify Blobs (immutable, tagged with patch version)

2. DIFF
   SHA-256 hash each entity against stored hashes in DB
   Only changed/new entities proceed to indexing
   (First run: all entities)

3. AI INDEXING (Claude Sonnet batch)
   Per changed entity, send description + controlled tag vocabulary
   Few-shot prompt with 3–4 worked examples
   Output per entity:
   {
     mechanic_tags: ["slam", "fire", "aoe", "ground_effect"],
     damage_tags: ["fire", "physical"],
     creates: ["molten_fissure"],
     triggered_by: [],
     synergizes_with: [
       { entity_id: "stampede", reason: "...", interaction_type: "direct" }
     ],
     recommended_supports: ["upheaval_ii"],
     relevant_passives: ["aftershocks_notable"]
   }

4. WRITE
   Upsert entities table
   Upsert synergy_edges table (deduplicated)
   Update stored content_hash per entity
```

### 5.4 Indexing Cost Estimate

POE2 has ~300–400 skills/supports/passives at ~500 tokens each:
- First full index: ~200k tokens → ~$0.60
- Per-patch incremental (10–30 changed entities): ~$0.05–0.15
- Annual cost at 12–16 patches/year: **~$1–3/year**

### 5.5 Cost Alerting

- **Anthropic console:** hard monthly spend cap set before first run
- **Pipeline guard:** if entities flagged for re-index > 50 unexpectedly, abort and alert
- **GitHub:** billing alert at $1/month threshold in account settings
- **Netlify:** usage notification in dashboard billing settings

---

## 6. Database Schema

```sql
CREATE TABLE entities (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game                  TEXT NOT NULL,       -- 'poe2' (expandable)
    entity_type           TEXT NOT NULL,       -- 'skill' | 'support' | 'passive'
    entity_slug           TEXT NOT NULL,       -- 'volcanic_fissure'
    display_name          TEXT NOT NULL,
    description           TEXT,
    class_tags            TEXT[],              -- ['warrior']
    mechanic_tags         TEXT[],              -- ['slam', 'fire', 'aoe']
    damage_tags           TEXT[],              -- ['fire', 'physical']
    creates               TEXT[],
    triggered_by          TEXT[],
    conversions_available JSONB,               -- [{from, to, requires}]
    recommended_supports  TEXT[],
    relevant_passives     TEXT[],
    patch_version         TEXT,
    content_hash          TEXT,                -- SHA-256 for diff detection
    raw_ai_output         JSONB,               -- full Claude output, preserved
    UNIQUE(game, entity_slug)
);

CREATE TABLE synergy_edges (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game             TEXT NOT NULL,
    from_entity_id   UUID REFERENCES entities(id) ON DELETE CASCADE,
    to_entity_id     UUID REFERENCES entities(id) ON DELETE CASCADE,
    interaction_type TEXT,                     -- 'direct' | 'extended' | 'conditional'
    reason           TEXT,
    UNIQUE(from_entity_id, to_entity_id)
);

-- Indexes
CREATE INDEX ON entities USING GIN(mechanic_tags);
CREATE INDEX ON entities USING GIN(damage_tags);
CREATE INDEX ON entities USING GIN(class_tags);
CREATE INDEX ON entities USING GIN(
    to_tsvector('english', display_name || ' ' || coalesce(description,''))
);
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX ON entities USING GIN(display_name gin_trgm_ops);
CREATE INDEX ON synergy_edges(from_entity_id);
CREATE INDEX ON synergy_edges(to_entity_id);
```

Adding a new game requires only inserting rows with `game = 'last_epoch'` — zero schema changes.

---

## 7. API Layer (Netlify Functions)

### `GET /api/search?game=poe2&q=volcanic&class=warrior`

Full-text + fuzzy search across entity names and descriptions. Returns top 20 results grouped by type.

Response:
```json
[
  {
    "id": "uuid",
    "entity_type": "skill",
    "display_name": "Volcanic Fissure",
    "mechanic_tags": ["slam", "fire", "aoe"],
    "damage_tags": ["fire", "physical"]
  }
]
```

Also used with no `q` param for skill browser (returns all, filtered by class/type/tag).

---

### `POST /api/analyze`

Body: `{ "game": "poe2", "entity_ids": ["uuid1", "uuid2", "uuid3"] }`

Runs a 1-hop JOIN across `synergy_edges` for all selected entity IDs. Returns full analysis result.

Response:
```json
{
  "direct_interactions": [...],
  "extended_interactions": [...],
  "loop_detected": true,
  "damage_tags": ["fire", "physical"],
  "recommended_supports": [...],
  "relevant_passives": [...],
  "conversion_options": [
    {
      "entity_id": "uuid1",
      "display_name": "Volcanic Fissure",
      "current_tags": ["fire"],
      "can_convert_to": ["lightning", "cold"]
    }
  ]
}
```

---

### `POST /api/extend`

Body: `{ "game": "poe2", "mechanic_tags": ["slam", "fire"], "exclude_ids": ["uuid1", "uuid2"] }`

Returns entities sharing mechanic tags with the current tray, excluding already-selected entities.

Response:
```json
{
  "skills": [...],
  "supports": [...],
  "passives": [...]
}
```

---

### Conversion Diff (Client-Side)

No extra endpoint. Frontend calls `/api/analyze` twice — once with original tags, once with swapped tag — and diffs the `direct_interactions` arrays. New entries are highlighted in the UI.

### Caching

`Cache-Control: s-maxage=3600` on all endpoints. Netlify CDN caches by URL. Analysis results for the same entity set are stable between patches, so cache hit rate on popular combos will be high.

---

## 8. Frontend & UX

### 8.1 Layout

```
┌──────────────────────────────────────────────────────────────┐
│  ⚡ SYNERGY WIZARD   [PoE 2]  [Last Epoch — soon]  [Ko-fi ♥] │
├──────────────────────────────────────────────────────────────┤
│  Active: [Volcanic Fissure ×] [Stampede ×]    [Analyze →]   │
├──────────────────┬───────────────────────────────────────────┤
│  [Search] [Browse│  SYNERGY ANALYSIS                        │
│                  │                                          │
│  🔍 Search...    │  ✅ Direct Interactions (4)              │
│                  │  ⚡ Loop Detected                        │
│  ── or browse ── │  💎 Recommended Supports                 │
│  Class:  [Any ▾] │  🌿 Passive Notables                    │
│  Type:   [Any ▾] │  🔁 Rotation                            │
│  Tag:    [Any ▾] │                                          │
│                  │  🔄 CONVERSION OPTIONS                   │
│  Volcanic  [+]   │  Volcanic Fissure is: [Fire]            │
│  Stampede  [+]   │  Convert to: [Lightning] [Cold]         │
│  Earthquake[+]   │                                          │
│  Leap Slam [+]   │  ➕ EXTEND THIS COMBO                   │
│                  │  Skills:  [Forge Hammer] [Earthquake]   │
│                  │  Passives:[Aftershocks] ...             │
│                  │                                          │
│                  │  [🔗 Share] [📋 Export] [♥ Support]    │
└──────────────────┴───────────────────────────────────────────┘
```

### 8.2 Visual Design

- **Background:** near-black (`#0d0f12`) with subtle texture — depth without pure black flatness
- **Accent:** gold/amber (`#c8a96e`) for interactive elements, headings, active states — POE2's signature palette
- **Tag chips:** color-coded by type — mechanic tags (blue), damage tags (red/orange), class tags (green)
- **Active tray entries:** subtle amber glow border
- **Loop detected:** pulsing ring animation on the indicator
- **Conversion panel:** electric/lightning visual treatment when active — hero feature gets hero treatment
- **Typography:** monospace for tags and entity IDs, clean sans-serif (Inter or similar) for body text
- **Logo:** lightning bolt + wizard silhouette, gold on dark — art assets to be provided by Amit

### 8.3 User Modes

Both modes use the same UI — entry point differentiates them:

- **Beginner:** opens Browse tab → filters by class → picks 2–3 skills they recognize → hits Analyze → reads plain-English explanation
- **Theorycraft:** types a theme in Search → explores → converts damage type → iterates → shares URL

### 8.4 Share URL Format

```
synergywizard.netlify.app/poe2/warbringer?skills=volcanic-fissure,stampede&convert=volcanic-fissure:fire>lightning
```

Switches to `synergywizard.gg/...` (or chosen domain) once registered. Full analysis state is encoded in URL params — no server-side persistence required.

### 8.5 Export Formats

- **Markdown** — full build spec for Mobalytics, Reddit, Google Docs
- **Plain text** — condensed for Discord
- **JSON** — structured synergy + conversion data for developers

---

## 9. Monetization

### Revenue Sequencing

```
Launch:          Ko-fi donate link (footer + export panel)
Soft launch:     Register domain (~$12–15/yr .com or .net)
                 Apply for Google AdSense immediately
10k pageviews:   Apply for Carbon Ads (better CPM for gaming audience)
Profitable:      Upgrade infra as needed, consider .gg domain
```

### Ad Placement

- Sidebar of synergy analysis panel (never inside the results themselves)
- Below export options
- Carbon Ads preferred over AdSense once eligible — less intrusive, better ARPG audience CPM

### Ko-fi

- "Support this project" button in footer and on the export panel
- One-time donations, 0% Ko-fi fee on free plan
- Covers domain cost and Claude indexing cost (~$14–18/year total) before ad revenue

---

## 10. Hosting & Cost

| Item | Cost |
|---|---|
| Netlify (existing paid plan) | $0 added |
| Netlify DB — Neon free tier (512 MB, data ~60 MB) | $0 |
| GitHub Actions daily cron (~60 min/month) | $0 |
| Claude API indexing (~$1–3/year) | ~$0.10/month |
| Domain (deferred) | $0 until profitable |
| **Total at launch** | **~$0** |

Upgrade path: Neon paid ($19/month) only when consistent daily traffic drives DB connection pressure.

---

## 11. Testing

### E2E (Playwright MCP)
- Theme search → add to tray → analyze → conversion diff → share URL
- Skill browser → filter by class → add to tray → analyze
- Export: Markdown, plain text, JSON outputs are non-empty and well-formed
- Share URL round-trip: generate URL → open URL → same analysis state restored

### Pipeline Testing
- Indexing job: run against a small fixture set of 5–10 known skills
- Validate Claude output against expected mechanic tags for known synergies (e.g. Volcanic Fissure + Stampede must produce a direct interaction)
- Cost guard: verify abort triggers correctly when entity count exceeds threshold

---

## 12. Expansion Roadmap

The architecture is game-agnostic from day one. Adding a new game requires:

1. A new data scraper (game-specific wiki/API)
2. A tuned Claude indexing prompt (game-specific terminology)
3. A `game = 'last_epoch'` row partition in the DB — zero schema changes

### Phase 2 Priorities (based on traction)
1. Last Epoch (data sources researched, per-skill tree model mapped)
2. Community Discoveries feed (requires click tracking table, ~2–3 days)
3. User accounts + saved history (Netlify Identity, Google + Discord OAuth)
4. Items as graph entities (POE2 unique items)
5. Diablo 4 (different mechanical model — aspects/affixes vs passive tree)

---

## 13. Open Questions (Deferred)

- Which domain to register at soft launch (.com vs .gg vs .io)?
- How many POE2 passives to index at launch — all notables, or only the most mechanically relevant?
- Should conversions at launch be limited to well-documented ones or attempt full coverage?
- Who builds it — Amit solo or with a partner?
