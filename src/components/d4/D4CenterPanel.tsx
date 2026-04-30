import React, { useState } from "react";
import { D4BrowseTab } from "./D4BrowseTab.tsx";
import { D4AskTab } from "./D4AskTab.tsx";

type CenterTab = "browse" | "ask";

export function D4CenterPanel(): React.ReactElement {
  const [tab, setTab] = useState<CenterTab>("browse");

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden border-r border-white/10">
      <div className="flex border-b border-white/10 bg-background">
        <button
          type="button"
          onClick={() => setTab("browse")}
          className={`px-4 py-2 text-sm transition-colors ${
            tab === "browse" ? "text-accent border-b-2 border-accent -mb-px" : "text-white/40 hover:text-white/70"
          }`}
        >
          Browse
        </button>
        <button
          type="button"
          onClick={() => setTab("ask")}
          className={`px-4 py-2 text-sm transition-colors ${
            tab === "ask" ? "text-accent border-b-2 border-accent -mb-px" : "text-white/40 hover:text-white/70"
          }`}
        >
          ✦ Ask AI
        </button>
      </div>
      <div className={`flex-1 overflow-hidden ${tab === "browse" ? "" : "hidden"}`}>
        <D4BrowseTab />
      </div>
      <div className={`flex-1 overflow-hidden ${tab === "ask" ? "" : "hidden"}`}>
        <D4AskTab />
      </div>
    </div>
  );
}
