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

  // Fetch stubs for any entity referenced in edges but not in the selected set,
  // so the client can show display names instead of raw UUIDs.
  const knownIds = new Set(entities.map((e) => e.id));
  const extraIds = unique(
    [...directInteractions, ...extendedInteractions].flatMap((e) => [e.from_entity_id, e.to_entity_id])
  ).filter((id) => !knownIds.has(id));

  if (extraIds.length > 0) {
    const extraEntities = (await sqlClient`
      SELECT id, entity_type, entity_slug, display_name, mechanic_tags,
             damage_tags, recommended_supports, relevant_passives, conversions_available
      FROM entities
      WHERE game = ${game} AND id = ANY(${extraIds}::uuid[]);
    `) as EntityRow[];
    entities.push(...extraEntities);
  }

  const edgePairs = new Set(directInteractions.map((e) => `${e.from_entity_id}->${e.to_entity_id}`));
  const loopDetected = directInteractions.some(
    (e) => edgePairs.has(`${e.to_entity_id}->${e.from_entity_id}`),
  );

  const allDamageTags = unique(entities.filter((e) => selectedSet.has(e.id)).flatMap((e) => e.damage_tags));
  const allSupports = unique(entities.filter((e) => selectedSet.has(e.id)).flatMap((e) => e.recommended_supports));
  const allPassives = unique(entities.filter((e) => selectedSet.has(e.id)).flatMap((e) => e.relevant_passives));

  const conversionOptions = entities
    .filter((e) => selectedSet.has(e.id) && (e.conversions_available ?? []).length > 0)
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
