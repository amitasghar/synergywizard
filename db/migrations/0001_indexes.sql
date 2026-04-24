CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS entities_mechanic_tags_idx ON entities USING GIN (mechanic_tags);
CREATE INDEX IF NOT EXISTS entities_damage_tags_idx   ON entities USING GIN (damage_tags);
CREATE INDEX IF NOT EXISTS entities_class_tags_idx    ON entities USING GIN (class_tags);

CREATE INDEX IF NOT EXISTS entities_tsv_idx ON entities USING GIN (
  to_tsvector('english', display_name || ' ' || coalesce(description, ''))
);

CREATE INDEX IF NOT EXISTS entities_name_trgm_idx ON entities USING GIN (display_name gin_trgm_ops);
