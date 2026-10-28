import { emptyFilters, type Filters } from "./search.ts";

const KEYS: [keyof Filters, string][] = [
  ["kinds", "type"],
  ["effects", "effect"],
  ["damage", "damage"],
  ["weapons", "weapon"],
  ["hide", "hide"],
];

export function readUrl(search: string): { query: string; filters: Filters } {
  const params = new URLSearchParams(search);
  const filters = emptyFilters();
  for (const [field, key] of KEYS) {
    const raw = params.get(key);
    if (raw) (filters as Record<keyof Filters, string[]>)[field] = raw.split(",").filter(Boolean);
  }
  return { query: params.get("q") ?? "", filters };
}

export function writeUrl(query: string, filters: Filters): string {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  for (const [field, key] of KEYS) if (filters[field].length) params.set(key, filters[field].join(","));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
