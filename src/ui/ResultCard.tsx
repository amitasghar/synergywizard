import React, { useState } from "react";
import { EFFECT_LABEL } from "../data/effects.ts";
import type { Entity } from "../data/types.ts";
import { track } from "../api/analytics.ts";
import { poe2dbUrl, wikiUrl } from "./links.ts";

const KIND_STYLE: Record<string, { label: string; bg: string; color?: string }> = {
  skill: { label: "Skill", bg: "#ff9900" },
  spirit: { label: "Spirit", bg: "#39ff14" },
  support: { label: "Support", bg: "#00e5ff" },
  keystone: { label: "Keystone", bg: "#ffe600" },
  notable: { label: "Notable", bg: "#ffd8a8" },
  ascendancy: { label: "Ascendancy", bg: "#ff2bd6", color: "#fff" },
  passive: { label: "Passive", bg: "#c0c0c0" },
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

  const links = (
    <span className="flex gap-2 flex-wrap">
      {[
        ["poe2db", "📖 poe2db", poe2dbUrl(entity.name)],
        ["Wiki", "🌐 PoE2 Wiki", wikiUrl(entity.name)],
      ].map(([site, label, href]) => (
        <a
          key={site}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track("outbound_click", { site, id: entity.id })}
          className="ext-btn"
        >
          {label}
        </a>
      ))}
    </span>
  );

  return (
    <article className="border-b border-[#c0c0c0] last:border-b-0 px-3 sm:px-4 py-3 font-prose">
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="tag" style={{ background: kind.bg, color: kind.color }}>{kind.label.toUpperCase()}</span>
        <h3 className="text-[16px] font-bold text-navy m-0">{entity.name}</h3>
        {entity.effects.map((e) => (
          <span key={e} className="font-ui text-[11px] text-black bg-[#ffffe1] border border-black px-1.5 py-px">
            {EFFECT_LABEL[e]}
          </span>
        ))}
        <span className="hidden sm:block sm:ml-auto">{links}</span>
      </header>
      {meta.length > 0 && <div className="text-[12px] text-[#555] mt-1 font-ui">{meta.join(" · ")}</div>}
      {text && <p className="text-[14px] text-ink mt-1.5 mb-0 leading-[1.5]">{text}</p>}
      {stats.length > 0 && (
        <ul className="mt-2 mb-0 p-0 text-[13px] text-navy space-y-0.5 border-l-2 border-[#808080] pl-3 list-none font-ui">
          {stats.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      )}
      {open && entity.supports?.length ? (
        <p className="mt-2 mb-0 text-xs text-[#555]">
          <span>Suggested supports: </span>
          {entity.supports.join(", ")}
        </p>
      ) : null}
      <div className="mt-2 sm:hidden">{links}</div>
      {canExpand && (
        <button type="button" onClick={toggle} className="link-btn mt-1 -ml-1">
          {open ? "Show less" : hiddenStats > 0 ? `Show ${hiddenStats} more line${hiddenStats > 1 ? "s" : ""}` : "Show more"}
        </button>
      )}
    </article>
  );
}
