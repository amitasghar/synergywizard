import React, { useEffect, useMemo, useState } from "react";
import logoSrc from "./assets/banner-90s.webp";
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
    <div className="max-w-[1100px] mx-auto px-4 py-4 sm:py-6 flex flex-col gap-4">
      <p className="font-pixel text-[14px] leading-[1.6] text-center text-white m-0" style={{ textShadow: "2px 2px 0 #000" }}>
        <a
          href="https://90sgamer.com"
          className="text-white no-underline hover:underline"
          onClick={() => track("outbound_click", { site: "90sgamer", id: "header" })}
        >
          90sGamer.com
        </a>{" "}
        presents
      </p>

      <header className="window">
        <div className="title-bar">
          <div className="title-bar-text">🧙 Synergy Wizard - a 90sGamer.com tool</div>
          <div className="title-bar-controls">
            <button aria-label="Minimize" tabIndex={-1}></button>
            <button aria-label="Maximize" tabIndex={-1}></button>
          </div>
        </div>
        <div className="window-body">
          <h1
            className="m-0 bg-[#050f3a] overflow-hidden"
            style={{ boxShadow: "inset -1px -1px #fff, inset 1px 1px grey, inset -2px -2px #dfdfdf, inset 2px 2px #0a0a0a", padding: 2 }}
          >
            <img src={logoSrc} alt="Synergy Wizard - PoE2 Skill Finder" width={2100} height={420} className="block w-full h-auto" />
          </h1>
          <p className="font-prose text-[15px] leading-[1.6] mt-2 mb-0">Search every Path of Exile 2 skill, support and passive by what it does.</p>
          {dataset && (
            <p className="mt-1 mb-0 text-xs text-[#555]">
              <span className="tag mr-2" style={{ background: "#ffe600" }}>PATCH {dataset.version}</span>
              Updated {formatDate(dataset.sourceUpdated)} · {dataset.entities.length.toLocaleString()} entries
            </p>
          )}
        </div>
      </header>

      <main className="grid gap-4 md:grid-cols-[250px_minmax(0,1fr)] items-start">
        <section className="window min-w-0">
          <div className="title-bar">
            <div className="title-bar-text">🔎 Search.exe</div>
            <div className="title-bar-controls">
              <button aria-label="Minimize" tabIndex={-1}></button>
              <button aria-label="Maximize" tabIndex={-1}></button>
            </div>
          </div>
          <div className="window-body">
            <label htmlFor="q" className="sr-only">
              Describe what you want
            </label>
            <input
              id="q"
              type="search"
              value={query}
              autoFocus
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Describe what you want, e.g. protect me for a few seconds"
              className="search-input"
            />
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="font-bold text-xs">Try:</span>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => {
                    track("example_click", { example: ex });
                    setQuery(ex);
                  }}
                  className="tap !min-w-0 !h-auto py-1 px-2 text-left"
                >
                  {ex}
                </button>
              ))}
            </div>

            <div className="sunken-panel mt-3 bg-white" style={{ maxHeight: "none", overflow: "visible" }}>
              {results?.hits.map((h) => <ResultCard key={h.entity.id} entity={h.entity} />)}
              {data.status !== "ready" && (
                <p className="px-4 py-8 text-center text-sm font-prose m-0">
                  {data.status === "loading" ? "Loading game data…" : `Couldn't load game data (${data.error})`}
                </p>
              )}
              {results && results.total === 0 && (
                <p className="px-4 py-10 text-center text-sm font-prose m-0">Nothing matches. Try fewer filters or different words.</p>
              )}
              {results && results.total > results.hits.length && (
                <button type="button" onClick={() => setLimit(limit + PAGE)} className="link-btn w-full py-3 border-t border-[#c0c0c0]">
                  Show more ({(results.total - results.hits.length).toLocaleString()} left)
                </button>
              )}
            </div>
          </div>
          <div className="status-bar">
            {data.status === "ready" ? (
              <>
                <p className="status-bar-field">
                  {searching
                    ? `${results!.total.toLocaleString()} match${results!.total === 1 ? "" : "es"}`
                    : `Browsing all ${results!.total.toLocaleString()}`}
                </p>
                {searching && smart && <p className="status-bar-field">{smart}</p>}
                <p className="status-bar-field">Patch {dataset!.version}</p>
              </>
            ) : (
              <p className="status-bar-field">{data.status === "loading" ? "Loading game data…" : "Error"}</p>
            )}
          </div>
        </section>

        <aside className="md:order-first md:sticky md:top-4 md:self-start min-w-0">
          <button type="button" className="md:hidden w-full tap" onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters}>
            Filters{activeCount ? ` (${activeCount})` : ""} {showFilters ? "▲" : "▼"}
          </button>
          <div className={`${showFilters ? "block mt-3" : "hidden"} md:block md:mt-0 window`}>
            <div className="title-bar">
              <div className="title-bar-text">⚙️ Filters</div>
              <div className="title-bar-controls">
                <button aria-label="Minimize" tabIndex={-1}></button>
                <button aria-label="Maximize" tabIndex={-1}></button>
              </div>
            </div>
            <div className="window-body">
              <FilterPanel filters={filters} onToggle={toggle} onClear={() => setFilters(emptyFilters())} />
            </div>
          </div>
        </aside>
      </main>

      <footer className="text-xs text-white flex flex-col items-center gap-1 text-center" style={{ textShadow: "1px 1px 0 #000" }}>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <a className="btn-play" href="https://90sgamer.com" onClick={() => track("outbound_click", { site: "90sgamer", id: "footer_back" })}>
            ◀ Back to 90sGamer.com
          </a>
          <a
            className="text-white underline text-[13px]"
            href="https://90sgamer.com"
            onClick={() => track("outbound_click", { site: "90sgamer", id: "footer_more" })}
          >
            More free games and tools at 90sGamer.com
          </a>
        </div>
        <span>
          Game data from{" "}
          <a className="text-white underline" href="https://repoe-fork.github.io/poe2/">
            RePoE
          </a>
          , refreshed automatically after each patch. Not affiliated with Grinding Gear Games.
        </span>
      </footer>
    </div>
  );
}
