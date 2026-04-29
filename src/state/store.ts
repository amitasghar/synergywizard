import { create } from "zustand";
import type { AnalysisResult, ConversionState, Entity, ExtendResult, FilterState } from "../types.ts";

export const MAX_TRAY = 8;

interface StoreState {
  selectedEntities: Entity[];
  analysisResult: AnalysisResult | null;
  baselineAnalysis: AnalysisResult | null;
  conversion: ConversionState | null;
  extendResult: ExtendResult | null;
  isAnalyzing: boolean;
  filters: FilterState;

  addEntity: (e: Entity) => void;
  removeEntity: (id: string) => void;
  moveEntity: (fromIdx: number, toIdx: number) => void;
  insertEntityAt: (e: Entity, atIdx: number) => void;
  clear: () => void;
  reset: () => void;

  setAnalysis: (r: AnalysisResult | null) => void;
  setBaseline: (r: AnalysisResult | null) => void;
  setConversion: (c: ConversionState | null) => void;
  setExtendResult: (r: ExtendResult | null) => void;
  setAnalyzing: (b: boolean) => void;

  toggleFilter: (group: keyof FilterState, tag: string) => void;
  clearFilters: () => void;
}

const emptyFilters = (): FilterState => ({
  damageTags: [],
  actionTags: [],
  styleTags: [],
  weaponTags: [],
  types: [],
});

export const useStore = create<StoreState>((set, get) => ({
  selectedEntities: [],
  analysisResult: null,
  baselineAnalysis: null,
  conversion: null,
  extendResult: null,
  isAnalyzing: false,
  filters: emptyFilters(),

  addEntity: (e) => {
    const existing = get().selectedEntities;
    if (existing.some((x) => x.id === e.id)) return;
    if (existing.length >= MAX_TRAY) return;
    set({ selectedEntities: [...existing, e] });
  },
  removeEntity: (id) =>
    set({ selectedEntities: get().selectedEntities.filter((e) => e.id !== id) }),
  moveEntity: (fromIdx, toIdx) => {
    const existing = get().selectedEntities;
    if (fromIdx === toIdx || fromIdx >= existing.length) return;
    const next = [...existing];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    set({ selectedEntities: next });
  },
  insertEntityAt: (e, atIdx) => {
    const existing = get().selectedEntities;
    if (existing.some((x) => x.id === e.id)) return;
    if (existing.length >= MAX_TRAY) return;
    const next = [...existing];
    const clampedIdx = Math.min(atIdx, next.length);
    next.splice(clampedIdx, 0, e);
    set({ selectedEntities: next });
  },
  clear: () => set({ selectedEntities: [], analysisResult: null, baselineAnalysis: null, conversion: null, extendResult: null }),
  reset: () =>
    set({
      selectedEntities: [],
      analysisResult: null,
      baselineAnalysis: null,
      conversion: null,
      extendResult: null,
      isAnalyzing: false,
      filters: emptyFilters(),
    }),

  setAnalysis: (r) => set({ analysisResult: r }),
  setBaseline: (r) => set({ baselineAnalysis: r }),
  setConversion: (c) => set({ conversion: c }),
  setExtendResult: (r) => set({ extendResult: r }),
  setAnalyzing: (b) => set({ isAnalyzing: b }),

  toggleFilter: (group, tag) => {
    const current = get().filters[group];
    const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
    set({ filters: { ...get().filters, [group]: next } });
  },
  clearFilters: () => set({ filters: emptyFilters() }),
}));
