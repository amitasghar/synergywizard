export type EntityKind = "skill" | "spirit" | "support" | "notable" | "keystone" | "ascendancy" | "passive" | "unique";

export interface Entity {
  id: string;
  kind: EntityKind;
  name: string;
  /** Main description, markup stripped. Empty for most passives. */
  text: string;
  /** Stat lines as shown in game, markup stripped. */
  stats: string[];
  /** GGG gem tags (attack, spell, aoe…) minus attribute/meta tags. */
  tags: string[];
  damage: string[];
  weapons: string[];
  /** Effect ids from EFFECTS, derived by rules from the text. */
  effects: string[];
  attribute?: "str" | "dex" | "int";
  ascendancy?: string;
  className?: string;
  /** Number of identical small passives this entry stands for. */
  count?: number;
  /** Recommended support gem names (from game data). */
  supports?: string[];
  /** Uniques: item class ("Body Armour") and base type ("Iron Greaves"). */
  itemClass?: string;
  base?: string;
  /** Wiki page name, when it differs from `name`. */
  page?: string;
  /** New or changed since `Dataset.baseline`. */
  change?: "new" | "changed";
}

export interface Dataset {
  game: "poe2";
  version: string;
  /** Patch the New/Changed badges compare against. */
  baseline?: string;
  sourceUpdated: string;
  builtAt: string;
  dims: number;
  entities: Entity[];
}
