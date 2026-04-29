import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";

const env = Object.fromEntries(
  readFileSync(".env", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const idx = l.indexOf("="); return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()]; })
);

const sql = neon(env.NETLIFY_DATABASE_URL);

const counts = await sql`SELECT game, entity_type, count(*) FROM entities GROUP BY game, entity_type ORDER BY game, entity_type`;
console.log("Entity counts by game/type:", counts);

const sample = await sql`SELECT entity_type, display_name, mechanic_tags, damage_tags, class_tags FROM entities WHERE game='poe2' ORDER BY entity_type, display_name LIMIT 6`;
console.log("Sample rows:", JSON.stringify(sample, null, 2));
