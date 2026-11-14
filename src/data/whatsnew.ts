/**
 * The "What's new" list on the site, newest first. Add a line whenever a change ships that players would notice.
 * feedback: true marks changes that came from player feedback, so the person who asked can see it landed.
 * Game data updates are not listed here; they happen automatically and show as the PATCH tag in the header.
 */
export interface NewsItem {
  date: string; // YYYY-MM-DD
  text: string;
  feedback?: boolean;
}

export const WHATS_NEW: NewsItem[] = [
  { date: "2026-11-14", text: "Fixed: some Path of Exile 1 uniques had slipped into the search. Uniques are PoE2-only again.", feedback: true },
  { date: "2026-11-14", text: "Better feedback form: pick an idea or a problem, say where you saw it, and leave an email if you'd like to hear when it's done.", feedback: true },
  { date: "2026-11-14", text: "synergywizard.com now works as a short address." },
  { date: "2026-11-07", text: "Uniques now come from Path of Building's data: more complete, and updated quickly after patches.", feedback: true },
  { date: "2026-11-06", text: "My list: tap ☆ on any result to save it, then share your list with a link." },
  { date: "2026-11-06", text: "Unique items are searchable, and NEW / CHANGED tags show what changed since the last patch." },
  { date: "2026-10-27", text: "Hide results that mention a word (like \"energy shield\"), or type -word in the search.", feedback: true },
  { date: "2026-10-27", text: "Each result shows the weapon it needs.", feedback: true },
  { date: "2026-10-24", text: "Search understands more player slang, like \"keep dying\" and \"clear packs\"." },
  { date: "2026-10-21", text: "Synergy Wizard launched." },
];

export const LATEST_NEWS = WHATS_NEW[0]?.date ?? "";
