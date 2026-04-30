import { describe, it, expect, beforeEach } from "vitest";
import { useD4Store } from "./d4Store.ts";

beforeEach(() => {
  useD4Store.getState().reset();
});

describe("d4Store", () => {
  it("adds an entity", () => {
    const entity = {
      id: "uuid-1",
      entity_type: "skill" as const,
      entity_slug: "test_skill",
      display_name: "Test Skill",
      class_tags: ["barbarian"],
      mechanic_tags: [],
      damage_tags: ["physical"],
    };
    useD4Store.getState().addEntity(entity);
    expect(useD4Store.getState().selectedEntities).toHaveLength(1);
  });

  it("does not add duplicate entities", () => {
    const entity = {
      id: "uuid-1",
      entity_type: "skill" as const,
      entity_slug: "test_skill",
      display_name: "Test Skill",
      class_tags: [],
      mechanic_tags: [],
      damage_tags: [],
    };
    useD4Store.getState().addEntity(entity);
    useD4Store.getState().addEntity(entity);
    expect(useD4Store.getState().selectedEntities).toHaveLength(1);
  });

  it("toggles class filter", () => {
    useD4Store.getState().toggleFilter("classTags", "barbarian");
    expect(useD4Store.getState().filters.classTags).toContain("barbarian");
    useD4Store.getState().toggleFilter("classTags", "barbarian");
    expect(useD4Store.getState().filters.classTags).not.toContain("barbarian");
  });
});
