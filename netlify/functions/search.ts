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
