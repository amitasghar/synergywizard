import React, { useState } from "react";
import { EFFECT_LABEL } from "../data/effects.ts";
import type { Entity } from "../data/types.ts";
import { track } from "../api/analytics.ts";
import { poe2dbUrl, wikiUrl } from "./links.ts";

const KIND_STYLE: Record<string, { label: string; cls: string }> = {
  skill: { label: "Skill", cls: "bg-[#3a1424] text-[#ff9c82]" },
  spirit: { label: "Spirit", cls: "bg-[#0f2a35] text-teal" },
  support: { label: "Support", cls: "bg-[#14224d] text-[#9fd0ff]" },
  keystone: { label: "Keystone", cls: "bg-gold-soft text-gold" },
  notable: { label: "Notable", cls: "bg-[#231f2e] text-[#e3cf9f]" },
  ascendancy: { label: "Ascendancy", cls: "bg-[#2a2360] text-[#e6e0ff]" },
  passive: { label: "Passive", cls: "bg-ink-800 text-muted" },
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
    <article className="border-b border-ink-700/50 last:border-b-0 px-4 sm:px-5 py-3.5 hover:bg-ink-850/60 transition-colors">
      <header className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${kind.cls}`}>{kind.label}</span>
        <h3 className="text-[15px] font-semibold text-text">{entity.name}</h3>
        {entity.effects.map((e) => (
          <span key={e} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#2a2360] border border-[#6a5ad6]/60 text-[#e6e0ff]">
            {EFFECT_LABEL[e]}
          </span>
        ))}
        <span className="ml-auto flex gap-3 text-[11px]">
          {[
            ["poe2db", poe2dbUrl(entity.name)],
            ["Wiki", wikiUrl(entity.name)],
          ].map(([site, href]) => (
            <a
              key={site}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track("outbound_click", { site, id: entity.id })}
              className="text-faint hover:text-teal underline decoration-ink-700 underline-offset-2"
            >
              {site} ↗
            </a>
          ))}
        </span>
      </header>
      {meta.length > 0 && <div className="text-[11px] text-faint mt-1">{meta.join(" · ")}</div>}
      {text && <p className="text-sm text-muted mt-1.5 leading-relaxed">{text}</p>}
      {stats.length > 0 && (
        <ul className="mt-2 text-[13px] text-stat space-y-0.5 border-l-2 border-ink-700 pl-3">
          {stats.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      )}
      {open && entity.supports?.length ? (
        <p className="mt-2 text-xs text-muted">
          <span className="text-faint">Suggested supports: </span>
          {entity.supports.join(", ")}
        </p>
      ) : null}
      {canExpand && (
        <button type="button" onClick={toggle} className="mt-2 text-xs text-teal/90 hover:text-teal">
          {open ? "Show less" : hiddenStats > 0 ? `Show ${hiddenStats} more line${hiddenStats > 1 ? "s" : ""}` : "Show more"}
        </button>
      )}
    </article>
  );
}
