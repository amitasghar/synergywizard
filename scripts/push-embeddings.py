"""Backfill embeddings for all entities that have embedding IS NULL.

Run from the project root:
    python scripts/push-embeddings.py

Reads NETLIFY_DATABASE_URL from .env automatically.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

# Load .env
env_file = Path(__file__).parent.parent / ".env"
if env_file.exists():
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())

sys.path.insert(0, str(Path(__file__).parent.parent))

from pipeline import db_writer, embedder  # noqa: E402


BATCH_COMMIT = 200


def main() -> int:
    conn = db_writer.connect()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT entity_slug, display_name, description, mechanic_tags, damage_tags
                FROM entities
                WHERE game = 'poe2' AND embedding IS NULL
                ORDER BY entity_type, entity_slug
            """)
            rows = cur.fetchall()

        total = len(rows)
        print(f"Found {total} entities without embeddings")
        if total == 0:
            print("Nothing to do.")
            return 0

        ok = 0
        fail = 0
        for i, (slug, name, desc, mechanic_tags, damage_tags) in enumerate(rows, 1):
            entity = {
                "entity_slug": slug,
                "display_name": name or "",
                "description": desc or "",
                "mechanic_tags": mechanic_tags or [],
                "damage_tags": damage_tags or [],
            }
            try:
                vec = embedder.embed_entity(entity)
                db_writer.update_embedding(conn, slug, vec)
                ok += 1
            except Exception as exc:
                print(f"\nWARNING {slug}: {exc}")
                fail += 1
                continue

            if i % BATCH_COMMIT == 0:
                conn.commit()
                pct = i / total * 100
                print(f"\r[{i}/{total}] {pct:.0f}%  committed", end="", flush=True)

        conn.commit()
        print(f"\nDone. Embedded: {ok}, failed: {fail}")
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
