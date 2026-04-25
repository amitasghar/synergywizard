import { useRef, useState } from "react";

type Status = "idle" | "loading" | "ready" | "error";

type EmbedderState = {
  status: Status;
  embed: (text: string) => Promise<number[]>;
};

let pipelineCache: ((text: string, opts: object) => Promise<{ data: Float32Array }>) | null = null;

export function useEmbedder(): EmbedderState {
  const [status, setStatus] = useState<Status>("idle");
  const loadingRef = useRef(false);

  async function embed(text: string): Promise<number[]> {
    if (!pipelineCache) {
      if (!loadingRef.current) {
        loadingRef.current = true;
        setStatus("loading");
        try {
          const { pipeline } = await import("@xenova/transformers");
          pipelineCache = await pipeline(
            "feature-extraction",
            "Xenova/all-MiniLM-L6-v2"
          ) as unknown as typeof pipelineCache;
          setStatus("ready");
        } catch {
          setStatus("error");
          throw new Error("Failed to load embedding model");
        } finally {
          loadingRef.current = false;
        }
      } else {
        await new Promise<void>((resolve) => {
          const interval = setInterval(() => {
            if (pipelineCache) { clearInterval(interval); resolve(); }
          }, 100);
        });
      }
    }
    const output = await pipelineCache!(text, { pooling: "mean", normalize: true });
    return Array.from(output.data);
  }

  return { status, embed };
}
