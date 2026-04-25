"""Upsert scraped + indexed entities and edges into Netlify DB (Neon Postgres)."""

from __future__ import annotations

import json
import os
import sys

import psycopg2
import psycopg2.extras

from pipeline import hasher


UPSERT_ENTITY_SQL = """
INSERT INTO entities (
    game, entity_type, entity_slug, display_name, description,
    class_tags, mechanic_tags, damage_tags, creates, triggered_by,
    conversions_available, recommended_supports, relevant_passives,
    patch_version, content_hash, raw_ai_output
) VALUES (
    %(game)s, %(entity_type)s, %(entity_slug)s, %(display_name)s, %(description)s,
    %(class_tags)s, %(mechanic_tags)s, %(damage_tags)s, %(creates)s, %(triggered_by)s,
    %(conversions_available)s, %(recommended_supports)s, %(relevant_passives)s,
    %(patch_version)s, %(content_hash)s, %(raw_ai_output)s
)
ON CONFLICT (game, entity_slug) DO UPDATE SET
    entity_type           = EXCLUDED.entity_type,
    display_name          = EXCLUDED.display_name,
    description           = EXCLUDED.description,
    class_tags            = EXCLUDED.class_tags,
    mechanic_tags         = EXCLUDED.mechanic_tags,
    damage_tags           = EXCLUDED.damage_tags,
    creates               = EXCLUDED.creates,
    triggered_by          = EXCLUDED.triggered_by,
    conversions_available = EXCLUDED.conversions_available,
    recommended_supports  = EXCLUDED.recommended_supports,
    relevant_passives     = EXCLUDED.relevant_passives,
    patch_version         = EXCLUDED.patch_version,
    content_hash          = EXCLUDED.content_hash,
    raw_ai_output         = EXCLUDED.raw_ai_output
RETURNING id;
"""

UPSERT_EDGE_SQL = """
INSERT INTO synergy_edges (game, from_entity_id, to_entity_id, interaction_type, reason)
VALUES (%(game)s, %(from_id)s, %(to_id)s, %(interaction_type)s, %(reason)s)
ON CONFLICT (from_entity_id, to_entity_id) DO UPDATE SET
    interaction_type = EXCLUDED.interaction_type,
    reason           = EXCLUDED.reason;
"""

LOOKUP_SQL = "SELECT id FROM entities WHERE game = %s AND entity_slug = %s;"

UPDATE_EMBEDDING_SQL = """
UPDATE entities SET embedding = %s::vector
WHERE game = %s AND entity_slug = %s;
"""


def connect() -> psycopg2.extensions.connection:
    url = os.environ["NETLIFY_DATABASE_URL"]
    return psycopg2.connect(url, sslmode="require")


def upsert_entity(
    conn,
    entity: dict,
    *,
    patch_version: str,
    content_hash_value: str,
    raw_ai_output: dict,
    game: str = "poe2",
) -> str:
    params = {
        "game": game,
        "entity_type": entity["entity_type"],
        "entity_slug": entity["entity_slug"],
        "display_name": entity["display_name"],
        "description": entity.get("description", ""),
        "class_tags": entity.get("class_tags", []),
        "mechanic_tags": entity.get("mechanic_tags", []),
        "damage_tags": entity.get("damage_tags", []),
        "creates": entity.get("creates", []),
        "triggered_by": entity.get("triggered_by", []),
        "conversions_available": json.dumps(entity.get("conversions_available", [])),
        "recommended_supports": entity.get("recommended_supports", []),
        "relevant_passives": entity.get("relevant_passives", []),
        "patch_version": patch_version,
        "content_hash": content_hash_value,
        "raw_ai_output": json.dumps(raw_ai_output),
    }
    with conn.cursor() as cur:
        cur.execute(UPSERT_ENTITY_SQL, params)
        row = cur.fetchone()
    return str(row[0])


def upsert_edge(
    conn,
    *,
    game: str,
    from_id: str,
    to_id: str,
    interaction_type: str,
    reason: str,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            UPSERT_EDGE_SQL,
            {
                "game": game,
                "from_id": from_id,
                "to_id": to_id,
                "interaction_type": interaction_type,
                "reason": reason,
            },
        )


def lookup_id(conn, slug: str, game: str = "poe2") -> str | None:
    with conn.cursor() as cur:
        cur.execute(LOOKUP_SQL, (game, slug))
        row = cur.fetchone()
    return str(row[0]) if row else None


def update_embedding(conn, slug: str, embedding: list[float], game: str = "poe2") -> None:
    vec_str = "[" + ",".join(str(v) for v in embedding) + "]"
    with conn.cursor() as cur:
        cur.execute(UPDATE_EMBEDDING_SQL, (vec_str, game, slug))


def write_all(scraped: list[dict], indexed: list[dict], patch_version: str) -> None:
    indexed_by_slug = {row["entity_slug"]: row for row in indexed}
    conn = connect()
    try:
        for entity in scraped:
            ai = indexed_by_slug.get(entity["entity_slug"], {})
            merged = dict(entity)
            if ai:
                merged["mechanic_tags"] = sorted(set(merged.get("mechanic_tags", [])) | set(ai.get("mechanic_tags", [])))
                merged["damage_tags"] = sorted(set(merged.get("damage_tags", [])) | set(ai.get("damage_tags", [])))
                merged["creates"] = ai.get("creates", [])
                merged["triggered_by"] = ai.get("triggered_by", [])
                merged["recommended_supports"] = ai.get("recommended_supports", [])
                merged["relevant_passives"] = ai.get("relevant_passives", [])
                merged["conversions_available"] = ai.get("conversions_available", [])
            upsert_entity(
                conn,
                merged,
                patch_version=patch_version,
                content_hash_value=hasher.content_hash(merged),
                raw_ai_output=ai,
            )
        conn.commit()

        for ai in indexed:
            from_id = lookup_id(conn, ai["entity_slug"])
            if not from_id:
                continue
            for edge in ai.get("synergizes_with", []):
                to_id = lookup_id(conn, edge["entity_id"])
                if not to_id:
                    continue
                upsert_edge(
                    conn,
                    game="poe2",
                    from_id=from_id,
                    to_id=to_id,
                    interaction_type=edge.get("interaction_type", "direct"),
                    reason=edge.get("reason", ""),
                )
        conn.commit()
    finally:
        conn.close()


def main() -> int:
    payload = json.loads(sys.stdin.read())
    write_all(
        scraped=payload["entities"],
        indexed=payload.get("indexed", []),
        patch_version=payload.get("patch_version", "unknown"),
    )
    print(f"Wrote {len(payload['entities'])} entities / {len(payload.get('indexed', []))} indexed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
