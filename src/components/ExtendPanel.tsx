import React, { useEffect } from "react";
import { api } from "../api/client.ts";
import { useStore } from "../state/store.ts";
import { EntityCard } from "./EntityCard.tsx";

export function ExtendPanel(): React.ReactElement | null {
  const analysis = useStore((s) => s.analysisResult);
  const extendResult = useStore((s) => s.extendResult);
  const setExtendResult = useStore((s) => s.setExtendResult);
  const addEntity = useStore((s) => s.addEntity);
  const selected = useStore((s) => s.selectedEntities);

  useEffect(() => {
    if (!analysis) { setExtendResult(null); return; }
    const mech = Array.from(new Set(selected.flatMap((e) => e.mechanic_tags)));
    if (mech.length === 0) { setExtendResult({ skills: [], supports: [], passives: [] }); return; }
    let cancelled = false;
    api.extend({
      game: "poe2",
      mechanic_tags: mech,
      exclude_ids: selected.map((e) => e.id),
    }).then((r) => { if (!cancelled) setExtendResult(r); });
    return () => { cancelled = true; };
  }, [analysis, selected, setExtendResult]);

  if (!analysis || !extendResult) return null;

  return (
    <section>
      <h3 className="text-accent font-semibold mb-2">➕ Extend this combo</h3>
      {(["skills", "supports", "passives"] as const).map((group) => (
        <div key={group} className="mb-3">
          <div className="text-xs uppercase tracking-wide text-white/50 mb-1">{group}</div>
          {extendResult[group].length === 0 && (
            <div className="text-xs text-white/30 italic">No suggestions.</div>
          )}
          <div className="flex flex-col gap-1">
            {extendResult[group].slice(0, 6).map((e) => (
              <EntityCard key={e.id} entity={e} onAdd={addEntity} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
