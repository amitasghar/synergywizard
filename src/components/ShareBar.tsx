import React, { useState } from "react";
import { track } from "../api/analytics.ts";
import { useStore } from "../state/store.ts";
import { encodeStateToUrl } from "../state/url.ts";
import { toJson, toMarkdown, toPlainText } from "../export/formats.ts";

function triggerDownload(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ShareBar(): React.ReactElement {
  const selected = useStore((s) => s.selectedEntities);
  const analysis = useStore((s) => s.analysisResult);
  const conversion = useStore((s) => s.conversion);
  const [copied, setCopied] = useState(false);

  async function copyShareUrl() {
    const slugs = selected.map((e) => e.entity_slug);
    const conv = conversion
      ? {
          slug: selected.find((e) => e.id === conversion.entityId)?.entity_slug ?? "",
          from: conversion.from,
          to: conversion.to,
        }
      : null;
    const url = encodeStateToUrl(window.location.href, {
      slugs,
      conversion: conv && conv.slug ? conv : null,
    });
    window.history.replaceState(null, "", url);
    await navigator.clipboard.writeText(url);
    track("share_url_copy", { entity_count: selected.length });
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function exportAs(format: "markdown" | "text" | "json") {
    if (!analysis) return;
    if (format === "markdown") {
      triggerDownload(toMarkdown(analysis), "synergy-wizard-build.md", "text/markdown");
    } else if (format === "text") {
      triggerDownload(toPlainText(analysis), "synergy-wizard-build.txt", "text/plain");
    } else {
      triggerDownload(toJson(analysis), "synergy-wizard-build.json", "application/json");
    }
    track("export_action", { format });
  }

  const canShare = selected.length > 0;
  const canExport = !!analysis;

  return (
    <section className="flex items-center gap-2 pt-3 border-t border-white/10">
      <button
        type="button"
        data-testid="share-url"
        onClick={copyShareUrl}
        disabled={!canShare}
        className="px-3 py-1 rounded border border-accent/50 text-accent hover:bg-accent/10 text-sm disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
      >
        🔗 {copied ? "Copied!" : "Share URL"}
      </button>
      <div className="relative">
        <details data-testid="export-dropdown" {...(!canExport ? { onClick: (e: React.MouseEvent) => e.preventDefault() } : {})}>
          <summary className={`list-none px-3 py-1 rounded border border-white/20 text-sm ${canExport ? "cursor-pointer" : "opacity-30 cursor-not-allowed"}`}>
            📋 Export ▾
          </summary>
          {canExport && (
            <div className="absolute mt-1 bg-background border border-white/20 rounded z-10">
              <button type="button" data-testid="export-md"   onClick={() => exportAs("markdown")} className="block w-full text-left px-3 py-1 text-sm hover:bg-white/5">Markdown</button>
              <button type="button" data-testid="export-txt"  onClick={() => exportAs("text")}     className="block w-full text-left px-3 py-1 text-sm hover:bg-white/5">Plain text</button>
              <button type="button" data-testid="export-json" onClick={() => exportAs("json")}     className="block w-full text-left px-3 py-1 text-sm hover:bg-white/5">JSON</button>
            </div>
          )}
        </details>
      </div>
    </section>
  );
}
