// Marks entries that are new or changed since a saved baseline (e.g. the last patch before 1.0),
// so players can see what a big patch added or reworked.
import { createHash } from "node:crypto";
import type { Entity } from "../src/data/types.ts";

export interface Baseline {
  version: string;
  /** Entity id → hash of what a player reads (name, text, stats). */
  hashes: Record<string, string>;
}

export function entityHash(e: Entity): string {
  return createHash("sha1").update(JSON.stringify([e.name, e.text, e.stats])).digest("base64url").slice(0, 10);
}

export function makeBaseline(version: string, entities: Entity[]): Baseline {
  const hashes: Record<string, string> = {};
  for (const e of entities) hashes[e.id] = entityHash(e);
  return { version, hashes };
}

/** Sets `change` on entries that differ from the baseline; clears it on the rest. */
export function markChanges(entities: Entity[], baseline: Baseline): Entity[] {
  return entities.map((e) => {
    const { change: _, ...rest } = e;
    const before = baseline.hashes[e.id];
    if (!before) return { ...rest, change: "new" };
    if (before !== entityHash(rest)) return { ...rest, change: "changed" };
    return rest;
  });
}
