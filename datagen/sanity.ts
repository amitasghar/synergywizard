// Refuses a rebuild that looks broken (e.g. RePoE changed its format) so bad data never deploys.
import type { Entity } from "../src/data/types.ts";

const MINIMUMS: Record<string, number> = { skill: 200, support: 300, notable: 500, keystone: 15, ascendancy: 100 };
const MAX_DROP = 0.15;

function countKinds(entities: Entity[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of entities) out[e.kind] = (out[e.kind] ?? 0) + 1;
  return out;
}

/** Returns the problems found; empty means the new data looks sane. */
export function checkSanity(previous: Entity[] | null, next: Entity[]): string[] {
  const problems: string[] = [];
  const now = countKinds(next);
  for (const [kind, min] of Object.entries(MINIMUMS)) {
    if ((now[kind] ?? 0) < min) problems.push(`only ${now[kind] ?? 0} ${kind} entries (expected at least ${min})`);
  }
  if (previous) {
    const before = countKinds(previous);
    for (const [kind, n] of Object.entries(before)) {
      if (n > 0 && !now[kind]) problems.push(`no ${kind} entries any more (had ${n})`);
    }
    if (next.length < previous.length * (1 - MAX_DROP)) {
      problems.push(`entry count fell from ${previous.length} to ${next.length} (more than ${MAX_DROP * 100}%)`);
    }
  }
  const empty = next.filter((e) => !e.text && e.stats.length === 0).length;
  if (empty > next.length * 0.05) problems.push(`${empty} entries have no description or stats`);
  return problems;
}
