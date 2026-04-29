import React, { useEffect, useRef } from "react";
import { Header } from "./components/Header.tsx";
import { FilterSidebar } from "./components/FilterSidebar.tsx";
import { CenterPanel } from "./components/CenterPanel.tsx";
import { SandboxPanel } from "./components/SandboxPanel.tsx";
import { AnalysisPanel } from "./components/AnalysisPanel.tsx";
import { api } from "./api/client.ts";
import { useStore } from "./state/store.ts";
import { decodeStateFromUrl } from "./state/url.ts";

export default function App(): React.ReactElement {
  const addEntity    = useStore((s) => s.addEntity);
  const setAnalysis  = useStore((s) => s.setAnalysis);
  const setBaseline  = useStore((s) => s.setBaseline);
  const setConversion = useStore((s) => s.setConversion);
  const hydrated     = useRef(false);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const state = decodeStateFromUrl(window.location.href);
    if (state.slugs.length === 0) return;

    (async () => {
      const entities = await Promise.all(
        state.slugs.map((slug) => api.search({ game: "poe2", q: slug })),
      );
      const flat   = entities.flat();
      const bySlug = new Map(flat.map((e) => [e.entity_slug, e]));
      const toAdd  = state.slugs
        .map((slug) => bySlug.get(slug.replace(/-/g, "_")) ?? bySlug.get(slug))
        .filter((e): e is NonNullable<typeof e> => !!e);
      toAdd.forEach((e) => addEntity(e));

      if (toAdd.length >= 2) {
        const result = await api.analyze({ game: "poe2", entity_ids: toAdd.map((e) => e.id) });
        setAnalysis(result);
        setBaseline(result);

        if (state.conversion) {
          const entity = toAdd.find(
            (e) =>
              e.entity_slug === state.conversion!.slug.replace(/-/g, "_") ||
              e.entity_slug === state.conversion!.slug,
          );
          if (entity) {
            setConversion({ entityId: entity.id, from: state.conversion.from, to: state.conversion.to });
          }
        }
      }
    })();
  }, [addEntity, setAnalysis, setBaseline, setConversion]);

  return (
    <div className="h-full flex flex-col">
      <Header game="poe2" />
      <div className="flex-1 flex overflow-hidden">
        <FilterSidebar />
        <CenterPanel />
        {/* Right panel: sandbox on top, analysis scrolls below */}
        <div className="w-[380px] min-w-[380px] flex flex-col overflow-hidden min-h-0">
          <SandboxPanel />
          <AnalysisPanel className="border-t border-white/10" />
        </div>
      </div>
    </div>
  );
}
