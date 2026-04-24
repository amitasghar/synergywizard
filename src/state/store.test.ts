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
