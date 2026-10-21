import React, { useState } from "react";
import { EFFECT_LABEL } from "../data/effects.ts";
import type { Entity } from "../data/types.ts";
import { track } from "../api/analytics.ts";

const KIND_STYLE: Record<string, { label: string; cls: string }> = {
  skill: { label: "Skill", cls: "bg-[#3d0e0e] text-[#ff8a7a]" },
  spirit: { label: "Spirit", cls: "bg-[#0e2a2a] text-[#6fe0d0]" },
  support: { label: "Support", cls: "bg-[#0d1f3d] text-[#7cc4f5]" },
  keystone: { label: "Keystone", cls: "bg-[#2a1f00] text-[#e7c35a]" },
  notable: { label: "Notable", cls: "bg-[#1f1a0d] text-[#d8c08a]" },
  ascendancy: { label: "Ascendancy", cls: "bg-[#1a0d2e] text-[#c39bd3]" },
  passive: { label: "Passive", cls: "bg-white/5 text-white/60" },
};

const ATTR: Record<string, string> = { str: "Str", dex: "Dex", int: "Int" };
const PREVIEW_STATS = 3;

export function ResultCard({ entity }: { entity: Entity }): React.ReactElement {
  const [open, setOpen] = useState(false);
  const kind = KIND_STYLE[entity.kind];
  const hiddenStats = entity.stats.length - PREVIEW_STATS;
  const canExpand = hiddenStats > 0 || !!entity.supports?.length || entity.text.length > 220;
  const text = !open && entity.text.length > 220 ? `${entity.text.slice(0, 220).trimEnd()}…` : entity.text;
  const stats = open ? entity.stats : entity.stats.slice(0, PREVIEW_STATS);
  const meta = [
    entity.ascendancy && `${entity.ascendancy} (${entity.className})`,
    entity.attribute && ATTR[entity.attribute],
    entity.count && entity.count > 1 && `${entity.count}× on the tree`,
    ...entity.tags.slice(0, 6),
  ].filter(Boolean);

  function toggle(): void {
    if (!open) track("result_expand", { id: entity.id });
    setOpen(!open);
  }

  return (
    <article className="border-b border-white/5 px-4 py-3 hover:bg-white/[0.02]">
      <header className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${kind.cls}`}>{kind.label}</span>
        <h3 className="text-[15px] font-medium text-white/95">{entity.name}</h3>
        {entity.effects.map((e) => (
          <span key={e} className="text-[10px] px-1.5 py-0.5 rounded-full border border-accent/30 text-accent/90">
            {EFFECT_LABEL[e]}
          </span>
        ))}
      </header>
      {meta.length > 0 && <div className="text-[11px] text-white/40 mt-1">{meta.join(" · ")}</div>}
      {text && <p className="text-sm text-white/75 mt-1.5 leading-relaxed">{text}</p>}
      {stats.length > 0 && (
        <ul className="mt-1.5 text-[13px] text-[#9fb4ff]/90 space-y-0.5">
          {stats.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      )}
      {open && entity.supports?.length ? (
        <p className="mt-2 text-xs text-white/50">
          <span className="text-white/35">Suggested supports: </span>
          {entity.supports.join(", ")}
        </p>
      ) : null}
      {canExpand && (
        <button type="button" onClick={toggle} className="mt-1.5 text-xs text-accent/80 hover:text-accent">
          {open ? "Show less" : hiddenStats > 0 ? `Show ${hiddenStats} more line${hiddenStats > 1 ? "s" : ""}` : "Show more"}
        </button>
      )}
    </article>
  );
}
