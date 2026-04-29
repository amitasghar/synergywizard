import React from "react";
import { useStore } from "../state/store.ts";
import type { FilterState } from "../types.ts";

const DAMAGE_TAGS = ["fire", "cold", "lightning", "physical", "chaos"] as const;
const ACTION_TAGS = ["attack", "spell", "channelled"] as const;
const STYLE_TAGS  = ["melee", "slam", "projectile", "aoe", "movement", "duration", "minion", "warcry", "aura", "herald", "mark"] as const;
const WEAPON_TAGS = ["mace", "sword", "axe", "dagger", "spear", "staff", "bow", "crossbow", "wand", "unarmed", "shield"] as const;
const TYPE_TAGS   = ["skill", "support", "passive"] as const;

function chipColor(group: keyof FilterState, tag: string): string {
  if (group === "damageTags") {
    if (tag === "fire")      return "bg-[#1a0000] border-[#c0392b55] text-[#e74c3c]";
    if (tag === "cold")      return "bg-[#1a1a2e] border-[#3498db55] text-[#5dade2]";
    if (tag === "lightning") return "bg-[#1c1a00] border-[#f1c40f55] text-[#f0b90b]";
  }
  return "bg-[#2a1f00] border-accent/40 text-accent";
}

interface GroupProps {
  label: string;
  group: keyof FilterState;
  tags: readonly string[];
  activeSet: ReadonlySet<string>;
  toggle: (group: keyof FilterState, tag: string) => void;
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

export function FilterSidebar(): React.ReactElement {
  const filters = useStore((s) => s.filters);
  const toggleFilter = useStore((s) => s.toggleFilter);
  const clearFilters = useStore((s) => s.clearFilters);

  const hasActive =
    filters.damageTags.length > 0 ||
    filters.actionTags.length > 0 ||
    filters.styleTags.length > 0 ||
    filters.weaponTags.length > 0 ||
    filters.types.length > 0;

  return (
    <aside className="w-[170px] min-w-[170px] border-r border-white/10 p-3 flex flex-col gap-4 overflow-y-auto">
      <ChipGroup label="Damage Type" group="damageTags" tags={DAMAGE_TAGS} activeSet={new Set(filters.damageTags)} toggle={toggleFilter} />
      <ChipGroup label="Action"      group="actionTags"  tags={ACTION_TAGS}  activeSet={new Set(filters.actionTags)}  toggle={toggleFilter} />
      <ChipGroup label="Style"       group="styleTags"   tags={STYLE_TAGS}   activeSet={new Set(filters.styleTags)}   toggle={toggleFilter} />
      <ChipGroup label="Weapon"      group="weaponTags"  tags={WEAPON_TAGS}  activeSet={new Set(filters.weaponTags)}  toggle={toggleFilter} />
      <ChipGroup label="Type"        group="types"       tags={TYPE_TAGS}    activeSet={new Set(filters.types)}       toggle={toggleFilter} />

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
