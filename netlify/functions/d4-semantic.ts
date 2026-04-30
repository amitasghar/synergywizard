import type { Config, Context } from "@netlify/functions";
import { neon } from "@netlify/neon";
import { badRequest, json } from "./_lib/response.ts";
import { semanticSearchBodySchema } from "./_lib/validators.ts";

export const config: Config = {
  path: "/api/d4-semantic",
  method: ["POST"],
};

const sqlClient = neon();

export default async function handler(req: Request, _ctx: Context): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const parsed = semanticSearchBodySchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  const { vector, limit } = parsed.data;
  const vecLiteral = `[${vector.join(",")}]`;

  let rows: Record<string, unknown>[];
  try {
    rows = await sqlClient`
      WITH base AS (
        SELECT id, entity_slug, display_name, entity_type,
               mechanic_tags, damage_tags, class_tags,
               embedding <=> ${vecLiteral}::vector AS dist
        FROM entities
        WHERE game = 'd4' AND embedding IS NOT NULL
      )
      SELECT id, entity_slug, display_name, entity_type,
             mechanic_tags, damage_tags, class_tags,
             1 - dist AS similarity
      FROM base
      ORDER BY dist
      LIMIT ${limit}
    `;
  } catch (err) {
    console.error("d4-semantic DB error:", err);
    return json({ error: "Search unavailable" }, { status: 503, cache: false });
  }
  return json(rows, { cache: false });
}
