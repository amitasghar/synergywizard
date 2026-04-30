import React from "react";
import bannerSrc from "../assets/banner.jpg";
import { GameSelector, type GameId } from "./GameSelector.tsx";

interface HeaderProps {
  activeGame: GameId;
  onGameChange: (game: GameId) => void;
}

export function Header({ activeGame, onGameChange }: HeaderProps): React.ReactElement {
  return (
    <header className="border-b border-white/10">
      <img src={bannerSrc} alt="Synergy Wizard" className="w-full block" />
      <div className="flex items-center gap-3 px-4 py-2">
        <span className="text-accent text-xl font-semibold">⚡ Synergy Wizard</span>
      </div>
      <GameSelector active={activeGame} onChange={onGameChange} />
    </header>
  );
}
