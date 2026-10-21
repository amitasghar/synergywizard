// poe2db pages are named after the item: "Zealot's Oath" → /us/Zealots_Oath,
// "...and Protect me from Harm" → /us/and_Protect_me_from_Harm.
export function poe2dbUrl(name: string): string {
  const slug = name
    .replace(/[^A-Za-z0-9 ]/g, "")
    .trim()
    .replace(/\s+/g, "_");
  return `https://poe2db.tw/us/${slug}`;
}

// The wiki sits behind a bot check, so go through its search, which jumps straight to an exact match.
export function wikiUrl(name: string): string {
  return `https://www.poe2wiki.net/index.php?search=${encodeURIComponent(name.replace(/^\.+/, ""))}`;
}
