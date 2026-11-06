// serpentina — lógica pura del juego (SPEC 09).
// Sin React, window, document, performance, localStorage ni Math.random:
// la aleatoriedad llega por s.rng (el componente pasa Math.random).
// Juego por casillas: (col, row) con origen arriba a la izquierda; tiempos en
// segundos. Avanza por ticks con un acumulador dentro de step().

export const COLS = 24;
export const ROWS = 24;
export const CELL = 24; // px
export const W = COLS * CELL; // 576
export const H = ROWS * CELL; // 576
export const MAX_DT = 0.05; // s; el componente ya limita dt con este valor
export const MAX_SCORE = 99_999_999; // igual que lib/scores.ts y el CHECK de public.scores

export const START_LENGTH = 3;
export const START_HEAD = { col: 8, row: 12 } as const;
export const BASE_STEP = 0.15; // s por casilla en el nivel 1
export const STEP_DEC = 0.01; // s menos por nivel
export const MIN_STEP = 0.06; // s
export const FOOD_PER_LEVEL = 5;
export const FOOD_POINTS = 10; // × nivel
export const GROW_PER_FOOD = 1;
export const BONUS_POINTS = 50; // × nivel
export const BONUS_TIME = 5; // s
export const MAX_QUEUE = 2;

export type Dir = "up" | "down" | "left" | "right";
export type Cell = { col: number; row: number };
// waiting = quieta hasta la primera dirección válida.
export type EngineState = "waiting" | "playing" | "gameover";

export type SerpentinaState = {
  body: Cell[]; // body[0] = cabeza
  dir: Dir; // dirección actual (orientación inicial: right)
  queue: Dir[]; // giros pendientes, máx. MAX_QUEUE
  grow: number; // casillas pendientes de crecer
  food: Cell | null; // null solo con el tablero lleno
  bonus: { cell: Cell; timeLeft: number } | null;
  acc: number; // acumulador del tick
  time: number; // segundos de partida (animaciones)
  score: number; // siempre entero
  level: number;
  foodEaten: number;
  bonusEaten: number;
  crash: Cell | null; // casilla del choque, para el dibujo final
  state: EngineState;
  rng: () => number;
};

// Entrada de un frame: direcciones pulsadas desde el último frame, una por pulsación.
export type SerpentinaInput = {
  turns: Dir[];
};

export const DELTA: Record<Dir, { dc: number; dr: number }> = {
  up: { dc: 0, dr: -1 },
  down: { dc: 0, dr: 1 },
  left: { dc: -1, dr: 0 },
  right: { dc: 1, dr: 0 },
};

const OPPOSITE: Record<Dir, Dir> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

export function stepTime(level: number): number {
  return Math.max(MIN_STEP, BASE_STEP - STEP_DEC * (level - 1));
}

export function createState(rng: () => number): SerpentinaState {
  const body: Cell[] = [];
  for (let i = 0; i < START_LENGTH; i++) {
    body.push({ col: START_HEAD.col - i, row: START_HEAD.row });
  }
  const s: SerpentinaState = {
    body,
    dir: "right",
    queue: [],
    grow: 0,
    food: null,
    bonus: null,
    acc: 0,
    time: 0,
    score: 0,
    level: 1,
    foodEaten: 0,
    bonusEaten: 0,
    crash: null,
    state: "waiting",
    rng,
  };
  s.food = randomFreeCell(s, []);
  return s;
}

// Aplica las reglas de la cola de giros. En "waiting", la primera dirección
// válida (cualquiera salvo la que mete la cabeza en el cuello) pone en marcha
// la serpiente; el primer avance llega tras un tick completo.
export function enqueueTurn(s: SerpentinaState, d: Dir): void {
  if (s.state === "gameover") return;
  if (s.state === "waiting") {
    if (d === OPPOSITE[s.dir]) return;
    s.dir = d;
    s.acc = 0;
    s.state = "playing";
    return;
  }
  if (s.queue.length >= MAX_QUEUE) return;
  const last = s.queue.length > 0 ? s.queue[s.queue.length - 1] : s.dir;
  if (d === last || d === OPPOSITE[last]) return;
  s.queue.push(d);
}

// Avanza la partida dt segundos. Muta s.
export function step(
  s: SerpentinaState,
  dt: number,
  input: SerpentinaInput,
): void {
  if (s.state === "gameover") return;
  for (const d of input.turns) enqueueTurn(s, d);
  s.time += dt;
  if (s.state !== "playing") return;

  if (s.bonus) {
    s.bonus.timeLeft -= dt;
    if (s.bonus.timeLeft <= 0) s.bonus = null;
  }

  s.acc += dt;
  while (s.state === "playing" && s.acc >= stepTime(s.level)) {
    s.acc -= stepTime(s.level);
    tick(s);
  }
}

// Un avance de una casilla.
function tick(s: SerpentinaState): void {
  const turn = s.queue.shift();
  if (turn) s.dir = turn;

  const head = s.body[0];
  const { dc, dr } = DELTA[s.dir];
  const next: Cell = { col: head.col + dc, row: head.row + dr };

  // Muros mortales: la marca del choque queda dentro del tablero.
  if (next.col < 0 || next.col >= COLS || next.row < 0 || next.row >= ROWS) {
    s.crash = { col: head.col, row: head.row };
    s.state = "gameover";
    return;
  }

  // Autocolisión. La punta de la cola se libera en este tick si no crece.
  const growing = s.grow > 0;
  const checkLen = growing ? s.body.length : s.body.length - 1;
  for (let i = 0; i < checkLen; i++) {
    if (sameCell(s.body[i], next)) {
      s.crash = next;
      s.state = "gameover";
      return;
    }
  }

  s.body.unshift(next);
  if (growing) s.grow--;
  else s.body.pop();

  if (s.bonus && sameCell(s.bonus.cell, next)) {
    addScore(s, BONUS_POINTS * s.level);
    s.bonusEaten++;
    s.bonus = null;
  }

  if (s.food && sameCell(s.food, next)) {
    addScore(s, FOOD_POINTS * s.level); // con el nivel anterior al bocado
    s.grow += GROW_PER_FOOD;
    s.foodEaten++;
    const levelUp = s.foodEaten % FOOD_PER_LEVEL === 0;
    if (levelUp) s.level++;

    s.food = randomFreeCell(s, s.bonus ? [s.bonus.cell] : []);
    if (!s.food) {
      // Tablero lleno: no hay casilla para un núcleo nuevo.
      s.state = "gameover";
      return;
    }
    if (levelUp) {
      const cell = randomFreeCell(s, [s.food]);
      // Un bonus nuevo sustituye al que siguiera activo.
      s.bonus = cell ? { cell, timeLeft: BONUS_TIME } : null;
    }
  }
}

// Casilla libre al azar entre todas las libres (no reintenta al azar).
function randomFreeCell(s: SerpentinaState, exclude: Cell[]): Cell | null {
  const taken = new Uint8Array(COLS * ROWS);
  for (const c of s.body) taken[c.row * COLS + c.col] = 1;
  for (const c of exclude) taken[c.row * COLS + c.col] = 1;
  const free: number[] = [];
  for (let i = 0; i < taken.length; i++) if (!taken[i]) free.push(i);
  if (free.length === 0) return null;
  const idx =
    free[Math.min(free.length - 1, Math.floor(s.rng() * free.length))];
  return { col: idx % COLS, row: Math.floor(idx / COLS) };
}

export function sameCell(a: Cell, b: Cell): boolean {
  return a.col === b.col && a.row === b.row;
}

// Sin animación tras el game over: la marca del choque se dibuja una vez.
export function isAnimating(s: SerpentinaState): boolean {
  void s;
  return false;
}

export function addScore(s: SerpentinaState, points: number): void {
  s.score = Math.min(MAX_SCORE, s.score + Math.round(points));
}
