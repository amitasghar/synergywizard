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
