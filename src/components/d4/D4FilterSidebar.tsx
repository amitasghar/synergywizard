import React from "react";
import { useD4Store } from "../../state/d4Store.ts";
import type { D4FilterState } from "../../types.ts";

const D4_CLASSES    = ["barbarian", "druid", "necromancer", "rogue", "sorcerer", "spiritborn"] as const;
const DAMAGE_TAGS   = ["physical", "fire", "cold", "lightning", "poison", "shadow"] as const;
const MECHANIC_TAGS = ["aoe", "dot", "movement", "minion", "stun", "barrier", "channel", "lucky"] as const;
const TYPE_TAGS     = ["skill", "passive", "aspect"] as const;

function chipColor(group: keyof D4FilterState, tag: string): string {
  if (group === "damageTags") {
    if (tag === "fire")      return "bg-[#1a0000] border-[#c0392b55] text-[#e74c3c]";
    if (tag === "cold")      return "bg-[#1a1a2e] border-[#3498db55] text-[#5dade2]";
    if (tag === "lightning") return "bg-[#1c1a00] border-[#f1c40f55] text-[#f0b90b]";
    if (tag === "shadow")    return "bg-[#1a001a] border-[#9b59b655] text-[#c39bd3]";
    if (tag === "poison")    return "bg-[#001a00] border-[#27ae6055] text-[#2ecc71]";
  }
  if (group === "classTags") return "bg-[#001a1a] border-accent/40 text-accent";
  return "bg-[#2a1f00] border-accent/40 text-accent";
}

interface GroupProps {
  label: string;
  group: keyof D4FilterState;
  tags: readonly string[];
  activeSet: ReadonlySet<string>;
  toggle: (group: keyof D4FilterState, tag: string) => void;
}

function ChipGroup({ label, group, tags, activeSet, toggle }: GroupProps): React.ReactElement {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-white/30 mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => {
          const isActive = activeSet.has(tag);
          return (
            <button
              key={tag}
              type="button"
              aria-pressed={isActive}
              onClick={() => toggle(group, tag)}
              className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${
                isActive
                  ? chipColor(group, tag)
                  : "border-white/10 text-white/40 hover:border-white/25 hover:text-white/60"
              }`}
            >
              {tag}{isActive ? " ×" : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function D4FilterSidebar(): React.ReactElement {
  const filters      = useD4Store((s) => s.filters);
  const toggleFilter = useD4Store((s) => s.toggleFilter);
  const clearFilters = useD4Store((s) => s.clearFilters);

  const hasActive =
    filters.classTags.length > 0 ||
    filters.damageTags.length > 0 ||
    filters.mechanicTags.length > 0 ||
    filters.types.length > 0;

  return (
    <aside className="w-[170px] min-w-[170px] border-r border-white/10 p-3 flex flex-col gap-4 overflow-y-auto">
      <ChipGroup label="Class"        group="classTags"    tags={D4_CLASSES}    activeSet={new Set(filters.classTags)}    toggle={toggleFilter} />
      <ChipGroup label="Damage Type"  group="damageTags"   tags={DAMAGE_TAGS}   activeSet={new Set(filters.damageTags)}   toggle={toggleFilter} />
      <ChipGroup label="Mechanic"     group="mechanicTags" tags={MECHANIC_TAGS} activeSet={new Set(filters.mechanicTags)} toggle={toggleFilter} />
      <ChipGroup label="Type"         group="types"        tags={TYPE_TAGS}     activeSet={new Set(filters.types)}        toggle={toggleFilter} />

      {hasActive && (
        <button
          type="button"
          onClick={clearFilters}
          className="mt-auto text-[11px] text-white/30 hover:text-white/60 text-left"
        >
          ✕ clear all filters
        </button>
      )}
    </aside>
  );
}
