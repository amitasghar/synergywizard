import type { Entity } from "../types.ts";
import { TagChip } from "./TagChip.tsx";

export interface EntityCardProps {
  entity: Entity;
  onAdd: (entity: Entity) => void;
  disabled?: boolean;
}

export function EntityCard({ entity, onAdd, disabled }: EntityCardProps): React.ReactElement {
  return (
    <div className="border border-white/10 rounded p-2 flex items-start justify-between hover:border-accent/40 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="text-accent font-medium truncate">{entity.display_name}</div>
        <div className="text-xs text-white/60 mb-1 capitalize">{entity.entity_type}</div>
        <div className="flex flex-wrap">
          {entity.mechanic_tags.map((t) => (
            <TagChip key={`m-${t}`} kind="mechanic">{t}</TagChip>
          ))}
          {entity.damage_tags.map((t) => (
            <TagChip key={`d-${t}`} kind="damage">{t}</TagChip>
          ))}
          {entity.class_tags.map((t) => (
            <TagChip key={`c-${t}`} kind="class">{t}</TagChip>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onAdd(entity)}
        disabled={disabled}
        aria-label={`Add ${entity.display_name}`}
        className="ml-2 border border-accent/60 text-accent px-2 py-0.5 rounded hover:bg-accent hover:text-background disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}
