/**
 * Targeted update: push description + weapon_tags from poe2_seed.json to the DB.
 * Does NOT overwrite AI-enriched fields (creates, triggered_by, etc.).
 * Run with: node scripts/push-descriptions.mjs
 */
import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";

const env = Object.fromEntries(
  readFileSync(".env", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const idx = l.indexOf("="); return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()]; })
);

const sql = neon(env.NETLIFY_DATABASE_URL);
const seed = JSON.parse(readFileSync("pipeline/data/poe2_seed.json", "utf8"));
const entities = seed.entities;

let updated = 0;
let skipped = 0;
const BATCH = 50;

for (let i = 0; i < entities.length; i += BATCH) {
  const batch = entities.slice(i, i + BATCH);
  await Promise.all(batch.map(async (e) => {
    const desc = e.description ?? "";
    const weaponTags = e.weapon_tags ?? [];
    const entityType = e.entity_type ?? "passive";
    try {
      await sql`
        UPDATE entities
        SET description = ${desc},
            weapon_tags = ${weaponTags},
            entity_type = ${entityType}
        WHERE game = 'poe2' AND entity_slug = ${e.entity_slug}
      `;
      updated++;
    } catch (err) {
      console.error(`Failed ${e.entity_slug}:`, err.message);
      skipped++;
    }
  }));
  process.stdout.write(`\r${Math.min(i + BATCH, entities.length)}/${entities.length}...`);
}

console.log(`\nDone. Updated: ${updated}, failed: ${skipped}`);
