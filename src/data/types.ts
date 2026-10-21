export type EntityKind = "skill" | "spirit" | "support" | "notable" | "keystone" | "ascendancy" | "passive";

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
}

export interface Dataset {
  game: "poe2";
  version: string;
  sourceUpdated: string;
  builtAt: string;
  dims: number;
  entities: Entity[];
}
