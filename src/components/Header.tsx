import bannerSrc from "../assets/banner.jpg";

export interface HeaderProps {
  game: "poe2";
}

export function Header({ game }: HeaderProps): React.ReactElement {
  return (
    <header className="border-b border-white/10">
      <img src={bannerSrc} alt="Synergy Wizard" className="w-full block" />
      <div className="flex items-center gap-3 px-4 py-2">
        <span className="text-accent text-xl font-semibold">⚡ Synergy Wizard</span>
        <span className={`px-2 py-0.5 rounded text-xs border ${game === "poe2" ? "border-accent text-accent" : "border-white/20 text-white/50"}`}>
          PoE 2
        </span>
        <span className="px-2 py-0.5 rounded text-xs border border-white/10 text-white/40">
          Last Epoch — coming soon
        </span>
      </div>
    </header>
  );
}
