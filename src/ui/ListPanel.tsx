import React, { useState } from "react";
import type { Entity } from "../data/types.ts";
import { track } from "../api/analytics.ts";
import { shareUrl } from "../saved/saved.ts";
import { ResultCard } from "./ResultCard.tsx";

interface Props {
  /** "mine" is the player's saved list; "shared" is a list opened from someone's link. */
  mode: "mine" | "shared";
  ids: string[];
  byId: Map<string, Entity>;
  since?: string;
  isSaved: (id: string) => boolean;
  onToggleSave: (id: string) => void;
  onAddAll: (ids: string[]) => void;
  onClear: () => void;
}

export function ListPanel({ mode, ids, byId, since, isSaved, onToggleSave, onAddAll, onClear }: Props): React.ReactElement {
  const [copied, setCopied] = useState<"" | "ok" | "failed">("");
  const entities = ids.map((id) => byId.get(id)).filter((e): e is Entity => !!e);
  const missing = ids.length - entities.length;
  const link = shareUrl(entities.map((e) => e.id));

  async function copy(): Promise<void> {
    track("list_share", { count: entities.length });
    try {
      await navigator.clipboard.writeText(link);
      setCopied("ok");
    } catch {
      setCopied("failed");
    }
  }

  if (mode === "mine" && !entities.length) {
    return (
      <div className="px-4 py-8 text-center font-prose text-[14px]">
        <p className="m-0 font-bold text-navy">Your list is empty.</p>
        <p className="mt-1 mb-0">Tap ☆ on any result to save it here for later. It stays in this browser; share a link to move it.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="px-3 sm:px-4 py-3 border-b border-[#c0c0c0] font-ui text-[13px] flex flex-wrap items-center gap-2">
        {mode === "shared" ? (
          <>
            <span className="font-bold">A shared list with {entities.length} entr{entities.length === 1 ? "y" : "ies"}.</span>
            <button
              type="button"
              className="tap !min-w-0 !h-auto py-1 px-2"
              onClick={() => {
                track("list_add_shared", { count: entities.length });
                onAddAll(entities.map((e) => e.id));
              }}
            >
              ☆ Add all to my list
            </button>
          </>
        ) : (
          <>
            <span className="font-bold">
              {entities.length} saved · kept in this browser
            </span>
            <button type="button" className="tap !min-w-0 !h-auto py-1 px-2" onClick={copy}>
              🔗 Copy share link
            </button>
            <button type="button" className="link-btn" onClick={onClear}>
              Clear list
            </button>
          </>
        )}
        {copied === "ok" && <span className="text-[#006400]">Link copied. Paste it anywhere to share this list.</span>}
        {copied === "failed" && (
          <input aria-label="Share link" readOnly value={link} className="w-full" onFocus={(e) => e.currentTarget.select()} />
        )}
        {missing > 0 && (
          <span className="w-full text-[12px] text-[#555]">
            {missing} saved entr{missing === 1 ? "y isn't" : "ies aren't"} in this patch any more.
          </span>
        )}
      </div>
      {entities.map((e) => (
        <ResultCard key={e.id} entity={e} since={since} saved={isSaved(e.id)} onToggleSave={() => onToggleSave(e.id)} />
      ))}
    </div>
  );
}
