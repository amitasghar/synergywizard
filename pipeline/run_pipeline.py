"""End-to-end pipeline orchestration invoked by GitHub Actions."""

from __future__ import annotations

import json
import os
import sys

from pipeline import blobs_backup, db_writer, hasher, indexer, patch_detector, scraper_poe2


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

    # 5. Cost guard + index (bypass on first run when DB is empty)
    to_index = [e for e in entities if e["entity_slug"] in set(changed_slugs)]
    first_run = len(db_hashes) == 0
    if not first_run:
        try:
            indexer.check_cost_guard(to_index)
        except indexer.CostGuardError as exc:
            sys.stderr.write(f"ABORT: {exc}\n")
            return 1
    else:
        print(f"First run detected — skipping cost guard to index all {len(to_index)} entities")
    indexed = indexer.index_many(to_index)

    # 6. Write
    db_writer.write_all(entities, indexed, patch_version)
    print("Pipeline complete")
    return 0


if __name__ == "__main__":
    sys.exit(main())
