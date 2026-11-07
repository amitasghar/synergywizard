import React, { useEffect, useMemo, useState } from "react";
import logoSrc from "./assets/banner-90s.webp";
import { adConfig } from "./ads/config.ts";
import { getConsent, track } from "./api/analytics.ts";
import { useDebouncedValue } from "./hooks/useDebouncedValue.ts";
import { useEmbedder } from "./hooks/useEmbedder.ts";
import { emptyFilters, parseQuery, search, type Filters } from "./search/search.ts";
import { readUrl, writeUrl } from "./search/url.ts";
import { useDataset } from "./search/useDataset.ts";
import { AdSlot } from "./ui/AdSlot.tsx";
import { ConsentBar } from "./ui/ConsentBar.tsx";
import { FilterPanel } from "./ui/FilterPanel.tsx";
import { ResultCard } from "./ui/ResultCard.tsx";
import { ListPanel } from "./ui/ListPanel.tsx";
import { readSharedList, useSaved } from "./saved/saved.ts";

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
  const [browse, setBrowse] = useState(false);
  const shared = useMemo(() => readSharedList(window.location.search), []);
  const [view, setView] = useState<"search" | "mine" | "shared">(shared ? "shared" : "search");
  const saved = useSaved();
  const [consentOpen, setConsentOpen] = useState(() => getConsent() === null);
  const [queryVector, setQueryVector] = useState<{ q: string; v: number[] } | null>(null);
  const data = useDataset();
  const { status: modelStatus, embed } = useEmbedder();
  const debounced = useDebouncedValue(query, 300);

  useEffect(() => {
    window.history.replaceState(null, "", `${window.location.pathname}${writeUrl(debounced, filters)}`);
    setLimit(PAGE);
  }, [debounced, filters]);

  // `-word` exclusions filter results; they stay out of the embedding.
  const meaning = useMemo(() => parseQuery(debounced).text, [debounced]);

  useEffect(() => {
    const raw = debounced.trim();
    if (raw) track("search", { search_term: raw });
    const q = meaning;
    if (!q) return;
    let cancelled = false;
    embed(q)
      .then((v) => !cancelled && setQueryVector({ q, v }))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [debounced, meaning, embed]);

  const results = useMemo(() => {
    if (data.status !== "ready") return null;
    const vec = queryVector && queryVector.q === meaning ? queryVector.v : null;
    return search(data.index, { query: debounced, filters, queryVector: vec, limit });
  }, [data, debounced, meaning, filters, queryVector, limit]);

  function toggle(field: keyof Filters, value: string): void {
    track("filter_use", { group: field, value });
    setFilters((f) => {
      const cur = f[field] as string[];
      return { ...f, [field]: cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value] };
    });
  }

  const activeCount = Object.values(filters).reduce((n, v) => n + v.filter((x: string) => x.trim()).length, 0);
  const searching = debounced.trim().length > 0;
  // First visit: explain the tool instead of an alphabetical list nobody asked for.
  const welcome = data.status === "ready" && !searching && activeCount === 0 && !browse;
  const since = data.status === "ready" && data.index.dataset.entities.some((e) => e.change) ? data.index.dataset.baseline : undefined;
  const smart =
    modelStatus === "ready" ? "Smart search" : modelStatus === "loading" ? "Loading smart search…" : modelStatus === "error" ? "Keyword search" : "";
  const dataset = data.status === "ready" ? data.index.dataset : null;
  const byId = useMemo(() => new Map((dataset?.entities ?? []).map((e) => [e.id, e])), [dataset]);

  useEffect(() => {
    if (shared) track("list_open_shared", { count: shared.length });
  }, [shared]);

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
          <p className="font-prose text-[15px] leading-[1.6] mt-2 mb-0">Search every Path of Exile 2 skill, support, passive and unique by what it does.</p>
          <p className="mt-0.5 mb-0" style={{ fontFamily: "Tahoma, Verdana, sans-serif", fontSize: 12, color: "#555" }}>
            Covers skill gems, spirit gems, supports, passives and unique items.
          </p>
          {dataset && (
            <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs text-[#555]">
              <span>
                <span className="tag mr-2" style={{ background: "#ffe600" }}>PATCH {dataset.version}</span>
                Updated {formatDate(dataset.sourceUpdated)} · {dataset.entities.length.toLocaleString()} entries
              </span>
              <a
                className="ext-btn"
                href="https://90sgamer.com/games/synergy-wizard/#feedback"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track("outbound_click", { site: "feedback", id: "header" })}
              >
                💬 Feedback
              </a>
            </div>
          )}
        </div>
      </header>

      <main className="grid gap-4 md:grid-cols-[250px_minmax(0,1fr)] items-start">
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
              <FilterPanel
                filters={filters}
                onToggle={toggle}
                onHide={(hide) => setFilters((f) => ({ ...f, hide }))}
                onClear={() => setFilters(emptyFilters())}
                since={since}
              />
            </div>
          </div>
        </aside>

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
              onChange={(e) => {
                setQuery(e.target.value);
                setView("search");
              }}
              placeholder="Describe what your build needs…"
              className="search-input"
            />
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="font-bold text-xs">Try:</span>
              {EXAMPLES.map((ex, i) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => {
                    track("example_click", { example: ex });
                    setQuery(ex);
                    setView("search");
                  }}
                  className={`tap !min-w-0 !h-auto py-1 px-2 text-left${i >= 3 ? " max-sm:hidden" : ""}`}
                >
                  {ex}
                </button>
              ))}
            </div>
            <p className="mt-2 mb-0 text-[12px] text-[#333] font-ui">
              <b>Hide what you don't want:</b> put a minus in front of a word, e.g. <code>protect me -minion</code> or{" "}
              <code>-"energy shield"</code>.
            </p>

            <div className="mt-3 flex gap-1" role="tablist" aria-label="Results or saved list">
              {(
                [
                  ["search", "🔎 Results"],
                  ["mine", `☆ My list (${saved.ids.length})`],
                  ...(shared ? [["shared", `🔗 Shared list (${shared.length})`]] : []),
                ] as [typeof view, string][]
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={view === v}
                  className={`tap !min-w-0 !h-auto py-1 px-2 ${view === v ? "font-bold" : ""}`}
                  style={view === v ? { boxShadow: "inset -1px -1px #fff, inset 1px 1px #0a0a0a, inset -2px -2px #dfdfdf, inset 2px 2px grey" } : undefined}
                  onClick={() => setView(v)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="sunken-panel mt-1 bg-white" style={{ maxHeight: "none", overflow: "visible" }}>
              {view !== "search" && dataset && (
                <ListPanel
                  mode={view === "shared" ? "shared" : "mine"}
                  ids={view === "shared" ? shared ?? [] : saved.ids}
                  byId={byId}
                  since={since}
                  isSaved={saved.has}
                  onToggleSave={saved.toggle}
                  onAddAll={(ids) => {
                    saved.add(ids);
                    setView("mine");
                  }}
                  onClear={saved.clear}
                />
              )}
              {view === "search" && welcome && (
                <div className="px-4 py-5 font-prose text-[14px] leading-[1.6]">
                  <p className="mt-0 mb-2 text-[16px] font-bold text-navy">Describe what your build needs, and get the gems, passives and uniques that do it.</p>
                  <ul className="m-0 pl-5 space-y-1">
                    <li>
                      Type it in plain words, like <i>"heal myself quickly"</i> or <i>"unique boots with movement speed"</i>, or tap an example above.
                    </li>
                    <li>Narrow it down with Filters: type, what it does, damage or weapon.</li>
                    <li>
                      Hide what doesn't fit your build with a minus: <code>protect me -minion</code>.
                    </li>
                    <li>Every result links to poe2db and the PoE2 Wiki for the full details.</li>
                  </ul>
                  <button type="button" className="link-btn mt-3 -ml-1" onClick={() => setBrowse(true)}>
                    Or browse all {dataset?.entities.length.toLocaleString()} entries
                  </button>
                </div>
              )}
              {view === "search" && !welcome && results?.hits.flatMap((h, i) => {
                const card = (
                  <ResultCard
                    key={h.entity.id}
                    entity={h.entity}
                    since={dataset?.baseline}
                    saved={saved.has(h.entity.id)}
                    onToggleSave={() => saved.toggle(h.entity.id)}
                  />
                );
                return i === 4 && adConfig?.inlineSlot
                  ? [card, <AdSlot key="ad-inline" slot={adConfig.inlineSlot} config={adConfig} />]
                  : [card];
              })}
              {view === "search" && !welcome && results && results.hits.length > 0 && adConfig?.bottomSlot && (
                <AdSlot key="ad-bottom" slot={adConfig.bottomSlot} config={adConfig} />
              )}
              {data.status !== "ready" && (
                <p className="px-4 py-8 text-center text-sm font-prose m-0">
                  {data.status === "loading" ? "Loading game data…" : `Couldn't load game data (${data.error})`}
                </p>
              )}
              {view === "search" && results && results.total === 0 && (
                <p className="px-4 py-10 text-center text-sm font-prose m-0">Nothing matches. Try fewer filters or different words.</p>
              )}
              {view === "search" && !welcome && results && results.total > results.hits.length && (
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

      </main>

      <footer
        className={`text-xs text-white flex flex-col items-center gap-1 text-center${consentOpen ? " pb-32" : ""}`}
        style={{ textShadow: "1px 1px 0 #000" }}
      >
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
          <a
            className="text-white underline text-[13px]"
            href="https://90sgamer.com/games/synergy-wizard/#feedback"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track("outbound_click", { site: "feedback", id: "footer" })}
          >
            Send feedback
          </a>
        </div>
        <span>
          Game data from{" "}
          <a className="text-white underline" href="https://repoe-fork.github.io/poe2/">
            RePoE
          </a>
          , unique item stats from the{" "}
          <a className="text-white underline" href="https://www.poe2wiki.net/">
            PoE2 Wiki
          </a>{" "}
          (CC BY-NC-SA 3.0), refreshed automatically. Not affiliated with Grinding Gear Games.
        </span>
        <button type="button" className="link-btn" style={{ color: "#fff" }} onClick={() => setConsentOpen(true)}>
          Cookie settings
        </button>
      </footer>
      <ConsentBar open={consentOpen} onClose={() => setConsentOpen(false)} />
    </div>
  );
}
