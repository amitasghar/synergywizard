import React from "react";

export type GameId = "poe2" | "d4";

interface GameSelectorProps {
  active: GameId;
  onChange: (game: GameId) => void;
}

const GAMES: { id: GameId; label: string; path: string }[] = [
  { id: "poe2", label: "Path of Exile 2", path: "/poe2" },
  { id: "d4",   label: "Diablo IV",       path: "/d4"   },
];

export function GameSelector({ active, onChange }: GameSelectorProps): React.ReactElement {
  function handleSelect(game: (typeof GAMES)[number]) {
    window.history.pushState({}, "", game.path);
    onChange(game.id);
  }

  return (
    <div className="flex gap-1 px-4 py-1.5 border-b border-white/10">
      {GAMES.map((game) => (
        <button
          key={game.id}
          type="button"
          onClick={() => handleSelect(game)}
          className={`px-3 py-1 rounded text-xs transition-colors ${
            active === game.id
              ? "bg-accent/20 text-accent border border-accent/40"
              : "text-white/40 border border-transparent hover:text-white/60 hover:border-white/15"
          }`}
        >
          {game.label}
        </button>
      ))}
    </div>
  );
}
