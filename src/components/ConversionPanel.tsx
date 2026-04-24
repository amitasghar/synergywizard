import React from "react";
import { api } from "../api/client.ts";
import { track } from "../api/analytics.ts";
import { useStore } from "../state/store.ts";

export function ConversionPanel(): React.ReactElement | null {
  const analysis = useStore((s) => s.analysisResult);
  const baseline = useStore((s) => s.baselineAnalysis);
  const setAnalysis = useStore((s) => s.setAnalysis);
  const setConversion = useStore((s) => s.setConversion);
  const conversion = useStore((s) => s.conversion);

  if (!analysis || analysis.conversion_options.length === 0) return null;

  async function applyConversion(entityId: string, from: string, to: string) {
    const entityIds = analysis!.entities.map((e) => e.id);
    const next = await api.analyze({ game: "poe2", entity_ids: entityIds });
    next.entities = next.entities.map((e) =>
      e.id === entityId
        ? { ...e, damage_tags: e.damage_tags.map((t) => (t === from ? to : t)) }
        : e,
    );
    next.damage_tags = Array.from(new Set(next.damage_tags.map((t) => (t === from ? to : t))));
    setAnalysis(next);
    setConversion({ entityId, from, to });
    track("conversion_applied", { entity_id: entityId, from, to });
  }

  function resetConversion() {
    if (baseline) setAnalysis(baseline);
    setConversion(null);
  }

  return (
    <section className="border border-accent/50 rounded p-3 relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-accent/5"
      />
      <h3 className="text-accent font-semibold mb-2">🔄 Conversion Options</h3>
      <ul className="space-y-2 relative">
        {analysis.conversion_options.map((opt) => (
          <li key={opt.entity_id} className="flex items-center gap-2 flex-wrap">
            <span className="text-accent">{opt.display_name}</span>
            <span className="text-white/60">is:</span>
            {opt.current_tags.map((t) => (
              <span key={`cur-${t}`} className="px-2 py-0.5 rounded bg-tagDamage/80 text-xs">{t}</span>
            ))}
            <span className="text-white/60">→</span>
            {opt.can_convert_to.map((to) => {
              const from = opt.current_tags[0] ?? "fire";
              const active = conversion?.entityId === opt.entity_id && conversion.to === to;
              return (
                <button
                  key={`to-${to}`}
                  type="button"
                  onClick={() => applyConversion(opt.entity_id, from, to)}
                  className={`px-2 py-0.5 rounded text-xs border ${active ? "bg-accent text-background border-accent" : "border-accent/50 text-accent hover:bg-accent/10"}`}
                >
                  {to}
                </button>
              );
            })}
          </li>
        ))}
      </ul>
      {conversion && (
        <button
          type="button"
          onClick={resetConversion}
          className="mt-2 text-xs text-white/60 underline hover:text-white"
        >
          Reset conversion
        </button>
      )}
    </section>
  );
}
