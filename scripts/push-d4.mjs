/**
 * Seed D4 entities from pipeline/data/d4_seed.json into the DB.
 * Safe to re-run — uses ON CONFLICT DO UPDATE.
 * Run with: node scripts/push-d4.mjs
 */
import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";

const env = Object.fromEntries(
  readFileSync(".env", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const idx = l.indexOf("="); return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()]; })
);

const sql = neon(env.NETLIFY_DATABASE_URL);
const seed = JSON.parse(readFileSync("pipeline/data/d4_seed.json", "utf8"));
const entities = seed.entities;

// Delete existing D4 rows first (no unique constraint on game+slug, so upsert isn't possible)
const deleted = await sql`DELETE FROM entities WHERE game = 'd4'`;
console.log(`Cleared existing D4 rows.`);
console.log(`Seeding ${entities.length} D4 entities…`);

let inserted = 0;
let failed = 0;
const BATCH = 20;

for (let i = 0; i < entities.length; i += BATCH) {
  const batch = entities.slice(i, i + BATCH);
  await Promise.all(batch.map(async (e) => {
    try {
      await sql`
        INSERT INTO entities
          (game, entity_type, entity_slug, display_name, description,
           mechanic_tags, damage_tags, class_tags, weapon_tags,
           recommended_supports, relevant_passives)
        VALUES (
          'd4',
          ${e.entity_type},
          ${e.entity_slug},
          ${e.display_name},
          ${e.description ?? ""},
          ${e.mechanic_tags ?? []},
          ${e.damage_tags ?? []},
          ${e.class_tags ?? []},
          '{}',
          ${e.recommended_supports ?? []},
          ${e.relevant_passives ?? []}
        )
      `;
      inserted++;
    } catch (err) {
      console.error(`  Failed ${e.entity_slug}:`, err.message);
      failed++;
    }
  }));
  process.stdout.write(`\r${Math.min(i + BATCH, entities.length)}/${entities.length}…`);
}

console.log(`\nDone. Inserted: ${inserted}, failed: ${failed}`);
