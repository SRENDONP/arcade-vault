// Registro de juegos jugables: asocia el `id` del catálogo (lib/games.ts) con
// su componente. Los juegos sin entrada usan el simulador (GamePlayer).

import type { ComponentType } from "react";
import { CaidaGame } from "@/games/caida/caida-game";
import type { Game } from "@/lib/games";

export type PlayableProps = { game: Game };

// Solo los juegos con implementación real tienen entrada.
export const PLAYABLE: Partial<Record<string, ComponentType<PlayableProps>>> = {
  caida: CaidaGame,
};

export function getPlayable(
  id: string,
): ComponentType<PlayableProps> | undefined {
  return Object.prototype.hasOwnProperty.call(PLAYABLE, id)
    ? PLAYABLE[id]
    : undefined;
}
