# Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** React + Tailwind SPA deployed on Netlify that lets users theme-search or browse POE2 skills, build a tray of up to 8 entities, analyze synergies, flip damage-type conversions, extend combos, share URLs, export to Markdown/text/JSON, and donate via Ko-fi. GA4 tracks key events. Playwright covers four E2E flows.

**Architecture:** Vite + React + TypeScript SPA. Zustand holds global state (tray, analysis result, conversion state). URL query params encode tray state bidirectionally. All API calls go to the three Netlify Functions defined in Plan 2. Tailwind drives theming; gold/amber accent on near-black background per the spec.

**Tech Stack:** Vite, React 18, TypeScript, Tailwind CSS, Zustand, Playwright, `@netlify/plugin-nextjs` is NOT used — this is a pure Vite SPA. GA4 via `gtag.js`. Ko-fi via simple anchor.

---

### Task 1: Vite + React + Tailwind scaffold

**Files:**
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/index.css`
- Create: `postcss.config.js`
- Create: `tailwind.config.js`
- Modify: `package.json` (add frontend scripts/deps)
- Modify: `tsconfig.json` (include `src/`)

- [ ] **Step 1: Add frontend deps to `package.json`**

Merge into existing `package.json` dependencies (keep everything from Plan 2; add these):

```json
{
  "dependencies": {
    "@netlify/functions": "^3.0.0",
    "@netlify/neon": "^0.1.0",
    "drizzle-orm": "^0.36.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zod": "^3.23.8",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.48.0",
    "@types/node": "^20.12.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.20",
    "drizzle-kit": "^0.28.0",
    "netlify-cli": "^17.0.0",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.14",
    "typescript": "^5.6.0",
    "vite": "^5.4.10",
    "vitest": "^2.1.0"
  }
}
```

And add/ensure scripts include:

```json
{
  "scripts": {
    "dev": "netlify dev",
    "dev:vite": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "typecheck": "tsc --noEmit",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "netlify dev:exec drizzle-kit migrate"
  }
}
```

- [ ] **Step 2: Install**

Run: `npm install`
Expected: installs cleanly with no peer-dep errors.

- [ ] **Step 3: Write `vite.config.ts`**

Create `vite.config.ts`:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: { outDir: "dist", sourcemap: true },
});
```

- [ ] **Step 4: Write Tailwind config with the spec's palette**

Create `tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#0d0f12",
        accent: "#c8a96e",
        tagMechanic: "#2563eb", // blue-600
        tagDamage: "#ef4444",   // red-500
        tagClass: "#16a34a",    // green-600
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
        mono: ["ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        amberGlow: "0 0 0 1px rgba(200,169,110,0.4), 0 0 12px rgba(200,169,110,0.25)",
      },
      keyframes: {
        pulseRing: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(200,169,110,0.6)" },
          "50%": { boxShadow: "0 0 0 8px rgba(200,169,110,0)" },
        },
      },
      animation: { pulseRing: "pulseRing 1.6s ease-out infinite" },
    },
  },
  plugins: [],
};
```

Create `postcss.config.js`:

```javascript
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

- [ ] **Step 5: Write the base CSS**

Create `src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root { height: 100%; background: #0d0f12; color: #e8e6e1; }
body { font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
```

- [ ] **Step 6: Entry points**

Create `index.html`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Synergy Wizard - POE2</title>
    <meta name="description" content="Discover every POE2 skill synergy in two minutes. Theme-search, conversions, share URLs." />
    <!--
      GA4 snippet. Replace G-XXXXXXXXXX with your GA4 Measurement ID
      from Google Analytics > Admin > Data Streams.
    -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){ dataLayer.push(arguments); }
      gtag('js', new Date());
      gtag('config', 'G-XXXXXXXXXX');
      window.__gtag = gtag;
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

Create `src/App.tsx` (placeholder that gets replaced in Task 3):

```tsx
export default function App() {
  return <div className="p-8 text-accent">Synergy Wizard scaffold</div>;
}
```

- [ ] **Step 7: Extend `tsconfig.json` to include `src/`**

Edit `tsconfig.json` so the `include` array becomes:

```json
["netlify/**/*.ts", "db/**/*.ts", "tests/**/*.ts", "drizzle.config.ts", "src/**/*.ts", "src/**/*.tsx"]
```

And under `compilerOptions` add `"jsx": "react-jsx"`.

- [ ] **Step 8: Build to verify**

Run: `npm run build`
Expected: `dist/` directory created; `npm run typecheck` exits 0.

- [ ] **Step 9: Commit**

```bash
git add vite.config.ts index.html src/main.tsx src/App.tsx src/index.css postcss.config.js tailwind.config.js package.json package-lock.json tsconfig.json
git commit -m "feat(frontend): Vite + React + Tailwind scaffold"
```

---

### Task 2: Global state store (Zustand)

**Files:**
- Create: `src/state/store.ts`
- Create: `src/types.ts`
- Create: `src/state/store.test.ts`

- [ ] **Step 1: Define shared types**

Create `src/types.ts`:

```typescript
export type EntityType = "skill" | "support" | "passive";

export interface Entity {
  id: string;
  entity_type: EntityType;
  entity_slug: string;
  display_name: string;
  description?: string;
  class_tags: string[];
  mechanic_tags: string[];
  damage_tags: string[];
}

export interface SynergyEdge {
  from_entity_id: string;
  to_entity_id: string;
  interaction_type: "direct" | "extended" | "conditional";
  reason: string;
}

export interface ConversionOption {
  entity_id: string;
  display_name: string;
  current_tags: string[];
  can_convert_to: string[];
}

export interface AnalysisResult {
  direct_interactions: SynergyEdge[];
  extended_interactions: SynergyEdge[];
  loop_detected: boolean;
  damage_tags: string[];
  recommended_supports: string[];
  relevant_passives: string[];
  conversion_options: ConversionOption[];
  entities: Entity[];
}

export interface ConversionState {
  entityId: string;
  from: string;
  to: string;
}

export interface ExtendResult {
  skills: Entity[];
  supports: Entity[];
  passives: Entity[];
}
```

- [ ] **Step 2: Write the failing store test**

Create `src/state/store.test.ts`:

```typescript
import { describe, expect, it, beforeEach } from "vitest";
import { useStore } from "./store.ts";
import type { Entity } from "../types.ts";

function entity(id: string, slug: string): Entity {
  return {
    id,
    entity_type: "skill",
    entity_slug: slug,
    display_name: slug,
    class_tags: [],
    mechanic_tags: [],
    damage_tags: [],
  };
}

beforeEach(() => {
  useStore.getState().reset();
});

describe("useStore", () => {
  it("adds and removes entities", () => {
    useStore.getState().addEntity(entity("1", "a"));
    useStore.getState().addEntity(entity("2", "b"));
    expect(useStore.getState().selectedEntities.length).toBe(2);
    useStore.getState().removeEntity("1");
    expect(useStore.getState().selectedEntities.map((e) => e.id)).toEqual(["2"]);
  });

  it("does not add duplicates", () => {
    useStore.getState().addEntity(entity("1", "a"));
    useStore.getState().addEntity(entity("1", "a"));
    expect(useStore.getState().selectedEntities.length).toBe(1);
  });

  it("caps at 8 entities", () => {
    for (let i = 0; i < 10; i++) {
      useStore.getState().addEntity(entity(String(i), `s${i}`));
    }
    expect(useStore.getState().selectedEntities.length).toBe(8);
  });
});
```

- [ ] **Step 3: Run to confirm it fails**

Run: `npm test src/state/store.test.ts`
Expected: FAIL with `Cannot find module './store.ts'`.

- [ ] **Step 4: Implement the store**

Create `src/state/store.ts`:

```typescript
import { create } from "zustand";
import type { AnalysisResult, ConversionState, Entity, ExtendResult } from "../types.ts";

export const MAX_TRAY = 8;

interface StoreState {
  selectedEntities: Entity[];
  analysisResult: AnalysisResult | null;
  baselineAnalysis: AnalysisResult | null;
  conversion: ConversionState | null;
  extendResult: ExtendResult | null;
  isAnalyzing: boolean;

  addEntity: (e: Entity) => void;
  removeEntity: (id: string) => void;
  clear: () => void;
  reset: () => void;

  setAnalysis: (r: AnalysisResult | null) => void;
  setBaseline: (r: AnalysisResult | null) => void;
  setConversion: (c: ConversionState | null) => void;
  setExtendResult: (r: ExtendResult | null) => void;
  setAnalyzing: (b: boolean) => void;
}

export const useStore = create<StoreState>((set, get) => ({
  selectedEntities: [],
  analysisResult: null,
  baselineAnalysis: null,
  conversion: null,
  extendResult: null,
  isAnalyzing: false,

  addEntity: (e) => {
    const existing = get().selectedEntities;
    if (existing.some((x) => x.id === e.id)) return;
    if (existing.length >= MAX_TRAY) return;
    set({ selectedEntities: [...existing, e] });
  },
  removeEntity: (id) =>
    set({ selectedEntities: get().selectedEntities.filter((e) => e.id !== id) }),
  clear: () => set({ selectedEntities: [], analysisResult: null, baselineAnalysis: null, conversion: null, extendResult: null }),
  reset: () =>
    set({
      selectedEntities: [],
      analysisResult: null,
      baselineAnalysis: null,
      conversion: null,
      extendResult: null,
      isAnalyzing: false,
    }),

  setAnalysis: (r) => set({ analysisResult: r }),
  setBaseline: (r) => set({ baselineAnalysis: r }),
  setConversion: (c) => set({ conversion: c }),
  setExtendResult: (r) => set({ extendResult: r }),
  setAnalyzing: (b) => set({ isAnalyzing: b }),
}));
```

- [ ] **Step 5: Run the tests and verify they pass**

Run: `npm test src/state/store.test.ts`
Expected: `3 passed`.

- [ ] **Step 6: Commit**

```bash
git add src/state/store.ts src/state/store.test.ts src/types.ts
git commit -m "feat(frontend): Zustand store + shared types"
```

---

### Task 3: URL state encoding

**Files:**
- Create: `src/state/url.ts`
- Create: `src/state/url.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/state/url.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { decodeStateFromUrl, encodeStateToUrl } from "./url.ts";

describe("url state", () => {
  it("encodes slugs and conversion", () => {
    const url = encodeStateToUrl("https://example.test/poe2/", {
      slugs: ["volcanic-fissure", "stampede"],
      conversion: { slug: "volcanic-fissure", from: "fire", to: "lightning" },
    });
    expect(url).toContain("skills=volcanic-fissure,stampede");
    expect(url).toContain("convert=volcanic-fissure:fire%3Elightning");
  });

  it("decodes slugs and conversion", () => {
    const url = "https://example.test/poe2/?skills=volcanic-fissure,stampede&convert=volcanic-fissure:fire%3Elightning";
    const state = decodeStateFromUrl(url);
    expect(state.slugs).toEqual(["volcanic-fissure", "stampede"]);
    expect(state.conversion).toEqual({ slug: "volcanic-fissure", from: "fire", to: "lightning" });
  });

  it("handles empty state", () => {
    const state = decodeStateFromUrl("https://example.test/poe2/");
    expect(state.slugs).toEqual([]);
    expect(state.conversion).toBeNull();
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `npm test src/state/url.test.ts`
Expected: FAIL with `Cannot find module './url.ts'`.

- [ ] **Step 3: Implement the URL helpers**

Create `src/state/url.ts`:

```typescript
export interface UrlState {
  slugs: string[];
  conversion: { slug: string; from: string; to: string } | null;
}

export function encodeStateToUrl(baseUrl: string, state: UrlState): string {
  const url = new URL(baseUrl);
  if (state.slugs.length > 0) {
    url.searchParams.set("skills", state.slugs.join(","));
  } else {
    url.searchParams.delete("skills");
  }
  if (state.conversion) {
    url.searchParams.set(
      "convert",
      `${state.conversion.slug}:${state.conversion.from}>${state.conversion.to}`,
    );
  } else {
    url.searchParams.delete("convert");
  }
  return url.toString();
}

export function decodeStateFromUrl(href: string): UrlState {
  const url = new URL(href);
  const skillsParam = url.searchParams.get("skills");
  const convertParam = url.searchParams.get("convert");

  const slugs = skillsParam ? skillsParam.split(",").filter(Boolean) : [];
  let conversion: UrlState["conversion"] = null;
  if (convertParam) {
    const match = convertParam.match(/^([^:]+):([^>]+)>(.+)$/);
    if (match) {
      conversion = { slug: match[1], from: match[2], to: match[3] };
    }
  }
  return { slugs, conversion };
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npm test src/state/url.test.ts`
Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/state/url.ts src/state/url.test.ts
git commit -m "feat(frontend): URL encode/decode for share state"
```

---

### Task 4: API client + GA4 wrapper

**Files:**
- Create: `src/api/client.ts`
- Create: `src/api/analytics.ts`
- Create: `src/api/client.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/api/client.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";
import { api } from "./client.ts";

describe("api client", () => {
  it("search passes query params", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 }),
    );
    await api.search({ game: "poe2", q: "volcanic" });
    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("game=poe2");
    expect(url).toContain("q=volcanic");
    fetchSpy.mockRestore();
  });

  it("analyze posts JSON body", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ direct_interactions: [], extended_interactions: [], loop_detected: false, damage_tags: [], recommended_supports: [], relevant_passives: [], conversion_options: [], entities: [] }), { status: 200 }),
    );
    await api.analyze({ game: "poe2", entity_ids: ["00000000-0000-0000-0000-000000000001"] });
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(typeof init.body).toBe("string");
    fetchSpy.mockRestore();
  });

  it("extend posts mechanic_tags", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ skills: [], supports: [], passives: [] }), { status: 200 }),
    );
    await api.extend({ game: "poe2", mechanic_tags: ["slam"], exclude_ids: [] });
    const body = JSON.parse(String((fetchSpy.mock.calls[0][1] as RequestInit).body));
    expect(body.mechanic_tags).toEqual(["slam"]);
    fetchSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `npm test src/api/client.test.ts`
Expected: FAIL with `Cannot find module './client.ts'`.

- [ ] **Step 3: Implement the client + analytics helper**

Create `src/api/client.ts`:

```typescript
import type { AnalysisResult, Entity, ExtendResult } from "../types.ts";

async function request<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const api = {
  async search(params: { game: "poe2"; q?: string; class?: string; type?: string; tag?: string }): Promise<Entity[]> {
    const url = new URL("/api/search", window.location.origin);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    });
    return request<Entity[]>(url.toString());
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
};
```

Create `src/api/analytics.ts`:

```typescript
type GA4Event =
  | "analysis_run"
  | "share_url_copy"
  | "export_action"
  | "conversion_applied";

export function track(event: GA4Event, params: Record<string, unknown> = {}): void {
  const gtag = (window as any).__gtag ?? (window as any).gtag;
  if (typeof gtag === "function") gtag("event", event, params);
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npm test src/api/client.test.ts`
Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/api/client.ts src/api/analytics.ts src/api/client.test.ts
git commit -m "feat(frontend): API client + GA4 analytics helper"
```

---

### Task 5: Primitive components — TagChip, EntityCard, Header

**Files:**
- Create: `src/components/TagChip.tsx`
- Create: `src/components/EntityCard.tsx`
- Create: `src/components/Header.tsx`

- [ ] **Step 1: `TagChip`**

Create `src/components/TagChip.tsx`:

```tsx
import type { ReactNode } from "react";

export type TagKind = "mechanic" | "damage" | "class";

export interface TagChipProps {
  kind: TagKind;
  children: ReactNode;
}

const COLORS: Record<TagKind, string> = {
  mechanic: "bg-tagMechanic/90 text-white",
  damage: "bg-tagDamage/90 text-white",
  class: "bg-tagClass/90 text-white",
};

export function TagChip({ kind, children }: TagChipProps): JSX.Element {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-mono mr-1 mb-1 ${COLORS[kind]}`}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 2: `EntityCard`**

Create `src/components/EntityCard.tsx`:

```tsx
import type { Entity } from "../types.ts";
import { TagChip } from "./TagChip.tsx";

export interface EntityCardProps {
  entity: Entity;
  onAdd: (entity: Entity) => void;
  disabled?: boolean;
}

export function EntityCard({ entity, onAdd, disabled }: EntityCardProps): JSX.Element {
  return (
    <div className="border border-white/10 rounded p-2 flex items-start justify-between hover:border-accent/40 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="text-accent font-medium truncate">{entity.display_name}</div>
        <div className="text-xs text-white/60 mb-1 capitalize">{entity.entity_type}</div>
        <div className="flex flex-wrap">
          {entity.mechanic_tags.map((t) => (
            <TagChip key={`m-${t}`} kind="mechanic">{t}</TagChip>
          ))}
          {entity.damage_tags.map((t) => (
            <TagChip key={`d-${t}`} kind="damage">{t}</TagChip>
          ))}
          {entity.class_tags.map((t) => (
            <TagChip key={`c-${t}`} kind="class">{t}</TagChip>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onAdd(entity)}
        disabled={disabled}
        aria-label={`Add ${entity.display_name}`}
        className="ml-2 border border-accent/60 text-accent px-2 py-0.5 rounded hover:bg-accent hover:text-background disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}
```

- [ ] **Step 3: `Header`**

Create `src/components/Header.tsx`:

```tsx
export interface HeaderProps {
  game: "poe2";
}

// NOTE: Replace YOUR_KOFI_USERNAME below with the actual Ko-fi handle once registered.
const KOFI_URL = "https://ko-fi.com/YOUR_KOFI_USERNAME";

export function Header({ game }: HeaderProps): JSX.Element {
  return (
    <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-accent text-xl font-semibold">⚡ Synergy Wizard</span>
        <span className={`px-2 py-0.5 rounded text-xs border ${game === "poe2" ? "border-accent text-accent" : "border-white/20 text-white/50"}`}>
          PoE 2
        </span>
        <span className="px-2 py-0.5 rounded text-xs border border-white/10 text-white/40">
          Last Epoch — coming soon
        </span>
      </div>
      <a
        href={KOFI_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="px-3 py-1 rounded bg-accent text-background text-sm font-medium hover:opacity-90"
      >
        Support on Ko-fi ♥
      </a>
    </header>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: exit code 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/TagChip.tsx src/components/EntityCard.tsx src/components/Header.tsx
git commit -m "feat(frontend): primitive components (TagChip, EntityCard, Header)"
```

---

### Task 6: Left panel — SearchTab + BrowseTab

**Files:**
- Create: `src/components/LeftPanel.tsx`
- Create: `src/components/SearchTab.tsx`
- Create: `src/components/BrowseTab.tsx`
- Create: `src/hooks/useDebouncedValue.ts`

- [ ] **Step 1: Debounce hook**

Create `src/hooks/useDebouncedValue.ts`:

```typescript
import { useEffect, useState } from "react";

export function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const h = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(h);
  }, [value, delayMs]);
  return debounced;
}
```

- [ ] **Step 2: `SearchTab`**

Create `src/components/SearchTab.tsx`:

```tsx
import { useEffect, useState } from "react";
import { api } from "../api/client.ts";
import { useStore } from "../state/store.ts";
import type { Entity } from "../types.ts";
import { EntityCard } from "./EntityCard.tsx";
import { useDebouncedValue } from "../hooks/useDebouncedValue.ts";

export function SearchTab(): JSX.Element {
  const [q, setQ] = useState("");
  const debounced = useDebouncedValue(q, 250);
  const [results, setResults] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);
  const addEntity = useStore((s) => s.addEntity);

  useEffect(() => {
    if (!debounced) { setResults([]); return; }
    let cancelled = false;
    setLoading(true);
    api.search({ game: "poe2", q: debounced }).then((rows) => {
      if (!cancelled) setResults(rows);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [debounced]);

  return (
    <div className="flex flex-col gap-2">
      <input
        type="search"
        placeholder="Search skills, supports, passives..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-full bg-background border border-white/15 focus:border-accent/70 rounded px-2 py-1 outline-none"
        aria-label="Search"
      />
      {loading && <div className="text-xs text-white/40">Searching...</div>}
      <div className="flex flex-col gap-1">
        {results.map((r) => (
          <EntityCard key={r.id} entity={r} onAdd={addEntity} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `BrowseTab`**

Create `src/components/BrowseTab.tsx`:

```tsx
import { useEffect, useState } from "react";
import { api } from "../api/client.ts";
import { useStore } from "../state/store.ts";
import type { Entity } from "../types.ts";
import { EntityCard } from "./EntityCard.tsx";

const CLASSES = ["any", "warrior", "ranger", "sorceress", "witch", "monk", "mercenary"];
const TYPES = ["any", "skill", "support", "passive"];
const TAGS = ["any", "slam", "fire", "cold", "lightning", "aoe", "duration", "projectile", "movement", "minion"];

export function BrowseTab(): JSX.Element {
  const [klass, setKlass] = useState("any");
  const [type, setType] = useState("any");
  const [tag, setTag] = useState("any");
  const [results, setResults] = useState<Entity[]>([]);
  const addEntity = useStore((s) => s.addEntity);

  useEffect(() => {
    let cancelled = false;
    api.search({
      game: "poe2",
      class: klass === "any" ? undefined : klass,
      type: type === "any" ? undefined : (type as any),
      tag: tag === "any" ? undefined : tag,
    }).then((rows) => { if (!cancelled) setResults(rows); });
    return () => { cancelled = true; };
  }, [klass, type, tag]);

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2 text-xs">
        <label>Class
          <select data-testid="browse-class" value={klass} onChange={(e) => setKlass(e.target.value)} className="block w-full bg-background border border-white/15 rounded px-1 py-0.5">
            {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label>Type
          <select data-testid="browse-type" value={type} onChange={(e) => setType(e.target.value)} className="block w-full bg-background border border-white/15 rounded px-1 py-0.5">
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label>Tag
          <select data-testid="browse-tag" value={tag} onChange={(e) => setTag(e.target.value)} className="block w-full bg-background border border-white/15 rounded px-1 py-0.5">
            {TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      </div>
      <div data-testid="browse-grid" className="flex flex-col gap-1">
        {results.map((r) => (
          <EntityCard key={r.id} entity={r} onAdd={addEntity} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: `LeftPanel`**

Create `src/components/LeftPanel.tsx`:

```tsx
import { useState } from "react";
import { SearchTab } from "./SearchTab.tsx";
import { BrowseTab } from "./BrowseTab.tsx";

type Tab = "search" | "browse";

export function LeftPanel(): JSX.Element {
  const [tab, setTab] = useState<Tab>("search");
  return (
    <aside className="w-[320px] border-r border-white/10 p-3 flex flex-col gap-3 overflow-y-auto">
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => setTab("search")}
          data-testid="tab-search"
          className={`flex-1 px-3 py-1 rounded text-sm ${tab === "search" ? "bg-accent text-background" : "border border-white/15 text-white/70"}`}
        >Search</button>
        <button
          type="button"
          onClick={() => setTab("browse")}
          data-testid="tab-browse"
          className={`flex-1 px-3 py-1 rounded text-sm ${tab === "browse" ? "bg-accent text-background" : "border border-white/15 text-white/70"}`}
        >Browse</button>
      </div>
      {tab === "search" ? <SearchTab /> : <BrowseTab />}
    </aside>
  );
}
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: exit code 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/LeftPanel.tsx src/components/SearchTab.tsx src/components/BrowseTab.tsx src/hooks/useDebouncedValue.ts
git commit -m "feat(frontend): left panel with Search + Browse tabs"
```

---

### Task 7: Active tray + Analyze trigger

**Files:**
- Create: `src/components/ActiveTray.tsx`

- [ ] **Step 1: Implement ActiveTray**

Create `src/components/ActiveTray.tsx`:

```tsx
import { api } from "../api/client.ts";
import { track } from "../api/analytics.ts";
import { useStore } from "../state/store.ts";

export function ActiveTray(): JSX.Element {
  const selected = useStore((s) => s.selectedEntities);
  const removeEntity = useStore((s) => s.removeEntity);
  const setAnalysis = useStore((s) => s.setAnalysis);
  const setBaseline = useStore((s) => s.setBaseline);
  const setAnalyzing = useStore((s) => s.setAnalyzing);
  const isAnalyzing = useStore((s) => s.isAnalyzing);

  const canAnalyze = selected.length >= 2 && !isAnalyzing;

  async function runAnalyze() {
    setAnalyzing(true);
    try {
      const result = await api.analyze({
        game: "poe2",
        entity_ids: selected.map((e) => e.id),
      });
      setAnalysis(result);
      setBaseline(result);
      track("analysis_run", { entity_count: selected.length });
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="border-b border-white/10 p-3 flex items-center gap-2 flex-wrap">
      <span className="text-white/60 text-sm">Active ({selected.length}/8):</span>
      {selected.length === 0 && (
        <span className="text-white/40 text-sm italic">Add skills, supports, or passives from the left panel.</span>
      )}
      {selected.map((e) => (
        <span
          key={e.id}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-accent/40 shadow-amberGlow text-sm"
          data-testid="tray-entry"
        >
          {e.display_name}
          <button
            type="button"
            aria-label={`Remove ${e.display_name}`}
            onClick={() => removeEntity(e.id)}
            className="text-white/60 hover:text-white"
          >
            ×
          </button>
        </span>
      ))}
      <div className="flex-1" />
      <button
        type="button"
        onClick={runAnalyze}
        disabled={!canAnalyze}
        data-testid="analyze-button"
        className="px-3 py-1 rounded bg-accent text-background text-sm font-medium disabled:opacity-40"
      >
        {isAnalyzing ? "Analyzing..." : "Analyze →"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exit code 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/ActiveTray.tsx
git commit -m "feat(frontend): active tray with analyze trigger + amber glow"
```

---

### Task 8: Analysis panel + InteractionList

**Files:**
- Create: `src/components/AnalysisPanel.tsx`
- Create: `src/components/InteractionList.tsx`

- [ ] **Step 1: `InteractionList`**

Create `src/components/InteractionList.tsx`:

```tsx
import type { AnalysisResult, SynergyEdge } from "../types.ts";

export interface InteractionListProps {
  analysis: AnalysisResult;
  highlightNew: Set<string>;
}

function edgeKey(e: SynergyEdge): string {
  return `${e.from_entity_id}->${e.to_entity_id}`;
}

function nameFor(analysis: AnalysisResult, id: string | null | undefined): string {
  if (!id) return "?";
  return analysis.entities.find((e) => e.id === id)?.display_name ?? id;
}

export function InteractionList({ analysis, highlightNew }: InteractionListProps): JSX.Element {
  return (
    <div className="space-y-3">
      <section>
        <h3 className="text-accent font-semibold mb-1">
          ✅ Direct Interactions ({analysis.direct_interactions.length})
          {analysis.loop_detected && (
            <span className="ml-2 inline-block w-2 h-2 rounded-full bg-accent animate-pulseRing" aria-label="Loop detected" />
          )}
        </h3>
        <ul className="space-y-1" data-testid="direct-interactions">
          {analysis.direct_interactions.map((e) => (
            <li
              key={edgeKey(e)}
              className={`p-2 rounded border ${highlightNew.has(edgeKey(e)) ? "border-accent shadow-amberGlow" : "border-white/10"}`}
            >
              <span className="text-accent">{nameFor(analysis, e.from_entity_id)}</span>
              <span className="text-white/40"> ↔ </span>
              <span className="text-accent">{nameFor(analysis, e.to_entity_id)}</span>
              <div className="text-xs text-white/60">{e.reason}</div>
            </li>
          ))}
          {analysis.direct_interactions.length === 0 && (
            <li className="text-sm text-white/40 italic">No direct interactions found.</li>
          )}
        </ul>
      </section>
      <section>
        <h3 className="text-accent font-semibold mb-1">🔗 Extended Interactions ({analysis.extended_interactions.length})</h3>
        <ul className="space-y-1">
          {analysis.extended_interactions.map((e) => (
            <li key={edgeKey(e)} className="p-2 rounded border border-white/10">
              <span>{nameFor(analysis, e.from_entity_id)}</span>
              <span className="text-white/40"> → </span>
              <span>{nameFor(analysis, e.to_entity_id)}</span>
              <div className="text-xs text-white/60">{e.reason}</div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: `AnalysisPanel`**

Create `src/components/AnalysisPanel.tsx`:

```tsx
import { useMemo } from "react";
import { useStore } from "../state/store.ts";
import { InteractionList } from "./InteractionList.tsx";
import { ConversionPanel } from "./ConversionPanel.tsx";
import { ExtendPanel } from "./ExtendPanel.tsx";
import { ShareBar } from "./ShareBar.tsx";

export function AnalysisPanel(): JSX.Element | null {
  const analysis = useStore((s) => s.analysisResult);
  const baseline = useStore((s) => s.baselineAnalysis);

  const highlightNew = useMemo(() => {
    if (!analysis || !baseline || analysis === baseline) return new Set<string>();
    const baseKeys = new Set(baseline.direct_interactions.map((e) => `${e.from_entity_id}->${e.to_entity_id}`));
    return new Set(
      analysis.direct_interactions
        .map((e) => `${e.from_entity_id}->${e.to_entity_id}`)
        .filter((k) => !baseKeys.has(k)),
    );
  }, [analysis, baseline]);

  if (!analysis) {
    return (
      <section className="flex-1 p-4 text-white/40 italic">
        Select at least two entities and hit Analyze.
      </section>
    );
  }

  return (
    <section className="flex-1 p-4 overflow-y-auto space-y-4">
      <InteractionList analysis={analysis} highlightNew={highlightNew} />
      <ConversionPanel />
      <ExtendPanel />
      <ShareBar />
    </section>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/AnalysisPanel.tsx src/components/InteractionList.tsx
git commit -m "feat(frontend): analysis panel with direct+extended interaction list"
```

---

### Task 9: Conversion panel (re-analyze + diff highlight)

**Files:**
- Create: `src/components/ConversionPanel.tsx`

- [ ] **Step 1: Implement the conversion panel**

Create `src/components/ConversionPanel.tsx`:

```tsx
import { api } from "../api/client.ts";
import { track } from "../api/analytics.ts";
import { useStore } from "../state/store.ts";

export function ConversionPanel(): JSX.Element | null {
  const analysis = useStore((s) => s.analysisResult);
  const baseline = useStore((s) => s.baselineAnalysis);
  const setAnalysis = useStore((s) => s.setAnalysis);
  const setConversion = useStore((s) => s.setConversion);
  const conversion = useStore((s) => s.conversion);

  if (!analysis || analysis.conversion_options.length === 0) return null;

  async function applyConversion(entityId: string, from: string, to: string) {
    // Re-call /api/analyze with the same IDs - backend remains authoritative.
    // The "swap" is encoded in UI state; we then diff against baseline.
    const entityIds = analysis!.entities.map((e) => e.id);
    const next = await api.analyze({ game: "poe2", entity_ids: entityIds });
    // Locally overlay the damage swap onto the entity so the UI reflects it.
    next.entities = next.entities.map((e) =>
      e.id === entityId
        ? { ...e, damage_tags: e.damage_tags.map((t) => (t === from ? to : t)) }
        : e,
    );
    next.damage_tags = Array.from(new Set(next.damage_tags.map((t) => (t === from ? to : t))));
    setAnalysis(next);
    setConversion({ entityId, from, to });
    track("conversion_applied", { entity_id: entityId, from, to });
  }

  function resetConversion() {
    if (baseline) setAnalysis(baseline);
    setConversion(null);
  }

  return (
    <section className="border border-accent/50 rounded p-3 relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-accent/5"
      />
      <h3 className="text-accent font-semibold mb-2">🔄 Conversion Options</h3>
      <ul className="space-y-2 relative">
        {analysis.conversion_options.map((opt) => (
          <li key={opt.entity_id} className="flex items-center gap-2 flex-wrap">
            <span className="text-accent">{opt.display_name}</span>
            <span className="text-white/60">is:</span>
            {opt.current_tags.map((t) => (
              <span key={`cur-${t}`} className="px-2 py-0.5 rounded bg-tagDamage/80 text-xs">{t}</span>
            ))}
            <span className="text-white/60">→</span>
            {opt.can_convert_to.map((to) => {
              const from = opt.current_tags[0] ?? "fire";
              const active = conversion?.entityId === opt.entity_id && conversion.to === to;
              return (
                <button
                  key={`to-${to}`}
                  type="button"
                  onClick={() => applyConversion(opt.entity_id, from, to)}
                  className={`px-2 py-0.5 rounded text-xs border ${active ? "bg-accent text-background border-accent" : "border-accent/50 text-accent hover:bg-accent/10"}`}
                >
                  {to}
                </button>
              );
            })}
          </li>
        ))}
      </ul>
      {conversion && (
        <button
          type="button"
          onClick={resetConversion}
          className="mt-2 text-xs text-white/60 underline hover:text-white"
        >
          Reset conversion
        </button>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ConversionPanel.tsx
git commit -m "feat(frontend): conversion panel with amber glow diff highlight"
```

---

### Task 10: Extend panel

**Files:**
- Create: `src/components/ExtendPanel.tsx`

- [ ] **Step 1: Implement ExtendPanel**

Create `src/components/ExtendPanel.tsx`:

```tsx
import { useEffect } from "react";
import { api } from "../api/client.ts";
import { useStore } from "../state/store.ts";
import { EntityCard } from "./EntityCard.tsx";

export function ExtendPanel(): JSX.Element | null {
  const analysis = useStore((s) => s.analysisResult);
  const extendResult = useStore((s) => s.extendResult);
  const setExtendResult = useStore((s) => s.setExtendResult);
  const addEntity = useStore((s) => s.addEntity);
  const selected = useStore((s) => s.selectedEntities);

  useEffect(() => {
    if (!analysis) { setExtendResult(null); return; }
    const mech = Array.from(new Set(selected.flatMap((e) => e.mechanic_tags)));
    if (mech.length === 0) { setExtendResult({ skills: [], supports: [], passives: [] }); return; }
    let cancelled = false;
    api.extend({
      game: "poe2",
      mechanic_tags: mech,
      exclude_ids: selected.map((e) => e.id),
    }).then((r) => { if (!cancelled) setExtendResult(r); });
    return () => { cancelled = true; };
  }, [analysis, selected, setExtendResult]);

  if (!analysis || !extendResult) return null;

  return (
    <section>
      <h3 className="text-accent font-semibold mb-2">➕ Extend this combo</h3>
      {(["skills", "supports", "passives"] as const).map((group) => (
        <div key={group} className="mb-3">
          <div className="text-xs uppercase tracking-wide text-white/50 mb-1">{group}</div>
          {extendResult[group].length === 0 && (
            <div className="text-xs text-white/30 italic">No suggestions.</div>
          )}
          <div className="flex flex-col gap-1">
            {extendResult[group].slice(0, 6).map((e) => (
              <EntityCard key={e.id} entity={e} onAdd={addEntity} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ExtendPanel.tsx
git commit -m "feat(frontend): extend panel calls /api/extend and groups by type"
```

---

### Task 11: ShareBar + Export

**Files:**
- Create: `src/components/ShareBar.tsx`
- Create: `src/export/formats.ts`
- Create: `src/export/formats.test.ts`

- [ ] **Step 1: Write the export formatter tests**

Create `src/export/formats.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { toMarkdown, toPlainText, toJson } from "./formats.ts";
import type { AnalysisResult } from "../types.ts";

const fixture: AnalysisResult = {
  direct_interactions: [
    { from_entity_id: "a", to_entity_id: "b", interaction_type: "direct", reason: "x" },
  ],
  extended_interactions: [],
  loop_detected: false,
  damage_tags: ["fire"],
  recommended_supports: ["upheaval"],
  relevant_passives: ["aftershocks"],
  conversion_options: [],
  entities: [
    { id: "a", entity_type: "skill", entity_slug: "a", display_name: "A", class_tags: [], mechanic_tags: ["slam"], damage_tags: ["fire"] },
    { id: "b", entity_type: "skill", entity_slug: "b", display_name: "B", class_tags: [], mechanic_tags: ["slam"], damage_tags: ["fire"] },
  ],
};

describe("exports", () => {
  it("markdown contains headings", () => {
    const md = toMarkdown(fixture);
    expect(md).toMatch(/^# Synergy Wizard/m);
    expect(md).toContain("## Direct Interactions");
  });
  it("plain text is non-empty", () => {
    expect(toPlainText(fixture).length).toBeGreaterThan(10);
  });
  it("json roundtrips", () => {
    const parsed = JSON.parse(toJson(fixture));
    expect(parsed.direct_interactions.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test src/export/formats.test.ts`
Expected: FAIL with `Cannot find module './formats.ts'`.

- [ ] **Step 3: Implement formatters**

Create `src/export/formats.ts`:

```typescript
import type { AnalysisResult } from "../types.ts";

function nameFor(a: AnalysisResult, id: string | null | undefined): string {
  if (!id) return "?";
  return a.entities.find((e) => e.id === id)?.display_name ?? id;
}

export function toMarkdown(a: AnalysisResult): string {
  const lines: string[] = [];
  lines.push("# Synergy Wizard — POE2 Build");
  lines.push("");
  lines.push(`**Entities:** ${a.entities.map((e) => e.display_name).join(", ")}`);
  lines.push(`**Damage tags:** ${a.damage_tags.join(", ") || "—"}`);
  lines.push("");
  lines.push("## Direct Interactions");
  a.direct_interactions.forEach((e) => {
    lines.push(`- **${nameFor(a, e.from_entity_id)} ↔ ${nameFor(a, e.to_entity_id)}** — ${e.reason}`);
  });
  lines.push("");
  lines.push("## Extended Interactions");
  a.extended_interactions.forEach((e) => {
    lines.push(`- ${nameFor(a, e.from_entity_id)} → ${nameFor(a, e.to_entity_id)} — ${e.reason}`);
  });
  lines.push("");
  if (a.recommended_supports.length) {
    lines.push("## Recommended Supports");
    a.recommended_supports.forEach((s) => lines.push(`- ${s}`));
    lines.push("");
  }
  if (a.relevant_passives.length) {
    lines.push("## Relevant Passives");
    a.relevant_passives.forEach((p) => lines.push(`- ${p}`));
    lines.push("");
  }
  lines.push("---");
  lines.push("Built with Synergy Wizard — https://synergywizard.netlify.app");
  return lines.join("\n");
}

export function toPlainText(a: AnalysisResult): string {
  const parts: string[] = [];
  parts.push(`Synergy Wizard: ${a.entities.map((e) => e.display_name).join(" + ")}`);
  parts.push(`Direct: ${a.direct_interactions.map((e) => `${nameFor(a, e.from_entity_id)}<->${nameFor(a, e.to_entity_id)}`).join("; ") || "none"}`);
  parts.push(`Damage: ${a.damage_tags.join("/") || "n/a"}`);
  if (a.recommended_supports.length) parts.push(`Supports: ${a.recommended_supports.join(", ")}`);
  if (a.relevant_passives.length) parts.push(`Passives: ${a.relevant_passives.join(", ")}`);
  return parts.join("\n");
}

export function toJson(a: AnalysisResult): string {
  return JSON.stringify(a, null, 2);
}
```

- [ ] **Step 4: Run tests**

Run: `npm test src/export/formats.test.ts`
Expected: `3 passed`.

- [ ] **Step 5: Implement `ShareBar`**

Create `src/components/ShareBar.tsx`:

```tsx
import { useState } from "react";
import { track } from "../api/analytics.ts";
import { useStore } from "../state/store.ts";
import { encodeStateToUrl } from "../state/url.ts";
import { toJson, toMarkdown, toPlainText } from "../export/formats.ts";

// NOTE: Replace YOUR_KOFI_USERNAME with the real Ko-fi handle.
const KOFI_URL = "https://ko-fi.com/YOUR_KOFI_USERNAME";

function triggerDownload(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ShareBar(): JSX.Element {
  const selected = useStore((s) => s.selectedEntities);
  const analysis = useStore((s) => s.analysisResult);
  const conversion = useStore((s) => s.conversion);
  const [copied, setCopied] = useState(false);

  async function copyShareUrl() {
    const slugs = selected.map((e) => e.entity_slug);
    const conv = conversion
      ? {
          slug: selected.find((e) => e.id === conversion.entityId)?.entity_slug ?? "",
          from: conversion.from,
          to: conversion.to,
        }
      : null;
    const url = encodeStateToUrl(window.location.href, {
      slugs,
      conversion: conv && conv.slug ? conv : null,
    });
    window.history.replaceState(null, "", url);
    await navigator.clipboard.writeText(url);
    track("share_url_copy", { entity_count: selected.length });
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function exportAs(format: "markdown" | "text" | "json") {
    if (!analysis) return;
    if (format === "markdown") {
      triggerDownload(toMarkdown(analysis), "synergy-wizard-build.md", "text/markdown");
    } else if (format === "text") {
      triggerDownload(toPlainText(analysis), "synergy-wizard-build.txt", "text/plain");
    } else {
      triggerDownload(toJson(analysis), "synergy-wizard-build.json", "application/json");
    }
    track("export_action", { format });
  }

  return (
    <section className="flex items-center gap-2 pt-3 border-t border-white/10">
      <button
        type="button"
        data-testid="share-url"
        onClick={copyShareUrl}
        className="px-3 py-1 rounded border border-accent/50 text-accent hover:bg-accent/10 text-sm"
      >
        🔗 {copied ? "Copied!" : "Share URL"}
      </button>
      <div className="relative">
        <details data-testid="export-dropdown">
          <summary className="list-none px-3 py-1 rounded border border-white/20 text-sm cursor-pointer">
            📋 Export ▾
          </summary>
          <div className="absolute mt-1 bg-background border border-white/20 rounded z-10">
            <button type="button" data-testid="export-md"   onClick={() => exportAs("markdown")} className="block w-full text-left px-3 py-1 text-sm hover:bg-white/5">Markdown</button>
            <button type="button" data-testid="export-txt"  onClick={() => exportAs("text")}     className="block w-full text-left px-3 py-1 text-sm hover:bg-white/5">Plain text</button>
            <button type="button" data-testid="export-json" onClick={() => exportAs("json")}     className="block w-full text-left px-3 py-1 text-sm hover:bg-white/5">JSON</button>
          </div>
        </details>
      </div>
      <a
        href={KOFI_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="ml-auto px-3 py-1 rounded border border-accent/50 text-accent text-sm hover:bg-accent/10"
      >
        ♥ Support
      </a>
    </section>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/export/formats.ts src/export/formats.test.ts src/components/ShareBar.tsx
git commit -m "feat(frontend): share URL copy + markdown/text/json export"
```

---

### Task 12: Assemble App + URL restore on load

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace the placeholder App**

Edit `src/App.tsx` — replace the entire contents with:

```tsx
import { useEffect, useRef } from "react";
import { Header } from "./components/Header.tsx";
import { LeftPanel } from "./components/LeftPanel.tsx";
import { ActiveTray } from "./components/ActiveTray.tsx";
import { AnalysisPanel } from "./components/AnalysisPanel.tsx";
import { api } from "./api/client.ts";
import { useStore } from "./state/store.ts";
import { decodeStateFromUrl } from "./state/url.ts";

export default function App(): JSX.Element {
  const addEntity = useStore((s) => s.addEntity);
  const setAnalysis = useStore((s) => s.setAnalysis);
  const setBaseline = useStore((s) => s.setBaseline);
  const setConversion = useStore((s) => s.setConversion);
  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const state = decodeStateFromUrl(window.location.href);
    if (state.slugs.length === 0) return;

    (async () => {
      const entities = await Promise.all(
        state.slugs.map((slug) => api.search({ game: "poe2", q: slug })),
      );
      const flat = entities.flat();
      const bySlug = new Map(flat.map((e) => [e.entity_slug, e]));
      const toAdd = state.slugs
        .map((slug) => bySlug.get(slug.replace(/-/g, "_")) ?? bySlug.get(slug))
        .filter((e): e is NonNullable<typeof e> => !!e);
      toAdd.forEach((e) => addEntity(e));

      if (toAdd.length >= 2) {
        const result = await api.analyze({ game: "poe2", entity_ids: toAdd.map((e) => e.id) });
        setAnalysis(result);
        setBaseline(result);

        if (state.conversion) {
          const entity = toAdd.find((e) => e.entity_slug === state.conversion!.slug.replace(/-/g, "_") || e.entity_slug === state.conversion!.slug);
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
      <ActiveTray />
      <div className="flex-1 flex overflow-hidden">
        <LeftPanel />
        <AnalysisPanel />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(frontend): assemble app shell + URL state hydration"
```

---

### Task 13: Playwright setup

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/fixtures/seed-ids.json` (produced at test-time)
- Create: `tests/e2e/_seed.ts`

- [ ] **Step 1: Playwright config**

Create `playwright.config.ts`:

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  webServer: {
    command: "npx netlify dev --port 8888",
    url: "http://localhost:8888",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: {
    baseURL: "http://localhost:8888",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
```

- [ ] **Step 2: Seed helper (reuses Plan 2's Postgres fixture)**

Create `tests/e2e/_seed.ts`:

```typescript
import { resetAndSeed } from "../_helpers/seed.ts";

export async function seedOnce(): Promise<{ vfId: string; stId: string }> {
  return resetAndSeed();
}
```

- [ ] **Step 3: Install Playwright browsers**

Run: `npx playwright install chromium`
Expected: `chromium has been installed`.

- [ ] **Step 4: Commit**

```bash
git add playwright.config.ts tests/e2e/_seed.ts
git commit -m "test(frontend): Playwright config + seed helper"
```

---

### Task 14: E2E — search-to-analyze

**Files:**
- Create: `tests/e2e/search-to-analyze.spec.ts`

- [ ] **Step 1: Write the E2E spec**

Create `tests/e2e/search-to-analyze.spec.ts`:

```typescript
import { expect, test } from "@playwright/test";
import { seedOnce } from "./_seed.ts";

test("search volcanic -> add + Stampede -> analyze shows Direct Interactions", async ({ page }) => {
  await seedOnce();
  await page.goto("/");

  await page.getByTestId("tab-search").click();
  await page.getByPlaceholder(/search/i).fill("volcanic");
  await expect(page.getByText("Volcanic Fissure")).toBeVisible();
  await page.getByRole("button", { name: /Add Volcanic Fissure/i }).click();

  await page.getByPlaceholder(/search/i).fill("stampede");
  await expect(page.getByText("Stampede")).toBeVisible();
  await page.getByRole("button", { name: /Add Stampede/i }).click();

  await expect(page.getByTestId("tray-entry")).toHaveCount(2);
  await page.getByTestId("analyze-button").click();

  await expect(page.getByText(/Direct Interactions/)).toBeVisible();
  await expect(page.getByTestId("direct-interactions").locator("li")).not.toHaveCount(0);
});
```

- [ ] **Step 2: Run**

Run: `npx playwright test tests/e2e/search-to-analyze.spec.ts`
Expected: `1 passed`.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/search-to-analyze.spec.ts
git commit -m "test(e2e): search-to-analyze end-to-end flow"
```

---

### Task 15: E2E — skill browser

**Files:**
- Create: `tests/e2e/skill-browser.spec.ts`

- [ ] **Step 1: Write the spec**

Create `tests/e2e/skill-browser.spec.ts`:

```typescript
import { expect, test } from "@playwright/test";
import { seedOnce } from "./_seed.ts";

test("browse -> class warrior -> grid populated -> add first -> tray count 1", async ({ page }) => {
  await seedOnce();
  await page.goto("/");

  await page.getByTestId("tab-browse").click();
  await page.getByTestId("browse-class").selectOption("warrior");

  const grid = page.getByTestId("browse-grid");
  await expect(grid.locator("> *").first()).toBeVisible();

  await grid.getByRole("button", { name: /^Add / }).first().click();
  await expect(page.getByTestId("tray-entry")).toHaveCount(1);
});
```

- [ ] **Step 2: Run**

Run: `npx playwright test tests/e2e/skill-browser.spec.ts`
Expected: `1 passed`.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/skill-browser.spec.ts
git commit -m "test(e2e): skill browser filter + add-to-tray"
```

---

### Task 16: E2E — share URL round-trip

**Files:**
- Create: `tests/e2e/share-url.spec.ts`

- [ ] **Step 1: Write the spec**

Create `tests/e2e/share-url.spec.ts`:

```typescript
import { expect, test } from "@playwright/test";
import { seedOnce } from "./_seed.ts";

test("share URL round-trip restores the same two skills in tray", async ({ page, context }) => {
  await seedOnce();

  await page.goto("/");
  await page.getByTestId("tab-search").click();
  await page.getByPlaceholder(/search/i).fill("volcanic");
  await page.getByRole("button", { name: /Add Volcanic Fissure/i }).click();
  await page.getByPlaceholder(/search/i).fill("stampede");
  await page.getByRole("button", { name: /Add Stampede/i }).click();
  await page.getByTestId("analyze-button").click();
  await expect(page.getByText(/Direct Interactions/)).toBeVisible();

  // Grant clipboard permissions for the copy step.
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByTestId("share-url").click();

  const url = await page.evaluate(() => navigator.clipboard.readText());
  expect(url).toContain("skills=volcanic_fissure,stampede");

  const page2 = await context.newPage();
  await page2.goto(url);
  await expect(page2.getByTestId("tray-entry")).toHaveCount(2);
});
```

- [ ] **Step 2: Run**

Run: `npx playwright test tests/e2e/share-url.spec.ts`
Expected: `1 passed`.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/share-url.spec.ts
git commit -m "test(e2e): share URL round-trip restores tray"
```

---

### Task 17: E2E — export

**Files:**
- Create: `tests/e2e/export.spec.ts`

- [ ] **Step 1: Write the spec**

Create `tests/e2e/export.spec.ts`:

```typescript
import { expect, test } from "@playwright/test";
import { seedOnce } from "./_seed.ts";

test("export markdown triggers download with .md extension", async ({ page }) => {
  await seedOnce();

  await page.goto("/");
  await page.getByTestId("tab-search").click();
  await page.getByPlaceholder(/search/i).fill("volcanic");
  await page.getByRole("button", { name: /Add Volcanic Fissure/i }).click();
  await page.getByPlaceholder(/search/i).fill("stampede");
  await page.getByRole("button", { name: /Add Stampede/i }).click();
  await page.getByTestId("analyze-button").click();
  await expect(page.getByText(/Direct Interactions/)).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    // open dropdown then click markdown
    page.getByTestId("export-dropdown").locator("summary").click(),
    page.getByTestId("export-md").click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.md$/);
});
```

- [ ] **Step 2: Run**

Run: `npx playwright test tests/e2e/export.spec.ts`
Expected: `1 passed`.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/export.spec.ts
git commit -m "test(e2e): export markdown triggers download"
```

---

### Task 18: Final green-bar verification

**Files:** (no new files)

- [ ] **Step 1: Run the full unit + function suite**

Run: `npm test`
Expected: all unit + function + store + url + client + export tests pass (roughly 20+ green).

- [ ] **Step 2: Run the full E2E suite**

Run: `npx playwright test`
Expected: `4 passed` across the four specs.

- [ ] **Step 3: Build once more**

Run: `npm run build && npm run typecheck`
Expected: exit 0 for both.

- [ ] **Step 4: Commit any incidental fixes**

```bash
git commit --allow-empty -m "chore(frontend): verified full unit+E2E green-bar"
```
