import React, { useEffect, useRef, useState } from "react";
import { track } from "../api/analytics.ts";

/** Easter egg: typing "hotpants" (or "hotpant") makes a little dancer pop up. Search is untouched. */
export const HOTPANTS = /\bhot ?pants?\b/i;
export const hasHotpants = (q: string): boolean => HOTPANTS.test(q);

// Pops in from the bottom-right corner, dances, pops back out: a quick cameo, not a visit.
const SHOW_MS = 2600;
const OUT_MS = 220;

export function HotpantsDancer({ query }: { query: string }): React.ReactElement | null {
  const [phase, setPhase] = useState<"hidden" | "in" | "out">("hidden");
  const was = useRef(false);

  useEffect(() => {
    const now = hasHotpants(query);
    // Pops up when the word first appears, not on every keystroke after it.
    if (now && !was.current) {
      setPhase("in");
      track("easter_egg", { id: "hotpants" });
    }
    was.current = now;
  }, [query]);

  useEffect(() => {
    if (phase === "hidden") return;
    const t = window.setTimeout(() => setPhase(phase === "in" ? "out" : "hidden"), phase === "in" ? SHOW_MS : OUT_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  if (phase === "hidden") return null;
  return (
    <button type="button" className={`hotpants hotpants-${phase}`} onClick={() => setPhase("out")} aria-label="Hotpants dancer. Click to dismiss.">
      <span className="hotpants-bubble">♪ Hot pants! ♪</span>
      <svg className="hotpants-guy" viewBox="0 0 32 48" width="96" height="144" shapeRendering="crispEdges" aria-hidden="true">
        {/* arms (behind body) */}
        <g className="hp-arm hp-arm-l"><rect x="5" y="15" width="3" height="9" fill="#f2c39b" /><rect x="5" y="13" width="3" height="3" fill="#f2c39b" /></g>
        <g className="hp-arm hp-arm-r"><rect x="24" y="15" width="3" height="9" fill="#f2c39b" /><rect x="24" y="13" width="3" height="3" fill="#f2c39b" /></g>
        <g className="hp-body">
          {/* afro */}
          <rect x="9" y="0" width="14" height="5" fill="#3b2314" /><rect x="8" y="2" width="16" height="5" fill="#3b2314" />
          {/* head + sweatband */}
          <rect x="11" y="5" width="10" height="8" fill="#f2c39b" />
          <rect x="10" y="5" width="12" height="2" fill="#39ff14" />
          <rect x="13" y="8" width="2" height="2" fill="#000" /><rect x="18" y="8" width="2" height="2" fill="#000" />
          <rect x="13" y="11" width="6" height="1" fill="#3b2314" />
          {/* shirtless: bare chest, gold chain, a little chest hair, belly button */}
          <rect x="8" y="13" width="16" height="11" fill="#f2c39b" />
          <rect x="11" y="13" width="1" height="2" fill="#ffd23f" /><rect x="20" y="13" width="1" height="2" fill="#ffd23f" />
          <rect x="12" y="15" width="8" height="1" fill="#ffd23f" /><rect x="15" y="16" width="2" height="2" fill="#ffd23f" />
          <rect x="14" y="19" width="1" height="1" fill="#3b2314" /><rect x="16" y="18" width="1" height="1" fill="#3b2314" /><rect x="17" y="20" width="1" height="1" fill="#3b2314" />
          <rect x="15" y="22" width="2" height="1" fill="#c98f66" />
          {/* the hot pants */}
          <rect x="9" y="24" width="14" height="5" fill="#00e5ff" /><rect x="9" y="24" width="14" height="1" fill="#fff" />
        </g>
        {/* legs + tube socks + sneakers */}
        <g className="hp-leg hp-leg-l"><rect x="10" y="29" width="4" height="10" fill="#f2c39b" /><rect x="10" y="37" width="4" height="7" fill="#fff" /><rect x="10" y="38" width="4" height="1" fill="#ff2fa8" /><rect x="8" y="44" width="6" height="3" fill="#ff2fa8" /></g>
        <g className="hp-leg hp-leg-r"><rect x="18" y="29" width="4" height="10" fill="#f2c39b" /><rect x="18" y="37" width="4" height="7" fill="#fff" /><rect x="18" y="38" width="4" height="1" fill="#ff2fa8" /><rect x="18" y="44" width="6" height="3" fill="#ff2fa8" /></g>
      </svg>
    </button>
  );
}
