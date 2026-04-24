import type { AnalysisResult, Entity, ExtendResult } from "../types.ts";

async function request<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const api = {
  async search(params: { game: "poe2"; q?: string; class?: string; type?: string; tag?: string }): Promise<Entity[]> {
    const url = new URL("/api/search", window.location.origin);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    });
    return request<Entity[]>(url.toString());
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
};
