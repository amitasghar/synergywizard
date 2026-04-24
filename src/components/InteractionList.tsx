import React from "react";
import type { AnalysisResult, SynergyEdge } from "../types.ts";

export interface InteractionListProps {
  analysis: AnalysisResult;
  highlightNew: Set<string>;
}

function edgeKey(e: SynergyEdge): string {
  return `${e.from_entity_id}->${e.to_entity_id}`;
}

function nameFor(analysis: AnalysisResult, id: string | null | undefined): string {
  if (!id) return "?";
  return analysis.entities.find((e) => e.id === id)?.display_name ?? id;
}

export function InteractionList({ analysis, highlightNew }: InteractionListProps): React.ReactElement {
  return (
    <div className="space-y-3">
      <section>
        <h3 className="text-accent font-semibold mb-1">
          ✅ Direct Interactions ({analysis.direct_interactions.length})
          {analysis.loop_detected && (
            <span className="ml-2 inline-block w-2 h-2 rounded-full bg-accent animate-pulseRing" aria-label="Loop detected" />
          )}
        </h3>
        <ul className="space-y-1" data-testid="direct-interactions">
          {analysis.direct_interactions.map((e) => (
            <li
              key={edgeKey(e)}
              className={`p-2 rounded border ${highlightNew.has(edgeKey(e)) ? "border-accent shadow-amberGlow" : "border-white/10"}`}
            >
              <span className="text-accent">{nameFor(analysis, e.from_entity_id)}</span>
              <span className="text-white/40"> ↔ </span>
              <span className="text-accent">{nameFor(analysis, e.to_entity_id)}</span>
              <div className="text-xs text-white/60">{e.reason}</div>
            </li>
          ))}
          {analysis.direct_interactions.length === 0 && (
            <li className="text-sm text-white/40 italic">No direct interactions found.</li>
          )}
        </ul>
      </section>
      <section>
        <h3 className="text-accent font-semibold mb-1">🔗 Extended Interactions ({analysis.extended_interactions.length})</h3>
        <ul className="space-y-1">
          {analysis.extended_interactions.map((e) => (
            <li key={edgeKey(e)} className="p-2 rounded border border-white/10">
              <span>{nameFor(analysis, e.from_entity_id)}</span>
              <span className="text-white/40"> → </span>
              <span>{nameFor(analysis, e.to_entity_id)}</span>
              <div className="text-xs text-white/60">{e.reason}</div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
