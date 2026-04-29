import React, { useEffect, useState } from "react";
import { api } from "../api/client.ts";
import { useStore } from "../state/store.ts";
import type { Entity } from "../types.ts";

const PREVIEW_LENGTH = 120;

function cleanDescription(raw: string): string {
  return raw
    .replace(/\[([^\]|]+)\|([^\]]+)\]/g, "$2")
    .replace(/\[([^\]]+)\]/g, "$1")
    .replace(/\{[0-9]+\}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

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

interface ResultRowProps {
  entity: Entity;
  inBuild: boolean;
  onAdd: () => void;
  onDragStart: (e: React.DragEvent) => void;
}

function ResultRow({ entity, inBuild, onAdd, onDragStart }: ResultRowProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const desc = cleanDescription(entity.description ?? "");
  const isLong = desc.length > PREVIEW_LENGTH;
  const preview = isLong && !expanded ? desc.slice(0, PREVIEW_LENGTH).trimEnd() + "…" : desc;

  return (
    <div
      draggable={!inBuild}
      onDragStart={onDragStart}
      className={`px-3 py-2 border-b border-white/5 hover:bg-white/3 group ${inBuild ? "cursor-default" : "cursor-grab"}`}
    >
      {/* Top row: drag handle · name · add button */}
      <div className="flex items-start gap-2">
        <span className="text-white/20 text-sm group-hover:text-white/40 select-none mt-0.5 shrink-0" aria-hidden="true">⠿</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white/90 truncate">{entity.display_name}</div>
          {tagLine(entity)}
          {/* Description */}
          {desc && (
            <div className="mt-1">
              <p className="text-[11px] text-white/45 leading-relaxed">{preview}</p>
              {isLong && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
                  className="text-[10px] text-white/25 hover:text-white/50 mt-0.5"
                >
                  {expanded ? "Show less ▲" : "Show more ▼"}
                </button>
              )}
            </div>
          )}
        </div>
        <div className="shrink-0 mt-0.5">
          {inBuild ? (
            <span className="text-[11px] text-accent/40 whitespace-nowrap">✓ In build</span>
          ) : (
            <button
              type="button"
              onClick={onAdd}
              className="text-[11px] border border-white/15 text-white/50 px-2 py-0.5 rounded hover:border-accent/50 hover:text-accent whitespace-nowrap"
              data-testid="browse-add"
            >
              + Add
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function BrowseTab(): React.ReactElement {
  const [q, setQ]             = useState("");
  const [results, setResults] = useState<Entity[]>([]);
  const filters        = useStore((s) => s.filters);
  const selected       = useStore((s) => s.selectedEntities);
  const insertEntityAt = useStore((s) => s.insertEntityAt);

  const selectedIds = new Set(selected.map((e) => e.id));

  const activeLabels = [
    ...filters.damageTags,
    ...filters.actionTags,
    ...filters.styleTags,
    ...filters.weaponTags,
    ...filters.types,
  ];

  useEffect(() => {
    let cancelled = false;
    const mechanics = [...filters.actionTags, ...filters.styleTags];
    api.search({
      game: "poe2",
      q: q.trim() || undefined,
      damages:   filters.damageTags.length ? filters.damageTags : undefined,
      mechanics: mechanics.length          ? mechanics           : undefined,
      weapons:   filters.weaponTags.length ? filters.weaponTags : undefined,
      types:     filters.types.length      ? filters.types       : undefined,
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
        {results.map((entity) => (
          <ResultRow
            key={entity.id}
            entity={entity}
            inBuild={selectedIds.has(entity.id)}
            onAdd={() => insertEntityAt(entity, selected.length)}
            onDragStart={(e) => {
              e.dataTransfer.setData("application/synergy-entity", JSON.stringify(entity));
              e.dataTransfer.effectAllowed = "copy";
            }}
          />
        ))}
      </div>
    </div>
  );
}
