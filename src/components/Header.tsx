export interface HeaderProps {
  game: "poe2";
}

const KOFI_URL = "https://ko-fi.com/YOUR_KOFI_USERNAME";

export function Header({ game }: HeaderProps): React.ReactElement {
  return (
    <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-accent text-xl font-semibold">⚡ Synergy Wizard</span>
        <span className={`px-2 py-0.5 rounded text-xs border ${game === "poe2" ? "border-accent text-accent" : "border-white/20 text-white/50"}`}>
          PoE 2
        </span>
        <span className="px-2 py-0.5 rounded text-xs border border-white/10 text-white/40">
          Last Epoch — coming soon
        </span>
      </div>
      <a
        href={KOFI_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="px-3 py-1 rounded bg-accent text-background text-sm font-medium hover:opacity-90"
      >
        Support on Ko-fi ♥
      </a>
    </header>
  );
}
