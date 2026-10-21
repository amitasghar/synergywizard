// Turns raw RePoE PoE2 exports into the Entity list the site searches.
import type { Entity, EntityKind } from "../src/data/types.ts";
import { effectsForText } from "../src/data/effects.ts";
import { cleanLines, cleanMarkup, translateStats, type TranslationIndex } from "./text.ts";

export interface RawGem {
  base_item: { display_name: string; id: string; release_state: string };
  gem_type: "active" | "support" | "spirit";
  grants_skills?: string[];
  recommended_supports?: string[];
  requirement_weights?: { strength: number; dexterity: number; intelligence: number };
  support_text?: string;
  is_lineage?: boolean;
  tags?: string[];
}

interface RawStatSet {
  static?: { stat_text?: Record<string, string> };
}

export interface RawSkill {
  active_skill?: { description?: string; display_name?: string; types?: string[] };
  stat_sets?: RawStatSet[];
}

export interface RawNode {
  name: string;
  stats: Record<string, number>;
  is_keystone: boolean;
  is_notable: boolean;
  is_jewel_socket: boolean;
  is_ascendancy_starting_node: boolean;
  reminder_text?: string[];
  ascendancy?: string;
}

export interface RawTree {
  passives: Record<string, RawNode>;
  groups: { passives: { hash: number; connections: (number | { id: number })[] }[] }[];
  roots: number[];
}

export interface RawAscendancy {
  name: string;
  disabled: boolean;
}

export interface RawData {
  gems: Record<string, RawGem>;
  skills: Record<string, RawSkill>;
  tree: RawTree;
  ascendancies: Record<string, RawAscendancy>;
  translations: TranslationIndex;
}

const HIDDEN_NAME = /\[DNT|UNUSED|playtest|^Removed Skill$|^Coming Soon$|^$/i;
const DAMAGE = ["fire", "cold", "lightning", "physical", "chaos"];
const DROP_TAGS = new Set([
  "strength", "dexterity", "intelligence", "grants_active_skill", "support",
  "low_max_level", "exceptional", "awakened", "link", "vaal",
]);
const TAG_RENAMES: Record<string, string> = { area: "aoe", wolf: "werewolf" };
const WEAPONS: [string, RegExp][] = [
  ["bow", /\bbows?\b/],
  ["crossbow", /\bcrossbows?\b/],
  ["quarterstaff", /\bquarterstaff\w*\b/],
  ["spear", /\bspears?\b/],
  ["mace", /\bmaces?\b/],
  ["sword", /\bswords?\b/],
  ["axe", /\baxes?\b/],
  ["dagger", /\bdaggers?\b/],
  ["claw", /\bclaws?\b/],
  ["flail", /\bflails?\b/],
  ["wand", /\bwands?\b/],
  ["staff", /(?<!quarter)\bstaff\b/],
  ["sceptre", /\bsceptres?\b/],
  ["talisman", /\btalismans?\b/],
  ["shield", /(?<!energy )\b(shield|buckler)s?\b(?! wave)/],
  ["unarmed", /\bunarmed\b/],
];

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function weaponsFor(text: string, types: string[]): string[] {
  const lower = text.toLowerCase();
  const out = new Set(WEAPONS.filter(([, re]) => re.test(lower)).map(([w]) => w));
  if (types.includes("RequiresShield")) out.add("shield");
  return [...out];
}

function attributeOf(w: RawGem["requirement_weights"]): Entity["attribute"] {
  if (!w) return undefined;
  const best = Math.max(w.strength, w.dexterity, w.intelligence);
  if (best === 0) return undefined;
  if (best === w.strength) return "str";
  if (best === w.dexterity) return "dex";
  return "int";
}

function unique<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

function gemEntities(data: RawData): Entity[] {
  const nameById = new Map<string, string>();
  for (const [key, gem] of Object.entries(data.gems)) {
    nameById.set(key, gem.base_item.display_name);
    nameById.set(gem.base_item.id, gem.base_item.display_name);
  }

  const byName = new Map<string, Entity>();
  for (const gem of Object.values(data.gems)) {
    const name = gem.base_item.display_name;
    if (gem.base_item.release_state !== "released" || HIDDEN_NAME.test(name)) continue;

    const kind: EntityKind = gem.gem_type === "support" ? "support" : gem.gem_type === "spirit" ? "spirit" : "skill";
    const skills = (gem.grants_skills ?? []).map((k) => data.skills[k]).filter((s): s is RawSkill => !!s);
    const description =
      kind === "support"
        ? gem.support_text ?? ""
        : skills.map((s) => s.active_skill?.description ?? "").find(Boolean) ?? "";
    const stats = unique(
      skills.flatMap((s) => (s.stat_sets ?? []).flatMap((set) => Object.values(set.static?.stat_text ?? {}).flatMap(cleanLines))),
    ).slice(0, 14);
    const types = unique(skills.flatMap((s) => s.active_skill?.types ?? []));
    const tags = unique((gem.tags ?? []).filter((t) => !DROP_TAGS.has(t)).map((t) => TAG_RENAMES[t] ?? t));
    if (gem.is_lineage && !tags.includes("lineage")) tags.push("lineage");
    const text = cleanMarkup(description).replace(/\n+/g, " ");
    if (!text && !stats.length) continue;
    const all = [text, ...stats].join("\n");

    const entity: Entity = {
      id: `${kind}-${slugify(name)}`,
      kind,
      name,
      text,
      stats,
      tags,
      damage: DAMAGE.filter((d) => tags.includes(d)),
      weapons: weaponsFor(all, types),
      effects: effectsForText(all),
      attribute: attributeOf(gem.requirement_weights),
      supports: unique((gem.recommended_supports ?? []).map((id) => nameById.get(id)).filter((n): n is string => !!n && !HIDDEN_NAME.test(n))),
    };
    if (!entity.supports?.length) delete entity.supports;
    if (!entity.attribute) delete entity.attribute;

    // Several gems share a display name (weapon basic attacks, spirit variants); keep the richest.
    const prev = byName.get(entity.id);
    if (!prev || entity.text.length + entity.stats.length > prev.text.length + prev.stats.length) byName.set(entity.id, entity);
  }
  return [...byName.values()];
}

function reachableNodes(tree: RawTree): Set<number> {
  const adj = new Map<number, number[]>();
  const link = (a: number, b: number) => {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a)!.push(b);
  };
  for (const g of tree.groups) {
    for (const p of g.passives) {
      for (const c of p.connections) {
        const to = typeof c === "number" ? c : c.id;
        link(p.hash, to);
        link(to, p.hash);
      }
    }
  }
  const seen = new Set<number>(tree.roots);
  const queue = [...tree.roots];
  while (queue.length) {
    const n = queue.pop()!;
    for (const m of adj.get(n) ?? []) {
      if (!seen.has(m)) {
        seen.add(m);
        queue.push(m);
      }
    }
  }
  return seen;
}

function passiveEntities(data: RawData): Entity[] {
  const reachable = reachableNodes(data.tree);
  const out: Entity[] = [];
  const smallByKey = new Map<string, Entity>();
  const usedIds = new Set<string>();

  for (const [hash, node] of Object.entries(data.tree.passives)) {
    if (!reachable.has(Number(hash))) continue;
    if (node.is_jewel_socket || node.is_ascendancy_starting_node || HIDDEN_NAME.test(node.name)) continue;
    const asc = node.ascendancy ? data.ascendancies[node.ascendancy] : undefined;
    if (node.ascendancy && (!asc || asc.disabled || HIDDEN_NAME.test(asc.name))) continue;

    const stats = translateStats(node.stats, data.translations);
    if (!stats.length) continue;
    const reminder = (node.reminder_text ?? []).flatMap(cleanLines).join(" ");
    const kind: EntityKind = node.is_keystone ? "keystone" : asc ? "ascendancy" : node.is_notable ? "notable" : "passive";
    const all = [node.name, ...stats, reminder].join("\n");

    const entity: Entity = {
      id: "",
      kind,
      name: node.name,
      text: reminder,
      stats,
      tags: [],
      damage: DAMAGE.filter((d) => new RegExp(`\\b${d}\\b`, "i").test(stats.join(" "))),
      weapons: weaponsFor(stats.join("\n"), []),
      effects: effectsForText(all),
    };
    if (asc) {
      entity.ascendancy = asc.name;
      entity.className = node.ascendancy!.replace(/\d+b?$/, "");
    }

    // Small passives repeat all over the tree ("+8 to Strength"); list each distinct one once.
    if (kind === "passive" || (kind === "ascendancy" && !node.is_notable)) {
      const key = `${entity.ascendancy ?? ""}|${node.name}|${stats.join("|")}`;
      const prev = smallByKey.get(key);
      if (prev) {
        prev.count = (prev.count ?? 1) + 1;
        continue;
      }
      smallByKey.set(key, entity);
    }

    let id = `${kind}-${slugify(entity.ascendancy ? `${entity.ascendancy} ${node.name}` : node.name)}`;
    for (let n = 2; usedIds.has(id); n++) id = `${id.replace(/-\d+$/, "")}-${n}`;
    usedIds.add(id);
    entity.id = id;
    out.push(entity);
  }
  return out;
}

const KIND_ORDER: EntityKind[] = ["skill", "spirit", "support", "keystone", "ascendancy", "notable", "passive"];

export function buildEntities(data: RawData): Entity[] {
  const all = [...gemEntities(data), ...passiveEntities(data)];
  return all.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.name.localeCompare(b.name));
}

/** The text each entity is embedded from; also what keyword search scans. */
export function searchText(e: Entity): string {
  return [e.name, e.text, ...e.stats].filter(Boolean).join(". ");
}
