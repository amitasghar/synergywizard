import React, { useEffect, useState } from "react";

interface SeedStatus {
  present: boolean;
  extracted_at?: string;
  patch_version?: string;
  entity_counts?: { skill: number; support: number; passive: number };
  poe2Dir: string;
}

function staleness(extractedAt: string): { label: string; color: string } {
  const ageMs = Date.now() - new Date(extractedAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays < 7) return { label: "Fresh", color: "text-green-400 border-green-400" };
  if (ageDays <= 30) return { label: "Aging", color: "text-yellow-400 border-yellow-400" };
  return { label: "Stale", color: "text-red-400 border-red-400" };
}

function relativeAge(extractedAt: string): string {
  const ageMs = Date.now() - new Date(extractedAt).getTime();
  const days = Math.floor(ageMs / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export function AdminPage(): React.ReactElement {
  const [status, setStatus] = useState<SeedStatus | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/seed-status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ present: false, poe2Dir: "" }));
  }, []);

  const command = status
    ? `python -m pipeline.extract_game_data --poe2-dir "${status.poe2Dir}"`
    : "";

  function handleCopy() {
    navigator.clipboard.writeText(command).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const badge =
    status?.present && status.extracted_at
      ? staleness(status.extracted_at)
      : { label: "Missing", color: "text-red-400 border-red-400" };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <h1 className="text-2xl font-semibold mb-6">Seed Status</h1>

      {/* Status card */}
      <div className="border border-white/10 rounded-lg p-6 mb-6 max-w-lg">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-lg font-medium">
            {status === null ? "Loading..." : status.present ? "Seed present" : "Seed missing"}
          </span>
          {status !== null && (
            <span className={`px-2 py-0.5 rounded text-xs border ${badge.color}`}>
              {badge.label}
            </span>
          )}
        </div>

        {status?.present && status.extracted_at && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-white/50">Extracted</dt>
            <dd>{relativeAge(status.extracted_at)}</dd>

            <dt className="text-white/50">Patch</dt>
            <dd>{status.patch_version ?? "—"}</dd>

            {status.entity_counts && (
              <>
                <dt className="text-white/50">Skills</dt>
                <dd>{status.entity_counts.skill}</dd>

                <dt className="text-white/50">Supports</dt>
                <dd>{status.entity_counts.support}</dd>

                <dt className="text-white/50">Passives</dt>
                <dd>{status.entity_counts.passive}</dd>
              </>
            )}
          </dl>
        )}
      </div>

      {/* Command box */}
      <div className="border border-white/10 rounded-lg p-6 max-w-2xl">
        <h2 className="text-sm font-medium text-white/70 mb-3 uppercase tracking-wider">
          Run extraction
        </h2>
        <div className="flex items-stretch gap-2">
          <code className="flex-1 bg-white/5 rounded px-3 py-2 text-sm font-mono break-all">
            {command}
          </code>
          <button
            onClick={handleCopy}
            className="px-3 py-2 rounded border border-white/20 text-sm hover:border-white/40 transition-colors shrink-0"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <p className="mt-3 text-xs text-white/40">
          After running, commit{" "}
          <code className="font-mono">pipeline/data/poe2_seed.json</code> and push to trigger the
          pipeline.
        </p>
      </div>
    </div>
  );
}
