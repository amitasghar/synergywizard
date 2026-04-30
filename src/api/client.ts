import type { AnalysisResult, D4SearchParams, Entity, ExtendResult, SemanticSearchResult } from "../types.ts";

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

export function buildD4SearchUrl(params: D4SearchParams): string {
  const url = new URL("/api/d4-search", window.location.origin);
  if (params.q) url.searchParams.set("q", params.q);
  if (params.damages?.length) url.searchParams.set("damages", params.damages.join(","));
  if (params.mechanics?.length) url.searchParams.set("mechanics", params.mechanics.join(","));
  if (params.classes?.length) url.searchParams.set("classes", params.classes.join(","));
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
  async d4Search(params: D4SearchParams): Promise<Entity[]> {
    return request<Entity[]>(buildD4SearchUrl(params));
  },
  async d4SemanticSearch(vector: number[]): Promise<SemanticSearchResult[]> {
    return request<SemanticSearchResult[]>("/api/d4-semantic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vector }),
    });
  },
  async d4Analyze(body: { entity_ids: string[] }): Promise<AnalysisResult> {
    return request<AnalysisResult>("/api/d4-analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },
};
