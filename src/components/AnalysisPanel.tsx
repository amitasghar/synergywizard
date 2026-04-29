import React, { useMemo } from "react";
import { useStore } from "../state/store.ts";
import { InteractionList } from "./InteractionList.tsx";
import { ConversionPanel } from "./ConversionPanel.tsx";
import { ExtendPanel } from "./ExtendPanel.tsx";

interface AnalysisPanelProps {
  className?: string;
}

export function AnalysisPanel({ className = "" }: AnalysisPanelProps): React.ReactElement | null {
  const analysis = useStore((s) => s.analysisResult);
  const baseline = useStore((s) => s.baselineAnalysis);

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
        Select at least two entities and hit Analyze.
      </section>
    );
  }

  return (
    <section className={`flex-1 p-4 overflow-y-auto space-y-4 ${className}`}>
      <InteractionList analysis={analysis} highlightNew={highlightNew} />
      <ConversionPanel />
      <ExtendPanel />
    </section>
  );
}
