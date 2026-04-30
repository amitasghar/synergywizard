import React, { useMemo } from "react";
import { useD4Store } from "../../state/d4Store.ts";
import { InteractionList } from "../InteractionList.tsx";

interface D4AnalysisPanelProps {
  className?: string;
}

export function D4AnalysisPanel({ className = "" }: D4AnalysisPanelProps): React.ReactElement | null {
  const analysis = useD4Store((s) => s.analysisResult);
  const baseline = useD4Store((s) => s.baselineAnalysis);

  const highlightNew = useMemo(() => {
    if (!analysis || !baseline || analysis === baseline) return new Set<string>();
    const baseKeys = new Set(baseline.direct_interactions.map((e) => `${e.from_entity_id}->${e.to_entity_id}`));
    return new Set(
      analysis.direct_interactions
        .map((e) => `${e.from_entity_id}->${e.to_entity_id}`)
        .filter((k) => !baseKeys.has(k)),
    );
  }, [analysis, baseline]);

  if (!analysis) {
    return (
      <section className={`flex-1 p-4 text-white/40 italic ${className}`}>
        Select 2+ entities and hit Analyze.
      </section>
    );
  }

  return (
    <section className={`flex-1 p-4 overflow-y-auto space-y-4 ${className}`}>
      <InteractionList analysis={analysis} highlightNew={highlightNew} />

      {analysis.recommended_supports.length > 0 && (
        <div>
          <h3 className="text-accent font-semibold mb-1">✨ Recommended Aspects</h3>
          <ul className="space-y-0.5">
            {analysis.recommended_supports.map((name) => (
              <li key={name} className="text-sm text-white/60">{name}</li>
            ))}
          </ul>
        </div>
      )}

      {analysis.relevant_passives.length > 0 && (
        <div>
          <h3 className="text-accent font-semibold mb-1">🌿 Relevant Passives</h3>
          <ul className="space-y-0.5">
            {analysis.relevant_passives.map((name) => (
              <li key={name} className="text-sm text-white/60">{name}</li>
            ))}
          </ul>
        </div>
      )}

      {analysis.damage_tags.length > 0 && (
        <div>
          <h3 className="text-accent font-semibold mb-1">⚡ Build Damage Tags</h3>
          <div className="flex flex-wrap gap-1.5">
            {analysis.damage_tags.map((tag) => (
              <span key={tag} className="px-2 py-0.5 rounded text-[11px] border border-white/15 text-white/50">{tag}</span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
