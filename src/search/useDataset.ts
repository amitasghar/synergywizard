import { useEffect, useState } from "react";
import type { Dataset } from "../data/types.ts";
import { buildIndex, type SearchIndex } from "./search.ts";

type State = { status: "loading" } | { status: "error"; error: string } | { status: "ready"; index: SearchIndex };

/** Loads /data/poe2.json, plus the vectors when available (keyword search still works without them). */
export function useDataset(): State {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [jsonRes, vecRes] = await Promise.all([fetch("/data/poe2.json"), fetch("/data/poe2.vec").catch(() => null)]);
        if (!jsonRes.ok) throw new Error(`data ${jsonRes.status}`);
        const dataset = (await jsonRes.json()) as Dataset;
        const vectors = vecRes?.ok ? new Int8Array(await vecRes.arrayBuffer()) : null;
        const usable = vectors && vectors.length === dataset.entities.length * dataset.dims ? vectors : null;
        if (!cancelled) setState({ status: "ready", index: buildIndex(dataset, usable) });
      } catch (err) {
        if (!cancelled) setState({ status: "error", error: err instanceof Error ? err.message : String(err) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
