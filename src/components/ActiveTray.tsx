import { api } from "../api/client.ts";
import { track } from "../api/analytics.ts";
import { useStore } from "../state/store.ts";

export function ActiveTray(): React.ReactElement {
  const selected = useStore((s) => s.selectedEntities);
  const removeEntity = useStore((s) => s.removeEntity);
  const setAnalysis = useStore((s) => s.setAnalysis);
  const setBaseline = useStore((s) => s.setBaseline);
  const setAnalyzing = useStore((s) => s.setAnalyzing);
  const isAnalyzing = useStore((s) => s.isAnalyzing);

  const canAnalyze = selected.length >= 2 && !isAnalyzing;

  async function runAnalyze() {
    setAnalyzing(true);
    try {
      const result = await api.analyze({
        game: "poe2",
        entity_ids: selected.map((e) => e.id),
      });
      setAnalysis(result);
      setBaseline(result);
      track("analysis_run", { entity_count: selected.length });
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="border-b border-white/10 p-3 flex items-center gap-2 flex-wrap">
      <span className="text-white/60 text-sm">Active ({selected.length}/8):</span>
      {selected.length === 0 && (
        <span className="text-white/40 text-sm italic">Add skills, supports, or passives from the left panel.</span>
      )}
      {selected.map((e) => (
        <span
          key={e.id}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-accent/40 shadow-amberGlow text-sm"
          data-testid="tray-entry"
        >
          {e.display_name}
          <button
            type="button"
            aria-label={`Remove ${e.display_name}`}
            onClick={() => removeEntity(e.id)}
            className="text-white/60 hover:text-white"
          >
            ×
          </button>
        </span>
      ))}
      <div className="flex-1" />
      <button
        type="button"
        onClick={runAnalyze}
        disabled={!canAnalyze}
        data-testid="analyze-button"
        className="px-3 py-1 rounded bg-accent text-background text-sm font-medium disabled:opacity-40"
      >
        {isAnalyzing ? "Analyzing..." : "Analyze →"}
      </button>
    </div>
  );
}
