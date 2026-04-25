import { describe, expect, it, vi, beforeAll, afterEach } from "vitest";
import { api } from "./client.ts";

describe("api client", () => {
  beforeAll(() => {
    const globalWindow = globalThis as any;
    if (!globalWindow.window) {
      globalWindow.window = {};
    }
    globalWindow.window.location = { origin: "http://localhost" };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("search passes query params", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 }),
    );
    await api.search({ game: "poe2", q: "volcanic" });
    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("game=poe2");
    expect(url).toContain("q=volcanic");
    fetchSpy.mockRestore();
  });

  it("analyze posts JSON body", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ direct_interactions: [], extended_interactions: [], loop_detected: false, damage_tags: [], recommended_supports: [], relevant_passives: [], conversion_options: [], entities: [] }), { status: 200 }),
    );
    await api.analyze({ game: "poe2", entity_ids: ["00000000-0000-0000-0000-000000000001"] });
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(typeof init.body).toBe("string");
    fetchSpy.mockRestore();
  });

  it("extend posts mechanic_tags", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ skills: [], supports: [], passives: [] }), { status: 200 }),
    );
    await api.extend({ game: "poe2", mechanic_tags: ["slam"], exclude_ids: [] });
    const body = JSON.parse(String((fetchSpy.mock.calls[0][1] as RequestInit).body));
    expect(body.mechanic_tags).toEqual(["slam"]);
    fetchSpy.mockRestore();
  });

  it("semanticSearch posts vector and returns results", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify([{ entity_slug: "volcanic-fissure", display_name: "Volcanic Fissure", entity_type: "skill", mechanic_tags: ["slam"], damage_tags: ["fire"], class_tags: [], similarity: 0.92 }]),
        { status: 200 }
      ),
    );
    const vec = Array.from({ length: 384 }, () => 0.1);
    const results = await api.semanticSearch(vec);
    expect(results[0].entity_slug).toBe("volcanic-fissure");
    expect(results[0].similarity).toBe(0.92);
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    const body = JSON.parse(String(init.body));
    expect(body.vector).toHaveLength(384);
    fetchSpy.mockRestore();
  });
});
