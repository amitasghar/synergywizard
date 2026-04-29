import React, { useEffect, useState } from "react";
import { api } from "../api/client.ts";
import { useStore } from "../state/store.ts";
import type { Entity } from "../types.ts";

function tagLine(entity: Entity): React.ReactElement {
  const damageParts = entity.damage_tags.map((t) => (
    <span key={`d-${t}`} className="text-[#e8735a]">{t}</span>
  ));
  const mechParts = entity.mechanic_tags.slice(0, 4).map((t) => (
    <span key={`m-${t}`}>{t}</span>
  ));
  const all = [...damageParts, ...mechParts];
  return (
    <div className="text-[10px] text-white/35 flex flex-wrap gap-x-1 mt-0.5">
      {all.map((el, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-white/20">·</span>}
          {el}
        </React.Fragment>
      ))}
    </div>
  );
}

export function BrowseTab(): React.ReactElement {
  const [q, setQ]           = useState("");
  const [results, setResults] = useState<Entity[]>([]);
  const filters   = useStore((s) => s.filters);
  const selected  = useStore((s) => s.selectedEntities);
  const addEntity = useStore((s) => s.insertEntityAt);

  const selectedIds = new Set(selected.map((e) => e.id));

  const mechanics = [...filters.actionTags, ...filters.styleTags];

  // Summary label for active filters
  const activeLabels = [
    ...filters.damageTags,
    ...filters.actionTags,
    ...filters.styleTags,
    ...filters.weaponTags,
    ...filters.types,
  ];

  useEffect(() => {
    let cancelled = false;
    api.search({
      game: "poe2",
      q: q.trim() || undefined,
      damages:   filters.damageTags.length  ? filters.damageTags  : undefined,
      mechanics: mechanics.length           ? mechanics            : undefined,
      weapons:   filters.weaponTags.length  ? filters.weaponTags  : undefined,
      types:     filters.types.length       ? filters.types        : undefined,
    }).then((rows) => {
      if (!cancelled) setResults(rows);
    }).catch(() => {
      if (!cancelled) setResults([]);
    });
    return () => { cancelled = true; };
  }, [q, filters]);

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="p-2 border-b border-white/10">
        <input
          id="browse-search"
          type="search"
          placeholder="Search by name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-accent/50"
          aria-label="Search skills"
          data-testid="browse-search"
        />
      </div>

      {/* Active filter summary */}
      {activeLabels.length > 0 && (
        <div className="px-3 py-1 text-[10px] text-white/35 border-b border-white/5">
          Showing <span className="text-accent/70">{results.length}</span> results matching:{" "}
          {activeLabels.join(", ")}
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto" data-testid="browse-grid">
        {results.map((entity) => {
          const inBuild = selectedIds.has(entity.id);
          return (
            <div
              key={entity.id}
              draggable={!inBuild}
              onDragStart={(e) => {
                e.dataTransfer.setData("application/synergy-entity", JSON.stringify(entity));
                e.dataTransfer.effectAllowed = "copy";
              }}
              className="flex items-center gap-2 px-3 py-2 border-b border-white/5 hover:bg-white/3 cursor-grab group"
            >
              <span className="text-white/20 text-sm group-hover:text-white/40 select-none" aria-hidden="true">⠿</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white/90 truncate">{entity.display_name}</div>
                {tagLine(entity)}
              </div>
              {inBuild ? (
                <span className="text-[11px] text-accent/40 whitespace-nowrap">✓ In build</span>
              ) : (
                <button
                  type="button"
                  onClick={() => addEntity(entity, selected.length)}
                  className="text-[11px] border border-white/15 text-white/50 px-2 py-0.5 rounded hover:border-accent/50 hover:text-accent whitespace-nowrap"
                  data-testid="browse-add"
                >
                  + Add
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
