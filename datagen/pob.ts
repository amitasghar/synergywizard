// Unique items from Path of Building PoE2's own data files (MIT licence) on GitHub. The game data names
// uniques but not their stats; PoB keeps them current for build planning, usually on patch day.
// (RePoE's pob-data/poe2 copy was replaced by PoE1 uniques on 2026-11-11, so we read PoB directly
// and cli.ts also drops anything the PoE2 game files don't list.)
import type { Entity } from "../src/data/types.ts";
import { effectsForText } from "../src/data/effects.ts";
import { slugify } from "./build.ts";

const BASE = "https://raw.githubusercontent.com/PathOfBuildingCommunity/PathOfBuilding-PoE2/dev/src/Data/Uniques";
/** PoB's file per item type → the class players see. Bucklers, quarterstaves, charms and flasks are split by base below. */
const FILES: Record<string, string> = {
  amulet: "Amulet", axe: "Axe", belt: "Belt", body: "Body Armour", boots: "Boots", bow: "Bow", claw: "Claw",
  crossbow: "Crossbow", dagger: "Dagger", flail: "Flail", flask: "Flask", focus: "Focus", gloves: "Gloves",
  helmet: "Helmet", jewel: "Jewel", mace: "Mace", quiver: "Quiver", ring: "Ring", sceptre: "Sceptre",
  shield: "Shield", spear: "Spear", staff: "Staff", sword: "Sword", talisman: "Talisman", wand: "Wand",
};
const MIN_UNIQUES = 300;
const MAX_LINES = 16;
const DAMAGE = ["fire", "cold", "lightning", "physical", "chaos"];
const WEAPON_CLASSES: [string, RegExp][] = [
  ["bow", /^bow$/], ["crossbow", /^crossbow$/], ["quarterstaff", /^quarterstaff$/], ["spear", /^spear$/],
  ["mace", /^mace$/], ["sword", /^sword$/], ["axe", /^axe$/], ["dagger", /^dagger$/], ["claw", /^claw$/],
  ["flail", /^flail$/], ["wand", /^wand$/], ["staff", /^staff$/], ["sceptre", /^sceptre$/],
  ["talisman", /^talisman$/], ["shield", /^(shield|buckler)$/],
];
/** Item header lines, not stats. ("Grants Skill:" is a real implicit and stays.) */
const META = /^(Variant|Version|Implicits|Source|League|Sockets|Has Alt Variant[\w ]*|Selected[\w ]*|Allow Duplicate Variants|Limited to|Radius|Left ring slot|Right ring slot|Crafted|Requires[\w ]*|LevelReq|Item Level|Quality|Corrupted|Mirrored|Unreleased):/;

export interface PobUnique {
  /** PoB file key, e.g. "boots". */
  file: string;
  text: string;
}

/** PoB's Lua files hold one item per `[[ … ]]` block. */
export function luaItemBlocks(lua: string): string[] {
  return [...lua.matchAll(/\[\[\r?\n?([\s\S]*?)\]\]/g)].map((m) => m[1].trim()).filter(Boolean);
}

/** Downloads every unique list; a missing file counts as empty. */
export async function fetchPobUniques(): Promise<PobUnique[]> {
  const lists = await Promise.all(
    Object.keys(FILES).map(async (file) => {
      const res = await fetch(`${BASE}/${file}.lua`);
      if (res.status === 404) return [];
      if (!res.ok) throw new Error(`PoB uniques ${file}: ${res.status}`);
      return luaItemBlocks(await res.text()).map((text) => ({ file, text }));
    }),
  );
  const all = lists.flat();
  if (all.length < MIN_UNIQUES) throw new Error(`PoB uniques: only ${all.length} found`);
  return all;
}

/** "{variant:1,2}{tags:life}+40 to Life" → { variants: [1, 2], text: "+40 to Life" } */
function splitTags(line: string): { variants: number[] | null; versions: number[] | null; text: string } {
  let variants: number[] | null = null;
  let versions: number[] | null = null;
  let text = line;
  for (let m; (m = text.match(/^\{(\w+)(?::([^}]*))?\}/)); text = text.slice(m[0].length)) {
    const nums = (m[2] ?? "").split(",").map(Number).filter((n) => n > 0);
    if (m[1] === "variant") variants = nums;
    if (m[1] === "version") versions = nums;
  }
  return { variants, versions, text: text.trim() };
}

/**
 * PoB item text → name, base and the stat lines that apply today.
 * Variants named "Pre x.y" / "Current" are versions, so only the newest counts; other variants
 * (Mageblood's legacies, Atziri's Splendour's defences) are real alternatives and all stay.
 */
export function parsePobUnique(raw: string): { name: string; base: string; stats: string[] } {
  const lines = raw.split("\n").map((l) => l.trimEnd()).filter(Boolean);
  const name = lines[0]?.trim() ?? "";
  const variantNames = lines.filter((l) => l.startsWith("Variant: ")).map((l) => l.slice(9));
  const versionCount = lines.filter((l) => l.startsWith("Version: ")).length;
  const versioned = variantNames.length > 0 && variantNames.every((v) => /^(Pre |Current)/.test(v));
  const current = variantNames.length;
  const applies = (t: ReturnType<typeof splitTags>) =>
    (!t.variants || !versioned || t.variants.includes(current)) && (!t.versions || t.versions.includes(versionCount));

  // Base type: line 2, or one line per version ("{variant:1}Ironclad Vestments") before the header lines.
  const firstMeta = lines.findIndex((l, i) => i > 0 && META.test(l));
  const baseLines = firstMeta > 1 && lines.slice(1, firstMeta).every((l) => l.startsWith("{")) ? lines.slice(1, firstMeta) : lines.slice(1, 2);
  const base = baseLines.map(splitTags).find(applies)?.text ?? splitTags(baseLines.at(-1) ?? "").text;

  const stats: string[] = [];
  for (const line of lines.slice(1 + baseLines.length)) {
    if (META.test(line)) continue;
    const t = splitTags(line);
    if (t.text && applies(t) && !stats.includes(t.text)) stats.push(t.text);
  }
  return { name, base, stats };
}

function itemClass(file: string, base: string): string {
  if (/Buckler$/.test(base)) return "Buckler";
  if (/Quarterstaff$/.test(base)) return "Quarterstaff";
  if (/Charm$/.test(base)) return "Charm";
  if (/Life Flask$/.test(base)) return "Life Flask";
  if (/Mana Flask$/.test(base)) return "Mana Flask";
  return FILES[file] ?? file;
}

export function pobUniqueEntities(rows: PobUnique[]): Entity[] {
  const byId = new Map<string, Entity>();
  for (const row of rows) {
    const { name, base, stats } = parsePobUnique(row.text);
    if (!name || !stats.length) continue;
    const cls = itemClass(row.file, base);
    const text = stats.join("\n");
    const entity: Entity = {
      id: `unique-${slugify(name)}`,
      kind: "unique",
      name,
      text: "",
      stats: stats.slice(0, MAX_LINES),
      tags: [cls.toLowerCase()],
      damage: DAMAGE.filter((d) => new RegExp(`\\b${d}\\b`, "i").test(text)),
      weapons: WEAPON_CLASSES.filter(([, re]) => re.test(cls.toLowerCase())).map(([w]) => w),
      effects: effectsForText(`${name}\n${text}`),
      itemClass: cls,
      base,
    };
    if (!byId.has(entity.id)) byId.set(entity.id, entity);
  }
  return [...byId.values()];
}

const normName = (s: string) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();

/** Keeps only uniques the PoE2 game files list by name, so a PoE1 item can never slip in. */
export function onlyPoe2(uniques: Entity[], gameNames: string[]): { kept: Entity[]; dropped: string[] } {
  const game = new Set(gameNames.map(normName));
  const kept = uniques.filter((u) => game.has(normName(u.name)));
  const dropped = uniques.filter((u) => !game.has(normName(u.name))).map((u) => u.name);
  return { kept, dropped };
}
