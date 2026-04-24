import { useEffect, useState } from "react";
import { api } from "../api/client.ts";
import { useStore } from "../state/store.ts";
import type { Entity } from "../types.ts";
import { EntityCard } from "./EntityCard.tsx";
import { useDebouncedValue } from "../hooks/useDebouncedValue.ts";

export function SearchTab(): React.ReactElement {
  const [q, setQ] = useState("");
  const debounced = useDebouncedValue(q, 250);
  const [results, setResults] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);
  const addEntity = useStore((s) => s.addEntity);

  useEffect(() => {
    if (!debounced) { setResults([]); return; }
    let cancelled = false;
    setLoading(true);
    api.search({ game: "poe2", q: debounced }).then((rows) => {
      if (!cancelled) setResults(rows);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [debounced]);

  return (
    <div className="flex flex-col gap-2">
      <input
        type="search"
        placeholder="Search skills, supports, passives..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-full bg-background border border-white/15 focus:border-accent/70 rounded px-2 py-1 outline-none"
        aria-label="Search"
      />
      {loading && <div className="text-xs text-white/40">Searching...</div>}
      <div className="flex flex-col gap-1">
        {results.map((r) => (
          <EntityCard key={r.id} entity={r} onAdd={addEntity} />
        ))}
      </div>
    </div>
  );
}
