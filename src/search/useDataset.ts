import { useEffect, useState } from "react";
import type { Dataset } from "../data/types.ts";
import { buildIndex, type SearchIndex } from "./search.ts";

// jsDelivr serves files straight from the public GitHub repo at a fixed commit, so the data
// always matches this build and costs no Netlify bandwidth. The site's own copy is the fallback.
const COMMIT = import.meta.env.VITE_COMMIT_REF as string;
const CDN = COMMIT ? `https://cdn.jsdelivr.net/gh/amitasghar/synergywizard@${COMMIT}/public` : "";

async function fetchData(path: string): Promise<Response> {
  if (CDN) {
    try {
      const res = await fetch(`${CDN}${path}`);
      if (res.ok) return res;
    } catch {
      // fall through to the site's copy
    }
  }
  return fetch(path);
}

type State = { status: "loading" } | { status: "error"; error: string } | { status: "ready"; index: SearchIndex };

/** Loads /data/poe2.json, plus the vectors when available (keyword search still works without them). */
export function useDataset(): State {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [jsonRes, vecRes] = await Promise.all([fetchData("/data/poe2.json"), fetchData("/data/poe2.vec").catch(() => null)]);
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
