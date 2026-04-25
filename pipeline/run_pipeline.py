"""End-to-end pipeline orchestration invoked by GitHub Actions."""

from __future__ import annotations

import json
import os
import sys

from pipeline import blobs_backup, db_writer, embedder, hasher, indexer, patch_detector, scraper_poe2


def fetch_db_hashes(conn) -> dict[str, str]:
    with conn.cursor() as cur:
        cur.execute("SELECT entity_slug, content_hash FROM entities WHERE game = 'poe2';")
        rows = cur.fetchall()
    return {slug: h for slug, h in rows if h}


def main() -> int:
    # 1. Detect
    detection = patch_detector.detect()
    if not detection.changed:
        print("NO_CHANGE - skipping scrape")
        return 0
    patch_detector.save_state(detection.ggg_version, detection.steam_latest_gid)
    patch_version = detection.ggg_version or "unknown"

    # 2. Scrape
    print(f"Scraping for patch {patch_version}")
    entities = scraper_poe2.scrape_all()
    print(f"Scraped {len(entities)} entities")

    # 3. Backup raw
    ctx = os.environ.get("NETLIFY_BLOBS_CONTEXT")
    if ctx:
        blobs_backup.upload(
            ctx,
            key=f"poe2/raw/{patch_version}.json",
            payload={"patch_version": patch_version, "entities": entities},
        )

    # 4. Diff against DB
    conn = db_writer.connect()
    try:
        db_hashes = fetch_db_hashes(conn)
    finally:
        conn.close()
    changed_slugs = hasher.diff(entities, db_hashes)
    print(f"{len(changed_slugs)} entities changed")

    # 5. Cost guard
    changed_set = set(changed_slugs)
    to_index = [
        e for e in entities
        if e["entity_slug"] in changed_set and e.get("mechanic_tags")
    ]
    # Bypass cost guard on first run OR while still completing initial population
    bulk_mode = len(db_hashes) == 0 or len(to_index) > len(db_hashes)
    if not bulk_mode:
        try:
            indexer.check_cost_guard(to_index)
        except indexer.CostGuardError as exc:
            sys.stderr.write(f"ABORT: {exc}\n")
            return 1
    else:
        print(f"Bulk mode — indexing {len(to_index)} entities ({len(db_hashes)} already in DB)")

    # 6. Index + write incrementally (each entity committed immediately)
    conn = db_writer.connect()
    edges_pending: list[tuple[dict, list]] = []
    try:
        for i, entity in enumerate(to_index, 1):
            try:
                ai = indexer.index_one(entity)
            except Exception as exc:
                sys.stderr.write(f"WARNING: index_one failed for {entity['entity_slug']}: {exc}\n")
                continue
            merged = dict(entity)
            merged["mechanic_tags"] = sorted(set(merged.get("mechanic_tags", [])) | set(ai.get("mechanic_tags", [])))
            merged["damage_tags"] = sorted(set(merged.get("damage_tags", [])) | set(ai.get("damage_tags", [])))
            merged["creates"] = ai.get("creates", [])
            merged["triggered_by"] = ai.get("triggered_by", [])
            merged["recommended_supports"] = ai.get("recommended_supports", [])
            merged["relevant_passives"] = ai.get("relevant_passives", [])
            merged["conversions_available"] = ai.get("conversions_available", [])
            db_writer.upsert_entity(
                conn, merged,
                patch_version=patch_version,
                content_hash_value=hasher.content_hash(merged),
                raw_ai_output=ai,
            )
            conn.commit()
            try:
                vec = embedder.embed_entity(merged)
                db_writer.update_embedding(conn, merged["entity_slug"], vec)
                conn.commit()
            except Exception as exc:
                sys.stderr.write(f"WARNING: embedding failed for {merged['entity_slug']}: {exc}\n")
            edges_pending.append((entity["entity_slug"], ai.get("synergizes_with", [])))
            print(f"[{i}/{len(to_index)}] saved {entity['entity_slug']}")

        # Write edges after all entities are committed
        for slug, edges in edges_pending:
            from_id = db_writer.lookup_id(conn, slug)
            if not from_id:
                continue
            for edge in edges:
                to_id = db_writer.lookup_id(conn, edge["entity_id"])
                if not to_id:
                    continue
                db_writer.upsert_edge(conn, game="poe2", from_id=from_id, to_id=to_id,
                                      interaction_type=edge.get("interaction_type", "direct"),
                                      reason=edge.get("reason", ""))
        conn.commit()
        # Rebuild IVFFlat index after populating embeddings (index trains on actual data)
        try:
            conn.autocommit = True
            with conn.cursor() as cur:
                cur.execute("REINDEX INDEX CONCURRENTLY entities_embedding_idx;")
            conn.autocommit = False
            print("Embedding index rebuilt")
        except Exception as exc:
            conn.autocommit = False
            sys.stderr.write(f"WARNING: index rebuild failed: {exc}\n")
    finally:
        conn.close()

    print("Pipeline complete")
    return 0


if __name__ == "__main__":
    sys.exit(main())
