import type { AnalysisResult } from "../types.ts";

function nameFor(a: AnalysisResult, id: string | null | undefined): string {
  if (!id) return "?";
  return a.entities.find((e) => e.id === id)?.display_name ?? id;
}

export function toMarkdown(a: AnalysisResult): string {
  const lines: string[] = [];
  lines.push("# Synergy Wizard — POE2 Build");
  lines.push("");
  lines.push(`**Entities:** ${a.entities.map((e) => e.display_name).join(", ")}`);
  lines.push(`**Damage tags:** ${a.damage_tags.join(", ") || "—"}`);
  lines.push("");
  lines.push("## Direct Interactions");
  a.direct_interactions.forEach((e) => {
    lines.push(`- **${nameFor(a, e.from_entity_id)} ↔ ${nameFor(a, e.to_entity_id)}** — ${e.reason}`);
  });
  lines.push("");
  lines.push("## Extended Interactions");
  a.extended_interactions.forEach((e) => {
    lines.push(`- ${nameFor(a, e.from_entity_id)} → ${nameFor(a, e.to_entity_id)} — ${e.reason}`);
  });
  lines.push("");
  if (a.recommended_supports.length) {
    lines.push("## Recommended Supports");
    a.recommended_supports.forEach((s) => lines.push(`- ${s}`));
    lines.push("");
  }
  if (a.relevant_passives.length) {
    lines.push("## Relevant Passives");
    a.relevant_passives.forEach((p) => lines.push(`- ${p}`));
    lines.push("");
  }
  lines.push("---");
  lines.push("Built with Synergy Wizard — https://synergywizard.netlify.app");
  return lines.join("\n");
}

export function toPlainText(a: AnalysisResult): string {
  const parts: string[] = [];
  parts.push(`Synergy Wizard: ${a.entities.map((e) => e.display_name).join(" + ")}`);
  parts.push(`Direct: ${a.direct_interactions.map((e) => `${nameFor(a, e.from_entity_id)}<->${nameFor(a, e.to_entity_id)}`).join("; ") || "none"}`);
  parts.push(`Damage: ${a.damage_tags.join("/") || "n/a"}`);
  if (a.recommended_supports.length) parts.push(`Supports: ${a.recommended_supports.join(", ")}`);
  if (a.relevant_passives.length) parts.push(`Passives: ${a.relevant_passives.join(", ")}`);
  return parts.join("\n");
}

export function toJson(a: AnalysisResult): string {
  return JSON.stringify(a, null, 2);
}
