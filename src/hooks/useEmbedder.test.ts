// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useEmbedder } from "./useEmbedder.ts";

vi.mock("@xenova/transformers", () => ({
  pipeline: vi.fn().mockResolvedValue(
    vi.fn().mockResolvedValue({ data: new Float32Array(384).fill(0.1) })
  ),
}));

describe("useEmbedder", () => {
  it("starts in idle state", () => {
    const { result } = renderHook(() => useEmbedder());
    expect(result.current.status).toBe("idle");
    expect(result.current.embed).toBeInstanceOf(Function);
  });

  it("returns 384-dim vector after embedding", async () => {
    const { result } = renderHook(() => useEmbedder());
    let vec: number[] = [];
    await act(async () => {
      vec = await result.current.embed("fire slam skill");
    });
    expect(vec).toHaveLength(384);
    expect(result.current.status).toBe("ready");
  });
});
