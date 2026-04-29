import type { Config, Context } from "@netlify/functions";
import { neon } from "@netlify/neon";
import { badRequest, json } from "./_lib/response.ts";
import { semanticSearchBodySchema } from "./_lib/validators.ts";

export const config: Config = {
  path: "/api/semantic-search",
  method: ["POST"],
};

const sqlClient = neon();

// Module-level pipeline cache so warm invocations skip model loading.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _pipeline: ((text: string, opts: object) => Promise<{ data: Float32Array }>) | any = null;

async function getEmbedding(text: string): Promise<number[]> {
  if (!_pipeline) {
    // Dynamic import keeps esbuild from analysing the WASM internals at bundle time.
    const { pipeline, env } = await import("@xenova/transformers");
    // onnxruntime-node is available — use it instead of WASM.
    env.backends.onnx.wasm.numThreads = 1;
    _pipeline = (await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2",
    )) as typeof _pipeline;
  }
  const output = await _pipeline!(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

export default async function handler(req: Request, _ctx: Context): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const parsed = semanticSearchBodySchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  const { text, limit } = parsed.data;

  let vector: number[];
  try {
    vector = await getEmbedding(text);
  } catch (err) {
    console.error("embedding error:", err);
    return json({ error: "Embedding unavailable" }, { status: 503, cache: false });
  }

  const vecLiteral = `[${vector.join(",")}]`;

  let rows: Record<string, unknown>[];
  try {
    rows = await sqlClient`
      WITH base AS (
        SELECT id, entity_slug, display_name, entity_type,
               mechanic_tags, damage_tags, class_tags,
               embedding <=> ${vecLiteral}::vector AS dist
        FROM entities
        WHERE game = 'poe2' AND embedding IS NOT NULL
      )
      SELECT id, entity_slug, display_name, entity_type,
             mechanic_tags, damage_tags, class_tags,
             1 - dist AS similarity
      FROM base
      ORDER BY dist
      LIMIT ${limit}
    `;
  } catch (err) {
    console.error("semantic-search DB error:", err);
    return json({ error: "Search unavailable" }, { status: 503, cache: false });
  }
  return json(rows, { cache: false });
}
