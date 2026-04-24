import type { ReactNode } from "react";

export type TagKind = "mechanic" | "damage" | "class";

export interface TagChipProps {
  kind: TagKind;
  children: ReactNode;
}

const COLORS: Record<TagKind, string> = {
  mechanic: "bg-tagMechanic/90 text-white",
  damage: "bg-tagDamage/90 text-white",
  class: "bg-tagClass/90 text-white",
};

export function TagChip({ kind, children }: TagChipProps): React.ReactElement {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-mono mr-1 mb-1 ${COLORS[kind]}`}
    >
      {children}
    </span>
  );
}
