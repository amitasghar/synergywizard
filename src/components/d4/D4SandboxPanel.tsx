import React, { useState } from "react";
import { api } from "../../api/client.ts";
import { useD4Store, D4_MAX_TRAY } from "../../state/d4Store.ts";
import type { Entity } from "../../types.ts";
import { SandboxCard } from "../SandboxCard.tsx";

export function D4SandboxPanel(): React.ReactElement {
  const selected       = useD4Store((s) => s.selectedEntities);
  const removeEntity   = useD4Store((s) => s.removeEntity);
  const moveEntity     = useD4Store((s) => s.moveEntity);
  const insertEntityAt = useD4Store((s) => s.insertEntityAt);
  const setAnalysis    = useD4Store((s) => s.setAnalysis);
  const setBaseline    = useD4Store((s) => s.setBaseline);
  const setAnalyzing   = useD4Store((s) => s.setAnalyzing);
  const isAnalyzing    = useD4Store((s) => s.isAnalyzing);

  const [dropTarget, setDropTarget] = useState<number | null>(null);

  const canAnalyze = selected.length >= 2 && !isAnalyzing;

  async function runAnalyze() {
    setAnalyzing(true);
    try {
      const result = await api.d4Analyze({ entity_ids: selected.map((e) => e.id) });
      setAnalysis(result);
      setBaseline(result);
    } finally {
      setAnalyzing(false);
    }
  }

  function handleSlotDragOver(e: React.DragEvent, slotIdx: number) {
    e.preventDefault();
    const isInternal = e.dataTransfer.types.includes("application/synergy-index");
    e.dataTransfer.dropEffect = isInternal ? "move" : "copy";
    setDropTarget(slotIdx);
  }

  function handleSlotDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDropTarget(null);
    }
  }

  function handleSlotDrop(e: React.DragEvent, slotIdx: number) {
    e.preventDefault();
    setDropTarget(null);
    const rawIndex = e.dataTransfer.getData("application/synergy-index");
    if (rawIndex !== "") {
      moveEntity(parseInt(rawIndex, 10), slotIdx);
      return;
    }
    const raw = e.dataTransfer.getData("application/synergy-entity");
    if (!raw) return;
    try {
      const entity: Entity = JSON.parse(raw);
      insertEntityAt(entity, slotIdx);
    } catch {}
  }

  return (
    <div className="border-b border-white/10 p-3 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/40 uppercase tracking-widest">Build</span>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => useD4Store.getState().clear()}
            className="text-[11px] text-white/25 hover:text-white/50"
          >
            ✕ clear
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {selected.map((entity, slotIdx) => (
          <div
            key={slotIdx}
            onDragOver={(e) => handleSlotDragOver(e, slotIdx)}
            onDragLeave={handleSlotDragLeave}
            onDrop={(e) => handleSlotDrop(e, slotIdx)}
            className={`rounded transition-colors ${dropTarget === slotIdx ? "ring-1 ring-accent/60 bg-accent/5" : ""}`}
          >
            <SandboxCard
              entity={entity}
              index={slotIdx}
              onRemove={() => removeEntity(entity.id)}
              onDragStart={() => {}}
              onDragEnd={() => setDropTarget(null)}
            />
          </div>
        ))}
        {selected.length < D4_MAX_TRAY && (
          <div
            onDragOver={(e) => handleSlotDragOver(e, selected.length)}
            onDragLeave={handleSlotDragLeave}
            onDrop={(e) => handleSlotDrop(e, selected.length)}
            onClick={() => document.getElementById("browse-search")?.focus()}
            className={`min-h-[40px] border border-dashed rounded flex items-center justify-center text-lg cursor-pointer transition-colors ${
              dropTarget === selected.length
                ? "border-accent/60 text-accent/60 bg-accent/5"
                : "border-white/10 text-white/20 hover:border-white/25 hover:text-white/35"
            }`}
          >
            +
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={runAnalyze}
        disabled={!canAnalyze}
        className="w-full py-1.5 rounded bg-accent text-background text-sm font-medium disabled:opacity-30 hover:bg-accent/90 transition-colors"
      >
        {isAnalyzing ? "Analyzing…" : "Analyze Synergies"}
      </button>
    </div>
  );
}
