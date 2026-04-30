import React, { useEffect, useState } from "react";
import { api } from "../../api/client.ts";
import { useD4Store } from "../../state/d4Store.ts";
import type { Entity } from "../../types.ts";

const PREVIEW_LENGTH = 120;

function cleanDescription(raw: string): string {
  return raw.replace(/\{[^}]+\}/g, "").replace(/\s+/g, " ").trim();
}

const TYPE_COLORS: Record<string, string> = {
  skill:   "bg-[#3d0e0e] text-[#e74c3c]",
  passive: "bg-white/5 text-white/40",
  aspect:  "bg-[#1a0d1a] text-[#c39bd3]",
};

function TypeBadge({ type }: { type: string }): React.ReactElement {
  const cls = TYPE_COLORS[type] ?? TYPE_COLORS.passive;
  return (
    <span className={`inline-block px-1.5 py-0 rounded text-[9px] font-semibold uppercase tracking-wide ${cls} mr-1.5`}>
      {type}
    </span>
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
      <div className="flex items-start gap-2">
        <span className="text-white/20 text-sm group-hover:text-white/40 select-none mt-0.5 shrink-0" aria-hidden="true">⠿</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white/90 truncate">
            <TypeBadge type={entity.entity_type} />
            {entity.display_name}
          </div>
          <div className="text-[10px] text-white/35 flex flex-wrap gap-x-1 mt-0.5">
            {entity.class_tags.map((t) => (
              <span key={t} className="text-accent/60">{t}</span>
            ))}
            {entity.damage_tags.map((t, i) => (
              <React.Fragment key={`d-${t}`}>
                {(entity.class_tags.length > 0 || i > 0) && <span className="text-white/20">·</span>}
                <span className="text-[#e8735a]">{t}</span>
              </React.Fragment>
            ))}
            {entity.mechanic_tags.slice(0, 3).map((t) => (
              <React.Fragment key={`m-${t}`}>
                <span className="text-white/20">·</span>
                <span>{t}</span>
              </React.Fragment>
            ))}
          </div>
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
            >
              + Add
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function D4BrowseTab(): React.ReactElement {
  const [q, setQ]             = useState("");
  const [results, setResults] = useState<Entity[]>([]);
  const filters        = useD4Store((s) => s.filters);
  const selected       = useD4Store((s) => s.selectedEntities);
  const insertEntityAt = useD4Store((s) => s.insertEntityAt);

  const selectedIds = new Set(selected.map((e) => e.id));
  const activeLabels = [...filters.classTags, ...filters.damageTags, ...filters.mechanicTags, ...filters.types];

  useEffect(() => {
    let cancelled = false;
    api.d4Search({
      q: q.trim() || undefined,
      damages:   filters.damageTags.length  ? filters.damageTags  : undefined,
      mechanics: filters.mechanicTags.length ? filters.mechanicTags : undefined,
      classes:   filters.classTags.length   ? filters.classTags   : undefined,
      types:     filters.types.length       ? filters.types       : undefined,
    }).then((rows) => {
      if (!cancelled) setResults(rows);
    }).catch(() => {
      if (!cancelled) setResults([]);
    });
    return () => { cancelled = true; };
  }, [q, filters]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 border-b border-white/10">
        <input
          id="browse-search"
          type="search"
          placeholder="Search D4 skills, aspects…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-accent/50"
          aria-label="Search D4 entities"
        />
      </div>
      {activeLabels.length > 0 && (
        <div className="px-3 py-1 text-[10px] text-white/35 border-b border-white/5">
          Showing <span className="text-accent/70">{results.length}</span> results matching:{" "}
          {activeLabels.join(", ")}
        </div>
      )}
      <div className="flex-1 overflow-y-auto">
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
