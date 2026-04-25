// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Reset module-level cache between tests
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("useEmbedder", () => {
  it("starts in idle state", async () => {
    vi.doMock("@xenova/transformers", () => ({
      pipeline: vi.fn().mockResolvedValue(
        vi.fn().mockResolvedValue({ data: new Float32Array(384).fill(0.1) })
      ),
    }));
    const { useEmbedder } = await import("./useEmbedder.ts");
    const { result } = renderHook(() => useEmbedder());
    expect(result.current.status).toBe("idle");
    expect(result.current.embed).toBeInstanceOf(Function);
  });

  it("returns 384-dim vector after embedding", async () => {
    vi.doMock("@xenova/transformers", () => ({
      pipeline: vi.fn().mockResolvedValue(
        vi.fn().mockResolvedValue({ data: new Float32Array(384).fill(0.1) })
      ),
    }));
    const { useEmbedder } = await import("./useEmbedder.ts");
    const { result } = renderHook(() => useEmbedder());
    let vec: number[] = [];
    await act(async () => {
      vec = await result.current.embed("fire slam skill");
    });
    expect(vec).toHaveLength(384);
    expect(result.current.status).toBe("ready");
  });

  it("sets status to error when model fails to load", async () => {
    vi.doMock("@xenova/transformers", () => ({
      pipeline: vi.fn().mockRejectedValue(new Error("Network error")),
    }));
    const { useEmbedder } = await import("./useEmbedder.ts");
    const { result } = renderHook(() => useEmbedder());
    await act(async () => {
      await result.current.embed("test").catch(() => {});
    });
    expect(result.current.status).toBe("error");
  });
});
