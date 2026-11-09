// Registro de juegos jugables: asocia el `id` del catálogo (lib/games.ts) con
// su componente. Los juegos sin entrada usan el simulador (GamePlayer).

import type { ComponentType } from "react";
import { BloqueBusterGame } from "@/games/bloque-buster/bloque-buster-game";
import { CaidaGame } from "@/games/caida/caida-game";
import { DueloPixelGame } from "@/games/duelo-pixel/duelo-pixel-game";
import { RocasGame } from "@/games/rocas/rocas-game";
import { SerpentinaGame } from "@/games/serpentina/serpentina-game";
import type { Game } from "@/lib/games";

export type PlayableProps = { game: Game };

// Solo los juegos con implementación real tienen entrada.
export const PLAYABLE: Partial<Record<string, ComponentType<PlayableProps>>> = {
  "bloque-buster": BloqueBusterGame,
  caida: CaidaGame,
  "duelo-pixel": DueloPixelGame,
  rocas: RocasGame,
  serpentina: SerpentinaGame,
};

// Only real games save to the leaderboard: the simulator raises its own score.
// Reads only the keys, so a Server Action can call it without rendering anything.
export function isRanked(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(PLAYABLE, id);
}

export function getPlayable(
  id: string,
): ComponentType<PlayableProps> | undefined {
  return Object.prototype.hasOwnProperty.call(PLAYABLE, id)
    ? PLAYABLE[id]
    : undefined;
}
