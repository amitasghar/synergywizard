import React, { useState } from "react";
import { BrowseTab } from "./BrowseTab.tsx";
import { AskTab } from "./AskTab.tsx";

type CenterTab = "browse" | "ask";

export function CenterPanel(): React.ReactElement {
  const [tab, setTab] = useState<CenterTab>("browse");

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden border-r border-white/10">
      {/* Tab bar */}
      <div className="flex border-b border-white/10 bg-background">
        <button
          type="button"
          data-testid="tab-browse"
          onClick={() => setTab("browse")}
          className={`px-4 py-2 text-sm transition-colors ${
            tab === "browse"
              ? "text-accent border-b-2 border-accent -mb-px"
              : "text-white/40 hover:text-white/70"
          }`}
        >
          Browse
        </button>
        <button
          type="button"
          data-testid="tab-ask"
          onClick={() => setTab("ask")}
          className={`px-4 py-2 text-sm transition-colors ${
            tab === "ask"
              ? "text-accent border-b-2 border-accent -mb-px"
              : "text-white/40 hover:text-white/70"
          }`}
        >
          ✦ Ask AI
        </button>
      </div>

      {/* Both tabs stay mounted to preserve state (search query, chat history) across switches */}
      <div className={`flex-1 overflow-hidden ${tab === "browse" ? "" : "hidden"}`}>
        <BrowseTab />
      </div>
      <div className={`flex-1 overflow-hidden ${tab === "ask" ? "" : "hidden"}`}>
        <AskTab />
      </div>
    </div>
  );
}
