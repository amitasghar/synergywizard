// Hybrid search over the static dataset, all in the browser:
//   keyword hits + plain-English intent ("protect" → Defensive) + embedding similarity.
import type { Dataset, Entity, EntityKind } from "../data/types.ts";
import { effectsForQuery } from "../data/effects.ts";

export interface Filters {
  kinds: EntityKind[];
  effects: string[];
  damage: string[];
  weapons: string[];
}

export const emptyFilters = (): Filters => ({ kinds: [], effects: [], damage: [], weapons: [] });

export interface SearchIndex {
  dataset: Dataset;
  vectors: Int8Array | null;
  haystacks: string[];
  names: string[];
}

export interface Hit {
  entity: Entity;
  score: number;
}

const STOPWORDS = new Set(
  "a an and any are as at be by can for from give gives how i if in is it me my of on or so that the there this to what when which will with you your get have has do does few some lot lots skill skills gem gems support supports passive passives node nodes".split(
    " ",
  ),
);

const KIND_WORDS: [RegExp, EntityKind[]][] = [
  [/\b(skills?|gems?|spells?|attacks?)\b/, ["skill", "spirit"]],
  [/\bsupports?\b/, ["support"]],
  [/\b(passives?|nodes?|notables?|tree)\b/, ["notable", "keystone", "passive"]],
  [/\bkeystones?\b/, ["keystone"]],
  [/\bascendanc\w*\b/, ["ascendancy"]],
];

export function buildIndex(dataset: Dataset, vectors: Int8Array | null): SearchIndex {
  const haystacks = dataset.entities.map((e) =>
    [e.name, e.text, ...e.stats, ...e.tags, ...e.weapons, e.ascendancy ?? ""].join(" \n ").toLowerCase(),
  );
  return { dataset, vectors, haystacks, names: dataset.entities.map((e) => e.name.toLowerCase()) };
}

export function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9%+']+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** OR within a group, AND across groups. */
export function matchesFilters(e: Entity, f: Filters): boolean {
  if (f.kinds.length && !f.kinds.includes(e.kind)) return false;
  if (f.effects.length && !f.effects.some((x) => e.effects.includes(x))) return false;
  if (f.damage.length && !f.damage.some((x) => e.damage.includes(x))) return false;
  if (f.weapons.length && !f.weapons.some((x) => e.weapons.includes(x))) return false;
  return true;
}

function keywordScore(index: SearchIndex, i: number, tokens: string[], phrase: string): number {
  if (!tokens.length) return 0;
  const name = index.names[i];
  const hay = index.haystacks[i];
  let s = 0;
  for (const t of tokens) {
    if (name.includes(t)) s += 3;
    else if (new RegExp(`\\b${t.replace(/[^a-z0-9]/g, "")}`).test(hay)) s += 1;
  }
  if (phrase.length > 2 && name.includes(phrase)) s += 6;
  if (name === phrase) s += 10;
  return s / (tokens.length * 3);
}

export function cosine(vectors: Int8Array, i: number, dims: number, q: ArrayLike<number>): number {
  let dot = 0;
  const off = i * dims;
  for (let d = 0; d < dims; d++) dot += vectors[off + d] * q[d];
  return dot / 127;
}

export interface SearchOptions {
  query: string;
  filters: Filters;
  /** Normalised query embedding; omit for keyword-only search. */
  queryVector?: ArrayLike<number> | null;
  limit?: number;
}

export function search(index: SearchIndex, { query, filters, queryVector, limit = 60 }: SearchOptions): { hits: Hit[]; total: number } {
  const { entities, dims } = index.dataset;
  const phrase = query.trim().toLowerCase();
  const tokens = tokenize(query);
  const wantEffects = effectsForQuery(query);
  const wantKinds = KIND_WORDS.filter(([re]) => re.test(phrase)).flatMap(([, k]) => k);
  const semantic = !!(queryVector && index.vectors && phrase);

  const hits: Hit[] = [];
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    if (!matchesFilters(e, filters)) continue;
    if (!phrase) {
      hits.push({ entity: e, score: 0 });
      continue;
    }
    const kw = keywordScore(index, i, tokens, phrase);
    const matched = wantEffects.filter((x) => e.effects.includes(x)).length;
    const effectBoost = matched * 0.12 + (wantEffects.length > 1 && matched === wantEffects.length ? 0.1 : 0);
    const kindBoost = wantKinds.length && wantKinds.includes(e.kind) ? 0.08 : 0;
    let score: number;
    if (semantic) {
      score = cosine(index.vectors!, i, dims, queryVector!) + 0.3 * kw + effectBoost + kindBoost;
    } else {
      if (kw === 0 && matched === 0) continue;
      score = kw + effectBoost + kindBoost;
    }
    hits.push({ entity: e, score });
  }
  if (!phrase) return { hits: hits.slice(0, limit), total: hits.length };
  hits.sort((a, b) => b.score - a.score);
  // Similarity is never zero, so without a cutoff every entity would "match".
  const relevant = semantic && hits.length ? hits.filter((h) => h.score >= hits[0].score * 0.75) : hits;
  return { hits: relevant.slice(0, limit), total: relevant.length };
}
