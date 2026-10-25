import React, { useEffect } from "react";
import { getConsent } from "../api/analytics.ts";
import type { AdConfig } from "../ads/config.ts";

type AdWindow = Window & { adsbygoogle?: unknown[] };

export function AdSlot({ slot, config }: { slot: string; config: AdConfig | null }): React.ReactElement | null {
  const show = !!config && getConsent() === "granted";
  useEffect(() => {
    if (!show) return;
    try {
      const w = window as AdWindow;
      (w.adsbygoogle = w.adsbygoogle || []).push({});
    } catch {
      // ad blocker or script failure: leave the frame empty
    }
  }, [show]);
  if (!show || !config) return null;
  return (
    <div className="px-2 py-2 border-t border-[#c0c0c0] bg-[#dfdfdf]" style={{ minHeight: 120 }}>
      <div style={{ font: "11px Tahoma, sans-serif", color: "#555", marginBottom: 2 }}>Advertisement</div>
      <div className="bg-white" style={{ boxShadow: "inset -1px -1px #fff, inset 1px 1px grey, inset -2px -2px #dfdfdf, inset 2px 2px #0a0a0a", padding: 2 }}>
        <ins
          className="adsbygoogle"
          style={{ display: "block" }}
          data-ad-client={config.client}
          data-ad-slot={slot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    </div>
  );
}
