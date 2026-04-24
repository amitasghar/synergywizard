# Synergy Wizard — Product Requirements Document
**Version:** 1.1  
**Date:** April 2026  
**Author:** Amit + Kit  
**Status:** Draft  
**Changelog:** v1.1 — Added theme-first workflow, items as first-class inputs, conversion layer, iterative session flow, dual user modes based on real user research

---

## 1. Product Overview

### 1.1 Elevator Pitch
Synergy Wizard is an ARPG skill synergy discovery tool that tells players *why* skill combinations work, not just *if* they're popular. Start with any theme — a skill, item, or mechanic keyword — and instantly explore everything that synergizes with it, including conversions that open entirely new interaction chains. What takes 2 hours of wiki-browsing takes 2 minutes here.

### 1.2 Problem Statement
ARPG players spend hundreds of hours theorycrafting builds, but every existing tool (Mobalytics, Maxroll, Path of Building) assumes you already know what you're building. They are **lookup tools**, not **discovery tools**. The result:

- New and mid-level players copy meta builds without understanding why they work
- Creative players can't easily validate novel combos without expensive in-game trial and error
- Genuinely new synergy discoveries take days/weeks to surface through streamers and Reddit
- No tool reasons about *mechanical interactions* — they only show stats and compatibility
- No tool connects skills, items, and passive notables into a single searchable graph
- No tool models damage type conversions and shows what new synergies open up as a result
- Hardcore theorycrafters spend 2+ hours manually cross-referencing wikis to validate a single build idea

### 1.3 Solution
A pre-computed synergy graph built from official skill, support, passive, and item descriptions — queryable through a pure UI with no natural language input. Players start with any theme (skill, item, or keyword), explore outward through the graph, apply damage type conversions to discover new interaction chains, and iterate — all in one session. Zero AI tokens at runtime. Fast, free to serve, shareable by design.

### 1.4 Product Name
**Synergy Wizard**  
Domain targets: `synergywizard.gg` or `synergywizard.io`

---

## 2. Goals & Success Metrics

### Launch Goals (Month 1-3)
- 10,000 monthly active users across PoE 2 + Last Epoch
- 500+ unique synergy combinations shared via URL
- Average session time > 8 minutes
- Appearing in Google search results for "[skill name] synergy poe2"

### Growth Goals (Month 4-12)
- 50,000 monthly active users
- Community Discoveries feed with 50+ weekly submissions
- 3rd game added to platform
- Ad revenue covering hosting costs

### Key Metrics
- Synergy analyses run per day
- Share URL click-through rate
- Return visitor rate (target: 40%+)
- Session depth (number of skills added per session)
- Export actions per session

---

## 3. Target Users

All three segments are equally prioritized at launch:

### 3.1 Beginner Players
- Don't understand why builds work
- Copy guides blindly, get frustrated when things don't perform
- **Need:** Plain English explanations of how skills connect
- **Value:** Synergy Wizard teaches them the mechanics while helping them build

### 3.2 Mid-Level Theorycrafters
- Have ideas but can't easily validate them
- Spend hours on Reddit/Discord asking "does X work with Y?"
- **Need:** Fast validation of combo ideas before committing in-game
- **Value:** Instant interaction analysis + shareable link to show others

### 3.3 Hardcore Players & Content Creators
- Already deep in mechanics, want to discover novel synergies fast
- Current workflow: find theme → browse wiki for synergies → find items → find conversions → re-browse with new damage tag — takes 2+ hours manually
- Create guides, YouTube content, Reddit posts
- **Need:** Compress the full theorycraft loop from hours to minutes
- **Value:** Synergy Wizard becomes the tool they link in their content, driving traffic; their shared discoveries fuel the Community feed

---

## 4. Supported Games at Launch

### 4.1 Path of Exile 2
- Primary game, largest community, highest search volume
- Data sources: poe2wiki.net, poe2db.tw
- Skill gems, support gems, passive tree notables, ascendancy nodes
- Patch cadence: frequent — requires reliable update pipeline

### 4.2 Last Epoch
- Secondary game, passionate community, weak existing tooling
- Data sources: Last Epoch wiki, maxroll Last Epoch section
- Skill trees (each skill has its own tree — different structure to PoE 2)
- Passive mastery trees per class
- Patch cadence: slower — lower maintenance burden

### 4.3 Multi-Game Architecture Requirement
The data layer, synergy engine, UI, and sharing infrastructure must be **game-agnostic from day one**. Adding a new game should require only:
1. A new data ingestion pipeline for that game's wiki
2. A tuned indexing prompt for that game's terminology
3. A game-specific UI skin/label set
All core logic is shared.

---

## 5. Features

### 5.0 Core User Workflow (Informed by Real User Research)

A hardcore Last Epoch player described their real theorycraft process:

> 1. Find the theme — a specific skill, item, or gimmick
> 2. Find all skills that synergize with the theme (proc it, augment it, affect it)
> 3. Find all items that directly synergize with the theme
> 4. Find any damage type conversions (e.g. Meteor: Fire → Lightning)
> 5. Return to step 2 with the new damage tag (Lightning instead of Fire)

This is the workflow Synergy Wizard must support. It is iterative, not one-shot. It starts with a theme, not a skill list. It includes items as first-class inputs. It models conversions as a graph re-entry point.

### 5.1 Two User Modes

The same underlying data serves two distinct UX flows:

**Beginner Mode — "Help me understand this"**
- User picks 2-3 skills they've seen in a guide
- Tool explains in plain English why they interact, what the loop is, what supports help
- Focus: explanation and education

**Theorycraft Mode — "Help me explore this"**
- User starts with a theme (skill, item, keyword)
- Tool shows everything connected to that theme
- User adds, removes, converts, and iterates
- Focus: speed of discovery and iteration depth

Both modes use the same UI — the difference is entry point and how deep the user goes.

### 5.2 MVP Features (Launch)

#### Unified Theme Search (replaces "Skill Picker")
The primary search input accepts skills, items, AND mechanic keywords — not just skill names.

- Type "Meteor" → see: Meteor (skill), items that reference Meteor, passives that affect Meteor
- Type "Ground Effect" → see: all skills tagged Ground Effect as a tag browse
- Type "Ignite" → see: all skills that create, extend, or benefit from Ignite
- Results grouped by type: Skills / Items / Passives / Tags
- Click any result to add it to the active tray

This is the theme-first entry point. No separate "tag browser" needed — it's unified.

#### Active Tray
Selected skills and items sit in a persistent tray at the top of the page.

```
Active: [Meteor (skill) ×] [Ashen Crown (item) ×] [Analyze →]
```

- Maximum 8 entries (skills + items combined)
- Tray persists across the iterative session
- Removing and adding items re-triggers analysis automatically

#### Game & Class Selector
- Top-level game selector: [Path of Exile 2] [Last Epoch]
- Class filter (optional): narrows skill and item pool to class-relevant entries
- Ascendancy filter (optional): highlights ascendancy-specific interactions

#### Synergy Analysis Panel
Triggered when user hits "Analyze" with 2+ entries in tray. Displays:

- **Direct Interactions** — entry A directly enables, triggers, or amplifies entry B
- **Item Interactions** — how selected items interact with selected skills (e.g. "Ashen Crown causes Meteor to proc on kill")
- **Extended Interactions** — A creates a condition that C benefits from via B
- **Loop Detection** — identifies circular chains
- **Damage Tags** — all active damage types in the current selection (feeds conversion panel)
- **Recommended Supports** — per skill, pre-computed
- **Passive Notables** — tree nodes that amplify detected interactions
- **Rotation Suggestion** — plain English sequence

#### Conversion Layer (new — critical for iterative workflow)
After analysis, if any skill in the tray has a detectable damage type, a conversion panel appears:

```
⚡ Conversion Options
Meteor is currently tagged: [Fire]
Convert to: [Lightning] [Cold] [Physical] [Chaos]
→ Re-analyze with Lightning tag
```

Applying a conversion:
- Swaps the damage type tag on that skill in the graph
- Re-runs synergy analysis with the new tag
- Shows newly unlocked interactions that weren't available under the original damage type
- Highlights which interactions are NEW vs previously detected

This directly models step 4-5 of the real user workflow.

#### "Extend This Combo" Panel
After analysis, shows skills AND items from the DB that share tags with the current loop. Grouped by type:

```
➕ Skills that extend this synergy:
[Shockwave Totem] [Forge Hammer] [Earthquake]

🗡️ Items that synergize with this combo:
[Hrimnor's Hymn] [Kaom's Madness]

Click any to add and re-analyze →
```

This is the engine of iterative discovery — it replaces manual wiki browsing with one-click graph traversal.

#### Items as First-Class Graph Entities (new)
Unique items are indexed alongside skills during the AI batch job. For each item, the indexer extracts:
- Mechanic tags (same taxonomy as skills)
- What it creates, procs, or modifies
- What skills or skill tags it references explicitly
- What damage types it affects or converts

Items are fully searchable, addable to the tray, and appear in the "Extend This" panel alongside skills.

#### Shareable URL
- Every analysis state generates a permanent URL encoding selected skills, items, game, class, ascendancy, and any active conversions
- URL is human-readable:
  `synergywizard.gg/poe2/warbringer?skills=volcanic-fissure,stampede,shockwave-totem`
  `synergywizard.gg/le/runemaster?skills=meteor&items=ashen-crown&convert=meteor:fire>lightning`
- One-click copy button
- Open Graph social preview card for Discord/Reddit embeds showing skill/item names + top detected interaction

#### Export
- **Markdown** — full build spec for Mobalytics, Reddit, Google Docs
- **Plain text** — condensed for Discord
- **JSON** — structured synergy + conversion data for power users and developers

#### Optional Account (via Google/Discord OAuth)
- Save synergy analyses to personal history with custom names
- Session history preserved even without account (localStorage) for duration of visit
- Account creation prompted after 3 analyses ("Save your discoveries")
- No account required for core features or sharing

#### Community Discoveries Feed
- Displayed on homepage
- Shows most-shared synergy URLs from past 7 days, sorted by share count
- Each entry shows: skill/item names, game, class, top interaction, share count, conversion if applied
- Filterable by game, class, damage tag, mechanic tag
- No upvote mechanic at launch — share-count driven

### 5.3 Post-Launch Features (Roadmap)

#### Patch Impact Tracker
Re-run indexing on patch drop, surface which synergies changed, broke, or got buffed. High-traffic event.

#### "Is My Build Dead?" Tool
Input current skill + item setup → see which interactions were affected by latest patch.

#### Build Translator
Cross-game mechanic mapping — "I loved my Last Epoch Meteor Runemaster, what's the closest PoE 2 equivalent?"

#### Saved Build Collections
Group synergy analyses into a full build plan, share as single URL. Natural bridge to Mobalytics/PoB export.

#### Creator Profiles
Content creators claim a profile, list discoveries, link YouTube/Twitch. Drives backlinks and creator adoption.

#### Conversion Chain Visualization
Visual graph showing how a damage type conversion cascades through the synergy map — which interactions stay, which open, which close.

---

## 6. Technical Architecture

### 6.1 Data Pipeline (AI runs here — NOT at query time)

```
Game Wiki / DB
      ↓
Scraper / Ingestion Script (per game, runs on patch)
      ↓
Raw Description Store (JSON / DB)
      ↓
AI Indexing Job (Claude API batch — ~$2-5 per game per patch)
      ↓
Synergy Graph DB (pre-computed relationships)
      ↓
Query Layer (zero AI at runtime)
```

#### AI Indexing Job — What It Computes Per Entry
For each skill, support, passive, and **item** the batch job extracts and stores:
- Mechanic tags (Slam, Fire, Ground Effect, Duration, Travel, Totem, etc.)
- Damage type tags (Fire, Lightning, Cold, Physical, Chaos, Void)
- What it creates (ground effects, fissures, debuffs, charges)
- What it triggers or is triggered by
- What conditions it requires to activate
- What it amplifies or is amplified by
- Compatible support gems (skills only — from official compatibility data)
- Related passive notables (from description keyword matching)
- Conversion options: what damage types can be converted to/from, and what tag changes result
- Entity type: skill / support / passive / item

#### Synergy Graph Structure
```json
{
  "game": "poe2",
  "entity_type": "skill",
  "skill_id": "volcanic_fissure",
  "display_name": "Volcanic Fissure",
  "class_tags": ["warrior"],
  "mechanic_tags": ["slam", "fire", "aoe", "duration", "ground_effect"],
  "damage_tags": ["fire", "physical"],
  "conversions_available": [
    { "from": "fire", "to": "lightning", "requires": "specific_item_or_passive" }
  ],
  "creates": ["molten_fissure"],
  "triggered_by": ["different_slam"],
  "produces_on_trigger": ["aftershock"],
  "synergizes_with": [
    {
      "entity_id": "stampede",
      "entity_type": "skill",
      "reason": "Stampede creates Jagged Ground per footstep + final slam detonates all nearby Jagged Ground + triggers fissure aftershocks simultaneously",
      "interaction_type": "direct"
    },
    {
      "entity_id": "hrimnors_hymn",
      "entity_type": "item",
      "reason": "Grants 'Slam Skills cause an additional Aftershock' — every fissure trigger gets a guaranteed extra aftershock regardless of % chance",
      "interaction_type": "direct"
    }
  ],
  "recommended_supports": ["jagged_ground_i", "upheaval_ii", "elemental_armament_ii"],
  "relevant_passives": ["aftershocks_notable", "ancestral_artifice"],
  "patch_version": "0.4"
}
```

### 6.2 Runtime Query Layer
All user queries are DB lookups / graph traversals — no AI:
- Theme search → full-text search across skill names, item names, mechanic keywords
- Tag filter → index on mechanic_tags and damage_tags
- Synergy analysis → graph join on synergizes_with for all selected skills + items
- Item interactions → lookup items in synergizes_with for selected skills
- Support recommendations → lookup recommended_supports per skill
- Passive recommendations → lookup relevant_passives per detected interaction
- "Extend this combo" → find skills AND items that share mechanic_tags with detected loop
- Conversion → swap damage_tags on target skill, re-run graph traversal, diff results to show new interactions

### 6.3 Tech Stack Recommendations
- **Frontend:** React + Tailwind (fast to build, easy to maintain)
- **Backend:** Node.js or Python FastAPI
- **DB:** PostgreSQL with graph-style junction tables OR Neo4j if graph queries get complex
- **AI Indexing:** Claude API (Sonnet) — batch job only
- **Auth:** Auth0 or Clerk (Google + Discord OAuth)
- **Hosting:** Vercel (frontend) + Railway or Render (backend)
- **Analytics:** Plausible or PostHog (privacy-friendly, no cookie banner needed in most regions)

### 6.4 Patch Update Pipeline
1. Monitor official patch notes RSS / forum posts per game
2. Trigger scraper on patch detection
3. Diff new descriptions against stored descriptions
4. Run AI indexing job only on changed skills (reduces token cost further)
5. Update synergy graph
6. Publish patch impact summary to Community Discoveries feed

---

## 7. Monetization

### 7.1 Model: Ad Revenue Only
- Display ads via Google AdSense or Carbon Ads (Carbon is ARPG/dev audience-friendly)
- Ad placements: sidebar on results panel, below Community Discoveries feed, between export options
- No paywalls, no feature gating — full tool is free

### 7.2 Ad Strategy
- Carbon Ads preferred over AdSense for ARPG audience (better CPM, less intrusive)
- Avoid ads inside the synergy analysis panel itself — protect core UX
- Patch days are peak traffic — highest ad inventory value

### 7.3 Revenue Drivers
- High session time (deep theorycraft sessions = more ad impressions)
- Return visits (patch updates, new game additions)
- Viral share URLs (each Reddit/Discord share brings new sessions)
- Community Discoveries feed (daily return visits from engaged users)

---

## 8. UI Layout

```
┌──────────────────────────────────────────────────────────────┐
│  ⚡ SYNERGY WIZARD   [PoE 2 ▾] [Last Epoch ▾]   [My Builds] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Active: [Volcanic Fissure ×][Stampede ×][Hrimnor's Hymn ×] │
│                                              [Analyze →]    │
│                                                              │
│  ┌──────────────────────┐  ┌───────────────────────────────┐│
│  │  THEME SEARCH        │  │  SYNERGY ANALYSIS             ││
│  │                      │  │                               ││
│  │  🔍 Search anything  │  │  ✅ Direct Interactions (4)   ││
│  │  skill, item, tag... │  │  🗡️ Item Interactions (1)     ││
│  │                      │  │  ⚡ Loop Detected             ││
│  │  Class:  [Any ▾]     │  │  💎 Recommended Supports      ││
│  │  Asc:    [Any ▾]     │  │  🌿 Passive Notables          ││
│  │                      │  │  🔁 Rotation                  ││
│  │  SKILLS              │  │                               ││
│  │  Volcanic Fissure [+]│  │  🔄 CONVERSION OPTIONS        ││
│  │  Stampede         [+]│  │  Meteor is: [Fire]            ││
│  │  Shockwave Totem  [+]│  │  Convert: [Lightning] [Cold]  ││
│  │                      │  │  → Re-analyze with new tag    ││
│  │  ITEMS               │  │                               ││
│  │  Hrimnor's Hymn   [+]│  │  ➕ Extend this combo         ││
│  │  Kaom's Madness   [+]│  │  Skills: [Forge Hammer] ...   ││
│  │                      │  │  Items:  [Kaom's Madness] ... ││
│  │  TAGS                │  │                               ││
│  │  Ground Effect    [+]│  │  [🔗 Share] [📋 Export] [💾]  ││
│  └──────────────────────┘  └───────────────────────────────┘│
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  🔥 COMMUNITY DISCOVERIES THIS WEEK                  │   │
│  │  Meteor (Fire→Lightning) + ...       (312 shares)    │   │
│  │  Volcanic Fissure + Stampede + ...   (234 shares)    │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

---

## 9. Sharing & Community

### 9.1 Shareable URL Format
```
synergywizard.gg/{game}/{ascendancy}?skills={skill1},{skill2}&items={item1}&convert={skill}:{from}>{to}

synergywizard.gg/poe2/warbringer?skills=volcanic-fissure,stampede,shockwave-totem&items=hrimnors-hymn
synergywizard.gg/le/runemaster?skills=meteor&items=ashen-crown&convert=meteor:fire>lightning
```

### 9.2 Social Preview (Open Graph)
When pasted into Discord or Reddit, link unfurls showing:
- Skill names + icons
- Game + class/ascendancy
- Top detected interaction summary ("Loop Detected: Fissure → Aftershock → Jagged Ground → repeat")

### 9.3 Community Discoveries Feed
- Tracks share URL click counts (no account needed to contribute)
- Any URL shared publicly and clicked 5+ times surfaces in the feed
- Feed resets weekly to keep fresh
- Filterable by game, class, mechanic tag

### 9.4 Optional Account Features
- Save synergy analyses with custom names
- View personal discovery history
- No account required for any core feature
- Sign in with Google or Discord

---

## 10. Launch Plan

### Phase 1 — Build (Weeks 1-6)
- Set up data ingestion for PoE 2 (poe2wiki / poe2db)
- Set up data ingestion for Last Epoch wiki
- Build AI indexing batch job + synergy graph schema
- Run first indexing pass, QA synergy outputs manually
- Build frontend: skill picker, analysis panel, share URL, export
- Build community discoveries feed (share tracking)
- Set up ad placements

### Phase 2 — Soft Launch (Weeks 7-8)
- Invite 20-30 ARPG community members to test
- QA synergy accuracy against known good combos (use our Warbringer build as test case)
- Fix data gaps and indexing errors
- Set up patch monitoring pipeline

### Phase 3 — Public Launch (Week 9)
- Reddit posts in r/pathofexile2 and r/LastEpoch
- Post a "we built a synergy discovery tool" thread showing a novel combo discovered by the tool
- Reach out to 3-5 mid-tier ARPG content creators for coverage
- Monitor Community Discoveries feed for organic viral combos

### Phase 4 — Growth (Month 3+)
- Add patch impact tracker on first major patch after launch
- Evaluate 3rd game based on community requests
- Iterate on export formats based on where users are pasting (Mobalytics? Reddit? Discord?)

---

## 11. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Patch breaks synergy data | High | Automated patch monitoring + quick re-index pipeline |
| Undocumented mechanics missed by description parsing | Medium | Community flagging ("this interaction is wrong") |
| Low initial traffic | Medium | Content creator outreach + Reddit launch post showing novel discovery |
| PoE 2 tool ecosystem is already crowded | Medium | Differentiation is clear — no other tool does discovery reasoning, items, or conversions |
| Last Epoch skill tree structure is different to PoE 2 | Low | Handled in game-specific indexing prompt tuning |
| Item data harder to scrape than skill data | Medium | Manual curation pass for unique items at launch; automate later |
| Conversion mappings incomplete or incorrect | Medium | Community flagging; start with well-documented conversions only |
| Ad revenue too low to cover costs | Low | Hosting costs are minimal; ad revenue threshold is low |

---

## 12. Out of Scope (for now)
- DPS / damage calculations
- Passive tree path optimizer
- Full gear set recommendations (items as synergy inputs is in scope; gear optimization is not)
- Trade integration
- Mobile app (responsive web is sufficient at launch)
- User-submitted description corrections (flag only, no editing)
- Conversion chain visualization (post-launch roadmap item)

---

## 13. Open Questions
- Which domain to register?
- Who builds it — Amit solo, or looking for a co-founder/dev partner?
- Will Last Epoch wiki data be structured enough for automated scraping or will it need manual work?
- What's the hosting budget for month 1?
- How many unique items to index at launch — all of them, or a curated subset of the most popular?
- Should conversions at launch be limited to well-documented ones only, or attempt full coverage?

---

*PRD updated April 2026 — Synergy Wizard v1.1*
