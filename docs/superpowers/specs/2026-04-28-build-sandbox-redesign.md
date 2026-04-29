# Build Sandbox Redesign — Design Spec

**Date:** 2026-04-28
**Status:** Approved for implementation planning
**Authors:** Amit + Claude

---

## 1. Summary

Redesign the SynergyWizard UI from a browse-tab + flat pill tray into a three-panel build sandbox. The primary goal is making it feel like a **build design tool**, not just a search interface — users should be able to discover skills, drag them into a visual sandbox, and get AI-powered feedback, all in one coherent workspace.

---

## 2. Layout

Three fixed panels filling the viewport height below the header.

```
┌──────────────┬────────────────────┬──────────────┐
│ Filter       │ Browse / Ask AI    │ Build Sandbox│
│ Sidebar      │ (tabs)             │ + Analysis   │
│ (170px)      │ (flex-1)           │ (270px)      │
└──────────────┴────────────────────┴──────────────┘
```

The header retains the banner image and game selector. There is no longer a full-width ActiveTray row — the sandbox replaces it on the right panel.

---

## 3. Left Panel — Filter Sidebar (170px)

A persistent scrollable sidebar of tag chip groups. Clicking a chip toggles it on/off. Multiple active chips across groups are ANDed together (fire AND attack AND mace). Active chips are highlighted with their category colour; inactive chips are muted grey.

### Tag groups (in order)

| Group | Tags |
|---|---|
| **Damage Type** | fire, cold, lightning, physical, chaos |
| **Action** | attack, spell, channelled |
| **Style** | melee, slam, projectile, aoe, movement, duration, minion, warcry, aura, herald, mark |
| **Weapon** | mace, sword, axe, dagger, spear, staff, bow, crossbow, wand, unarmed, shield |
| **Type** | skill, support, passive |

### Colour coding for active chips
- fire → red tint (`#1a0000` bg, `#e74c3c` text)
- cold → blue tint (`#1a1a2e` bg, `#5dade2` text)
- lightning → yellow tint (`#1c1a00` bg, `#f0b90b` text)
- attack/weapon → amber tint (`#2a1f00` bg, `#e8b84b` text) — same as brand accent
- other → standard muted chip

**"Clear all filters"** link at the bottom of the sidebar resets all chip selections.

### Known extractor gaps

The following tags are confirmed real PoE2 gem tags (visible on poe2db.tw and the PoE2 wiki) but are not yet present in `poe2_seed.json` because `SKILL_TYPE_TO_MECHANIC` in `extract_game_data.py` has no mapping for them:

`strike`, `nova`, `totem`, `trap`, `curse`, `stance`, `blink`

`totem` and `trap` were in an earlier version of the Style group but removed because they return 0 results today. `strike` is particularly important (single-target melee attacks like Heavy Strike) and should be added to the Style group once the extractor is updated. These tags should be added to the extractor in a follow-up task.

### Data mapping
- Damage Type chips filter on `damage_tags` DB column
- Action + Style chips filter on `mechanic_tags` DB column
- Weapon chips filter on `weapon_tags` DB column
- Type chips filter on `entity_type` DB column
- Multiple active chips across different groups: AND across groups, OR within the same group. Example: selecting `fire` + `cold` (same group) shows skills with fire OR cold damage; also selecting `attack` (different group) further restricts to attack skills only.

---

## 4. Center Panel — Browse / Ask AI Tabs

### 4.1 Browse tab (default)

**Search bar** — text input at the top filters by skill name (existing ILIKE search). Sits above the results list, below the tab bar.

**Active filter summary** — a single line showing count and active chip labels: `Showing 23 skills matching: fire, cold, attack, mace`. Updates reactively as chips toggle.

**Results list** — scrollable. Each row:
- Drag handle (`⠿`) on the left — drag to a sandbox slot to add
- Skill name (bold) + tag line below (damage tags coloured, mechanic tags grey)
- `+ Add` button on the right — click to add to next available sandbox slot
- If already in build: `✓ In build` badge (amber, muted) replaces the Add button — no duplicate adding

Results are capped at 50 and sorted: exact name matches first, then alphabetical.

### 4.2 Ask AI tab

Full chat interface replacing the results list. The filter sidebar goes visually inactive (opacity reduced) while this tab is open — chip selections are preserved but not applied.

**Chat messages** — user messages right-aligned, AI responses left-aligned. AI responses that include skill recommendations embed inline skill rows with `+ Add` buttons, identical in style to the Browse results rows.

**Input** — text input at the bottom with a send button. Placeholder: `Ask anything — "show me fire slams", "what pairs with Volcanic Fissure?"`.

**AI context** — the current sandbox contents are included in every AI request so the AI can give build-aware advice (e.g. "you already have Leap Slam, add a second fire skill").

---

## 5. Right Panel — Build Sandbox + Analysis (270px)

### 5.1 Sandbox

Header: `Build Sandbox` label + `N/8 slots` counter.

**Skill card grid** — 2 columns × 4 rows = 8 slots. Each filled slot:
- Drag handle (`⠿`) top-left corner
- `✕` remove button top-right corner
- Entity type label (e.g. `SKILL`, `SUPPORT`, `WARCRY`) coloured by category:
  - skill → red (`#e74c3c`)
  - support → blue (`#3498db`)
  - warcry/aura/herald → grey
- Display name (bold, white)
- Tag summary line (mechanic + damage, truncated if long)
- Border colour reflects entity type: amber for skills, blue for supports

Empty slots show a `+` centered, clickable (opens Browse tab focused on the search bar).

**Drag to add** — dragging a result row from the center panel and dropping onto an empty slot adds the skill there. Dragging onto a filled slot inserts before it and shifts remaining cards down (no silent overwrites).

**Drag to reorder** — dragging a sandbox card to another slot (empty or filled) reorders within the grid.

**Analyze button** — full-width amber button below the grid. Disabled until ≥ 2 skills are in the sandbox. Label: `Analyze Build →` / `Analyzing…` while loading.

### 5.2 Analysis panel

Appears below the Analyze button after analysis runs. Scrollable.

Sections:
- **Synergy callouts** — 1–3 highlighted interactions detected (e.g. "🔥 Ignite Slam combo — Infernal Cry doubles next Volcanic Fissure hit")
- **Suggested additions** — 1–2 recommended skills with inline `+ Add` buttons
- **Share** — truncated share URL with a copy button

---

## 6. Tag Categorisation — Data Changes

The existing `mechanic_tags` field conflates damage types with delivery mechanics. This needs a clean split at the data level:

### Current problem
`fire`, `cold`, `lightning`, `physical`, `chaos` appear in both `mechanic_tags` and `damage_tags`. The filter sidebar uses `damage_tags` for the Damage Type group, so no data migration is needed — but the frontend `TAGS` constant in `BrowseTab.tsx` currently includes damage words that should be removed from the mechanic chip list.

### Fix
Remove `fire`, `cold`, `lightning`, `physical`, `chaos` from the Style group chips in the sidebar (they are already covered by the Damage Type group). The DB queries do not need to change — `damage_tags` and `mechanic_tags` are already separate columns.

---

## 7. Interactions Summary

| Interaction | Behaviour |
|---|---|
| Click chip (inactive) | Activates chip, results update immediately |
| Click chip (active) | Deactivates chip, results update |
| Multiple chips in same group | OR within group |
| Chips across different groups | AND across groups |
| Clear all filters | Resets all chips, shows all skills |
| Type in search bar | Filters by name (ILIKE), works alongside chip filters |
| Click `+ Add` | Adds skill to next empty sandbox slot |
| Drag result row → empty slot | Adds skill to that slot |
| Drag result row → filled slot | Swaps with that slot |
| Drag sandbox card → slot | Reorders within sandbox |
| Click `✕` on sandbox card | Removes skill from sandbox |
| Click empty `+` slot | Focuses center panel search bar |
| Click `Analyze Build →` | Runs analysis (≥ 2 skills required) |
| Switch to Ask AI tab | Chat UI; sidebar dims; AI sees current build |
| Click `+ Add` in AI response | Same as Browse Add |

---

## 8. Out of Scope

- Mobile / responsive layout (desktop only for now)
- Drag-and-drop on touch devices
- Saving/loading named builds (share URL is the persistence mechanism)
- Support gem socketing UI (skills and supports are treated equally as sandbox slots)
- Passive tree visualisation

---

## 9. Component Map

New/changed components:

| Component | Status | Notes |
|---|---|---|
| `App.tsx` | Modify | Replace ActiveTray + LeftPanel layout with 3-panel grid |
| `FilterSidebar.tsx` | New | Tag chip groups, clear all, calls search API reactively |
| `BrowseTab.tsx` | Modify | Remove old dropdowns; add search bar + result rows with drag handles |
| `AskTab.tsx` | New | Chat UI; send build context with each message; inline Add buttons in AI responses |
| `CenterPanel.tsx` | New | Tab container for BrowseTab + AskTab |
| `SandboxPanel.tsx` | New | 2×4 card grid with drag-to-reorder, add, remove |
| `SandboxCard.tsx` | New | Individual skill card in sandbox |
| `AnalysisPanel.tsx` | Modify | Move into right panel below sandbox; remove from separate column |
| `ActiveTray.tsx` | Delete | Replaced by SandboxPanel |
| `LeftPanel.tsx` | Delete | Replaced by FilterSidebar + CenterPanel |
