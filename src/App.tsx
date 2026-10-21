import React, { useEffect, useMemo, useState } from "react";
import bannerSrc from "./assets/banner.jpg";
import { track } from "./api/analytics.ts";
import { useDebouncedValue } from "./hooks/useDebouncedValue.ts";
import { useEmbedder } from "./hooks/useEmbedder.ts";
import { emptyFilters, search, type Filters } from "./search/search.ts";
import { readUrl, writeUrl } from "./search/url.ts";
import { useDataset } from "./search/useDataset.ts";
import { FilterPanel } from "./ui/FilterPanel.tsx";
import { ResultCard } from "./ui/ResultCard.tsx";

const EXAMPLES = [
  "a skill that protects me for a few seconds",
  "heal myself quickly",
  "get away from enemies fast",
  "freeze enemies in place",
  "make my minions tankier",
  "cast spells automatically when I get hit",
];
const PAGE = 40;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function App(): React.ReactElement {
  const initial = useMemo(() => readUrl(window.location.search), []);
  const [query, setQuery] = useState(initial.query);
  const [filters, setFilters] = useState<Filters>(initial.filters);
  const [limit, setLimit] = useState(PAGE);
  const [showFilters, setShowFilters] = useState(false);
  const [queryVector, setQueryVector] = useState<{ q: string; v: number[] } | null>(null);
  const data = useDataset();
  const { status: modelStatus, embed } = useEmbedder();
  const debounced = useDebouncedValue(query, 300);

  useEffect(() => {
    window.history.replaceState(null, "", `${window.location.pathname}${writeUrl(debounced, filters)}`);
    setLimit(PAGE);
  }, [debounced, filters]);

  useEffect(() => {
    const q = debounced.trim();
    if (!q) return;
    track("search", { search_term: q });
    let cancelled = false;
    embed(q)
      .then((v) => !cancelled && setQueryVector({ q, v }))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [debounced, embed]);

  const results = useMemo(() => {
    if (data.status !== "ready") return null;
    const q = debounced.trim();
    const vec = queryVector && queryVector.q === q ? queryVector.v : null;
    return search(data.index, { query: q, filters, queryVector: vec, limit });
  }, [data, debounced, filters, queryVector, limit]);

  function toggle(field: keyof Filters, value: string): void {
    track("filter_use", { group: field, value });
    setFilters((f) => {
      const cur = f[field] as string[];
      return { ...f, [field]: cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value] };
    });
  }

  const activeCount = Object.values(filters).reduce((n, v) => n + v.length, 0);
  const smart = modelStatus === "ready" ? "Smart search on" : modelStatus === "loading" ? "Loading smart search…" : modelStatus === "error" ? "Keyword search only" : "";

  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-white/10">
        <img src={bannerSrc} alt="Synergy Wizard" className="w-full block max-h-40 object-cover" />
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-accent text-xl font-semibold">Synergy Wizard</h1>
          <p className="text-sm text-white/55">Search every Path of Exile 2 skill, support and passive by what it does.</p>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-4 grid gap-6 md:grid-cols-[230px_1fr]">
        <aside className="md:sticky md:top-4 md:self-start">
          <button
            type="button"
            className="md:hidden w-full text-left text-sm border border-white/15 rounded px-3 py-2 mb-3"
            onClick={() => setShowFilters(!showFilters)}
            aria-expanded={showFilters}
          >
            Filters{activeCount ? ` (${activeCount})` : ""} {showFilters ? "▲" : "▼"}
          </button>
          <div className={`${showFilters ? "block" : "hidden"} md:block`}>
            <FilterPanel filters={filters} onToggle={toggle} onClear={() => setFilters(emptyFilters())} />
          </div>
        </aside>

        <section className="min-w-0">
          <label htmlFor="q" className="sr-only">
            Search
          </label>
          <input
            id="q"
            type="search"
            value={query}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Describe what you want, e.g. protect me for a few seconds"
            className="w-full bg-white/5 border border-white/15 focus:border-accent/70 outline-none rounded-lg px-4 py-3 text-base placeholder:text-white/35"
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => {
                  track("example_click", { example: ex });
                  setQuery(ex);
                }}
                className="text-xs px-2 py-1 rounded-full border border-white/10 text-white/55 hover:text-white/85 hover:border-white/30"
              >
                {ex}
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-lg border border-white/10 overflow-hidden">
            <div className="px-4 py-2 text-xs text-white/45 border-b border-white/10 flex flex-wrap gap-x-3 justify-between">
              {data.status === "ready" ? (
                <>
                  <span>
                    {results!.total.toLocaleString()} result{results!.total === 1 ? "" : "s"}
                    {debounced.trim() && smart ? ` · ${smart}` : ""}
                  </span>
                  <span>
                    PoE2 {data.index.dataset.version} · data updated {formatDate(data.index.dataset.sourceUpdated)}
                  </span>
                </>
              ) : (
                <span>{data.status === "loading" ? "Loading game data…" : `Couldn't load game data (${data.error})`}</span>
              )}
            </div>
            {results?.hits.map((h) => <ResultCard key={h.entity.id} entity={h.entity} />)}
            {results && results.total === 0 && (
              <p className="px-4 py-8 text-sm text-white/50">Nothing matches. Try fewer filters or different words.</p>
            )}
            {results && results.total > results.hits.length && (
              <button type="button" onClick={() => setLimit(limit + PAGE)} className="w-full py-3 text-sm text-accent/80 hover:text-accent hover:bg-white/[0.03]">
                Show more ({(results.total - results.hits.length).toLocaleString()} left)
              </button>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 text-xs text-white/40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-wrap gap-x-4 gap-y-1">
          <span>
            Game data from{" "}
            <a className="underline hover:text-white/70" href="https://repoe-fork.github.io/poe2/">
              RePoE
            </a>
            , refreshed automatically after each patch.
          </span>
          <a className="underline hover:text-white/70" href="https://90sgamer.com">
            More from 90sGamer
          </a>
          <span>Not affiliated with Grinding Gear Games.</span>
        </div>
      </footer>
    </div>
  );
}
