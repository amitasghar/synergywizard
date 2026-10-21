// Text helpers for RePoE data: strip GGG tooltip markup and turn raw stat ids
// into the lines the game shows.

/** "[Stun|Stunning] [Fire]" → "Stunning Fire" */
export function cleanMarkup(raw: string): string {
  return raw
    .replace(/\[([^\]|]+)\|([^\]]+)\]/g, "$2")
    .replace(/\[([^\]]+)\]/g, "$1")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export function cleanLines(raw: string): string[] {
  return cleanMarkup(raw)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

interface Condition {
  min?: number;
  max?: number;
  negated?: boolean;
}

interface Variant {
  condition: Condition[];
  format: string[];
  index_handlers: string[][];
  string: string;
}

export interface Translation {
  ids: string[];
  English: Variant[];
}

export type TranslationIndex = Map<string, Translation>;

/** Earlier files win, so pass the most specific file first. */
export function buildTranslationIndex(...files: Translation[][]): TranslationIndex {
  const index: TranslationIndex = new Map();
  for (const file of files) {
    for (const tr of file) {
      for (const id of tr.ids) if (!index.has(id)) index.set(id, tr);
    }
  }
  return index;
}

function matches(c: Condition, value: number): boolean {
  const inRange = (c.min === undefined || value >= c.min) && (c.max === undefined || value <= c.max);
  return c.negated ? !inRange : inRange;
}

const DIVISORS: Record<string, number> = {
  divide_by_two_0dp: 2,
  divide_by_three: 3,
  divide_by_four: 4,
  divide_by_five: 5,
  divide_by_six: 6,
  divide_by_ten_0dp: 10,
  divide_by_ten_1dp: 10,
  divide_by_ten_1dp_if_required: 10,
  divide_by_twelve: 12,
  divide_by_fifteen_0dp: 15,
  divide_by_twenty: 20,
  divide_by_twenty_then_double_0dp: 10,
  divide_by_fifty: 50,
  divide_by_one_hundred: 100,
  divide_by_one_hundred_and_negate: -100,
  divide_by_one_hundred_0dp: 100,
  divide_by_one_hundred_1dp: 100,
  divide_by_one_hundred_2dp: 100,
  divide_by_one_hundred_2dp_if_required: 100,
  divide_by_one_thousand: 1000,
  milliseconds_to_seconds: 1000,
  milliseconds_to_seconds_0dp: 1000,
  milliseconds_to_seconds_1dp: 1000,
  milliseconds_to_seconds_2dp: 1000,
  milliseconds_to_seconds_2dp_if_required: 1000,
  deciseconds_to_seconds: 10,
  per_minute_to_per_second: 60,
  per_minute_to_per_second_0dp: 60,
  per_minute_to_per_second_1dp: 60,
  per_minute_to_per_second_2dp: 60,
  per_minute_to_per_second_2dp_if_required: 60,
};

const MULTIPLIERS: Record<string, number> = {
  negate: -1,
  negate_and_double: -2,
  double: 2,
  times_twenty: 20,
  times_one_point_five: 1.5,
  multiply_by_four: 4,
  "30%_of_value": 0.3,
  "60%_of_value": 0.6,
};

function applyHandlers(value: number, handlers: string[]): number {
  let v = value;
  for (const h of handlers) {
    if (h in DIVISORS) v /= DIVISORS[h];
    else if (h in MULTIPLIERS) v *= MULTIPLIERS[h];
    else if (h === "plus_two_hundred") v += 200;
  }
  return v;
}

function formatNumber(v: number): string {
  return String(Math.round(v * 100) / 100);
}

/** Translate a {stat_id: value} map into display lines. Unknown stats are dropped. */
export function translateStats(stats: Record<string, number>, index: TranslationIndex): string[] {
  const used = new Set<string>();
  const out: string[] = [];
  for (const id of Object.keys(stats)) {
    if (used.has(id)) continue;
    const tr = index.get(id);
    if (!tr) continue;
    tr.ids.forEach((i) => used.add(i));
    const values = tr.ids.map((i) => stats[i] ?? 0);
    const variant = tr.English.find((v) => v.condition.every((c, i) => matches(c, values[i])));
    if (!variant) continue;
    let str = variant.string;
    variant.format.forEach((fmt, i) => {
      if (fmt === "ignore") return;
      const n = applyHandlers(values[i], variant.index_handlers[i] ?? []);
      const shown = fmt === "+#" ? (n < 0 ? "-" : "+") + formatNumber(Math.abs(n)) : fmt.replace("#", formatNumber(n));
      str = str.split(`{${i}}`).join(shown);
    });
    out.push(...cleanLines(str));
  }
  return out;
}
