import { useEffect, useState } from "react";
import { api } from "../api/client.ts";
import { useStore } from "../state/store.ts";
import type { Entity } from "../types.ts";
import { EntityCard } from "./EntityCard.tsx";

// Weapon types for skills/supports. Only "bow" has data currently;
// others will populate once the extractor adds weapon_tags to the seed.
const WEAPONS = ["any", "bow", "crossbow", "mace", "flail", "axe", "sword", "dagger", "spear", "staff", "wand", "shield", "unarmed"];
const TYPES = ["any", "skill", "support", "passive"];
// Tags drawn from actual mechanic_tags in the seed, highest-count first.
const TAGS = ["any", "aoe", "attack", "spell", "melee", "duration", "projectile", "fire", "lightning", "physical", "cold", "minion", "slam", "warcry", "aura", "movement", "herald", "channelling", "totem", "trap"];

export function BrowseTab(): React.ReactElement {
  const [weapon, setWeapon] = useState("any");
  const [type, setType] = useState("any");
  const [tag, setTag] = useState("any");
  const [results, setResults] = useState<Entity[]>([]);
  const addEntity = useStore((s) => s.addEntity);

  useEffect(() => {
    let cancelled = false;
    api.search({
      game: "poe2",
      weapons: weapon === "any" ? undefined : [weapon],
      types: type === "any" ? undefined : [type],
      mechanics: tag === "any" ? undefined : [tag],
    }).then((rows) => { if (!cancelled) setResults(rows); })
      .catch(() => { if (!cancelled) setResults([]); });
    return () => { cancelled = true; };
  }, [weapon, type, tag]);

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2 text-xs">
        <label>Weapon
          <select data-testid="browse-weapon" value={weapon} onChange={(e) => setWeapon(e.target.value)} className="block w-full bg-background border border-white/15 rounded px-1 py-0.5">
            {WEAPONS.map((w) => <option key={w} value={w}>{w}</option>)}
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
