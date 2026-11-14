import React from "react";
import { WHATS_NEW } from "../data/whatsnew.ts";

function formatDay(d: string): string {
  return new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** Recent changes, so players (and whoever sent the feedback) can see the tool is being worked on. */
export function WhatsNew({ onClose, feedbackLink }: { onClose: () => void; feedbackLink: React.ReactNode }): React.ReactElement {
  return (
    <section className="window" id="whats-new" aria-labelledby="whats-new-title">
      <div className="title-bar">
        <div className="title-bar-text" id="whats-new-title">📰 What's new</div>
        <div className="title-bar-controls">
          <button aria-label="Close" onClick={onClose}></button>
        </div>
      </div>
      <div className="window-body font-prose text-[14px] leading-[1.5]">
        <p className="mt-0 mb-2">
          We keep improving Synergy Wizard, much of it from your ideas. Game data is checked every 3 hours and updates by itself on patch day.
        </p>
        <ul className="m-0 p-0 list-none flex flex-col gap-1.5 max-h-[320px] overflow-y-auto">
          {WHATS_NEW.map((n, i) => (
            <li key={i} className="flex flex-wrap gap-x-2">
              <span className="text-[#555] whitespace-nowrap" style={{ fontFamily: "Tahoma, Verdana, sans-serif", fontSize: 12, paddingTop: 2 }}>
                {formatDay(n.date)}
              </span>
              <span className="flex-1 min-w-[220px]">
                {n.text}
                {n.feedback && <span className="tag ml-1.5" style={{ background: "#c8f7c5" }}>💬 from feedback</span>}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 mb-0">Got an idea or found a problem? {feedbackLink}</p>
      </div>
    </section>
  );
}
