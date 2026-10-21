import React from "react";
import { EFFECTS } from "../data/effects.ts";
import type { Filters } from "../search/search.ts";

const KINDS: [string, string][] = [
  ["skill", "Skill gems"],
  ["spirit", "Spirit gems"],
  ["support", "Supports"],
  ["notable", "Notables"],
  ["keystone", "Keystones"],
  ["ascendancy", "Ascendancy"],
  ["passive", "Small passives"],
];
const DAMAGE: [string, string][] = ["fire", "cold", "lightning", "physical", "chaos"].map((d) => [d, d]);
const WEAPONS: [string, string][] = [
  "bow", "crossbow", "quarterstaff", "spear", "mace", "sword", "axe", "dagger", "claw", "flail", "wand", "staff", "sceptre", "talisman", "shield", "unarmed",
].map((w) => [w, w]);

const DAMAGE_COLOR: Record<string, string> = {
  fire: "border-[#ff7a5c99] text-[#ff9c82] bg-[#2a1018]",
  cold: "border-[#6fb8ff99] text-[#9fd0ff] bg-[#0f1d3d]",
  lightning: "border-[#ffd84d99] text-[#ffe27a] bg-[#2a2414]",
  physical: "border-[#c9c7d899] text-[#e4e2ef] bg-[#1c1f38]",
  chaos: "border-[#c58bdf99] text-[#d9a8f0] bg-[#22123a]",
};

interface GroupProps {
  label: string;
  field: keyof Filters;
  options: [string, string][];
  filters: Filters;
  onToggle: (field: keyof Filters, value: string) => void;
}

function Group({ label, field, options, filters, onToggle }: GroupProps): React.ReactElement {
  const active = new Set<string>(filters[field]);
  return (
    <fieldset>
      <legend className="font-display text-[12px] tracking-[0.12em] text-gold/85 mb-2">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map(([value, text]) => {
          const on = active.has(value);
          const color = field === "damage" ? DAMAGE_COLOR[value] : "border-gold/60 text-gold bg-gold-soft";
          return (
            <button
              key={value}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(field, value)}
              className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${field === "effects" ? "" : "capitalize"} ${
                on ? color : "border-ink-700 text-muted hover:border-violet/50 hover:text-text"
              }`}
            >
              {text}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

interface Props {
  filters: Filters;
  onToggle: (field: keyof Filters, value: string) => void;
  onClear: () => void;
}

export function FilterPanel({ filters, onToggle, onClear }: Props): React.ReactElement {
  const any = Object.values(filters).some((v) => v.length > 0);
  return (
    <div className="flex flex-col gap-5">
      <Group label="What it does" field="effects" options={EFFECTS.map((e) => [e.id, e.label])} filters={filters} onToggle={onToggle} />
      <Group label="Type" field="kinds" options={KINDS} filters={filters} onToggle={onToggle} />
      <Group label="Damage" field="damage" options={DAMAGE} filters={filters} onToggle={onToggle} />
      <Group label="Weapon" field="weapons" options={WEAPONS} filters={filters} onToggle={onToggle} />
      {any && (
        <button type="button" onClick={onClear} className="self-start text-xs text-muted hover:text-text underline decoration-ink-700 underline-offset-2">
          Clear filters
        </button>
      )}
    </div>
  );
}
