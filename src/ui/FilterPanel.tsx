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
      <legend>{label}</legend>
      <div className="grid grid-cols-2 gap-x-2">
        {options.map(([value, text]) => {
          const id = `f-${field}-${value}`;
          return (
            <div key={value} className="filter-check min-w-0">
              <input type="checkbox" id={id} checked={active.has(value)} onChange={() => onToggle(field, value)} />
              <label htmlFor={id} className={`min-w-0 ${field === "effects" ? "" : "capitalize"}`}>
                {text}
              </label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

interface Props {
  filters: Filters;
  onToggle: (field: keyof Filters, value: string) => void;
  onHide: (hide: string[]) => void;
  onClear: () => void;
}

export function FilterPanel({ filters, onToggle, onHide, onClear }: Props): React.ReactElement {
  const any = Object.values(filters).some((v) => v.length > 0);
  return (
    <div className="flex flex-col gap-3">
      <Group label="What it does" field="effects" options={EFFECTS.map((e) => [e.id, e.label])} filters={filters} onToggle={onToggle} />
      <Group label="Type" field="kinds" options={KINDS} filters={filters} onToggle={onToggle} />
      <Group label="Damage" field="damage" options={DAMAGE} filters={filters} onToggle={onToggle} />
      <Group label="Weapon" field="weapons" options={WEAPONS} filters={filters} onToggle={onToggle} />
      <fieldset>
        <legend>Hide results that mention</legend>
        {/* Raw text kept as split pieces so typing a comma or space isn't swallowed. */}
        <input
          type="text"
          className="w-full"
          aria-label="Hide results that mention"
          placeholder="e.g. energy shield, minion"
          value={filters.hide.join(",")}
          onChange={(ev) => onHide(ev.target.value ? ev.target.value.split(",") : [])}
        />
        <p className="text-[11px] text-[#555] mt-1 mb-0 font-ui">Separate with commas. Or type -word in the search box.</p>
      </fieldset>
      {any && (
        <button type="button" onClick={onClear} className="self-start tap">
          Clear filters
        </button>
      )}
    </div>
  );
}
