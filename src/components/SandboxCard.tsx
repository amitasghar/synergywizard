import React from "react";
import type { Entity } from "../types.ts";

interface Props {
  entity: Entity;
  index: number;
  onRemove: (id: string) => void;
  onDragStart: (index: number) => void;
}

function typeBadgeStyle(type: string): string {
  if (type === "skill")   return "text-[#e74c3c]";
  if (type === "support") return "text-[#3498db]";
  return "text-white/50";
}

function cardBorderStyle(type: string): string {
  if (type === "skill")   return "border-accent/30";
  if (type === "support") return "border-[#3498db]/30";
  return "border-white/10";
}

function tagSummary(entity: Entity): string {
  const parts = [...entity.damage_tags, ...entity.mechanic_tags].slice(0, 4);
  return parts.join(" · ");
}

export function SandboxCard({ entity, index, onRemove, onDragStart }: Props): React.ReactElement {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/synergy-index", String(index));
        e.dataTransfer.effectAllowed = "move";
        onDragStart(index);
      }}
      className={`relative bg-background/60 border ${cardBorderStyle(entity.entity_type)} rounded p-2 cursor-grab active:cursor-grabbing select-none`}
    >
      <span
        className="absolute top-1 left-1.5 text-white/20 text-[10px] cursor-grab"
        aria-hidden="true"
      >⠿</span>
      <button
        type="button"
        aria-label={`Remove ${entity.display_name}`}
        onClick={() => onRemove(entity.id)}
        className="absolute top-1 right-1.5 text-white/25 hover:text-white/70 text-[11px] leading-none"
      >✕</button>
      <div className="mt-3">
        <div className={`text-[9px] uppercase tracking-wider font-semibold ${typeBadgeStyle(entity.entity_type)}`}>
          {entity.entity_type}
        </div>
        <div className="text-sm font-medium text-white leading-tight mt-0.5 truncate">
          {entity.display_name}
        </div>
        <div className="text-[10px] text-white/35 mt-0.5 truncate">
          {tagSummary(entity)}
        </div>
      </div>
    </div>
  );
}
