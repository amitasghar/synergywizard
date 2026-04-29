import React, { useState } from "react";
import { api } from "../api/client.ts";
import { useStore } from "../state/store.ts";
import type { Entity } from "../types.ts";
import type { SemanticSearchResult } from "../types.ts";
import { EntityCard } from "./EntityCard.tsx";

function resultToEntity(r: SemanticSearchResult): Entity {
  return {
    id: r.id,
    entity_slug: r.entity_slug,
    display_name: r.display_name,
    entity_type: r.entity_type,
    mechanic_tags: r.mechanic_tags,
    damage_tags: r.damage_tags,
    class_tags: r.class_tags,
  };
}

export function NaturalSearchBar(): React.ReactElement {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SemanticSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const addEntity = useStore((s) => s.addEntity);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setError("");
    try {
      const hits = await api.semanticSearch(query.trim());
      setResults(hits);
    } catch {
      setError("Search failed. Try again.");
    } finally {
      setSearching(false);
    }
  }

  const placeholder = searching ? "Searching…" : "Ask anything about skills…";

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          data-testid="natural-search-input"
          className="flex-1 bg-white/5 border border-white/20 rounded px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-accent/60"
        />
        <button
          type="submit"
          disabled={searching || !query.trim()}
          data-testid="natural-search-submit"
          className="px-4 py-2 rounded bg-accent text-background text-sm font-medium hover:opacity-90 disabled:opacity-40"
        >
          {searching ? "…" : "Ask"}
        </button>
      </form>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <ul className="flex flex-col gap-1" data-testid="natural-search-results">
        {results.map((r) => (
          <li key={r.entity_slug}>
            <EntityCard
              entity={resultToEntity(r)}
              onAdd={addEntity}
            />
            <span className="text-xs text-white/30 pl-2">
              {(r.similarity * 100).toFixed(0)}% match
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
