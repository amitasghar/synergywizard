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
  fire: "border-[#e74c3c88] text-[#ff7b6b] bg-[#2a0b08]",
  cold: "border-[#3498db88] text-[#7cc4f5] bg-[#0b1a2a]",
  lightning: "border-[#f1c40f88] text-[#f5d442] bg-[#2a2408]",
  physical: "border-[#bdc3c788] text-[#dfe4e6] bg-[#1d2022]",
  chaos: "border-[#9b59b688] text-[#c58bdf] bg-[#1d0c26]",
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
      <legend className="text-[11px] uppercase tracking-widest text-white/40 mb-2">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map(([value, text]) => {
          const on = active.has(value);
          const color = field === "damage" ? DAMAGE_COLOR[value] : "border-accent/60 text-accent bg-[#2a1f00]";
          return (
            <button
              key={value}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(field, value)}
              className={`px-2 py-1 rounded text-xs border capitalize transition-colors ${
                on ? color : "border-white/10 text-white/55 hover:border-white/30 hover:text-white/80"
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
        <button type="button" onClick={onClear} className="self-start text-xs text-white/45 hover:text-white/80 underline underline-offset-2">
          Clear filters
        </button>
      )}
    </div>
  );
}
