import { useCallback, useEffect, useRef, useState } from "react";

type Status = "idle" | "loading" | "ready" | "error";

export type EmbedderState = {
  status: Status;
  embed: (text: string) => Promise<number[]>;
};

type PipelineFn = (text: string, opts: { pooling: string; normalize: boolean }) => Promise<{ data: Float32Array }>;

let pipelineCache: PipelineFn | null = null;
let pipelinePromise: Promise<PipelineFn> | null = null;

function loadPipeline(): Promise<PipelineFn> {
  if (pipelinePromise) return pipelinePromise;
  pipelinePromise = import("@xenova/transformers")
    .then(({ pipeline }) =>
      pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2") as Promise<PipelineFn>
    )
    .then((fn) => {
      pipelineCache = fn;
      return fn;
    })
    .catch((err) => {
      pipelinePromise = null;
      throw new Error("Failed to load embedding model", { cause: err });
    });
  return pipelinePromise;
}

export function useEmbedder(): EmbedderState {
  const [status, setStatus] = useState<Status>(pipelineCache ? "ready" : "idle");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const embed = useCallback(async (text: string): Promise<number[]> => {
    let fn = pipelineCache;
    if (!fn) {
      if (mountedRef.current) setStatus("loading");
      try {
        fn = await loadPipeline();
        if (mountedRef.current) setStatus("ready");
      } catch (err) {
        if (mountedRef.current) setStatus("error");
        throw err;
      }
    }
    const output = await fn(text, { pooling: "mean", normalize: true });
    return Array.from(output.data);
  }, []);

  return { status, embed };
}
