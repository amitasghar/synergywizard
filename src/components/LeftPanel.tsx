import { useState } from "react";
import { SearchTab } from "./SearchTab.tsx";
import { BrowseTab } from "./BrowseTab.tsx";

type Tab = "search" | "browse";

export function LeftPanel(): React.ReactElement {
  const [tab, setTab] = useState<Tab>("search");
  return (
    <aside className="w-[320px] border-r border-white/10 p-3 flex flex-col gap-3 overflow-y-auto">
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => setTab("search")}
          data-testid="tab-search"
          className={`flex-1 px-3 py-1 rounded text-sm ${tab === "search" ? "bg-accent text-background" : "border border-white/15 text-white/70"}`}
        >Search</button>
        <button
          type="button"
          onClick={() => setTab("browse")}
          data-testid="tab-browse"
          className={`flex-1 px-3 py-1 rounded text-sm ${tab === "browse" ? "bg-accent text-background" : "border border-white/15 text-white/70"}`}
        >Browse</button>
      </div>
      {tab === "search" ? <SearchTab /> : <BrowseTab />}
    </aside>
  );
}
