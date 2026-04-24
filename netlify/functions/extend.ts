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
