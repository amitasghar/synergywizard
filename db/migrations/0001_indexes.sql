CREATE INDEX IF NOT EXISTS entities_mechanic_tags_idx ON entities USING GIN (mechanic_tags);
CREATE INDEX IF NOT EXISTS entities_damage_tags_idx   ON entities USING GIN (damage_tags);
CREATE INDEX IF NOT EXISTS entities_class_tags_idx    ON entities USING GIN (class_tags);

CREATE INDEX IF NOT EXISTS entities_tsv_idx ON entities USING GIN (
  to_tsvector('english', display_name || ' ' || coalesce(description, ''))
);

-- pg_trgm (similarity) is not available on Neon's free tier without superuser;
-- name search uses ILIKE instead, so only a btree index on lower(display_name) is needed.
CREATE INDEX IF NOT EXISTS entities_name_lower_idx ON entities (lower(display_name));
