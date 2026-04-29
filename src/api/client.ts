import type { AnalysisResult, Entity, ExtendResult, SemanticSearchResult } from "../types.ts";

async function request<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export interface SearchParams {
  game: "poe2";
  q?: string;
  damages?: string[];
  mechanics?: string[];
  weapons?: string[];
  types?: string[];
}

export function buildSearchUrl(params: SearchParams): string {
  const url = new URL("/api/search", window.location.origin);
  url.searchParams.set("game", params.game);
  if (params.q) url.searchParams.set("q", params.q);
  if (params.damages?.length) url.searchParams.set("damages", params.damages.join(","));
  if (params.mechanics?.length) url.searchParams.set("mechanics", params.mechanics.join(","));
  if (params.weapons?.length) url.searchParams.set("weapons", params.weapons.join(","));
  if (params.types?.length) url.searchParams.set("types", params.types.join(","));
  return url.toString();
}

export const api = {
  async search(params: SearchParams): Promise<Entity[]> {
    return request<Entity[]>(buildSearchUrl(params));
  },
  async analyze(body: { game: "poe2"; entity_ids: string[] }): Promise<AnalysisResult> {
    return request<AnalysisResult>("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },
  async extend(body: { game: "poe2"; mechanic_tags: string[]; exclude_ids: string[] }): Promise<ExtendResult> {
    return request<ExtendResult>("/api/extend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },
  async semanticSearch(vector: number[]): Promise<SemanticSearchResult[]> {
    return request<SemanticSearchResult[]>("/api/semantic-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vector }),
    });
  },
};
