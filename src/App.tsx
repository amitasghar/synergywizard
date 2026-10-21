import React, { useEffect, useMemo, useState } from "react";
import logoSrc from "./assets/logo-banner.jpg";
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
  const searching = debounced.trim().length > 0;
  const smart =
    modelStatus === "ready" ? "Smart search" : modelStatus === "loading" ? "Loading smart search…" : modelStatus === "error" ? "Keyword search" : "";
  const dataset = data.status === "ready" ? data.index.dataset : null;

  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-ink-700/60 bg-gradient-to-r from-[#000211] via-[#0a1028] to-ink-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-8">
          <h1 className="shrink-0">
            <img
              src={logoSrc}
              alt="Synergy Wizard"
              width={712}
              height={145}
              className="h-[72px] sm:h-[96px] md:h-[112px] w-auto [mask-image:linear-gradient(to_right,black_85%,transparent)]"
            />
          </h1>
          <div className="md:ml-auto md:text-right">
            <p className="text-base sm:text-lg text-text">Search every Path of Exile 2 skill, support and passive by what it does.</p>
            {dataset && (
              <p className="mt-1 text-xs text-muted">
                <span className="inline-block rounded-full border border-gold/40 bg-gold-soft text-gold px-2 py-0.5 mr-2">Patch {dataset.version}</span>
                Updated {formatDate(dataset.sourceUpdated)} · {dataset.entities.length.toLocaleString()} entries
              </p>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-5 grid gap-5 md:gap-8 md:grid-cols-[240px_minmax(0,1fr)]">
        <section className="min-w-0">
          <label htmlFor="q" className="sr-only">
            Describe what you want
          </label>
          <div className="relative">
            <svg aria-hidden="true" viewBox="0 0 20 20" className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-faint">
              <path fill="currentColor" d="M8.5 3a5.5 5.5 0 0 1 4.38 8.83l3.65 3.64-1.06 1.06-3.64-3.65A5.5 5.5 0 1 1 8.5 3Zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
            </svg>
            <input
              id="q"
              type="search"
              value={query}
              autoFocus
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Describe what you want, e.g. protect me for a few seconds"
              className="w-full bg-ink-900 border border-ink-700 focus:border-gold/70 focus:outline-none focus:ring-2 focus:ring-gold/20 rounded-xl pl-12 pr-4 py-3.5 text-base text-text placeholder:text-faint shadow-[0_8px_30px_rgba(0,0,0,0.35)]"
            />
          </div>
          <div className="mt-3 flex items-center gap-2 overflow-x-auto no-scrollbar sm:flex-wrap -mx-4 px-4 sm:mx-0 sm:px-0">
            <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-muted">Try</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => {
                  track("example_click", { example: ex });
                  setQuery(ex);
                }}
                className="shrink-0 text-xs px-3 py-1.5 rounded-full border border-ink-700 bg-ink-900/60 text-muted hover:text-text hover:border-violet/60 transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>

          <div className="mt-5 rounded-xl border border-ink-700/70 bg-ink-900/80 overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.3)]">
            <div className="px-4 py-2.5 text-xs text-muted border-b border-ink-700/70 flex items-center justify-between gap-3">
              {data.status === "ready" ? (
                <>
                  <span>
                    {searching
                      ? `${results!.total.toLocaleString()} match${results!.total === 1 ? "" : "es"}`
                      : `Browsing all ${results!.total.toLocaleString()}`}
                  </span>
                  {searching && smart && (
                    <span className="inline-flex items-center gap-1.5 text-teal">
                      <span className={`w-1.5 h-1.5 rounded-full ${modelStatus === "ready" ? "bg-teal" : "bg-faint animate-pulse"}`} />
                      {smart}
                    </span>
                  )}
                </>
              ) : (
                <span>{data.status === "loading" ? "Loading game data…" : `Couldn't load game data (${data.error})`}</span>
              )}
            </div>
            {results?.hits.map((h) => <ResultCard key={h.entity.id} entity={h.entity} />)}
            {results && results.total === 0 && (
              <p className="px-4 py-10 text-center text-sm text-muted">Nothing matches. Try fewer filters or different words.</p>
            )}
            {results && results.total > results.hits.length && (
              <button
                type="button"
                onClick={() => setLimit(limit + PAGE)}
                className="w-full py-3 text-sm text-gold/90 hover:text-gold hover:bg-ink-850 border-t border-ink-700/70"
              >
                Show more ({(results.total - results.hits.length).toLocaleString()} left)
              </button>
            )}
          </div>
        </section>

        <aside className="md:order-first md:sticky md:top-5 md:self-start">
          <button
            type="button"
            className="md:hidden w-full flex items-center justify-between text-sm text-text bg-ink-900 border border-ink-700 rounded-xl px-4 py-3"
            onClick={() => setShowFilters(!showFilters)}
            aria-expanded={showFilters}
          >
            <span>Filters{activeCount ? ` (${activeCount})` : ""}</span>
            <span className="text-faint">{showFilters ? "Hide" : "Show"}</span>
          </button>
          <div className={`${showFilters ? "block mt-3" : "hidden"} md:block rounded-xl md:rounded-none border md:border-0 border-ink-700 bg-ink-900 md:bg-transparent p-4 md:p-0`}>
            <FilterPanel filters={filters} onToggle={toggle} onClear={() => setFilters(emptyFilters())} />
          </div>
        </aside>
      </main>

      <footer className="border-t border-ink-700/60 text-xs text-faint">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex flex-wrap gap-x-5 gap-y-2">
          <span>
            Game data from{" "}
            <a className="text-muted underline decoration-ink-700 underline-offset-2 hover:text-text" href="https://repoe-fork.github.io/poe2/">
              RePoE
            </a>
            , refreshed automatically after each patch.
          </span>
          <a className="text-muted underline decoration-ink-700 underline-offset-2 hover:text-text" href="https://90sgamer.com">
            More from 90sGamer
          </a>
          <span>Not affiliated with Grinding Gear Games.</span>
        </div>
      </footer>
    </div>
  );
}
