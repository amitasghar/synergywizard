import { useEffect, useState } from "react";
import { api } from "../api/client.ts";
import { useStore } from "../state/store.ts";
import type { Entity } from "../types.ts";
import { EntityCard } from "./EntityCard.tsx";

const CLASSES = ["any", "warrior", "ranger", "sorceress", "witch", "monk", "mercenary"];
const TYPES = ["any", "skill", "support", "passive"];
const TAGS = ["any", "slam", "fire", "cold", "lightning", "aoe", "duration", "projectile", "movement", "minion"];

export function BrowseTab(): React.ReactElement {
  const [klass, setKlass] = useState("any");
  const [type, setType] = useState("any");
  const [tag, setTag] = useState("any");
  const [results, setResults] = useState<Entity[]>([]);
  const addEntity = useStore((s) => s.addEntity);

  useEffect(() => {
    let cancelled = false;
    api.search({
      game: "poe2",
      class: klass === "any" ? undefined : klass,
      type: type === "any" ? undefined : (type as any),
      tag: tag === "any" ? undefined : tag,
    }).then((rows) => { if (!cancelled) setResults(rows); });
    return () => { cancelled = true; };
  }, [klass, type, tag]);

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2 text-xs">
        <label>Class
          <select data-testid="browse-class" value={klass} onChange={(e) => setKlass(e.target.value)} className="block w-full bg-background border border-white/15 rounded px-1 py-0.5">
            {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label>Type
          <select data-testid="browse-type" value={type} onChange={(e) => setType(e.target.value)} className="block w-full bg-background border border-white/15 rounded px-1 py-0.5">
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label>Tag
          <select data-testid="browse-tag" value={tag} onChange={(e) => setTag(e.target.value)} className="block w-full bg-background border border-white/15 rounded px-1 py-0.5">
            {TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      </div>
      <div data-testid="browse-grid" className="flex flex-col gap-1">
        {results.map((r) => (
          <EntityCard key={r.id} entity={r} onAdd={addEntity} />
        ))}
      </div>
    </div>
  );
}
