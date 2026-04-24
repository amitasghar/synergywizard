import { create } from "zustand";
import type { AnalysisResult, ConversionState, Entity, ExtendResult } from "../types.ts";

export const MAX_TRAY = 8;

interface StoreState {
  selectedEntities: Entity[];
  analysisResult: AnalysisResult | null;
  baselineAnalysis: AnalysisResult | null;
  conversion: ConversionState | null;
  extendResult: ExtendResult | null;
  isAnalyzing: boolean;

  addEntity: (e: Entity) => void;
  removeEntity: (id: string) => void;
  clear: () => void;
  reset: () => void;

  setAnalysis: (r: AnalysisResult | null) => void;
  setBaseline: (r: AnalysisResult | null) => void;
  setConversion: (c: ConversionState | null) => void;
  setExtendResult: (r: ExtendResult | null) => void;
  setAnalyzing: (b: boolean) => void;
}

export const useStore = create<StoreState>((set, get) => ({
  selectedEntities: [],
  analysisResult: null,
  baselineAnalysis: null,
  conversion: null,
  extendResult: null,
  isAnalyzing: false,

  addEntity: (e) => {
    const existing = get().selectedEntities;
    if (existing.some((x) => x.id === e.id)) return;
    if (existing.length >= MAX_TRAY) return;
    set({ selectedEntities: [...existing, e] });
  },
  removeEntity: (id) =>
    set({ selectedEntities: get().selectedEntities.filter((e) => e.id !== id) }),
  clear: () => set({ selectedEntities: [], analysisResult: null, baselineAnalysis: null, conversion: null, extendResult: null }),
  reset: () =>
    set({
      selectedEntities: [],
      analysisResult: null,
      baselineAnalysis: null,
      conversion: null,
      extendResult: null,
      isAnalyzing: false,
    }),

  setAnalysis: (r) => set({ analysisResult: r }),
  setBaseline: (r) => set({ baselineAnalysis: r }),
  setConversion: (c) => set({ conversion: c }),
  setExtendResult: (r) => set({ extendResult: r }),
  setAnalyzing: (b) => set({ isAnalyzing: b }),
}));
