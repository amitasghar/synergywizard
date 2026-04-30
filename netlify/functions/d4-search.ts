import type { Config, Context } from "@netlify/functions";
import { neon } from "@netlify/neon";
import { badRequest, json } from "./_lib/response.ts";
import { d4SearchQuerySchema } from "./_lib/validators.ts";

export const config: Config = {
  path: "/api/d4-search",
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
  const parseResult = d4SearchQuerySchema.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    damages: url.searchParams.get("damages") ?? undefined,
    mechanics: url.searchParams.get("mechanics") ?? undefined,
    classes: url.searchParams.get("classes") ?? undefined,
    types: url.searchParams.get("types") ?? undefined,
  });

  if (!parseResult.success) return badRequest(parseResult.error.message);

  const { q, damages, mechanics, classes, types } = parseResult.data;
  const damageArr = parseArr(damages);
  const mechanicArr = parseArr(mechanics);
  const classArr = parseArr(classes);
  const typeArr = parseArr(types);

  let rows: Record<string, unknown>[];

  if (q) {
    rows = await sqlClient`
      SELECT id, entity_type, entity_slug, display_name, description,
             mechanic_tags, damage_tags, class_tags
      FROM entities
      WHERE game = 'd4'
        AND (${damageArr}::text[]  IS NULL OR damage_tags   && ${damageArr}::text[])
        AND (${mechanicArr}::text[] IS NULL OR mechanic_tags && ${mechanicArr}::text[])
        AND (${classArr}::text[]   IS NULL OR class_tags    && ${classArr}::text[])
        AND (${typeArr}::text[]    IS NULL OR entity_type   = ANY(${typeArr}::text[]))
        AND (
          display_name ILIKE '%' || ${q} || '%'
          OR description ILIKE '%' || ${q} || '%'
        )
      ORDER BY
        CASE
          WHEN lower(display_name) = lower(${q})           THEN 0
          WHEN lower(display_name) LIKE lower(${q}) || '%' THEN 1
          ELSE 2
        END,
        display_name ASC
      LIMIT 50;
    `;
  } else {
    rows = await sqlClient`
      SELECT id, entity_type, entity_slug, display_name, description,
             mechanic_tags, damage_tags, class_tags
      FROM entities
      WHERE game = 'd4'
        AND (${damageArr}::text[]  IS NULL OR damage_tags   && ${damageArr}::text[])
        AND (${mechanicArr}::text[] IS NULL OR mechanic_tags && ${mechanicArr}::text[])
        AND (${classArr}::text[]   IS NULL OR class_tags    && ${classArr}::text[])
        AND (${typeArr}::text[]    IS NULL OR entity_type   = ANY(${typeArr}::text[]))
      ORDER BY display_name ASC
      LIMIT 50;
    `;
  }

  return json(rows);
}
