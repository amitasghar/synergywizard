# Backend API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provision the Netlify DB (Neon Postgres) schema via Drizzle migrations and ship three Netlify Functions (`/api/search`, `/api/analyze`, `/api/extend`) that serve the Synergy Wizard frontend.

**Architecture:** TypeScript monorepo rooted at the site. Drizzle ORM owns the schema; migrations run via `drizzle-kit`. Each function is a single TypeScript file using `@netlify/neon` for DB access and the modern Netlify Functions default-export + `Config` shape. All responses are JSON with a 1-hour CDN cache.

**Tech Stack:** Node.js 20, TypeScript 5, Netlify Functions, `@netlify/functions`, `@netlify/neon`, `drizzle-orm`, `drizzle-kit`, `vitest`, `zod`.

---

### Task 1: Netlify project bootstrap

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `netlify.toml`
- Create: `.env.example`
- Create: `.nvmrc`

- [ ] **Step 1: Write `package.json`**

Create `package.json`:

```json
{
  "name": "synergywizard",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "dev": "netlify dev",
    "build": "vite build",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "netlify dev:exec drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@netlify/functions": "^3.0.0",
    "@netlify/neon": "^0.1.0",
    "drizzle-orm": "^0.36.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^20.12.0",
    "drizzle-kit": "^0.28.0",
    "netlify-cli": "^17.0.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": false,
    "types": ["node"]
  },
  "include": ["netlify/**/*.ts", "db/**/*.ts", "tests/**/*.ts", "drizzle.config.ts"]
}
```

- [ ] **Step 3: Write `netlify.toml`**

Create `netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "dist"
  functions = "netlify/functions"

[functions]
  node_bundler = "esbuild"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200

[build.environment]
  NODE_VERSION = "20"

# NETLIFY_DATABASE_URL is provisioned automatically by `netlify db init`.
# ANTHROPIC_API_KEY is set via the pipeline workflow, not read by functions.
```

- [ ] **Step 4: Add env example + Node version file**

Create `.env.example`:

```
NETLIFY_DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
NETLIFY_DATABASE_URL_UNPOOLED=postgresql://user:pass@host/db?sslmode=require
```

Create `.nvmrc`:

```
20
```

- [ ] **Step 5: Install dependencies**

Run: `npm install`
Expected: `added NNN packages` with no errors.

- [ ] **Step 6: Initialize Netlify DB**

Run: `npx netlify db init --boilerplate=none`
Expected: `NETLIFY_DATABASE_URL` provisioned into the linked site, printed to console.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json netlify.toml .env.example .nvmrc
git commit -m "feat(backend): bootstrap Netlify + Drizzle + TypeScript project"
```

---

### Task 2: Drizzle schema

**Files:**
- Create: `db/schema.ts`
- Create: `drizzle.config.ts`
- Create: `db/client.ts`

- [ ] **Step 1: Write the Drizzle schema matching the spec exactly**

Create `db/schema.ts`:

```typescript
import { pgTable, uuid, text, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const entities = pgTable(
  "entities",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    game: text("game").notNull(),
    entityType: text("entity_type").notNull(),
    entitySlug: text("entity_slug").notNull(),
    displayName: text("display_name").notNull(),
    description: text("description"),
    classTags: text("class_tags").array().notNull().default(sql`'{}'::text[]`),
    mechanicTags: text("mechanic_tags").array().notNull().default(sql`'{}'::text[]`),
    damageTags: text("damage_tags").array().notNull().default(sql`'{}'::text[]`),
    creates: text("creates").array().notNull().default(sql`'{}'::text[]`),
    triggeredBy: text("triggered_by").array().notNull().default(sql`'{}'::text[]`),
    conversionsAvailable: jsonb("conversions_available").notNull().default(sql`'[]'::jsonb`),
    recommendedSupports: text("recommended_supports").array().notNull().default(sql`'{}'::text[]`),
    relevantPassives: text("relevant_passives").array().notNull().default(sql`'{}'::text[]`),
    patchVersion: text("patch_version"),
    contentHash: text("content_hash"),
    rawAiOutput: jsonb("raw_ai_output"),
  },
  (t) => ({
    gameSlugUnique: uniqueIndex("entities_game_slug_unique").on(t.game, t.entitySlug),
  }),
);

export const synergyEdges = pgTable(
  "synergy_edges",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    game: text("game").notNull(),
    fromEntityId: uuid("from_entity_id").references(() => entities.id, { onDelete: "cascade" }),
    toEntityId: uuid("to_entity_id").references(() => entities.id, { onDelete: "cascade" }),
    interactionType: text("interaction_type"),
    reason: text("reason"),
  },
  (t) => ({
    edgeUnique: uniqueIndex("synergy_edges_pair_unique").on(t.fromEntityId, t.toEntityId),
    fromIdx: index("edges_from_idx").on(t.fromEntityId),
    toIdx: index("edges_to_idx").on(t.toEntityId),
  }),
);

export type Entity = typeof entities.$inferSelect;
export type SynergyEdge = typeof synergyEdges.$inferSelect;
```

- [ ] **Step 2: Configure drizzle-kit**

Create `drizzle.config.ts`:

```typescript
import type { Config } from "drizzle-kit";

export default {
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.NETLIFY_DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
} satisfies Config;
```

- [ ] **Step 3: Create the DB client helper**

Create `db/client.ts`:

```typescript
import { neon } from "@netlify/neon";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema.ts";

const sqlClient = neon();
export const db = drizzle(sqlClient, { schema });
export { schema };
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: exit code 0, no errors.

- [ ] **Step 5: Commit**

```bash
git add db/schema.ts db/client.ts drizzle.config.ts
git commit -m "feat(backend): Drizzle schema for entities + synergy_edges"
```

---

### Task 3: Generate and apply the migration (with indexes)

**Files:**
- Create: `db/migrations/0000_initial.sql` (generated)
- Create: `db/migrations/0001_indexes.sql` (handwritten for GIN + pg_trgm)

- [ ] **Step 1: Generate the initial migration**

Run: `npm run db:generate`
Expected: A new file `db/migrations/0000_<name>.sql` created; output ends with `Your SQL migration file ➜ db/migrations/0000_...`.

- [ ] **Step 2: Add the hand-written GIN / pg_trgm migration**

Create `db/migrations/0001_indexes.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS entities_mechanic_tags_idx ON entities USING GIN (mechanic_tags);
CREATE INDEX IF NOT EXISTS entities_damage_tags_idx   ON entities USING GIN (damage_tags);
CREATE INDEX IF NOT EXISTS entities_class_tags_idx    ON entities USING GIN (class_tags);

CREATE INDEX IF NOT EXISTS entities_tsv_idx ON entities USING GIN (
  to_tsvector('english', display_name || ' ' || coalesce(description, ''))
);

CREATE INDEX IF NOT EXISTS entities_name_trgm_idx ON entities USING GIN (display_name gin_trgm_ops);
```

- [ ] **Step 3: Apply migrations against the linked Netlify DB**

Run: `npm run db:migrate`
Expected: `migrations applied successfully` (or equivalent drizzle-kit success line).

- [ ] **Step 4: Commit**

```bash
git add db/migrations/
git commit -m "feat(backend): initial schema migration + GIN and pg_trgm indexes"
```

---

### Task 4: Shared validation + response helpers

**Files:**
- Create: `netlify/functions/_lib/response.ts`
- Create: `netlify/functions/_lib/validators.ts`
- Create: `tests/unit/validators.test.ts`
- Create: `vitest.config.ts`

- [ ] **Step 1: Write the JSON helper**

Create `netlify/functions/_lib/response.ts`:

```typescript
export function json(body: unknown, init: { status?: number; cache?: boolean } = {}): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
  };
  if (init.cache !== false) {
    headers["Cache-Control"] = "public, s-maxage=3600, stale-while-revalidate=86400";
  }
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers,
  });
}

export function badRequest(message: string): Response {
  return json({ error: message }, { status: 400, cache: false });
}
```

- [ ] **Step 2: Write the Zod validators**

Create `netlify/functions/_lib/validators.ts`:

```typescript
import { z } from "zod";

export const gameSchema = z.enum(["poe2"]);

export const searchQuerySchema = z.object({
  game: gameSchema,
  q: z.string().trim().min(1).max(100).optional(),
  class: z.string().trim().min(1).max(40).optional(),
  type: z.enum(["skill", "support", "passive"]).optional(),
  tag: z.string().trim().min(1).max(40).optional(),
});

export const analyzeBodySchema = z.object({
  game: gameSchema,
  entity_ids: z.array(z.string().uuid()).min(1).max(8),
});

export const extendBodySchema = z.object({
  game: gameSchema,
  mechanic_tags: z.array(z.string().min(1).max(40)).min(1).max(20),
  exclude_ids: z.array(z.string().uuid()).max(8).default([]),
});
```

- [ ] **Step 3: Configure vitest**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    setupFiles: [],
  },
});
```

- [ ] **Step 4: Write the failing validator test**

Create `tests/unit/validators.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { analyzeBodySchema, extendBodySchema, searchQuerySchema } from "../../netlify/functions/_lib/validators.ts";

describe("validators", () => {
  it("accepts a well-formed search query", () => {
    const parsed = searchQuerySchema.parse({ game: "poe2", q: "volcanic" });
    expect(parsed.q).toBe("volcanic");
  });

  it("rejects unknown game", () => {
    expect(() => searchQuerySchema.parse({ game: "d4" })).toThrow();
  });

  it("requires at least one entity_id for analyze", () => {
    expect(() => analyzeBodySchema.parse({ game: "poe2", entity_ids: [] })).toThrow();
  });

  it("caps entity_ids at 8", () => {
    const nine = Array.from({ length: 9 }, () => "00000000-0000-0000-0000-000000000000");
    expect(() => analyzeBodySchema.parse({ game: "poe2", entity_ids: nine })).toThrow();
  });

  it("extend defaults exclude_ids to empty array", () => {
    const parsed = extendBodySchema.parse({ game: "poe2", mechanic_tags: ["slam"] });
    expect(parsed.exclude_ids).toEqual([]);
  });
});
```

- [ ] **Step 5: Run the tests**

Run: `npm test`
Expected: `5 passed`.

- [ ] **Step 6: Commit**

```bash
git add netlify/functions/_lib/response.ts netlify/functions/_lib/validators.ts vitest.config.ts tests/unit/validators.test.ts
git commit -m "feat(backend): JSON response helpers + zod validators"
```

---

### Task 5: `/api/search` function

**Files:**
- Create: `netlify/functions/search.ts`
- Create: `tests/functions/search.test.ts`
- Create: `tests/_helpers/seed.ts`

- [ ] **Step 1: Write a shared test-DB seeding helper**

Create `tests/_helpers/seed.ts`:

```typescript
import { db, schema } from "../../db/client.ts";

export async function resetAndSeed(): Promise<{ vfId: string; stId: string }> {
  await db.delete(schema.synergyEdges);
  await db.delete(schema.entities);

  const [vf] = await db
    .insert(schema.entities)
    .values({
      game: "poe2",
      entityType: "skill",
      entitySlug: "volcanic_fissure",
      displayName: "Volcanic Fissure",
      description: "Slam the ground, unleashing a fissure of molten rock that erupts in waves.",
      classTags: ["warrior"],
      mechanicTags: ["slam", "fire", "aoe", "ground_effect"],
      damageTags: ["fire", "physical"],
      creates: ["molten_fissure"],
      triggeredBy: [],
      conversionsAvailable: [
        { from: "fire", to: "lightning", requires: "lightning conversion support" },
        { from: "fire", to: "cold", requires: "cold conversion support" },
      ],
      recommendedSupports: ["upheaval_support"],
      relevantPassives: ["aftershocks_notable"],
      patchVersion: "test",
      contentHash: "test-vf",
    })
    .returning({ id: schema.entities.id });

  const [st] = await db
    .insert(schema.entities)
    .values({
      game: "poe2",
      entityType: "skill",
      entitySlug: "stampede",
      displayName: "Stampede",
      description: "Charge forward, knocking enemies aside and slamming at the end.",
      classTags: ["warrior"],
      mechanicTags: ["slam", "aoe", "movement"],
      damageTags: ["physical"],
      creates: [],
      triggeredBy: [],
      conversionsAvailable: [],
      recommendedSupports: [],
      relevantPassives: [],
      patchVersion: "test",
      contentHash: "test-st",
    })
    .returning({ id: schema.entities.id });

  await db.insert(schema.synergyEdges).values([
    {
      game: "poe2",
      fromEntityId: vf.id,
      toEntityId: st.id,
      interactionType: "direct",
      reason: "Stampede's aftershock repeatedly triggers the fissure along the slam line.",
    },
    {
      game: "poe2",
      fromEntityId: st.id,
      toEntityId: vf.id,
      interactionType: "direct",
      reason: "Stampede's aftershock repeatedly triggers the fissure along the slam line.",
    },
  ]);

  return { vfId: vf.id, stId: st.id };
}
```

- [ ] **Step 2: Write the failing function test**

Create `tests/functions/search.test.ts`:

```typescript
import { beforeAll, describe, expect, it } from "vitest";
import handler from "../../netlify/functions/search.ts";
import { resetAndSeed } from "../_helpers/seed.ts";

function makeRequest(url: string): Request {
  return new Request(url, { method: "GET" });
}

const ctx = { params: {} } as any;

describe("GET /api/search", () => {
  beforeAll(async () => {
    await resetAndSeed();
  });

  it("returns results for fuzzy query", async () => {
    const res = await handler(makeRequest("http://localhost/api/search?game=poe2&q=volcanic"), ctx);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ display_name: string }>;
    expect(body.some((r) => r.display_name === "Volcanic Fissure")).toBe(true);
  });

  it("filters by class when q is absent", async () => {
    const res = await handler(makeRequest("http://localhost/api/search?game=poe2&class=warrior"), ctx);
    const body = (await res.json()) as unknown[];
    expect(body.length).toBeGreaterThanOrEqual(2);
  });

  it("rejects missing game param", async () => {
    const res = await handler(makeRequest("http://localhost/api/search"), ctx);
    expect(res.status).toBe(400);
  });

  it("sets CDN cache header", async () => {
    const res = await handler(makeRequest("http://localhost/api/search?game=poe2&q=volcanic"), ctx);
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=3600");
  });
});
```

- [ ] **Step 3: Run the test to confirm it fails**

Run: `npm test tests/functions/search.test.ts`
Expected: FAIL with `Cannot find module '../../netlify/functions/search.ts'`.

- [ ] **Step 4: Implement the search function**

Create `netlify/functions/search.ts`:

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

export default async function handler(req: Request, _ctx: Context): Promise<Response> {
  const url = new URL(req.url);
  const parseResult = searchQuerySchema.safeParse({
    game: url.searchParams.get("game") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    class: url.searchParams.get("class") ?? undefined,
    type: url.searchParams.get("type") ?? undefined,
    tag: url.searchParams.get("tag") ?? undefined,
  });

  if (!parseResult.success) {
    return badRequest(parseResult.error.message);
  }

  const { game, q, class: classTag, type, tag } = parseResult.data;

  // We build a single parameterised SQL string. @netlify/neon exposes a tagged
  // template literal that binds interpolated values as parameters; we therefore
  // use explicit conditional branches rather than string concatenation.
  let rows: Record<string, unknown>[];

  if (q) {
    rows = await sqlClient`
      SELECT id,
             entity_type,
             entity_slug,
             display_name,
             description,
             mechanic_tags,
             damage_tags,
             class_tags
      FROM entities
      WHERE game = ${game}
        AND (${type}::text IS NULL OR entity_type = ${type})
        AND (${classTag}::text IS NULL OR ${classTag} = ANY(class_tags))
        AND (${tag}::text IS NULL OR ${tag} = ANY(mechanic_tags))
        AND (
          similarity(display_name, ${q}) > 0.2
          OR to_tsvector('english', display_name || ' ' || coalesce(description, ''))
             @@ plainto_tsquery('english', ${q})
        )
      ORDER BY similarity(display_name, ${q}) DESC
      LIMIT 20;
    `;
  } else {
    rows = await sqlClient`
      SELECT id,
             entity_type,
             entity_slug,
             display_name,
             description,
             mechanic_tags,
             damage_tags,
             class_tags
      FROM entities
      WHERE game = ${game}
        AND (${type}::text IS NULL OR entity_type = ${type})
        AND (${classTag}::text IS NULL OR ${classTag} = ANY(class_tags))
        AND (${tag}::text IS NULL OR ${tag} = ANY(mechanic_tags))
      ORDER BY display_name ASC
      LIMIT 20;
    `;
  }

  return json(rows);
}
```

- [ ] **Step 5: Run the test and verify it passes**

Run: `npm test tests/functions/search.test.ts`
Expected: `4 passed`. (Requires `NETLIFY_DATABASE_URL` in env; run via `netlify dev:exec npm test ...` if needed.)

- [ ] **Step 6: Commit**

```bash
git add netlify/functions/search.ts netlify/functions/_lib/response.ts netlify/functions/_lib/validators.ts tests/functions/search.test.ts tests/_helpers/seed.ts
git commit -m "feat(backend): /api/search with trigram + tsvector ranking"
```

---

### Task 6: `/api/analyze` function

**Files:**
- Create: `netlify/functions/analyze.ts`
- Create: `tests/functions/analyze.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/functions/analyze.test.ts`:

```typescript
import { beforeAll, describe, expect, it } from "vitest";
import handler from "../../netlify/functions/analyze.ts";
import { resetAndSeed } from "../_helpers/seed.ts";

const ctx = { params: {} } as any;

let vfId = "";
let stId = "";

beforeAll(async () => {
  const ids = await resetAndSeed();
  vfId = ids.vfId;
  stId = ids.stId;
});

function post(body: unknown): Request {
  return new Request("http://localhost/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/analyze", () => {
  it("returns a direct interaction between Volcanic Fissure and Stampede", async () => {
    const res = await handler(post({ game: "poe2", entity_ids: [vfId, stId] }), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.direct_interactions.length).toBeGreaterThan(0);
    const first = body.direct_interactions[0];
    expect([first.from_entity_id, first.to_entity_id]).toContain(vfId);
    expect([first.from_entity_id, first.to_entity_id]).toContain(stId);
  });

  it("includes conversion options for Volcanic Fissure", async () => {
    const res = await handler(post({ game: "poe2", entity_ids: [vfId, stId] }), ctx);
    const body = await res.json();
    const conv = body.conversion_options.find((c: any) => c.entity_id === vfId);
    expect(conv).toBeDefined();
    expect(conv.can_convert_to).toEqual(expect.arrayContaining(["lightning", "cold"]));
  });

  it("reports aggregated damage tags", async () => {
    const res = await handler(post({ game: "poe2", entity_ids: [vfId, stId] }), ctx);
    const body = await res.json();
    expect(body.damage_tags).toEqual(expect.arrayContaining(["fire", "physical"]));
  });

  it("returns 400 for invalid body", async () => {
    const res = await handler(post({ game: "poe2", entity_ids: [] }), ctx);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `npm test tests/functions/analyze.test.ts`
Expected: FAIL with `Cannot find module '../../netlify/functions/analyze.ts'`.

- [ ] **Step 3: Implement the analyze function**

Create `netlify/functions/analyze.ts`:

```typescript
import type { Config, Context } from "@netlify/functions";
import { neon } from "@netlify/neon";
import { badRequest, json } from "./_lib/response.ts";
import { analyzeBodySchema } from "./_lib/validators.ts";

export const config: Config = {
  path: "/api/analyze",
  method: ["POST"],
};

const sqlClient = neon();

interface EntityRow {
  id: string;
  entity_type: string;
  entity_slug: string;
  display_name: string;
  mechanic_tags: string[];
  damage_tags: string[];
  recommended_supports: string[];
  relevant_passives: string[];
  conversions_available: Array<{ from: string; to: string; requires: string }>;
}

interface EdgeRow {
  from_entity_id: string;
  to_entity_id: string;
  interaction_type: string | null;
  reason: string | null;
}

function unique<T>(xs: T[]): T[] {
  return Array.from(new Set(xs));
}

export default async function handler(req: Request, _ctx: Context): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Body must be JSON");
  }
  const parsed = analyzeBodySchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.message);
  }

  const { game, entity_ids } = parsed.data;

  const entities = (await sqlClient`
    SELECT id, entity_type, entity_slug, display_name, mechanic_tags,
           damage_tags, recommended_supports, relevant_passives, conversions_available
    FROM entities
    WHERE game = ${game} AND id = ANY(${entity_ids}::uuid[]);
  `) as EntityRow[];

  const edges = (await sqlClient`
    SELECT from_entity_id, to_entity_id, interaction_type, reason
    FROM synergy_edges
    WHERE game = ${game}
      AND (from_entity_id = ANY(${entity_ids}::uuid[])
           OR to_entity_id = ANY(${entity_ids}::uuid[]));
  `) as EdgeRow[];

  const selectedSet = new Set(entity_ids);

  const directInteractions = edges.filter(
    (e) =>
      e.interaction_type === "direct" &&
      selectedSet.has(e.from_entity_id) &&
      selectedSet.has(e.to_entity_id),
  );
  const extendedInteractions = edges.filter(
    (e) => e.interaction_type === "extended" || !selectedSet.has(e.to_entity_id) || !selectedSet.has(e.from_entity_id),
  );

  // Loop = there exist at least two distinct selected entities that edge to each other bidirectionally.
  const edgePairs = new Set(directInteractions.map((e) => `${e.from_entity_id}->${e.to_entity_id}`));
  const loopDetected = directInteractions.some(
    (e) => edgePairs.has(`${e.to_entity_id}->${e.from_entity_id}`),
  );

  const allDamageTags = unique(entities.flatMap((e) => e.damage_tags));
  const allSupports = unique(entities.flatMap((e) => e.recommended_supports));
  const allPassives = unique(entities.flatMap((e) => e.relevant_passives));

  const conversionOptions = entities
    .filter((e) => (e.conversions_available ?? []).length > 0)
    .map((e) => ({
      entity_id: e.id,
      display_name: e.display_name,
      current_tags: e.damage_tags,
      can_convert_to: unique((e.conversions_available ?? []).map((c) => c.to)),
    }));

  return json({
    direct_interactions: directInteractions,
    extended_interactions: extendedInteractions,
    loop_detected: loopDetected,
    damage_tags: allDamageTags,
    recommended_supports: allSupports,
    relevant_passives: allPassives,
    conversion_options: conversionOptions,
    entities,
  });
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npm test tests/functions/analyze.test.ts`
Expected: `4 passed`.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/analyze.ts tests/functions/analyze.test.ts
git commit -m "feat(backend): /api/analyze returns direct+extended+conversion data"
```

---

### Task 7: `/api/extend` function

**Files:**
- Create: `netlify/functions/extend.ts`
- Create: `tests/functions/extend.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/functions/extend.test.ts`:

```typescript
import { beforeAll, describe, expect, it } from "vitest";
import handler from "../../netlify/functions/extend.ts";
import { resetAndSeed } from "../_helpers/seed.ts";

const ctx = { params: {} } as any;

let vfId = "";
let stId = "";

beforeAll(async () => {
  const ids = await resetAndSeed();
  vfId = ids.vfId;
  stId = ids.stId;
});

function post(body: unknown): Request {
  return new Request("http://localhost/api/extend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/extend", () => {
  it("returns entities grouped by type when no exclusions match all", async () => {
    const res = await handler(
      post({ game: "poe2", mechanic_tags: ["slam"], exclude_ids: [] }),
      ctx,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("skills");
    expect(body).toHaveProperty("supports");
    expect(body).toHaveProperty("passives");
    expect(body.skills.length).toBeGreaterThanOrEqual(2);
  });

  it("excludes already-selected entities", async () => {
    const res = await handler(
      post({ game: "poe2", mechanic_tags: ["slam"], exclude_ids: [vfId, stId] }),
      ctx,
    );
    const body = await res.json();
    const ids = [...body.skills, ...body.supports, ...body.passives].map((e: any) => e.id);
    expect(ids).not.toContain(vfId);
    expect(ids).not.toContain(stId);
  });

  it("rejects empty mechanic_tags", async () => {
    const res = await handler(post({ game: "poe2", mechanic_tags: [] }), ctx);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `npm test tests/functions/extend.test.ts`
Expected: FAIL with `Cannot find module '../../netlify/functions/extend.ts'`.

- [ ] **Step 3: Implement the extend function**

Create `netlify/functions/extend.ts`:

```typescript
import type { Config, Context } from "@netlify/functions";
import { neon } from "@netlify/neon";
import { badRequest, json } from "./_lib/response.ts";
import { extendBodySchema } from "./_lib/validators.ts";

export const config: Config = {
  path: "/api/extend",
  method: ["POST"],
};

const sqlClient = neon();

interface Row {
  id: string;
  entity_type: string;
  entity_slug: string;
  display_name: string;
  mechanic_tags: string[];
  damage_tags: string[];
  class_tags: string[];
}

export default async function handler(req: Request, _ctx: Context): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Body must be JSON");
  }
  const parsed = extendBodySchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.message);
  }

  const { game, mechanic_tags, exclude_ids } = parsed.data;

  const rows = (await sqlClient`
    SELECT id, entity_type, entity_slug, display_name, mechanic_tags, damage_tags, class_tags
    FROM entities
    WHERE game = ${game}
      AND mechanic_tags && ${mechanic_tags}::text[]
      AND (${exclude_ids.length === 0} OR id <> ALL(${exclude_ids}::uuid[]))
    ORDER BY cardinality(mechanic_tags & ${mechanic_tags}::text[]) DESC, display_name ASC
    LIMIT 60;
  `) as Row[];

  const grouped = {
    skills: rows.filter((r) => r.entity_type === "skill"),
    supports: rows.filter((r) => r.entity_type === "support"),
    passives: rows.filter((r) => r.entity_type === "passive"),
  };

  return json(grouped);
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test tests/functions/extend.test.ts`
Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/extend.ts tests/functions/extend.test.ts
git commit -m "feat(backend): /api/extend returns entities grouped by type"
```

---

### Task 8: Full test suite + netlify.toml verification

**Files:**
- Modify: `netlify.toml`

- [ ] **Step 1: Ensure every function has the redirect path declared (already handled by `[[redirects]] /api/* -> /.netlify/functions/:splat`). Verify by running the full test suite.**

Run: `npm test`
Expected: all suites pass — unit validators + 3 function suites = `12 passed` total (5 + 4 + 4 + 3... the exact count must match the test files listed above; confirm no red).

- [ ] **Step 2: Typecheck the full project**

Run: `npm run typecheck`
Expected: exit code 0.

- [ ] **Step 3: Start the dev server and verify each endpoint responds**

Run: `npx netlify dev --port 8888 &` (background), then:
- `curl -s 'http://localhost:8888/api/search?game=poe2&q=volcanic' | head`
- `curl -s -X POST -H 'Content-Type: application/json' -d '{"game":"poe2","entity_ids":["<vfId>","<stId>"]}' http://localhost:8888/api/analyze | head`
- `curl -s -X POST -H 'Content-Type: application/json' -d '{"game":"poe2","mechanic_tags":["slam"]}' http://localhost:8888/api/extend | head`

Expected: each returns valid JSON (arrays / objects) and HTTP 200.

- [ ] **Step 4: Commit**

```bash
git add netlify.toml
git commit -m "test(backend): full API test suite green end-to-end"
```
