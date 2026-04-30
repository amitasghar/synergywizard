import type { Config, Context } from "@netlify/functions";
import { neon } from "@netlify/neon";
import { badRequest, json } from "./_lib/response.ts";
import { d4AnalyzeBodySchema } from "./_lib/validators.ts";

export const config: Config = {
  path: "/api/d4-analyze",
  method: ["POST"],
};

const sqlClient = neon();

interface EntityRow {
  id: string;
  entity_type: string;
  entity_slug: string;
  display_name: string;
  description: string;
  mechanic_tags: string[];
  damage_tags: string[];
  class_tags: string[];
  recommended_supports: string[];
  relevant_passives: string[];
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
  const parsed = d4AnalyzeBodySchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  const { entity_ids } = parsed.data;

  const entities = (await sqlClient`
    SELECT id, entity_type, entity_slug, display_name, description,
           mechanic_tags, damage_tags, class_tags,
           recommended_supports, relevant_passives
    FROM entities
    WHERE game = 'd4' AND id = ANY(${entity_ids}::uuid[]);
  `) as EntityRow[];

  const selectedSet = new Set(entity_ids);
  const skills = entities.filter((e) => e.entity_type === "skill");
  const aspects = entities.filter((e) => e.entity_type === "aspect");

  // Detect aspect→skill direct interactions via description text match
  const directInteractions: Array<{
    from_entity_id: string;
    to_entity_id: string;
    interaction_type: string;
    reason: string;
  }> = [];

  for (const aspect of aspects) {
    for (const skill of skills) {
      if (aspect.description.toLowerCase().includes(skill.display_name.toLowerCase())) {
        directInteractions.push({
          from_entity_id: aspect.id,
          to_entity_id: skill.id,
          interaction_type: "direct",
          reason: `${aspect.display_name} explicitly enhances ${skill.display_name}`,
        });
      }
    }
  }

  // Extended: passives in DB whose damage/mechanic tags overlap the build, not already selected
  const buildDamageTags = unique(entities.filter((e) => selectedSet.has(e.id)).flatMap((e) => e.damage_tags));
  const buildMechanicTags = unique(entities.filter((e) => selectedSet.has(e.id)).flatMap((e) => e.mechanic_tags));
  const combinedBuildTags = unique([...buildDamageTags, ...buildMechanicTags]);

  let extendedPassives: EntityRow[] = [];
  if (combinedBuildTags.length > 0) {
    extendedPassives = (await sqlClient`
      SELECT id, entity_type, entity_slug, display_name, description,
             mechanic_tags, damage_tags, class_tags,
             recommended_supports, relevant_passives
      FROM entities
      WHERE game = 'd4'
        AND entity_type = 'passive'
        AND NOT (id = ANY(${entity_ids}::uuid[]))
        AND (damage_tags && ${combinedBuildTags}::text[] OR mechanic_tags && ${combinedBuildTags}::text[])
      LIMIT 6;
    `) as EntityRow[];
  }

  const extendedInteractions = extendedPassives.map((p) => ({
    from_entity_id: null,
    to_entity_id: p.id,
    interaction_type: "extended",
    reason: `Passive complements build tags: ${[...p.damage_tags, ...p.mechanic_tags].join(", ")}`,
  }));

  const allEntities = [...entities, ...extendedPassives.filter((p) => !selectedSet.has(p.id))];

  const allDamageTags = buildDamageTags;
  const allRecommendedAspects = unique(
    entities.filter((e) => selectedSet.has(e.id)).flatMap((e) => e.recommended_supports)
  );
  const allRelevantPassives = unique(
    entities.filter((e) => selectedSet.has(e.id)).flatMap((e) => e.relevant_passives)
  );

  return json({
    direct_interactions: directInteractions,
    extended_interactions: extendedInteractions,
    loop_detected: false,
    damage_tags: allDamageTags,
    recommended_supports: allRecommendedAspects,
    relevant_passives: allRelevantPassives,
    conversion_options: [],
    entities: allEntities,
  });
}
