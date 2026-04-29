import { describe, expect, it, beforeEach } from "vitest";
import { useStore } from "./store.ts";
import type { Entity } from "../types.ts";

function entity(id: string, slug: string): Entity {
  return {
    id,
    entity_type: "skill",
    entity_slug: slug,
    display_name: slug,
    class_tags: [],
    mechanic_tags: [],
    damage_tags: [],
  };
}

beforeEach(() => {
  useStore.getState().reset();
});

describe("useStore", () => {
  it("adds and removes entities", () => {
    useStore.getState().addEntity(entity("1", "a"));
    useStore.getState().addEntity(entity("2", "b"));
    expect(useStore.getState().selectedEntities.length).toBe(2);
    useStore.getState().removeEntity("1");
    expect(useStore.getState().selectedEntities.map((e) => e.id)).toEqual(["2"]);
  });

  it("does not add duplicates", () => {
    useStore.getState().addEntity(entity("1", "a"));
    useStore.getState().addEntity(entity("1", "a"));
    expect(useStore.getState().selectedEntities.length).toBe(1);
  });

  it("caps at 8 entities", () => {
    for (let i = 0; i < 10; i++) {
      useStore.getState().addEntity(entity(String(i), `s${i}`));
    }
    expect(useStore.getState().selectedEntities.length).toBe(8);
  });
});

describe("filter state", () => {
  beforeEach(() => useStore.getState().reset());

  it("toggleFilter adds a tag to the correct group", () => {
    useStore.getState().toggleFilter("damageTags", "fire");
    expect(useStore.getState().filters.damageTags).toEqual(["fire"]);
  });

  it("toggleFilter removes a tag already present", () => {
    useStore.getState().toggleFilter("damageTags", "fire");
    useStore.getState().toggleFilter("damageTags", "fire");
    expect(useStore.getState().filters.damageTags).toEqual([]);
  });

  it("clearFilters resets all groups", () => {
    useStore.getState().toggleFilter("damageTags", "fire");
    useStore.getState().toggleFilter("weaponTags", "mace");
    useStore.getState().clearFilters();
    const { filters } = useStore.getState();
    expect(filters.damageTags).toEqual([]);
    expect(filters.weaponTags).toEqual([]);
  });
});

describe("moveEntity", () => {
  const e1 = { id: "1", entity_slug: "a", display_name: "A", entity_type: "skill" as const, mechanic_tags: [], damage_tags: [], class_tags: [] };
  const e2 = { id: "2", entity_slug: "b", display_name: "B", entity_type: "skill" as const, mechanic_tags: [], damage_tags: [], class_tags: [] };
  const e3 = { id: "3", entity_slug: "c", display_name: "C", entity_type: "skill" as const, mechanic_tags: [], damage_tags: [], class_tags: [] };

  beforeEach(() => {
    useStore.getState().reset();
    useStore.getState().addEntity(e1);
    useStore.getState().addEntity(e2);
    useStore.getState().addEntity(e3);
  });

  it("moves entity from index 0 to index 2", () => {
    useStore.getState().moveEntity(0, 2);
    const ids = useStore.getState().selectedEntities.map((e) => e.id);
    expect(ids).toEqual(["2", "3", "1"]);
  });

  it("does nothing when fromIdx equals toIdx", () => {
    useStore.getState().moveEntity(1, 1);
    const ids = useStore.getState().selectedEntities.map((e) => e.id);
    expect(ids).toEqual(["1", "2", "3"]);
  });
});

describe("insertEntityAt", () => {
  const e1 = { id: "1", entity_slug: "a", display_name: "A", entity_type: "skill" as const, mechanic_tags: [], damage_tags: [], class_tags: [] };
  const e2 = { id: "2", entity_slug: "b", display_name: "B", entity_type: "skill" as const, mechanic_tags: [], damage_tags: [], class_tags: [] };
  const eNew = { id: "99", entity_slug: "new", display_name: "New", entity_type: "skill" as const, mechanic_tags: [], damage_tags: [], class_tags: [] };

  beforeEach(() => {
    useStore.getState().reset();
    useStore.getState().addEntity(e1);
    useStore.getState().addEntity(e2);
  });

  it("inserts at index 0, shifting others right", () => {
    useStore.getState().insertEntityAt(eNew, 0);
    const ids = useStore.getState().selectedEntities.map((e) => e.id);
    expect(ids).toEqual(["99", "1", "2"]);
  });

  it("inserts at end when index >= length", () => {
    useStore.getState().insertEntityAt(eNew, 5);
    const ids = useStore.getState().selectedEntities.map((e) => e.id);
    expect(ids).toEqual(["1", "2", "99"]);
  });

  it("does not insert duplicates", () => {
    useStore.getState().insertEntityAt(e1, 1);
    expect(useStore.getState().selectedEntities).toHaveLength(2);
  });
});
