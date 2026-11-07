// Unique items from the Path of Exile 2 Wiki (CC BY-NC-SA 3.0). The game data names every unique
// but not which stats it has; the wiki links the two by hand, so only that part comes from here.
import type { Entity } from "../src/data/types.ts";
import { effectsForText } from "../src/data/effects.ts";
import { slugify } from "./build.ts";

const API = "https://www.poe2wiki.net/api.php";
const USER_AGENT = "SynergyWizard/1.0 (+https://poe2.90sgamer.com; data job runs every 3 hours)";
const PAGE = 500;

export interface WikiUnique {
  page: string;
  name: string;
  class: string;
  implicit?: string | null;
  explicit?: string | null;
  removal?: string | null;
  in_game?: string | null;
}

/** Atlas tablets and Sanctum relics don't go on a character. */
const SKIP_CLASSES = new Set(["Tablet", "Relic"]);
const MAX_LINES = 16;
const DAMAGE = ["fire", "cold", "lightning", "physical", "chaos"];
const WEAPON_CLASSES: [string, RegExp][] = [
  ["bow", /^bow$/],
  ["crossbow", /^crossbow$/],
  ["quarterstaff", /^quarterstaff$/],
  ["spear", /^spear$/],
  ["mace", /mace$/],
  ["sword", /sword$/],
  ["axe", /axe$/],
  ["dagger", /^dagger$/],
  ["claw", /^claw$/],
  ["flail", /^flail$/],
  ["wand", /^wand$/],
  ["staff", /^staff$/],
  ["sceptre", /^sceptre$/],
  ["talisman", /^talisman$/],
  ["shield", /^(shield|buckler)$/],
];

/** Pages through every unique; one or two requests per run. */
export async function fetchWikiUniques(): Promise<WikiUnique[]> {
  const rows: WikiUnique[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const params = new URLSearchParams({
      action: "cargoquery",
      tables: "items",
      fields:
        "items._pageName=page,items.name=name,items.class=class,items.implicit_stat_text=implicit,items.explicit_stat_text=explicit,items.removal_version=removal,items.is_in_game=in_game",
      where: "items.rarity_id='unique'",
      order_by: "items._pageName",
      limit: String(PAGE),
      offset: String(offset),
      format: "json",
    });
    const res = await fetch(`${API}?${params}`, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) throw new Error(`wiki uniques: ${res.status}`);
    const body = (await res.json()) as { cargoquery?: { title: WikiUnique }[]; error?: { info: string } };
    if (!body.cargoquery) throw new Error(`wiki uniques: ${body.error?.info ?? "no cargoquery in response"}`);
    rows.push(...body.cargoquery.map((r) => r.title));
    if (body.cargoquery.length < PAGE) return rows;
    await new Promise((r) => setTimeout(r, 1000));
  }
}

/** Some wiki text is escaped twice ("&amp;lt;"), so decode until nothing changes. */
function decodeEntities(s: string): string {
  for (let prev = ""; prev !== s; ) {
    prev = s;
    s = decodeOnce(s);
  }
  return s;
}

function decodeOnce(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/** Wiki stat text → plain lines. "[[Stat conversion|Converted]]" → "Converted"; <br>, <hr>, table rows → line breaks. */
export function wikiLines(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return decodeEntities(raw)
    .replace(/<\/?(br|hr|tr|th|td)\b[^>]*>/gi, "\n")
    // Real tags start with a letter; "<2 random radius jewel modifiers>" is text and stays.
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, "$1")
    .replace(/'{2,}/g, "")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function uniqueEntities(rows: WikiUnique[]): Entity[] {
  const byId = new Map<string, Entity>();
  for (const row of rows) {
    if (row.removal || row.in_game !== "1" || SKIP_CLASSES.has(row.class)) continue;
    const name = decodeEntities(row.name).trim();
    const stats = [...wikiLines(row.implicit), ...wikiLines(row.explicit)];
    if (!name || !stats.length) continue;
    const text = stats.join("\n");
    const cls = row.class.toLowerCase();
    const entity: Entity = {
      id: `unique-${slugify(name)}`,
      kind: "unique",
      name,
      text: "",
      stats: stats.slice(0, MAX_LINES),
      tags: [cls],
      damage: DAMAGE.filter((d) => new RegExp(`\\b${d}\\b`, "i").test(text)),
      weapons: WEAPON_CLASSES.filter(([, re]) => re.test(cls)).map(([w]) => w),
      effects: effectsForText(`${name}\n${text}`),
      itemClass: row.class,
      page: decodeEntities(row.page),
    };
    // Some uniques have variants (one per base type); keep the first.
    if (!byId.has(entity.id)) byId.set(entity.id, entity);
  }
  return [...byId.values()];
}
