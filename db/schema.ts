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
    weaponTags: text("weapon_tags").array().notNull().default(sql`'{}'::text[]`),
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
