// Rebuilds public/data/poe2.json + poe2.vec from the RePoE PoE2 export.
// Usage: node datagen/cli.ts [--force]
// Exits 0 without writing anything when RePoE still serves the version we built.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Dataset } from "../src/data/types.ts";
import { buildEntities, searchText, type RawData } from "./build.ts";
import { DIMS, embedAll } from "./embed.ts";
import { buildTranslationIndex, type Translation } from "./text.ts";

const BASE = "https://repoe-fork.github.io/poe2";
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "data");
const JSON_PATH = join(OUT_DIR, "poe2.json");
const VEC_PATH = join(OUT_DIR, "poe2.vec");

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/${path}`);
  if (!res.ok) throw new Error(`GET ${path}: ${res.status}`);
  return (await res.json()) as T;
}

async function sourceVersion(): Promise<{ version: string; updated: string }> {
  const index = await fetch(`${BASE}/`);
  const html = await index.text();
  const version = html.match(/version\s+([\d.]+)/i)?.[1];
  if (!version) throw new Error("Could not read the PoE2 version from the RePoE index page");
  const head = await fetch(`${BASE}/skill_gems.min.json`, { method: "HEAD" });
  const updated = new Date(head.headers.get("last-modified") ?? Date.now()).toISOString();
  return { version, updated };
}

async function main(): Promise<void> {
  const force = process.argv.includes("--force");
  const { version, updated } = await sourceVersion();
  const current = existsSync(JSON_PATH) ? (JSON.parse(readFileSync(JSON_PATH, "utf8")) as Dataset) : null;
  console.log(`Checking PoE2 ${version} (RePoE updated ${updated})`);

  const [gems, skills, tree, ascendancies, passiveTr, generalTr] = await Promise.all([
    getJson<RawData["gems"]>("skill_gems.min.json"),
    getJson<RawData["skills"]>("skills.min.json"),
    getJson<RawData["tree"]>("passive_skill_trees/Default.min.json"),
    getJson<RawData["ascendancies"]>("ascendancies.min.json"),
    getJson<Translation[]>("stat_translations/passive_skill_stat_descriptions.min.json"),
    getJson<Translation[]>("stat_translations/stat_descriptions.min.json"),
  ]);
  const entities = buildEntities({
    gems,
    skills,
    tree,
    ascendancies,
    translations: buildTranslationIndex(passiveTr, generalTr),
  });
  // RePoE's mirrors disagree on Last-Modified, so compare the content itself.
  if (!force && current && current.version === version && JSON.stringify(current.entities) === JSON.stringify(entities)) {
    console.log(`Up to date: PoE2 ${version}, no content changes`);
    return;
  }
  const counts: Record<string, number> = {};
  for (const e of entities) counts[e.kind] = (counts[e.kind] ?? 0) + 1;
  console.log(`${entities.length} entities`, counts);

  const vectors = await embedAll(entities.map(searchText), (n) => {
    if (n % 640 === 0 || n === entities.length) console.log(`embedded ${n}/${entities.length}`);
  });

  const dataset: Dataset = { game: "poe2", version, sourceUpdated: updated, builtAt: new Date().toISOString(), dims: DIMS, entities };
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(JSON_PATH, JSON.stringify(dataset));
  writeFileSync(VEC_PATH, vectors);
  console.log(`Wrote ${JSON_PATH} and ${VEC_PATH}`);

  const out = process.env.GITHUB_OUTPUT;
  if (out) writeFileSync(out, `changed=true\nversion=${version}\n`, { flag: "a" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
