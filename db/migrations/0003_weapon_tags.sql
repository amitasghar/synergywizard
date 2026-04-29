ALTER TABLE entities ADD COLUMN IF NOT EXISTS weapon_tags TEXT[] DEFAULT '{}' NOT NULL;
CREATE INDEX IF NOT EXISTS entities_weapon_tags_idx ON entities USING GIN (weapon_tags);
