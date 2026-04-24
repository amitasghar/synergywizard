CREATE TABLE IF NOT EXISTS "entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_slug" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"class_tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"mechanic_tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"damage_tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"creates" text[] DEFAULT '{}'::text[] NOT NULL,
	"triggered_by" text[] DEFAULT '{}'::text[] NOT NULL,
	"conversions_available" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recommended_supports" text[] DEFAULT '{}'::text[] NOT NULL,
	"relevant_passives" text[] DEFAULT '{}'::text[] NOT NULL,
	"patch_version" text,
	"content_hash" text,
	"raw_ai_output" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "synergy_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game" text NOT NULL,
	"from_entity_id" uuid,
	"to_entity_id" uuid,
	"interaction_type" text,
	"reason" text
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "synergy_edges" ADD CONSTRAINT "synergy_edges_from_entity_id_entities_id_fk" FOREIGN KEY ("from_entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "synergy_edges" ADD CONSTRAINT "synergy_edges_to_entity_id_entities_id_fk" FOREIGN KEY ("to_entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "entities_game_slug_unique" ON "entities" USING btree ("game","entity_slug");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "synergy_edges_pair_unique" ON "synergy_edges" USING btree ("from_entity_id","to_entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "edges_from_idx" ON "synergy_edges" USING btree ("from_entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "edges_to_idx" ON "synergy_edges" USING btree ("to_entity_id");