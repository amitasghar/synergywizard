CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS entities (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game                  TEXT NOT NULL,
    entity_type           TEXT NOT NULL,
    entity_slug           TEXT NOT NULL,
    display_name          TEXT NOT NULL,
    description           TEXT,
    class_tags            TEXT[] NOT NULL DEFAULT '{}',
    mechanic_tags         TEXT[] NOT NULL DEFAULT '{}',
    damage_tags           TEXT[] NOT NULL DEFAULT '{}',
    creates               TEXT[] NOT NULL DEFAULT '{}',
    triggered_by          TEXT[] NOT NULL DEFAULT '{}',
    conversions_available JSONB NOT NULL DEFAULT '[]'::jsonb,
    recommended_supports  TEXT[] NOT NULL DEFAULT '{}',
    relevant_passives     TEXT[] NOT NULL DEFAULT '{}',
    patch_version         TEXT,
    content_hash          TEXT,
    raw_ai_output         JSONB,
    UNIQUE(game, entity_slug)
);

CREATE TABLE IF NOT EXISTS synergy_edges (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game             TEXT NOT NULL,
    from_entity_id   UUID REFERENCES entities(id) ON DELETE CASCADE,
    to_entity_id     UUID REFERENCES entities(id) ON DELETE CASCADE,
    interaction_type TEXT,
    reason           TEXT,
    UNIQUE(from_entity_id, to_entity_id)
);

CREATE INDEX IF NOT EXISTS entities_mechanic_tags_idx ON entities USING GIN(mechanic_tags);
CREATE INDEX IF NOT EXISTS entities_damage_tags_idx   ON entities USING GIN(damage_tags);
CREATE INDEX IF NOT EXISTS entities_class_tags_idx    ON entities USING GIN(class_tags);
CREATE INDEX IF NOT EXISTS entities_tsv_idx           ON entities USING GIN(
    to_tsvector('english', display_name || ' ' || coalesce(description,''))
);
CREATE INDEX IF NOT EXISTS entities_name_trgm_idx     ON entities USING GIN(display_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS edges_from_idx             ON synergy_edges(from_entity_id);
CREATE INDEX IF NOT EXISTS edges_to_idx               ON synergy_edges(to_entity_id);
