export interface AdConfig {
  client: string;
  inlineSlot: string | null;
  bottomSlot: string | null;
}

type Env = Record<string, unknown>;

const slotOf = (v: unknown): string | null => (typeof v === "string" && /^\d+$/.test(v.trim()) ? v.trim() : null);

/** Ads stay completely off (null) unless a valid publisher id and at least one slot id are configured. */
export function readAdConfig(env: Env): AdConfig | null {
  const client = typeof env.VITE_ADSENSE_CLIENT === "string" ? env.VITE_ADSENSE_CLIENT.trim() : "";
  if (!/^ca-pub-\d{16}$/.test(client)) return null;
  const inlineSlot = slotOf(env.VITE_ADSENSE_SLOT_INLINE);
  const bottomSlot = slotOf(env.VITE_ADSENSE_SLOT_BOTTOM);
  if (!inlineSlot && !bottomSlot) return null;
  return { client, inlineSlot, bottomSlot };
}

export const adConfig: AdConfig | null = readAdConfig(import.meta.env as Env);
