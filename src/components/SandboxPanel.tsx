import React, { useState } from "react";
import { api } from "../api/client.ts";
import { track } from "../api/analytics.ts";
import { useStore, MAX_TRAY } from "../state/store.ts";
import type { Entity } from "../types.ts";
import { SandboxCard } from "./SandboxCard.tsx";

export function SandboxPanel(): React.ReactElement {
  const selected      = useStore((s) => s.selectedEntities);
  const removeEntity  = useStore((s) => s.removeEntity);
  const moveEntity    = useStore((s) => s.moveEntity);
  const insertEntityAt = useStore((s) => s.insertEntityAt);
  const setAnalysis   = useStore((s) => s.setAnalysis);
  const setBaseline   = useStore((s) => s.setBaseline);
  const setAnalyzing  = useStore((s) => s.setAnalyzing);
  const isAnalyzing   = useStore((s) => s.isAnalyzing);

  const [dragFromIdx, setDragFromIdx] = useState<number | null>(null);
  const [dropTarget,  setDropTarget]  = useState<number | null>(null);

  const slots: (Entity | null)[] = Array.from({ length: MAX_TRAY }, (_, i) => selected[i] ?? null);
  const canAnalyze = selected.length >= 2 && !isAnalyzing;

  async function runAnalyze() {
    setAnalyzing(true);
    try {
      const result = await api.analyze({ game: "poe2", entity_ids: selected.map((e) => e.id) });
      setAnalysis(result);
      setBaseline(result);
      track("analysis_run", { entity_count: selected.length });
    } finally {
      setAnalyzing(false);
    }
  }

  function handleSlotDragOver(e: React.DragEvent, slotIdx: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = dragFromIdx !== null ? "move" : "copy";
    setDropTarget(slotIdx);
  }

  function handleSlotDrop(e: React.DragEvent, slotIdx: number) {
    e.preventDefault();
    setDropTarget(null);

    const idxData    = e.dataTransfer.getData("application/synergy-index");
    const entityData = e.dataTransfer.getData("application/synergy-entity");

    if (idxData !== "") {
      // Reorder within sandbox
      moveEntity(parseInt(idxData, 10), slotIdx);
    } else if (entityData) {
      // Drop from browse panel
      try {
        const entity: Entity = JSON.parse(entityData);
        insertEntityAt(entity, slotIdx);
      } catch { /* ignore malformed data */ }
    }
    setDragFromIdx(null);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-white/10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-accent text-sm font-semibold">Build Sandbox</span>
          <span className="text-white/30 text-xs">{selected.length}/{MAX_TRAY} slots</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {slots.map((entity, slotIdx) => (
            <div
              key={slotIdx}
              onDragOver={(e) => handleSlotDragOver(e, slotIdx)}
              onDragLeave={() => setDropTarget(null)}
              onDrop={(e) => handleSlotDrop(e, slotIdx)}
              className={`min-h-[68px] rounded transition-colors ${
                dropTarget === slotIdx ? "ring-1 ring-accent/60 bg-accent/5" : ""
              }`}
            >
              {entity ? (
                <SandboxCard
                  entity={entity}
                  index={slotIdx}
                  onRemove={removeEntity}
                  onDragStart={(i) => setDragFromIdx(i)}
                />
              ) : (
                <div
                  className="h-full min-h-[68px] border border-dashed border-white/10 rounded flex items-center justify-center text-white/20 text-lg hover:border-white/25 hover:text-white/35 cursor-pointer transition-colors"
                  onClick={() => document.getElementById("browse-search")?.focus()}
                >
                  +
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={runAnalyze}
          disabled={!canAnalyze}
          data-testid="analyze-button"
          className="mt-3 w-full px-3 py-1.5 rounded bg-accent text-background text-sm font-semibold disabled:opacity-40 hover:opacity-90"
        >
          {isAnalyzing ? "Analyzing…" : "Analyze Build →"}
        </button>
      </div>
    </div>
  );
}
