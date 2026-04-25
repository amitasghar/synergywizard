CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE entities ADD COLUMN IF NOT EXISTS embedding vector(384);

CREATE INDEX IF NOT EXISTS entities_embedding_idx
  ON entities USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
