// Prints the top results for a set of real player questions, so ranking
// changes can be eyeballed. Usage: node datagen/eval.ts ["custom query"]
import { readFileSync } from "node:fs";
import { pipeline } from "@xenova/transformers";
import type { Dataset } from "../src/data/types.ts";
import { buildIndex, emptyFilters, search } from "../src/search/search.ts";
import { MODEL } from "./embed.ts";

const QUERIES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      "is there a skill i can add that will protect me for a few seconds",
      "heal myself quickly",
      "get away from enemies fast",
      "freeze enemies in place",
      "make my minions tankier",
      "automatically cast spells when I get hit",
      "fire damage over time",
      "Raise Shield",
    ];

const dataset = JSON.parse(readFileSync("public/data/poe2.json", "utf8")) as Dataset;
const buf = readFileSync("public/data/poe2.vec");
const vectors = new Int8Array(buf.buffer, buf.byteOffset, buf.byteLength);
const index = buildIndex(dataset, vectors);
const extract = (await pipeline("feature-extraction", MODEL)) as unknown as (
  t: string,
  o: object,
) => Promise<{ data: Float32Array }>;

for (const q of QUERIES) {
  const { data } = await extract(q, { pooling: "mean", normalize: true });
  const { hits } = search(index, { query: q, filters: emptyFilters(), queryVector: data, limit: 10 });
  console.log(`\n» ${q}`);
  for (const h of hits) console.log(`  ${h.score.toFixed(2)}  [${h.entity.kind}] ${h.entity.name}  {${h.entity.effects.join(",")}}`);
}
