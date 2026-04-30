import React from "react";
import { D4FilterSidebar } from "./D4FilterSidebar.tsx";
import { D4CenterPanel } from "./D4CenterPanel.tsx";
import { D4SandboxPanel } from "./D4SandboxPanel.tsx";
import { D4AnalysisPanel } from "./D4AnalysisPanel.tsx";

export function D4Experience(): React.ReactElement {
  return (
    <div className="flex-1 flex overflow-hidden">
      <D4FilterSidebar />
      <D4CenterPanel />
      <div className="w-[380px] min-w-[380px] flex flex-col overflow-hidden min-h-0">
        <D4SandboxPanel />
        <D4AnalysisPanel className="border-t border-white/10" />
      </div>
    </div>
  );
}
