// __id__ — lógica pura del juego.
// Sin React, window, document, performance, localStorage ni Math.random:
// la aleatoriedad llega por s.rng (el componente pasa Math.random).
// Unidades: px, px/s y segundos; origen arriba a la izquierda.

export const W = 800; // TODO: campo lógico del spec
export const H = 600;
export const START_LIVES = 3; // TODO: quitar si el juego no tiene vidas
export const MAX_DT = 0.05; // s; el componente ya limita dt con este valor
export const MAX_SCORE = 99_999_999; // igual que lib/scores.ts y el CHECK de public.scores

// TODO: constantes de reglas (velocidades, puntos, probabilidades…) con los
// valores exactos de la referencia o del spec.

export type Vec = { x: number; y: number };

// TODO: tipos de las entidades como objetos planos (no clases).
// export type Enemy = Vec & { vx: number; vy: number; radius: number; dead: boolean };

export type EngineState = "playing" | "gameover"; // TODO: + "dead" si hay espera al perder vida

export type __Pascal__State = {
  // TODO: entidades
  score: number; // siempre entero
  lives: number;
  level: number;
  // TODO: contadores para el `extra` del modal
  state: EngineState;
  rng: () => number;
};

// Entrada de un frame: teclas mantenidas + acciones de una sola vez por pulsación.
export type __Pascal__Input = {
  left: boolean;
  right: boolean;
  // TODO: resto de teclas mantenidas
  action: boolean; // TODO: renombrar (fire, rotate, drop…); true solo en el frame de la pulsación
};

export function createState(rng: () => number): __Pascal__State {
  return {
    score: 0,
    lives: START_LIVES,
    level: 1,
    state: "playing",
    rng,
  };
}

// Avanza la partida dt segundos. Muta s.
// Juegos por ticks: acumular dt en el estado y avanzar un tick cada N segundos.
export function step(s: __Pascal__State, dt: number, input: __Pascal__Input): void {
  if (s.state === "gameover") return;
  void dt;
  void input;
  // TODO: mover entidades, colisiones, puntos (addScore), vidas, niveles.
  // Al perder la última vida: s.state = "gameover".
}

// ¿Sigue habiendo animación tras el game over (explosión, partículas)?
// Mientras devuelva true el componente sigue dibujando en la fase "over".
export function isAnimating(s: __Pascal__State): boolean {
  void s;
  return false;
}

export function addScore(s: __Pascal__State, points: number): void {
  s.score = Math.min(MAX_SCORE, s.score + Math.round(points));
}

export function wrap(v: number, max: number): number {
  return ((v % max) + max) % max;
}
