# Synergy Wizard Pipeline

Daily cron (GitHub Actions) that keeps the Synergy Wizard DB in sync with POE2 patches.

## Entrypoints

| Script | Purpose |
|---|---|
| `patch_detector.py` | Exit 0 = new patch detected; exit 78 = no change |
| `scraper_poe2.py` | Pull wiki.gg + PathOfBuilding data, dump raw JSON to stdout |
| `hasher.py` | Compare content hashes against DB, print slugs of changed entities |
| `indexer.py` | Send changed entities to Claude Sonnet, write JSON output |
| `db_writer.py` | Upsert entities + edges into Netlify DB |
| `blobs_backup.py` | Upload raw JSON to Netlify Blobs, keyed by patch version |

## Environment variables

- `ANTHROPIC_API_KEY`
- `NETLIFY_DATABASE_URL`
- `NETLIFY_BLOBS_CONTEXT` (base64 JSON with siteID + token)
