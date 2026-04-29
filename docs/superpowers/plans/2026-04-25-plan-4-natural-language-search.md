# Natural Language Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a zero-token-cost natural language search bar that lets users describe what they want ("skills that spread fire on the ground") and get semantically ranked results, complementing the existing tag/keyword search.

**Architecture:** Browser-side query embedding via Transformers.js (ONNX model, no API calls) + pgvector similarity search in Neon Postgres. The pipeline pre-computes entity embeddings using fastembed (Python, same model weights) and stores them in a new `embedding vector(384)` column. At query time, the browser embeds the query locally and sends the float array to a new `/api/semantic-search` Netlify Function which runs a cosine-similarity SQL query.

**Tech Stack:** `@xenova/transformers` (browser ONNX runtime), `fastembed` (Python pipeline), pgvector (Neon extension), Drizzle ORM for schema, `@neondatabase/serverless` for vector SQL queries.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `db/migrations/0002_embeddings.sql` | Create | Enable pgvector, add `embedding vector(384)` column + IVFFlat index |
| `pipeline/requirements.txt` | Modify | Add `fastembed==0.3.6` |
| `pipeline/embedder.py` | Create | Generate 384-dim embeddings for entities using `all-MiniLM-L6-v2` |
| `pipeline/tests/test_embedder.py` | Create | Unit tests for embedder |
| `pipeline/run_pipeline.py` | Modify | Add embedding step after each entity is written to DB |
| `netlify/functions/semantic-search.ts` | Create | POST endpoint: receives float[] query vector, returns top-10 similar entities |
| `netlify/functions/_lib/validators.ts` | Modify | Add `semanticSearchBodySchema` |
| `tests/functions/semantic-search.test.ts` | Create | Unit tests for semantic-search function |
| `src/hooks/useEmbedder.ts` | Create | Lazy-loads `Xenova/all-MiniLM-L6-v2` once, exposes `embed(text)` |
| `src/components/NaturalSearchBar.tsx` | Create | Input + model loading state + result list using EntityCard |
| `src/components/LeftPanel.tsx` | Modify | Add "Ask" tab (third tab) wiring to NaturalSearchBar |
| `src/api/client.ts` | Modify | Add `api.semanticSearch(vector)` typed fetch wrapper |
| `src/types.ts` | Modify | Add `SemanticSearchResult` type |

---

### Task 1: DB migration — pgvector extension and embedding column

**Files:**
- Create: `db/migrations/0002_embeddings.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- db/migrations/0002_embeddings.sql
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE entities ADD COLUMN IF NOT EXISTS embedding vector(384);

CREATE INDEX IF NOT EXISTS entities_embedding_idx
  ON entities USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

- [ ] **Step 2: Apply the migration against Neon**

```bash
NETLIFY_DATABASE_URL="<value from .env>" npx drizzle-kit migrate
```

If drizzle-kit doesn't pick up the raw SQL file, run it directly:
```bash
psql "$NETLIFY_DATABASE_URL" -f db/migrations/0002_embeddings.sql
```

Expected: no errors, `\d entities` shows an `embedding` column of type `vector(384)`.

- [ ] **Step 3: Verify in psql**

```bash
psql "$NETLIFY_DATABASE_URL" -c "\d entities" | grep embedding
```

Expected output contains: `embedding | vector(384)`

- [ ] **Step 4: Commit**

```bash
git add db/migrations/0002_embeddings.sql
git commit -m "feat(db): add pgvector extension and embedding column"
```

---

### Task 2: Python embedder module

**Files:**
- Modify: `pipeline/requirements.txt`
- Create: `pipeline/embedder.py`
- Create: `pipeline/tests/test_embedder.py`

- [ ] **Step 1: Add fastembed to requirements**

In `pipeline/requirements.txt`, add after `python-slugify==8.0.4`:
```
fastembed==0.3.6
```

- [ ] **Step 2: Write the failing test**

Create `pipeline/tests/test_embedder.py`:
```python
import pytest
from pipeline.embedder import embed_entity, embed_text, DIMENSIONS

def test_embed_text_returns_correct_dimensions():
    vec = embed_text("fire slam skill")
    assert len(vec) == DIMENSIONS
    assert all(isinstance(v, float) for v in vec)

def test_embed_text_is_deterministic():
    assert embed_text("volcanic fissure") == embed_text("volcanic fissure")

def test_embed_entity_uses_name_and_tags():
    entity = {
        "display_name": "Volcanic Fissure",
        "mechanic_tags": ["slam", "fire", "aoe"],
        "damage_tags": ["fire"],
        "description": "Slams creating a fissure",
    }
    vec = embed_entity(entity)
    assert len(vec) == DIMENSIONS

def test_different_entities_produce_different_vectors():
    a = embed_text("fire slam skill")
    b = embed_text("cold projectile support")
    assert a != b
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd pipeline && python -m pytest tests/test_embedder.py -v
```

Expected: `ModuleNotFoundError: No module named 'pipeline.embedder'`

- [ ] **Step 4: Install fastembed locally**

```bash
pip install fastembed==0.3.6
```

- [ ] **Step 5: Implement embedder.py**

Create `pipeline/embedder.py`:
```python
"""Generate sentence embeddings for entities using all-MiniLM-L6-v2 via fastembed."""

from __future__ import annotations
from functools import lru_cache
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from fastembed import TextEmbedding

DIMENSIONS = 384
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"


@lru_cache(maxsize=1)
def _model() -> "TextEmbedding":
    from fastembed import TextEmbedding
    return TextEmbedding(model_name=MODEL_NAME)


def embed_text(text: str) -> list[float]:
    vectors = list(_model().embed([text]))
    return [float(v) for v in vectors[0]]


def embed_entity(entity: dict) -> list[float]:
    parts = [entity.get("display_name", "")]
    parts += entity.get("mechanic_tags", [])
    parts += entity.get("damage_tags", [])
    desc = entity.get("description", "")
    if desc:
        parts.append(desc)
    text = " ".join(parts)
    return embed_text(text)
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd pipeline && python -m pytest tests/test_embedder.py -v
```

Expected: `4 passed`

- [ ] **Step 7: Commit**

```bash
git add pipeline/requirements.txt pipeline/embedder.py pipeline/tests/test_embedder.py
git commit -m "feat(pipeline): add fastembed embedder module"
```

---

### Task 3: Wire embedder into pipeline run

**Files:**
- Modify: `pipeline/run_pipeline.py`

The pipeline already writes entities incrementally. After each `upsert_entity`, we compute and store the embedding in the same DB row.

- [ ] **Step 1: Add UPDATE SQL constant to db_writer.py**

In `pipeline/db_writer.py`, add after `LOOKUP_SQL`:
```python
UPDATE_EMBEDDING_SQL = """
UPDATE entities SET embedding = %s::vector
WHERE game = %s AND entity_slug = %s;
"""
```

And add this function:
```python
def update_embedding(conn, slug: str, embedding: list[float], game: str = "poe2") -> None:
    vec_str = "[" + ",".join(str(v) for v in embedding) + "]"
    with conn.cursor() as cur:
        cur.execute(UPDATE_EMBEDDING_SQL, (vec_str, game, slug))
```

- [ ] **Step 2: Write the failing test**

In `pipeline/tests/test_db_writer.py`, add:
```python
def test_update_embedding_formats_vector_correctly():
    conn = MagicMock()
    cur = MagicMock()
    conn.cursor.return_value.__enter__ = lambda s: cur
    conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

    from pipeline.db_writer import update_embedding
    update_embedding(conn, "volcanic_fissure", [0.1, 0.2, 0.3])

    call_args = cur.execute.call_args[0]
    assert "[0.1,0.2,0.3]" in call_args[1][0]
    assert call_args[1][1] == "poe2"
    assert call_args[1][2] == "volcanic_fissure"
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd pipeline && python -m pytest tests/test_db_writer.py::test_update_embedding_formats_vector_correctly -v
```

Expected: `FAILED` — `update_embedding` not yet defined.

- [ ] **Step 4: Run test to verify it passes after Step 1**

```bash
cd pipeline && python -m pytest tests/test_db_writer.py -v
```

Expected: all tests pass.

- [ ] **Step 5: Add embedding step in run_pipeline.py**

In `pipeline/run_pipeline.py`, add this import at top:
```python
from pipeline import embedder
```

Inside the incremental loop, after `conn.commit()` and before `edges_pending.append(...)`:
```python
            try:
                vec = embedder.embed_entity(merged)
                db_writer.update_embedding(conn, merged["entity_slug"], vec)
                conn.commit()
            except Exception as exc:
                sys.stderr.write(f"WARNING: embedding failed for {merged['entity_slug']}: {exc}\n")
```

- [ ] **Step 6: Commit**

```bash
git add pipeline/db_writer.py pipeline/run_pipeline.py pipeline/tests/test_db_writer.py
git commit -m "feat(pipeline): compute and store entity embeddings after each write"
```

---

### Task 4: Semantic search Netlify Function

**Files:**
- Modify: `netlify/functions/_lib/validators.ts`
- Create: `netlify/functions/semantic-search.ts`
- Create: `tests/functions/semantic-search.test.ts`

- [ ] **Step 1: Add validator schema**

In `netlify/functions/_lib/validators.ts`, add:
```typescript
export const semanticSearchBodySchema = z.object({
  vector: z.array(z.number()).length(384),
  limit: z.number().int().min(1).max(20).default(10),
});
```

- [ ] **Step 2: Write the failing test**

Create `tests/functions/semantic-search.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../db/client.ts", () => ({
  db: { execute: vi.fn() },
}));
vi.mock("../../netlify/functions/_lib/response.ts", () => ({
  json: (data: unknown) => ({ body: JSON.stringify(data), statusCode: 200 }),
  badRequest: (msg: string) => ({ body: msg, statusCode: 400 }),
}));

import { handler } from "../../netlify/functions/semantic-search.ts";

const fakeVector = Array.from({ length: 384 }, (_, i) => i / 384);

describe("semantic-search function", () => {
  it("returns 400 for missing vector", async () => {
    const res = await handler({ httpMethod: "POST", body: JSON.stringify({}) } as any, {} as any);
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 for wrong vector dimensions", async () => {
    const res = await handler(
      { httpMethod: "POST", body: JSON.stringify({ vector: [0.1, 0.2] }) } as any,
      {} as any
    );
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 for GET request", async () => {
    const res = await handler({ httpMethod: "GET", body: null } as any, {} as any);
    expect(res.statusCode).toBe(400);
  });

  it("returns results for valid vector", async () => {
    const { db } = await import("../../db/client.ts");
    (db.execute as any).mockResolvedValue({
      rows: [
        { entity_slug: "volcanic-fissure", display_name: "Volcanic Fissure",
          mechanic_tags: ["slam","fire"], damage_tags: ["fire"],
          class_tags: [], entity_type: "skill", similarity: 0.92 }
      ]
    });
    const res = await handler(
      { httpMethod: "POST", body: JSON.stringify({ vector: fakeVector }) } as any,
      {} as any
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveLength(1);
    expect(body[0].entity_slug).toBe("volcanic-fissure");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run tests/functions/semantic-search.test.ts
```

Expected: `Cannot find module '../../netlify/functions/semantic-search.ts'`

- [ ] **Step 4: Implement semantic-search.ts**

Create `netlify/functions/semantic-search.ts`:
```typescript
import type { Handler } from "@netlify/functions";
import { neon } from "@netlify/neon";
import { badRequest, json } from "./_lib/response.ts";
import { semanticSearchBodySchema } from "./_lib/validators.ts";

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return badRequest("POST required");

  const parsed = semanticSearchBodySchema.safeParse(
    JSON.parse(event.body ?? "{}")
  );
  if (!parsed.success) return badRequest(parsed.error.message);

  const { vector, limit } = parsed.data;
  const vecLiteral = `[${vector.join(",")}]`;

  const sql = neon();
  const rows = await sql(
    `SELECT entity_slug, display_name, entity_type,
            mechanic_tags, damage_tags, class_tags,
            1 - (embedding <=> $1::vector) AS similarity
     FROM entities
     WHERE game = 'poe2' AND embedding IS NOT NULL
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    [vecLiteral, limit]
  );

  return json(rows, { cache: false });
};
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run tests/functions/semantic-search.test.ts
```

Expected: `4 passed`

- [ ] **Step 6: Run full test suite to check for regressions**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add netlify/functions/semantic-search.ts netlify/functions/_lib/validators.ts tests/functions/semantic-search.test.ts
git commit -m "feat(api): add /api/semantic-search vector similarity endpoint"
```

---

### Task 5: Frontend — useEmbedder hook

**Files:**
- Create: `src/hooks/useEmbedder.ts`

This hook lazy-loads the ONNX model on first use and caches it for the session. Model is ~23MB and downloads once, then served from browser cache.

- [ ] **Step 1: Install Transformers.js**

```bash
npm install @xenova/transformers
```

- [ ] **Step 2: Write the failing test**

Create `src/hooks/useEmbedder.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useEmbedder } from "./useEmbedder.ts";

vi.mock("@xenova/transformers", () => ({
  pipeline: vi.fn().mockResolvedValue(
    vi.fn().mockResolvedValue({ data: new Float32Array(384).fill(0.1) })
  ),
}));

describe("useEmbedder", () => {
  it("starts in idle state", () => {
    const { result } = renderHook(() => useEmbedder());
    expect(result.current.status).toBe("idle");
    expect(result.current.embed).toBeInstanceOf(Function);
  });

  it("returns 384-dim vector after embedding", async () => {
    const { result } = renderHook(() => useEmbedder());
    let vec: number[] = [];
    await act(async () => {
      vec = await result.current.embed("fire slam skill");
    });
    expect(vec).toHaveLength(384);
    expect(result.current.status).toBe("ready");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run src/hooks/useEmbedder.test.ts
```

Expected: `Cannot find module './useEmbedder.ts'`

- [ ] **Step 4: Implement useEmbedder.ts**

Create `src/hooks/useEmbedder.ts`:
```typescript
import { useRef, useState } from "react";

type Status = "idle" | "loading" | "ready" | "error";

type EmbedderState = {
  status: Status;
  embed: (text: string) => Promise<number[]>;
};

let pipelineCache: ((text: string, opts: object) => Promise<{ data: Float32Array }>) | null = null;

export function useEmbedder(): EmbedderState {
  const [status, setStatus] = useState<Status>("idle");
  const loadingRef = useRef(false);

  async function embed(text: string): Promise<number[]> {
    if (!pipelineCache) {
      if (!loadingRef.current) {
        loadingRef.current = true;
        setStatus("loading");
        try {
          const { pipeline } = await import("@xenova/transformers");
          pipelineCache = await pipeline(
            "feature-extraction",
            "Xenova/all-MiniLM-L6-v2"
          ) as typeof pipelineCache;
          setStatus("ready");
        } catch {
          setStatus("error");
          throw new Error("Failed to load embedding model");
        } finally {
          loadingRef.current = false;
        }
      } else {
        await new Promise<void>((resolve) => {
          const interval = setInterval(() => {
            if (pipelineCache) { clearInterval(interval); resolve(); }
          }, 100);
        });
      }
    }
    const output = await pipelineCache!(text, { pooling: "mean", normalize: true });
    return Array.from(output.data);
  }

  return { status, embed };
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/hooks/useEmbedder.test.ts
```

Expected: `2 passed`

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useEmbedder.ts src/hooks/useEmbedder.test.ts
npm install  # package-lock.json will update
git add package.json package-lock.json
git commit -m "feat(frontend): add useEmbedder hook with Transformers.js lazy loading"
```

---

### Task 6: semanticSearch API client method + type

**Files:**
- Modify: `src/types.ts`
- Modify: `src/api/client.ts`

- [ ] **Step 1: Add SemanticSearchResult to types.ts**

In `src/types.ts`, add after the existing interfaces:
```typescript
export interface SemanticSearchResult {
  entity_slug: string;
  display_name: string;
  entity_type: "skill" | "support" | "passive";
  mechanic_tags: string[];
  damage_tags: string[];
  class_tags: string[];
  similarity: number;
}
```

- [ ] **Step 2: Add semanticSearch to client.ts**

In `src/api/client.ts`, add:
```typescript
  async semanticSearch(vector: number[]): Promise<SemanticSearchResult[]> {
    const res = await fetch(`${base}/semantic-search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vector }),
    });
    if (!res.ok) throw new Error(`semantic-search error ${res.status}`);
    return res.json();
  },
```

- [ ] **Step 3: Add test for semanticSearch**

In `src/api/client.test.ts`, add:
```typescript
  it("semanticSearch posts vector and returns results", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ entity_slug: "volcanic-fissure", similarity: 0.9 }],
    } as Response);
    const vec = Array.from({ length: 384 }, () => 0.1);
    const results = await api.semanticSearch(vec);
    expect(results[0].entity_slug).toBe("volcanic-fissure");
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("semantic-search"),
      expect.objectContaining({ method: "POST" })
    );
  });
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/api/client.test.ts
```

Expected: all tests pass (including new one).

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/api/client.ts src/api/client.test.ts
git commit -m "feat(frontend): add SemanticSearchResult type and semanticSearch API method"
```

---

### Task 7: NaturalSearchBar component

**Files:**
- Create: `src/components/NaturalSearchBar.tsx`

- [ ] **Step 1: Implement NaturalSearchBar.tsx**

Create `src/components/NaturalSearchBar.tsx`:
```typescript
import React, { useState } from "react";
import { api } from "../api/client.ts";
import { useEmbedder } from "../hooks/useEmbedder.ts";
import { useStore } from "../state/store.ts";
import type { SemanticSearchResult } from "../types.ts";
import { EntityCard } from "./EntityCard.tsx";

export function NaturalSearchBar(): React.ReactElement {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SemanticSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const { status, embed } = useEmbedder();
  const addEntity = useStore((s) => s.addEntity);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setError("");
    try {
      const vector = await embed(query.trim());
      const hits = await api.semanticSearch(vector);
      setResults(hits);
    } catch {
      setError("Search failed. Try again.");
    } finally {
      setSearching(false);
    }
  }

  const statusLabel: Record<string, string> = {
    idle: "Ask anything about skills…",
    loading: "Loading model (first time only)…",
    ready: "Ask anything about skills…",
    error: "Model failed to load",
  };

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={statusLabel[status]}
          disabled={status === "error"}
          data-testid="natural-search-input"
          className="flex-1 bg-white/5 border border-white/20 rounded px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-accent/60"
        />
        <button
          type="submit"
          disabled={searching || !query.trim() || status === "error"}
          data-testid="natural-search-submit"
          className="px-4 py-2 rounded bg-accent text-background text-sm font-medium hover:opacity-90 disabled:opacity-40"
        >
          {searching ? "…" : "Ask"}
        </button>
      </form>

      {status === "loading" && (
        <p className="text-xs text-white/40">Downloading AI model (~23 MB, once only)…</p>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      <ul className="flex flex-col gap-1" data-testid="natural-search-results">
        {results.map((r) => (
          <li key={r.entity_slug}>
            <EntityCard
              entity={{
                id: r.entity_slug,
                entity_slug: r.entity_slug,
                display_name: r.display_name,
                entity_type: r.entity_type,
                mechanic_tags: r.mechanic_tags,
                damage_tags: r.damage_tags,
                class_tags: r.class_tags,
                description: "",
                creates: [],
                triggered_by: [],
                conversions_available: [],
                recommended_supports: [],
                relevant_passives: [],
                patch_version: "",
                content_hash: "",
                raw_ai_output: {},
              }}
              onAdd={() => addEntity({
                id: r.entity_slug,
                entity_slug: r.entity_slug,
                display_name: r.display_name,
                entity_type: r.entity_type,
                mechanic_tags: r.mechanic_tags,
                damage_tags: r.damage_tags,
                class_tags: r.class_tags,
                description: "",
                creates: [],
                triggered_by: [],
                conversions_available: [],
                recommended_supports: [],
                relevant_passives: [],
                patch_version: "",
                content_hash: "",
                raw_ai_output: {},
              })}
            />
            <span className="text-xs text-white/30 pl-2">
              {(r.similarity * 100).toFixed(0)}% match
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/NaturalSearchBar.tsx
git commit -m "feat(frontend): add NaturalSearchBar component with Transformers.js embedding"
```

---

### Task 8: Wire NaturalSearchBar into LeftPanel as "Ask" tab

**Files:**
- Modify: `src/components/LeftPanel.tsx`

- [ ] **Step 1: Read current LeftPanel**

```bash
cat src/components/LeftPanel.tsx
```

- [ ] **Step 2: Add Ask tab**

Replace the contents of `src/components/LeftPanel.tsx` with:
```typescript
import React, { useState } from "react";
import { SearchTab } from "./SearchTab.tsx";
import { BrowseTab } from "./BrowseTab.tsx";
import { NaturalSearchBar } from "./NaturalSearchBar.tsx";

type Tab = "search" | "browse" | "ask";

export function LeftPanel(): React.ReactElement {
  const [tab, setTab] = useState<Tab>("search");

  const tabs: { id: Tab; label: string }[] = [
    { id: "search", label: "Search" },
    { id: "browse", label: "Browse" },
    { id: "ask", label: "Ask" },
  ];

  return (
    <section className="flex flex-col gap-3">
      <div className="flex gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            data-testid={`tab-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1 rounded text-sm ${
              tab === t.id
                ? "bg-accent text-background font-medium"
                : "text-white/50 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "search" && <SearchTab />}
      {tab === "browse" && <BrowseTab />}
      {tab === "ask" && <NaturalSearchBar />}
    </section>
  );
}
```

- [ ] **Step 3: Run type check**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 4: Run vitest**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 5: Smoke test in browser**

```bash
npx vite
```

Open `http://localhost:5173`. Click "Ask" tab. Type "fire skills that hit the ground" and click Ask. First load shows "Downloading AI model" message. After model loads, results appear with similarity percentages.

- [ ] **Step 6: Commit**

```bash
git add src/components/LeftPanel.tsx
git commit -m "feat(frontend): wire NaturalSearchBar into LeftPanel as Ask tab"
```

---

### Task 9: Update pipeline GitHub Actions — install fastembed

**Files:**
- Modify: `.github/workflows/pipeline.yml`

fastembed downloads the ONNX model on first use (~90MB). Cache it between runs to avoid re-downloading.

- [ ] **Step 1: Add model cache to pipeline.yml**

In `.github/workflows/pipeline.yml`, add a cache step before "Install deps":
```yaml
      - name: Cache fastembed models
        uses: actions/cache@v4
        with:
          path: ~/.cache/fastembed
          key: fastembed-minilm-${{ runner.os }}
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/pipeline.yml
git commit -m "ci: cache fastembed model between pipeline runs"
```

---

## Self-Review

**Spec coverage:**
- ✅ Zero-token-cost: Transformers.js runs entirely in browser, no API calls for embedding
- ✅ Semantic understanding: all-MiniLM-L6-v2 handles paraphrase/concept matching
- ✅ Complements existing UI: third "Ask" tab alongside Search and Browse
- ✅ Pre-computed embeddings: pipeline stores per-entity vectors in pgvector
- ✅ Similarity percentage shown in results
- ✅ Model loading feedback: "Downloading AI model (once only)" message
- ✅ Error handling: network errors, model load failures both handled

**Placeholder scan:** None found — all steps contain actual code.

**Type consistency:**
- `SemanticSearchResult` defined in Task 6, used in Task 7 ✅
- `embed()` returns `number[]` in hook, consumed as `number[]` in component ✅
- `semanticSearchBodySchema` defined in validators, imported in function ✅
- `EntityCard` `onAdd` prop matches store's `addEntity` signature ✅
