# Build Sandbox Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the app into a three-panel build sandbox — filter sidebar (tag chips), center panel (Browse / Ask AI tabs), and right panel (drag-and-drop skill grid + analysis).

**Architecture:** Replace the existing ActiveTray + LeftPanel layout with a permanent three-column grid. Filter state lives in the Zustand store. Drag-and-drop uses the HTML5 DnD API (no library). The search API gains multi-value filter params so the sidebar can AND across groups and OR within a group.

**Tech Stack:** React 18, TypeScript, Zustand, Tailwind CSS, Neon (PostgreSQL via tagged template literals), Vitest (unit tests), HTML5 Drag and Drop API.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/types.ts` | Modify | Add `FilterState` type |
| `src/state/store.ts` | Modify | Add filter state, `moveEntity`, `insertEntityAt` |
| `src/state/store.test.ts` | Modify | Tests for new store actions |
| `netlify/functions/_lib/validators.ts` | Modify | Multi-value filter params (`damages`, `mechanics`, `weapons`, `types`) |
| `netlify/functions/search.ts` | Modify | SQL updated to use `&&` array overlap operator |
| `src/api/client.ts` | Modify | Updated `search()` signature for array params |
| `src/api/client.test.ts` | Modify | Updated URL construction tests |
| `src/components/FilterSidebar.tsx` | Create | Tag chip groups (Damage / Action / Style / Weapon / Type) |
| `src/components/SandboxCard.tsx` | Create | Individual skill card with drag handle + remove |
| `src/components/SandboxPanel.tsx` | Create | 2×4 slot grid, drag-to-reorder, Analyze button |
| `src/components/BrowseTab.tsx` | Modify | Search bar + result rows with drag handles; remove old dropdowns |
| `src/components/AskTab.tsx` | Create | Chat UI wrapping semantic search with build context |
| `src/components/CenterPanel.tsx` | Create | Tab container (Browse / Ask AI) |
| `src/components/AnalysisPanel.tsx` | Modify | Accept `className` prop; used inside right panel |
| `src/App.tsx` | Modify | Three-column layout; delete ActiveTray + LeftPanel |
| `src/components/ActiveTray.tsx` | Delete | Replaced by SandboxPanel |
| `src/components/LeftPanel.tsx` | Delete | Replaced by FilterSidebar + CenterPanel |
| `src/components/SearchTab.tsx` | Delete | Text search moves into BrowseTab |

---

## Task 1: Store — filter state + sandbox reorder

**Files:**
- Modify: `src/types.ts`
- Modify: `src/state/store.ts`
- Modify: `src/state/store.test.ts`

- [ ] **Step 1: Add `FilterState` to `src/types.ts`**

Add after the existing `ExtendResult` interface:

```typescript
export interface FilterState {
  damageTags: string[];   // OR within group, AND with other groups
  actionTags: string[];
  styleTags: string[];
  weaponTags: string[];
  types: string[];
}
```

- [ ] **Step 2: Write failing tests for new store actions**

Open `src/state/store.test.ts` and add at the end (before the final closing if any):

```typescript
describe("filter state", () => {
  beforeEach(() => useStore.getState().reset());

  it("toggleFilter adds a tag to the correct group", () => {
    useStore.getState().toggleFilter("damageTags", "fire");
    expect(useStore.getState().filters.damageTags).toEqual(["fire"]);
  });

  it("toggleFilter removes a tag already present", () => {
    useStore.getState().toggleFilter("damageTags", "fire");
    useStore.getState().toggleFilter("damageTags", "fire");
    expect(useStore.getState().filters.damageTags).toEqual([]);
  });

  it("clearFilters resets all groups", () => {
    useStore.getState().toggleFilter("damageTags", "fire");
    useStore.getState().toggleFilter("weaponTags", "mace");
    useStore.getState().clearFilters();
    const { filters } = useStore.getState();
    expect(filters.damageTags).toEqual([]);
    expect(filters.weaponTags).toEqual([]);
  });
});

describe("moveEntity", () => {
  const e1 = { id: "1", entity_slug: "a", display_name: "A", entity_type: "skill" as const, mechanic_tags: [], damage_tags: [], class_tags: [] };
  const e2 = { id: "2", entity_slug: "b", display_name: "B", entity_type: "skill" as const, mechanic_tags: [], damage_tags: [], class_tags: [] };
  const e3 = { id: "3", entity_slug: "c", display_name: "C", entity_type: "skill" as const, mechanic_tags: [], damage_tags: [], class_tags: [] };

  beforeEach(() => {
    useStore.getState().reset();
    useStore.getState().addEntity(e1);
    useStore.getState().addEntity(e2);
    useStore.getState().addEntity(e3);
  });

  it("moves entity from index 0 to index 2", () => {
    useStore.getState().moveEntity(0, 2);
    const ids = useStore.getState().selectedEntities.map((e) => e.id);
    expect(ids).toEqual(["2", "3", "1"]);
  });

  it("does nothing when fromIdx equals toIdx", () => {
    useStore.getState().moveEntity(1, 1);
    const ids = useStore.getState().selectedEntities.map((e) => e.id);
    expect(ids).toEqual(["1", "2", "3"]);
  });
});

describe("insertEntityAt", () => {
  const e1 = { id: "1", entity_slug: "a", display_name: "A", entity_type: "skill" as const, mechanic_tags: [], damage_tags: [], class_tags: [] };
  const e2 = { id: "2", entity_slug: "b", display_name: "B", entity_type: "skill" as const, mechanic_tags: [], damage_tags: [], class_tags: [] };
  const eNew = { id: "99", entity_slug: "new", display_name: "New", entity_type: "skill" as const, mechanic_tags: [], damage_tags: [], class_tags: [] };

  beforeEach(() => {
    useStore.getState().reset();
    useStore.getState().addEntity(e1);
    useStore.getState().addEntity(e2);
  });

  it("inserts at index 0, shifting others right", () => {
    useStore.getState().insertEntityAt(eNew, 0);
    const ids = useStore.getState().selectedEntities.map((e) => e.id);
    expect(ids).toEqual(["99", "1", "2"]);
  });

  it("inserts at end when index >= length", () => {
    useStore.getState().insertEntityAt(eNew, 5);
    const ids = useStore.getState().selectedEntities.map((e) => e.id);
    expect(ids).toEqual(["1", "2", "99"]);
  });

  it("does not insert duplicates", () => {
    useStore.getState().insertEntityAt(e1, 1);
    expect(useStore.getState().selectedEntities).toHaveLength(2);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```
npm test -- store.test
```

Expected: multiple FAIL — `toggleFilter is not a function`, etc.

- [ ] **Step 4: Update `src/state/store.ts`**

Replace the entire file:

```typescript
import { create } from "zustand";
import type { AnalysisResult, ConversionState, Entity, ExtendResult, FilterState } from "../types.ts";

export const MAX_TRAY = 8;

interface StoreState {
  selectedEntities: Entity[];
  analysisResult: AnalysisResult | null;
  baselineAnalysis: AnalysisResult | null;
  conversion: ConversionState | null;
  extendResult: ExtendResult | null;
  isAnalyzing: boolean;
  filters: FilterState;

  addEntity: (e: Entity) => void;
  removeEntity: (id: string) => void;
  moveEntity: (fromIdx: number, toIdx: number) => void;
  insertEntityAt: (e: Entity, atIdx: number) => void;
  clear: () => void;
  reset: () => void;

  setAnalysis: (r: AnalysisResult | null) => void;
  setBaseline: (r: AnalysisResult | null) => void;
  setConversion: (c: ConversionState | null) => void;
  setExtendResult: (r: ExtendResult | null) => void;
  setAnalyzing: (b: boolean) => void;

  toggleFilter: (group: keyof FilterState, tag: string) => void;
  clearFilters: () => void;
}

const emptyFilters = (): FilterState => ({
  damageTags: [],
  actionTags: [],
  styleTags: [],
  weaponTags: [],
  types: [],
});

export const useStore = create<StoreState>((set, get) => ({
  selectedEntities: [],
  analysisResult: null,
  baselineAnalysis: null,
  conversion: null,
  extendResult: null,
  isAnalyzing: false,
  filters: emptyFilters(),

  addEntity: (e) => {
    const existing = get().selectedEntities;
    if (existing.some((x) => x.id === e.id)) return;
    if (existing.length >= MAX_TRAY) return;
    set({ selectedEntities: [...existing, e] });
  },
  removeEntity: (id) =>
    set({ selectedEntities: get().selectedEntities.filter((e) => e.id !== id) }),
  moveEntity: (fromIdx, toIdx) => {
    const existing = get().selectedEntities;
    if (fromIdx === toIdx || fromIdx >= existing.length) return;
    const next = [...existing];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    set({ selectedEntities: next });
  },
  insertEntityAt: (e, atIdx) => {
    const existing = get().selectedEntities;
    if (existing.some((x) => x.id === e.id)) return;
    if (existing.length >= MAX_TRAY) return;
    const next = [...existing];
    const clampedIdx = Math.min(atIdx, next.length);
    next.splice(clampedIdx, 0, e);
    set({ selectedEntities: next });
  },
  clear: () => set({ selectedEntities: [], analysisResult: null, baselineAnalysis: null, conversion: null, extendResult: null }),
  reset: () =>
    set({
      selectedEntities: [],
      analysisResult: null,
      baselineAnalysis: null,
      conversion: null,
      extendResult: null,
      isAnalyzing: false,
      filters: emptyFilters(),
    }),

  setAnalysis: (r) => set({ analysisResult: r }),
  setBaseline: (r) => set({ baselineAnalysis: r }),
  setConversion: (c) => set({ conversion: c }),
  setExtendResult: (r) => set({ extendResult: r }),
  setAnalyzing: (b) => set({ isAnalyzing: b }),

  toggleFilter: (group, tag) => {
    const current = get().filters[group];
    const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
    set({ filters: { ...get().filters, [group]: next } });
  },
  clearFilters: () => set({ filters: emptyFilters() }),
}));
```

- [ ] **Step 5: Run tests to verify they pass**

```
npm test -- store.test
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/state/store.ts src/state/store.test.ts
git commit -m "feat(store): add filter state, moveEntity, insertEntityAt"
```

---

## Task 2: Backend — multi-value search params

**Files:**
- Modify: `netlify/functions/_lib/validators.ts`
- Modify: `netlify/functions/search.ts`
- Modify: `src/api/client.ts`
- Modify: `src/api/client.test.ts`

- [ ] **Step 1: Update `netlify/functions/_lib/validators.ts`**

Replace the `searchQuerySchema` definition only (leave other schemas untouched):

```typescript
export const searchQuerySchema = z.object({
  game: gameSchema,
  q: z.string().trim().min(1).max(100).optional(),
  // Legacy single-value params kept for URL hydration compat — new UI uses array params below.
  type: z.enum(["skill", "support", "passive"]).optional(),
  weapon: z.string().trim().min(1).max(40).optional(),
  tag: z.string().trim().min(1).max(40).optional(),
  // Multi-value params: comma-separated tag lists, e.g. "fire,cold"
  damages: z.string().trim().max(200).optional(),
  mechanics: z.string().trim().max(200).optional(),
  weapons: z.string().trim().max(200).optional(),
  types: z.string().trim().max(200).optional(),
});
```

- [ ] **Step 2: Write failing test for new search URL construction in `src/api/client.test.ts`**

Read the existing file first, then add at the end:

```typescript
it("encodes multi-value filter params as comma-separated strings", () => {
  const url = buildSearchUrl({
    game: "poe2",
    damages: ["fire", "cold"],
    mechanics: ["slam", "melee"],
    weapons: ["mace"],
    types: ["skill"],
  });
  expect(url).toContain("damages=fire%2Ccold");
  expect(url).toContain("mechanics=slam%2Cmelee");
  expect(url).toContain("weapons=mace");
  expect(url).toContain("types=skill");
});
```

Note: this test requires extracting a `buildSearchUrl` helper from `api.search()` — do that in the next step.

- [ ] **Step 3: Run test to verify it fails**

```
npm test -- client.test
```

Expected: FAIL — `buildSearchUrl is not a function`.

- [ ] **Step 4: Update `src/api/client.ts`**

Replace the entire file:

```typescript
import type { AnalysisResult, Entity, ExtendResult, SemanticSearchResult } from "../types.ts";

async function request<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export interface SearchParams {
  game: "poe2";
  q?: string;
  damages?: string[];
  mechanics?: string[];
  weapons?: string[];
  types?: string[];
}

export function buildSearchUrl(params: SearchParams): string {
  const url = new URL("/api/search", window.location.origin);
  url.searchParams.set("game", params.game);
  if (params.q) url.searchParams.set("q", params.q);
  if (params.damages?.length) url.searchParams.set("damages", params.damages.join(","));
  if (params.mechanics?.length) url.searchParams.set("mechanics", params.mechanics.join(","));
  if (params.weapons?.length) url.searchParams.set("weapons", params.weapons.join(","));
  if (params.types?.length) url.searchParams.set("types", params.types.join(","));
  return url.toString();
}

export const api = {
  async search(params: SearchParams): Promise<Entity[]> {
    return request<Entity[]>(buildSearchUrl(params));
  },
  async analyze(body: { game: "poe2"; entity_ids: string[] }): Promise<AnalysisResult> {
    return request<AnalysisResult>("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },
  async extend(body: { game: "poe2"; mechanic_tags: string[]; exclude_ids: string[] }): Promise<ExtendResult> {
    return request<ExtendResult>("/api/extend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },
  async semanticSearch(vector: number[]): Promise<SemanticSearchResult[]> {
    return request<SemanticSearchResult[]>("/api/semantic-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vector }),
    });
  },
};
```

- [ ] **Step 5: Run test to verify it passes**

```
npm test -- client.test
```

Expected: PASS.

- [ ] **Step 6: Update `netlify/functions/search.ts`**

Replace the entire file:

```typescript
import type { Config, Context } from "@netlify/functions";
import { neon } from "@netlify/neon";
import { badRequest, json } from "./_lib/response.ts";
import { searchQuerySchema } from "./_lib/validators.ts";

export const config: Config = {
  path: "/api/search",
  method: ["GET"],
};

const sqlClient = neon();

function parseArr(val: string | undefined): string[] | undefined {
  if (!val) return undefined;
  const arr = val.split(",").map((s) => s.trim()).filter(Boolean);
  return arr.length ? arr : undefined;
}

export default async function handler(req: Request, _ctx: Context): Promise<Response> {
  const url = new URL(req.url);
  const parseResult = searchQuerySchema.safeParse({
    game: url.searchParams.get("game") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    type: url.searchParams.get("type") ?? undefined,
    weapon: url.searchParams.get("weapon") ?? undefined,
    tag: url.searchParams.get("tag") ?? undefined,
    damages: url.searchParams.get("damages") ?? undefined,
    mechanics: url.searchParams.get("mechanics") ?? undefined,
    weapons: url.searchParams.get("weapons") ?? undefined,
    types: url.searchParams.get("types") ?? undefined,
  });

  if (!parseResult.success) {
    return badRequest(parseResult.error.message);
  }

  const { game, q, damages, mechanics, weapons, types } = parseResult.data;

  const damageArr = parseArr(damages);
  const mechanicArr = parseArr(mechanics);
  const weaponArr = parseArr(weapons);
  const typeArr = parseArr(types);

  let rows: Record<string, unknown>[];

  if (q) {
    rows = await sqlClient`
      SELECT id, entity_type, entity_slug, display_name, description,
             mechanic_tags, damage_tags, class_tags, weapon_tags
      FROM entities
      WHERE game = ${game}
        AND (${damageArr} IS NULL OR damage_tags  && ${damageArr})
        AND (${mechanicArr} IS NULL OR mechanic_tags && ${mechanicArr})
        AND (${weaponArr}  IS NULL OR weapon_tags  && ${weaponArr})
        AND (${typeArr}    IS NULL OR entity_type  = ANY(${typeArr}))
        AND (
          display_name ILIKE '%' || ${q} || '%'
          OR description  ILIKE '%' || ${q} || '%'
        )
      ORDER BY
        CASE
          WHEN lower(display_name) = lower(${q})            THEN 0
          WHEN lower(display_name) LIKE lower(${q}) || '%'  THEN 1
          ELSE 2
        END,
        display_name ASC
      LIMIT 50;
    `;
  } else {
    rows = await sqlClient`
      SELECT id, entity_type, entity_slug, display_name, description,
             mechanic_tags, damage_tags, class_tags, weapon_tags
      FROM entities
      WHERE game = ${game}
        AND (${damageArr} IS NULL OR damage_tags  && ${damageArr})
        AND (${mechanicArr} IS NULL OR mechanic_tags && ${mechanicArr})
        AND (${weaponArr}  IS NULL OR weapon_tags  && ${weaponArr})
        AND (${typeArr}    IS NULL OR entity_type  = ANY(${typeArr}))
      ORDER BY display_name ASC
      LIMIT 50;
    `;
  }

  return json(rows);
}
```

- [ ] **Step 7: Run typecheck**

```
npm run typecheck
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add netlify/functions/_lib/validators.ts netlify/functions/search.ts src/api/client.ts src/api/client.test.ts
git commit -m "feat(search): multi-value filter params with array overlap SQL"
```

---

## Task 3: FilterSidebar component

**Files:**
- Create: `src/components/FilterSidebar.tsx`

- [ ] **Step 1: Create `src/components/FilterSidebar.tsx`**

```tsx
import { useStore } from "../state/store.ts";
import type { FilterState } from "../types.ts";

const DAMAGE_TAGS = ["fire", "cold", "lightning", "physical", "chaos"] as const;
const ACTION_TAGS = ["attack", "spell", "channelled"] as const;
const STYLE_TAGS  = ["melee", "slam", "projectile", "aoe", "movement", "duration", "minion", "warcry", "aura", "herald", "mark"] as const;
const WEAPON_TAGS = ["mace", "sword", "axe", "dagger", "spear", "staff", "bow", "crossbow", "wand", "unarmed", "shield"] as const;
const TYPE_TAGS   = ["skill", "support", "passive"] as const;

function chipColor(group: keyof FilterState, tag: string): string {
  if (group === "damageTags") {
    if (tag === "fire")      return "bg-[#1a0000] border-[#c0392b55] text-[#e74c3c]";
    if (tag === "cold")      return "bg-[#1a1a2e] border-[#3498db55] text-[#5dade2]";
    if (tag === "lightning") return "bg-[#1c1a00] border-[#f1c40f55] text-[#f0b90b]";
  }
  return "bg-[#2a1f00] border-accent/40 text-accent";
}

interface GroupProps {
  label: string;
  group: keyof FilterState;
  tags: readonly string[];
  active: string[];
  toggle: (group: keyof FilterState, tag: string) => void;
}

function ChipGroup({ label, group, tags, active, toggle }: GroupProps) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-white/30 mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => {
          const isActive = active.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(group, tag)}
              className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${
                isActive
                  ? chipColor(group, tag)
                  : "border-white/10 text-white/40 hover:border-white/25 hover:text-white/60"
              }`}
            >
              {tag}{isActive ? " ×" : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function FilterSidebar(): React.ReactElement {
  const filters = useStore((s) => s.filters);
  const toggleFilter = useStore((s) => s.toggleFilter);
  const clearFilters = useStore((s) => s.clearFilters);

  const hasActive =
    filters.damageTags.length > 0 ||
    filters.actionTags.length > 0 ||
    filters.styleTags.length > 0 ||
    filters.weaponTags.length > 0 ||
    filters.types.length > 0;

  return (
    <aside className="w-[170px] min-w-[170px] border-r border-white/10 p-3 flex flex-col gap-4 overflow-y-auto">
      <ChipGroup label="Damage Type" group="damageTags" tags={DAMAGE_TAGS} active={filters.damageTags} toggle={toggleFilter} />
      <ChipGroup label="Action"      group="actionTags"  tags={ACTION_TAGS}  active={filters.actionTags}  toggle={toggleFilter} />
      <ChipGroup label="Style"       group="styleTags"   tags={STYLE_TAGS}   active={filters.styleTags}   toggle={toggleFilter} />
      <ChipGroup label="Weapon"      group="weaponTags"  tags={WEAPON_TAGS}  active={filters.weaponTags}  toggle={toggleFilter} />
      <ChipGroup label="Type"        group="types"       tags={TYPE_TAGS}    active={filters.types}       toggle={toggleFilter} />

      {hasActive && (
        <button
          type="button"
          onClick={clearFilters}
          className="mt-auto text-[11px] text-white/30 hover:text-white/60 text-left"
        >
          ✕ clear all filters
        </button>
      )}
    </aside>
  );
}
```

- [ ] **Step 2: Typecheck**

```
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/FilterSidebar.tsx
git commit -m "feat(ui): FilterSidebar with tag chip groups"
```

---

## Task 4: SandboxCard + SandboxPanel

**Files:**
- Create: `src/components/SandboxCard.tsx`
- Create: `src/components/SandboxPanel.tsx`

- [ ] **Step 1: Create `src/components/SandboxCard.tsx`**

```tsx
import type { Entity } from "../types.ts";

interface Props {
  entity: Entity;
  index: number;
  onRemove: (id: string) => void;
  onDragStart: (index: number) => void;
}

function typeBadgeStyle(type: string): string {
  if (type === "skill")   return "text-[#e74c3c]";
  if (type === "support") return "text-[#3498db]";
  return "text-white/50";
}

function cardBorderStyle(type: string): string {
  if (type === "skill")   return "border-accent/30";
  if (type === "support") return "border-[#3498db]/30";
  return "border-white/10";
}

function tagSummary(entity: Entity): string {
  const parts = [...entity.damage_tags, ...entity.mechanic_tags].slice(0, 4);
  return parts.join(" · ");
}

export function SandboxCard({ entity, index, onRemove, onDragStart }: Props): React.ReactElement {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/synergy-index", String(index));
        e.dataTransfer.effectAllowed = "move";
        onDragStart(index);
      }}
      className={`relative bg-background/60 border ${cardBorderStyle(entity.entity_type)} rounded p-2 cursor-grab active:cursor-grabbing select-none`}
    >
      <span
        className="absolute top-1 left-1.5 text-white/20 text-[10px] cursor-grab"
        aria-hidden="true"
      >⠿</span>
      <button
        type="button"
        aria-label={`Remove ${entity.display_name}`}
        onClick={() => onRemove(entity.id)}
        className="absolute top-1 right-1.5 text-white/25 hover:text-white/70 text-[11px] leading-none"
      >✕</button>
      <div className="mt-3">
        <div className={`text-[9px] uppercase tracking-wider font-semibold ${typeBadgeStyle(entity.entity_type)}`}>
          {entity.entity_type}
        </div>
        <div className="text-sm font-medium text-white leading-tight mt-0.5 truncate">
          {entity.display_name}
        </div>
        <div className="text-[10px] text-white/35 mt-0.5 truncate">
          {tagSummary(entity)}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/SandboxPanel.tsx`**

```tsx
import React, { useState } from "react";
import { api } from "../api/client.ts";
import { track } from "../api/analytics.ts";
import { useStore, MAX_TRAY } from "../state/store.ts";
import type { Entity } from "../types.ts";
import { SandboxCard } from "./SandboxCard.tsx";

export function SandboxPanel(): React.ReactElement {
  const selected      = useStore((s) => s.selectedEntities);
  const removeEntity  = useStore((s) => s.removeEntity);
  const moveEntity    = useStore((s) => s.moveEntity);
  const insertEntityAt = useStore((s) => s.insertEntityAt);
  const setAnalysis   = useStore((s) => s.setAnalysis);
  const setBaseline   = useStore((s) => s.setBaseline);
  const setAnalyzing  = useStore((s) => s.setAnalyzing);
  const isAnalyzing   = useStore((s) => s.isAnalyzing);

  const [dragFromIdx, setDragFromIdx] = useState<number | null>(null);
  const [dropTarget,  setDropTarget]  = useState<number | null>(null);

  const slots: (Entity | null)[] = Array.from({ length: MAX_TRAY }, (_, i) => selected[i] ?? null);
  const canAnalyze = selected.length >= 2 && !isAnalyzing;

  async function runAnalyze() {
    setAnalyzing(true);
    try {
      const result = await api.analyze({ game: "poe2", entity_ids: selected.map((e) => e.id) });
      setAnalysis(result);
      setBaseline(result);
      track("analysis_run", { entity_count: selected.length });
    } finally {
      setAnalyzing(false);
    }
  }

  function handleSlotDragOver(e: React.DragEvent, slotIdx: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = dragFromIdx !== null ? "move" : "copy";
    setDropTarget(slotIdx);
  }

  function handleSlotDrop(e: React.DragEvent, slotIdx: number) {
    e.preventDefault();
    setDropTarget(null);

    const idxData    = e.dataTransfer.getData("application/synergy-index");
    const entityData = e.dataTransfer.getData("application/synergy-entity");

    if (idxData !== "") {
      // Reorder within sandbox
      moveEntity(parseInt(idxData, 10), slotIdx);
    } else if (entityData) {
      // Drop from browse panel
      try {
        const entity: Entity = JSON.parse(entityData);
        insertEntityAt(entity, slotIdx);
      } catch { /* ignore malformed data */ }
    }
    setDragFromIdx(null);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-white/10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-accent text-sm font-semibold">Build Sandbox</span>
          <span className="text-white/30 text-xs">{selected.length}/{MAX_TRAY} slots</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {slots.map((entity, slotIdx) => (
            <div
              key={slotIdx}
              onDragOver={(e) => handleSlotDragOver(e, slotIdx)}
              onDragLeave={() => setDropTarget(null)}
              onDrop={(e) => handleSlotDrop(e, slotIdx)}
              className={`min-h-[68px] rounded transition-colors ${
                dropTarget === slotIdx ? "ring-1 ring-accent/60 bg-accent/5" : ""
              }`}
            >
              {entity ? (
                <SandboxCard
                  entity={entity}
                  index={slotIdx}
                  onRemove={removeEntity}
                  onDragStart={(i) => setDragFromIdx(i)}
                />
              ) : (
                <div
                  className="h-full min-h-[68px] border border-dashed border-white/10 rounded flex items-center justify-center text-white/20 text-lg hover:border-white/25 hover:text-white/35 cursor-pointer transition-colors"
                  onClick={() => document.getElementById("browse-search")?.focus()}
                >
                  +
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={runAnalyze}
          disabled={!canAnalyze}
          data-testid="analyze-button"
          className="mt-3 w-full px-3 py-1.5 rounded bg-accent text-background text-sm font-semibold disabled:opacity-40 hover:opacity-90"
        >
          {isAnalyzing ? "Analyzing…" : "Analyze Build →"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

```
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/SandboxCard.tsx src/components/SandboxPanel.tsx
git commit -m "feat(ui): SandboxCard and SandboxPanel with drag-and-drop"
```

---

## Task 5: BrowseTab redesign

**Files:**
- Modify: `src/components/BrowseTab.tsx`

- [ ] **Step 1: Replace `src/components/BrowseTab.tsx`**

```tsx
import React, { useEffect, useState } from "react";
import { api } from "../api/client.ts";
import { useStore } from "../state/store.ts";
import type { Entity } from "../types.ts";

function tagLine(entity: Entity): React.ReactElement {
  const damageParts = entity.damage_tags.map((t) => (
    <span key={`d-${t}`} className="text-[#e8735a]">{t}</span>
  ));
  const mechParts = entity.mechanic_tags.slice(0, 4).map((t) => (
    <span key={`m-${t}`}>{t}</span>
  ));
  const all = [...damageParts, ...mechParts];
  return (
    <div className="text-[10px] text-white/35 flex flex-wrap gap-x-1 mt-0.5">
      {all.map((el, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-white/20">·</span>}
          {el}
        </React.Fragment>
      ))}
    </div>
  );
}

export function BrowseTab(): React.ReactElement {
  const [q, setQ]           = useState("");
  const [results, setResults] = useState<Entity[]>([]);
  const filters   = useStore((s) => s.filters);
  const selected  = useStore((s) => s.selectedEntities);
  const addEntity = useStore((s) => s.insertEntityAt);

  const selectedIds = new Set(selected.map((e) => e.id));

  const mechanics = [...filters.actionTags, ...filters.styleTags];

  // Summary label for active filters
  const activeLabels = [
    ...filters.damageTags,
    ...filters.actionTags,
    ...filters.styleTags,
    ...filters.weaponTags,
    ...filters.types,
  ];

  useEffect(() => {
    let cancelled = false;
    api.search({
      game: "poe2",
      q: q.trim() || undefined,
      damages:   filters.damageTags.length  ? filters.damageTags  : undefined,
      mechanics: mechanics.length           ? mechanics            : undefined,
      weapons:   filters.weaponTags.length  ? filters.weaponTags  : undefined,
      types:     filters.types.length       ? filters.types        : undefined,
    }).then((rows) => {
      if (!cancelled) setResults(rows);
    }).catch(() => {
      if (!cancelled) setResults([]);
    });
    return () => { cancelled = true; };
  }, [q, filters]);

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="p-2 border-b border-white/10">
        <input
          id="browse-search"
          type="search"
          placeholder="Search by name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-accent/50"
          aria-label="Search skills"
          data-testid="browse-search"
        />
      </div>

      {/* Active filter summary */}
      {activeLabels.length > 0 && (
        <div className="px-3 py-1 text-[10px] text-white/35 border-b border-white/5">
          Showing <span className="text-accent/70">{results.length}</span> results matching:{" "}
          {activeLabels.join(", ")}
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto" data-testid="browse-grid">
        {results.map((entity) => {
          const inBuild = selectedIds.has(entity.id);
          return (
            <div
              key={entity.id}
              draggable={!inBuild}
              onDragStart={(e) => {
                e.dataTransfer.setData("application/synergy-entity", JSON.stringify(entity));
                e.dataTransfer.effectAllowed = "copy";
              }}
              className="flex items-center gap-2 px-3 py-2 border-b border-white/5 hover:bg-white/3 cursor-grab group"
            >
              <span className="text-white/20 text-sm group-hover:text-white/40 select-none" aria-hidden="true">⠿</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white/90 truncate">{entity.display_name}</div>
                {tagLine(entity)}
              </div>
              {inBuild ? (
                <span className="text-[11px] text-accent/40 whitespace-nowrap">✓ In build</span>
              ) : (
                <button
                  type="button"
                  onClick={() => addEntity(entity, selected.length)}
                  className="text-[11px] border border-white/15 text-white/50 px-2 py-0.5 rounded hover:border-accent/50 hover:text-accent whitespace-nowrap"
                  data-testid="browse-add"
                >
                  + Add
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/BrowseTab.tsx
git commit -m "feat(ui): BrowseTab redesign — search bar + draggable rows + chip filter integration"
```

---

## Task 6: AskTab

**Files:**
- Create: `src/components/AskTab.tsx`

- [ ] **Step 1: Create `src/components/AskTab.tsx`**

```tsx
import React, { useRef, useState } from "react";
import { api } from "../api/client.ts";
import { useEmbedder } from "../hooks/useEmbedder.ts";
import { useStore } from "../state/store.ts";
import type { Entity, SemanticSearchResult } from "../types.ts";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  results?: Entity[];
}

function resultToEntity(r: SemanticSearchResult): Entity {
  return {
    id: r.entity_slug,
    entity_slug: r.entity_slug,
    display_name: r.display_name,
    entity_type: r.entity_type,
    mechanic_tags: r.mechanic_tags,
    damage_tags: r.damage_tags,
    class_tags: r.class_tags,
  };
}

export function AskTab(): React.ReactElement {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError]       = useState("");
  const { status, embed }       = useEmbedder();
  const selected                = useStore((s) => s.selectedEntities);
  const insertEntityAt          = useStore((s) => s.insertEntityAt);
  const bottomRef               = useRef<HTMLDivElement>(null);

  const buildContext = selected.length
    ? `[Build: ${selected.map((e) => e.display_name).join(", ")}] `
    : "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = input.trim();
    if (!query || searching) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", text: query };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSearching(true);
    setError("");

    try {
      const vector = await embed(buildContext + query);
      const hits   = await api.semanticSearch(vector);
      const entities = hits.map(resultToEntity);
      const summary =
        entities.length
          ? `Found ${entities.length} skills related to your query${buildContext ? " (based on your current build)" : ""}.`
          : "No matching skills found. Try different terms.";
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: summary,
        results: entities.slice(0, 8),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setError("Search failed. Try again.");
    } finally {
      setSearching(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  const placeholderText =
    status === "loading" ? "Loading model (first time only)…" : 'Ask anything — "show me fire slams"…';

  return (
    <div className="flex flex-col h-full">
      {/* Build context strip */}
      {selected.length > 0 && (
        <div className="px-3 py-1.5 text-[10px] text-white/30 border-b border-white/5 truncate">
          Build context: {selected.map((e) => e.display_name).join(", ")}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3" data-testid="ask-messages">
        {messages.length === 0 && (
          <p className="text-white/25 text-sm italic text-center mt-8">
            Ask anything about PoE2 skills.
          </p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}>
            <div
              className={`max-w-[85%] text-sm px-3 py-2 rounded ${
                msg.role === "user"
                  ? "bg-accent/20 text-white/80"
                  : "bg-white/5 text-white/70"
              }`}
            >
              {msg.text}
            </div>
            {msg.results && msg.results.map((entity) => {
              const inBuild = selected.some((s) => s.id === entity.id);
              return (
                <div
                  key={entity.id}
                  className="w-full flex items-center gap-2 px-2 py-1.5 bg-white/3 rounded border border-white/5"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white/85 truncate">{entity.display_name}</div>
                    <div className="text-[10px] text-white/30">{entity.entity_type}</div>
                  </div>
                  {inBuild ? (
                    <span className="text-[11px] text-accent/40">✓ In build</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => insertEntityAt(entity, selected.length)}
                      className="text-[11px] border border-white/15 text-white/50 px-2 py-0.5 rounded hover:border-accent/50 hover:text-accent"
                    >
                      + Add
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && <p className="px-3 text-xs text-red-400">{error}</p>}

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-2 border-t border-white/10 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholderText}
          disabled={status === "error"}
          data-testid="ask-input"
          className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-accent/50"
        />
        <button
          type="submit"
          disabled={searching || !input.trim() || status === "error"}
          data-testid="ask-submit"
          className="px-3 py-1.5 rounded bg-accent text-background text-sm font-medium disabled:opacity-40"
        >
          {searching ? "…" : "→"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/AskTab.tsx
git commit -m "feat(ui): AskTab — chat UI wrapping semantic search with build context"
```

---

## Task 7: CenterPanel + App rewire

**Files:**
- Create: `src/components/CenterPanel.tsx`
- Modify: `src/components/AnalysisPanel.tsx`
- Modify: `src/App.tsx`
- Delete: `src/components/ActiveTray.tsx`, `src/components/LeftPanel.tsx`, `src/components/SearchTab.tsx`

- [ ] **Step 1: Create `src/components/CenterPanel.tsx`**

```tsx
import { useState } from "react";
import { useStore } from "../state/store.ts";
import { BrowseTab } from "./BrowseTab.tsx";
import { AskTab } from "./AskTab.tsx";

type CenterTab = "browse" | "ask";

export function CenterPanel(): React.ReactElement {
  const [tab, setTab] = useState<CenterTab>("browse");
  const filters = useStore((s) => s.filters);
  const isAsk = tab === "ask";

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden border-r border-white/10">
      {/* Tab bar */}
      <div className="flex border-b border-white/10 bg-background">
        <button
          type="button"
          data-testid="tab-browse"
          onClick={() => setTab("browse")}
          className={`px-4 py-2 text-sm transition-colors ${
            tab === "browse"
              ? "text-accent border-b-2 border-accent -mb-px"
              : "text-white/40 hover:text-white/70"
          }`}
        >
          Browse
        </button>
        <button
          type="button"
          data-testid="tab-ask"
          onClick={() => setTab("ask")}
          className={`px-4 py-2 text-sm transition-colors ${
            tab === "ask"
              ? "text-accent border-b-2 border-accent -mb-px"
              : "text-white/40 hover:text-white/70"
          }`}
        >
          ✦ Ask AI
        </button>
      </div>

      {/* Content — filter sidebar dims when Ask tab is active */}
      <div className={`flex-1 overflow-hidden ${isAsk ? "opacity-browse-inactive" : ""}`}>
        {tab === "browse" ? <BrowseTab /> : <AskTab />}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `src/components/AnalysisPanel.tsx`** to accept a `className` prop

Replace the section opening tag:

```tsx
// Old:
return (
  <section className="flex-1 p-4 overflow-y-auto space-y-4">

// New:
interface AnalysisPanelProps {
  className?: string;
}

export function AnalysisPanel({ className = "" }: AnalysisPanelProps): React.ReactElement | null {
```

And update both return paths to include `className`:

```tsx
// Empty state:
return (
  <section className={`flex-1 p-4 text-white/40 italic ${className}`}>
    Select at least two entities and hit Analyze.
  </section>
);

// With analysis:
return (
  <section className={`flex-1 p-4 overflow-y-auto space-y-4 ${className}`}>
```

- [ ] **Step 3: Rewrite `src/App.tsx`**

```tsx
import React, { useEffect, useRef } from "react";
import { Header } from "./components/Header.tsx";
import { FilterSidebar } from "./components/FilterSidebar.tsx";
import { CenterPanel } from "./components/CenterPanel.tsx";
import { SandboxPanel } from "./components/SandboxPanel.tsx";
import { AnalysisPanel } from "./components/AnalysisPanel.tsx";
import { api } from "./api/client.ts";
import { useStore } from "./state/store.ts";
import { decodeStateFromUrl } from "./state/url.ts";

export default function App(): React.ReactElement {
  const addEntity    = useStore((s) => s.addEntity);
  const setAnalysis  = useStore((s) => s.setAnalysis);
  const setBaseline  = useStore((s) => s.setBaseline);
  const setConversion = useStore((s) => s.setConversion);
  const hydrated     = useRef(false);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const state = decodeStateFromUrl(window.location.href);
    if (state.slugs.length === 0) return;

    (async () => {
      const entities = await Promise.all(
        state.slugs.map((slug) => api.search({ game: "poe2", q: slug })),
      );
      const flat   = entities.flat();
      const bySlug = new Map(flat.map((e) => [e.entity_slug, e]));
      const toAdd  = state.slugs
        .map((slug) => bySlug.get(slug.replace(/-/g, "_")) ?? bySlug.get(slug))
        .filter((e): e is NonNullable<typeof e> => !!e);
      toAdd.forEach((e) => addEntity(e));

      if (toAdd.length >= 2) {
        const result = await api.analyze({ game: "poe2", entity_ids: toAdd.map((e) => e.id) });
        setAnalysis(result);
        setBaseline(result);

        if (state.conversion) {
          const entity = toAdd.find(
            (e) =>
              e.entity_slug === state.conversion!.slug.replace(/-/g, "_") ||
              e.entity_slug === state.conversion!.slug,
          );
          if (entity) {
            setConversion({ entityId: entity.id, from: state.conversion.from, to: state.conversion.to });
          }
        }
      }
    })();
  }, [addEntity, setAnalysis, setBaseline, setConversion]);

  return (
    <div className="h-full flex flex-col">
      <Header game="poe2" />
      <div className="flex-1 flex overflow-hidden">
        <FilterSidebar />
        <CenterPanel />
        {/* Right panel: sandbox on top, analysis scrolls below */}
        <div className="w-[270px] min-w-[270px] flex flex-col overflow-hidden">
          <SandboxPanel />
          <AnalysisPanel className="border-t border-white/10" />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Delete old files**

```bash
git rm src/components/ActiveTray.tsx src/components/LeftPanel.tsx src/components/SearchTab.tsx
```

- [ ] **Step 5: Typecheck**

```
npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Run all tests**

```
npm test
```

Expected: all PASS. If any existing tests reference `ActiveTray`, `LeftPanel`, `SearchTab`, or the old `tray-entry` / `tab-search` test IDs, update them to match the new component structure.

- [ ] **Step 7: Commit**

```bash
git add src/components/CenterPanel.tsx src/components/AnalysisPanel.tsx src/App.tsx
git commit -m "feat(ui): three-panel layout — FilterSidebar + CenterPanel + SandboxPanel + AnalysisPanel"
```

---

## Task 8: Manual smoke test + cleanup

- [ ] **Step 1: Start dev server**

```
npm run dev
```

Open `http://localhost:8888` (or the port Netlify dev uses).

- [ ] **Step 2: Smoke test checklist**

Work through each interaction from the spec:
- [ ] Tag chip in Damage Type toggles on/off; results update
- [ ] Two chips in same group (fire + cold) → OR: shows fire OR cold skills
- [ ] Chip in Damage Type + chip in Weapon → AND: shows skills matching both
- [ ] "Clear all filters" resets all chips
- [ ] Search bar filters by name alongside active chips
- [ ] Result row drag → empty sandbox slot → skill appears in sandbox
- [ ] Result row drag → occupied slot → inserts before, shifts card right
- [ ] Sandbox card drag → reorders within grid
- [ ] ✕ button on sandbox card removes it
- [ ] Empty `+` slot click → focuses the search bar
- [ ] Analyze button disabled with < 2 skills; fires analysis with ≥ 2
- [ ] Ask AI tab → filter sidebar dims; chat input works; results include + Add buttons
- [ ] Ask AI + Add button adds to sandbox
- [ ] Share URL still encodes/decodes build slugs correctly

- [ ] **Step 3: Fix any issues found during smoke test**

Each fix gets its own commit.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: post-redesign cleanup and smoke test fixes"
```
