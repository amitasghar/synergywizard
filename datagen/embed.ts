// Embeds entity text with the same model the browser uses for queries
// (Xenova/all-MiniLM-L6-v2), so build-time and query vectors line up.
import { pipeline } from "@xenova/transformers";

export const MODEL = "Xenova/all-MiniLM-L6-v2";
export const DIMS = 384;

type Extractor = (texts: string[], opts: { pooling: "mean"; normalize: boolean }) => Promise<{ data: Float32Array }>;

/** Unit vectors scaled to int8: 384 bytes per entity instead of 1.5 KB. */
export function quantize(vec: ArrayLike<number>): Int8Array {
  const out = new Int8Array(vec.length);
  for (let i = 0; i < vec.length; i++) out[i] = Math.max(-127, Math.min(127, Math.round(vec[i] * 127)));
  return out;
}

export async function embedAll(texts: string[], onProgress?: (done: number) => void): Promise<Int8Array> {
  const extract = (await pipeline("feature-extraction", MODEL)) as unknown as Extractor;
  const out = new Int8Array(texts.length * DIMS);
  const BATCH = 32;
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    const { data } = await extract(batch, { pooling: "mean", normalize: true });
    out.set(quantize(data), i * DIMS);
    onProgress?.(Math.min(i + BATCH, texts.length));
  }
  return out;
}
