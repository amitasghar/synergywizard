// "What does it do" categories. The pipeline tags entities by matching `text`
// against the description; the search box maps plain-English queries onto the
// same ids through `query`.
export interface EffectDef {
  id: string;
  label: string;
  text: RegExp;
  query: RegExp;
  /** Phrases removed before testing `text` (e.g. stun *threshold* is not crowd control). Must be global. */
  exclude?: RegExp;
}

export const EFFECTS: EffectDef[] = [
  {
    id: "defense",
    label: "Defensive",
    text: /\b(block|guard|armour|evasion|evade|energy shield|damage taken|immun\w*|invulnerab\w*|cannot be (?:stunned|frozen|ignited|shocked|hit|damaged)|avoid\w*|resistances?|barrier|ward|parry|deflect\w*|less damage|stun threshold|ailment threshold|fortif\w*)\b/,
    query: /\b(protect\w*|defen[cs]\w*|surviv\w*|tank\w*|safe\w*|mitigat\w*|shield\w*|block\w*|guard|immun\w*|invuln\w*|tanky|absorb\w*|damage reduction)\b/,
  },
  {
    id: "temporary",
    label: "Timed effect",
    text: /\b(for \d+(?:\.\d+)? seconds?|for a (?:short )?duration|duration|lasts?|for \d+(?:\.\d+)? second)\b/,
    query: /\b(seconds?|temporar\w*|brief\w*|short(?:ly)?|moment\w*|burst|cooldown|panic|emergency|oh ?shit)\b/,
  },
  {
    id: "recovery",
    label: "Recovery",
    text: /\b(recover\w*|regenerat\w*|leech\w*|recharg\w*|heal\w*|restor\w*|flask)\b/,
    exclude: /\b(?:stun|freeze|chill|ailment|poise) recovery\b/g,
    query: /\b(heal\w*|recover\w*|sustain\w*|regen\w*|leech\w*|life back|refill|restor\w*)\b/,
  },
  {
    id: "movement",
    label: "Movement",
    text: /\b(movement speed|dash\w*|leap\w*|teleport\w*|blink\w*|dodge roll|jump\w*|lunge\w*|travel|charges? (?:at|towards)|flip\w*|vault\w*)\b/,
    query: /\b(move\w*|mobil\w*|fast|faster|speed|escape|dash|gap ?clos\w*|teleport\w*|travel|run|zoom)\b/,
  },
  {
    id: "control",
    label: "Crowd control",
    text: /\b(stun\w*|freez\w*|frozen|slow\w*|knock\w* ?back|hinder\w*|daze\w*|immobili[sz]\w*|pin\w*|maim\w*|taunt\w*|blind\w*|chill\w*|electrocut\w*|pull\w*)\b/,
    exclude:
      /\b(?:(?:stun|freeze|chill|ailment|electrocute) (?:threshold|recovery)|cannot be (?:light |heavy )?(?:stunned|frozen|chilled|slowed|knocked back|pinned)|(?:stun|freeze|slow|chill)\w* (?:on|against) you|you(?: are|'re)? (?:stunned|frozen|chilled|slowed|knocked back|pinned)|avoid being \w+)\b/g,
    query: /\b(stun\w*|freez\w*|slow\w*|control|cc|crowd|knockback|stop enem\w*|lock\w* down|disable\w*|immobili\w*)\b/,
  },
  {
    id: "buff",
    label: "Buff / aura",
    text: /\b(aura|buff|herald|banner|allies|presence|empower\w*|grants? you)\b/,
    query: /\b(buff\w*|aura\w*|empower\w*|allies|party|support (?:my|the) team)\b/,
  },
  {
    id: "debuff",
    label: "Curse / debuff",
    text: /\b(curse\w*|hex\w*|mark\w*|expos\w*|wither\w*|break\w* armour|armour break|vulnerab\w*|weaken\w*|resistances? (?:is|are) reduced|reduce\w* (?:enemy|their) \w*resist\w*)\b/,
    query: /\b(curse\w*|hex\w*|debuff\w*|weaken\w*|exposure|mark\w*|enemies take more)\b/,
  },
  {
    id: "minion",
    label: "Minions",
    text: /\b(minions?|summon\w*|companions?|totems?|djinn)\b/,
    query: /\b(minions?|summon\w*|pets?|companions?|army|totems?|skeleton\w*|zombie\w*)\b/,
  },
  {
    id: "trigger",
    label: "Trigger / automation",
    text: /\b(trigger\w*|invocation|cast on|on kill|when you (?:are hit|block|kill|crit\w*))\b/,
    query: /\b(trigger\w*|automat\w*|auto[- ]?cast\w*|on hit|cast on|proc\w*)\b/,
  },
  {
    id: "ailment",
    label: "Ailments / DoT",
    text: /\b(ignit\w*|shock\w*|poison\w*|bleed\w*|blood ?loss|damage over time|burning|corrupted blood)\b/,
    query: /\b(dot|damage over time|ailment\w*|ignite|poison|bleed\w*|shock|burn\w*)\b/,
  },
  {
    id: "crit",
    label: "Critical hits",
    text: /\bcritical\b/,
    query: /\b(crit\w*|critical)\b/,
  },
];

export const EFFECT_LABEL: Record<string, string> = Object.fromEntries(EFFECTS.map((e) => [e.id, e.label]));

export function effectsForText(text: string): string[] {
  const lower = text.toLowerCase();
  return EFFECTS.filter((e) => e.text.test(e.exclude ? lower.replace(e.exclude, " ") : lower)).map((e) => e.id);
}

export function effectsForQuery(query: string): string[] {
  const lower = query.toLowerCase();
  return EFFECTS.filter((e) => e.query.test(lower)).map((e) => e.id);
}
