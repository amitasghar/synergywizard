// "My list": entries a player saves for later. Kept in this browser only (no accounts);
// a share link carries the ids in the URL so a list can move to a friend or another device.
import { useCallback, useEffect, useState } from "react";

const KEY = "sw.saved";
const PARAM = "list";

function load(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const ids = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function store(ids: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // Private mode or blocked storage: the list just won't survive a reload.
  }
}

export function useSaved(): {
  ids: string[];
  has: (id: string) => boolean;
  toggle: (id: string) => void;
  add: (more: string[]) => void;
  clear: () => void;
} {
  const [ids, setIds] = useState<string[]>(load);
  useEffect(() => store(ids), [ids]);
  const has = useCallback((id: string) => ids.includes(id), [ids]);
  const toggle = useCallback((id: string) => setIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id])), []);
  const add = useCallback((more: string[]) => setIds((cur) => [...cur, ...more.filter((id) => !cur.includes(id))]), []);
  const clear = useCallback(() => setIds([]), []);
  return { ids, has, toggle, add, clear };
}

/** Ids from a shared link (?list=a,b,c), or null when the page wasn't opened from one. */
export function readSharedList(search: string): string[] | null {
  const raw = new URLSearchParams(search).get(PARAM);
  return raw ? [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))] : null;
}

export function shareUrl(ids: string[]): string {
  return `${window.location.origin}${window.location.pathname}?${PARAM}=${ids.map(encodeURIComponent).join(",")}`;
}
