// ranaria — lógica pura del juego (SPEC 13).
// Sin React, window, document, performance, localStorage ni Math.random:
// la aleatoriedad llega por s.rng (el componente pasa Math.random).
// Juego por casillas: (col, row) con origen arriba a la izquierda; tiempos en
// segundos; velocidades en casillas/s. `col` de la rana es decimal porque el
// río la arrastra; `row` siempre es entera.

export const COLS = 16;
export const ROWS = 14;
export const CELL = 40; // px
export const W = COLS * CELL; // 640
export const H = ROWS * CELL; // 560
export const MAX_DT = 0.05; // s; el componente ya limita dt con este valor
export const MAX_SCORE = 99_999_999; // igual que lib/scores.ts y el CHECK de public.scores

// Zonas (índice de fila, 0 = arriba).
export const ROW_GOALS = 0;
export const ROW_RIVER_TOP = 1;
export const ROW_RIVER_BOT = 6;
export const ROW_SAFE_MID = 7;
export const ROW_ROAD_TOP = 8;
export const ROW_ROAD_BOT = 12;
export const ROW_START = 13;

export const START_COL = 7;
export const LILY_COLS = [1, 4, 7, 10, 13] as const; // cada nenúfar ocupa col y col + 1
export const LILY_WIDTH = 2;
export const LANE_SPAN = 20; // casillas por ciclo de carril
// Las entidades viven en [LANE_MIN, LANE_MIN + LANE_SPAN) = [-4, 16): la vuelta
// ocurre fuera de la vista porque el ancho máximo es 4.
export const LANE_MIN = COLS - LANE_SPAN; // -4

export const JUMP_TIME = 0.12; // s
export const DEATH_TIME = 0.8; // s
export const START_LIVES = 3;
export const TURTLE_UP = 3; // s visibles
export const TURTLE_DOWN = 1.5; // s sumergidas
export const TURTLE_CYCLE = TURTLE_UP + TURTLE_DOWN;
export const TURTLE_OFFSET = 1.5; // s de desfase × índice del grupo
export const ROW_POINTS = 10;
export const LILY_POINTS = 50;
export const TIME_POINTS = 10; // × segundo restante
export const ROUND_POINTS = 200;

export const SPEED_STEP = 0.15; // +15 % de la base por nivel
export const MAX_SPEED_FACTOR = 2.5;
export const BASE_TRIP_TIME = 15; // s
export const MIN_TRIP_TIME = 8; // s

export type Dir = "up" | "down" | "left" | "right";
export type EntityKind = "car" | "truck" | "log" | "turtle";
// dead = rana marcada DEATH_TIME s antes de reaparecer o terminar.
export type EngineState = "playing" | "dead" | "gameover";

export type Entity = {
  x: number; // columna del borde izquierdo, en [LANE_MIN, LANE_MIN + LANE_SPAN)
  width: number;
  kind: EntityKind;
  phase: number; // desfase del ciclo de inmersión (solo tortugas)
};

export type Lane = {
  row: number;
  dir: 1 | -1;
  speed: number; // casillas/s, ya escalada por nivel
  entities: Entity[];
};

export type Jump = {
  fromCol: number;
  fromRow: number;
  toCol: number;
  toRow: number;
  t: number; // s transcurridos del salto
};

export type Frog = {
  col: number;
  row: number;
  facing: Dir;
  jump: Jump | null;
  pending: Dir | null; // como máximo una pulsación pendiente; gana la última
};

export type RanariaState = {
  frog: Frog;
  lanes: Lane[];
  lilies: boolean[]; // 5, ocupados en la ronda actual
  bestRow: number; // fila más alta alcanzada en el viaje
  timeLeft: number;
  deadTimer: number;
  deathAt: { col: number; row: number } | null;
  time: number; // segundos de partida (tortugas y animaciones)
  score: number; // siempre entero
  lives: number;
  level: number;
  liliesTotal: number;
  state: EngineState;
  rng: () => number;
};

// Entrada de un frame: direcciones pulsadas desde el último frame, una por pulsación.
export type RanariaInput = {
  jumps: Dir[];
};

type LaneDef = {
  row: number;
  kind: EntityKind;
  width: number;
  dir: 1 | -1;
  speed: number; // casillas/s en el nivel 1
  starts: number[];
};

// Tabla de carriles del spec (sentido: 1 = →, -1 = ←).
export const LANE_DEFS: readonly LaneDef[] = [
  {
    row: 12,
    kind: "car",
    width: 1,
    dir: -1,
    speed: 2.25,
    starts: [0, 5, 10, 15],
  },
  { row: 11, kind: "car", width: 1, dir: 1, speed: 3.0, starts: [2, 9, 16] },
  { row: 10, kind: "truck", width: 2, dir: -1, speed: 2.5, starts: [1, 8, 15] },
  { row: 9, kind: "car", width: 1, dir: 1, speed: 4.5, starts: [4, 14] },
  { row: 8, kind: "truck", width: 3, dir: -1, speed: 2.25, starts: [3, 13] },
  {
    row: 6,
    kind: "turtle",
    width: 3,
    dir: -1,
    speed: 2.25,
    starts: [0, 7, 14],
  },
  { row: 5, kind: "log", width: 3, dir: 1, speed: 1.5, starts: [0, 7, 14] },
  { row: 4, kind: "log", width: 4, dir: 1, speed: 3.0, starts: [1, 10] },
  {
    row: 3,
    kind: "turtle",
    width: 2,
    dir: -1,
    speed: 2.25,
    starts: [0, 5, 10, 15],
  },
  { row: 2, kind: "log", width: 2, dir: 1, speed: 2.25, starts: [2, 8, 14] },
  { row: 1, kind: "log", width: 4, dir: -1, speed: 1.5, starts: [0, 9] },
];

export const DELTA: Record<Dir, { dc: number; dr: number }> = {
  up: { dc: 0, dr: -1 },
  down: { dc: 0, dr: 1 },
  left: { dc: -1, dr: 0 },
  right: { dc: 1, dr: 0 },
};

export function speedFactor(level: number): number {
  return Math.min(MAX_SPEED_FACTOR, 1 + SPEED_STEP * (level - 1));
}

export function tripTime(level: number): number {
  return Math.max(MIN_TRIP_TIME, BASE_TRIP_TIME - (level - 1));
}

export function isRiverRow(row: number): boolean {
  return row >= ROW_RIVER_TOP && row <= ROW_RIVER_BOT;
}

export function isRoadRow(row: number): boolean {
  return row >= ROW_ROAD_TOP && row <= ROW_ROAD_BOT;
}

// Lleva x al intervalo [LANE_MIN, LANE_MIN + LANE_SPAN).
export function wrapLane(x: number): number {
  return LANE_MIN + ((((x - LANE_MIN) % LANE_SPAN) + LANE_SPAN) % LANE_SPAN);
}

export function buildLanes(level: number, rng: () => number): Lane[] {
  const factor = speedFactor(level);
  return LANE_DEFS.map((def) => {
    const offset = Math.floor(rng() * LANE_SPAN); // entero en 0..19
    return {
      row: def.row,
      dir: def.dir,
      speed: def.speed * factor,
      entities: def.starts.map((start, i) => ({
        x: wrapLane(start + offset),
        width: def.width,
        kind: def.kind,
        phase: def.kind === "turtle" ? i * TURTLE_OFFSET : 0,
      })),
    };
  });
}

// Segundos dentro del ciclo de inmersión de un grupo de tortugas.
export function turtleCycleTime(e: Entity, time: number): number {
  return (((time + e.phase) % TURTLE_CYCLE) + TURTLE_CYCLE) % TURTLE_CYCLE;
}

export function isSubmerged(e: Entity, time: number): boolean {
  return e.kind === "turtle" && turtleCycleTime(e, time) >= TURTLE_UP;
}

function newFrog(): Frog {
  return {
    col: START_COL,
    row: ROW_START,
    facing: "up",
    jump: null,
    pending: null,
  };
}

export function createState(rng: () => number): RanariaState {
  return {
    frog: newFrog(),
    lanes: buildLanes(1, rng),
    lilies: LILY_COLS.map(() => false),
    bestRow: ROW_START,
    timeLeft: tripTime(1),
    deadTimer: 0,
    deathAt: null,
    time: 0,
    score: 0,
    lives: START_LIVES,
    level: 1,
    liliesTotal: 0,
    state: "playing",
    rng,
  };
}

export function addScore(s: RanariaState, points: number): void {
  s.score = Math.min(MAX_SCORE, s.score + Math.round(points));
}

// Posición dibujable de la rana (interpolada durante el salto) y avance del salto 0..1.
export function frogPosition(s: RanariaState): {
  col: number;
  row: number;
  jumpT: number | null;
} {
  const { frog } = s;
  if (!frog.jump) return { col: frog.col, row: frog.row, jumpT: null };
  const k = Math.min(1, frog.jump.t / JUMP_TIME);
  return {
    col: frog.jump.fromCol + (frog.jump.toCol - frog.jump.fromCol) * k,
    row: frog.jump.fromRow + (frog.jump.toRow - frog.jump.fromRow) * k,
    jumpT: k,
  };
}

function laneAt(s: RanariaState, row: number): Lane | undefined {
  return s.lanes.find((l) => l.row === row);
}

// Vehículo que toca la caja [col + 0,15; col + 0,85] de la rana en su fila.
function hitByVehicle(s: RanariaState): boolean {
  const lane = laneAt(s, s.frog.row);
  if (!lane || !isRoadRow(lane.row)) return false;
  const left = s.frog.col + 0.15;
  const right = s.frog.col + 0.85;
  return lane.entities.some((e) => left < e.x + e.width && right > e.x);
}

// Tronco o grupo de tortugas visible bajo el centro de la rana, o null.
export function getSupport(
  s: RanariaState,
): { lane: Lane; entity: Entity } | null {
  const lane = laneAt(s, s.frog.row);
  if (!lane || !isRiverRow(lane.row)) return null;
  const center = s.frog.col + 0.5;
  for (const e of lane.entities) {
    if (center >= e.x && center < e.x + e.width && !isSubmerged(e, s.time)) {
      return { lane, entity: e };
    }
  }
  return null;
}

// Nueva salida: posición inicial, temporizador lleno y puntos por fila reiniciados.
// También descarta la pulsación pendiente (no se arrastra a un viaje nuevo).
function startTrip(s: RanariaState): void {
  s.frog = newFrog();
  s.bestRow = ROW_START;
  s.timeLeft = tripTime(s.level);
}

function kill(s: RanariaState): void {
  s.lives = Math.max(0, s.lives - 1);
  s.state = "dead";
  s.deadTimer = DEATH_TIME;
  s.deathAt = {
    col: Math.min(COLS - 1, Math.max(0, s.frog.col)),
    row: s.frog.row,
  };
  s.frog.jump = null;
  s.frog.pending = null;
}

function completeRound(s: RanariaState): void {
  addScore(s, ROUND_POINTS);
  s.level += 1;
  s.lilies = LILY_COLS.map(() => false);
  s.lanes = buildLanes(s.level, s.rng);
}

// Llegada a la orilla: ocupa un nenúfar libre bajo el centro de la rana o muere.
function reachGoal(s: RanariaState): void {
  const center = s.frog.col + 0.5;
  const i = LILY_COLS.findIndex((c) => center >= c && center < c + LILY_WIDTH);
  if (i < 0 || s.lilies[i]) {
    kill(s);
    return;
  }
  s.lilies[i] = true;
  s.liliesTotal += 1;
  addScore(s, LILY_POINTS + Math.floor(s.timeLeft) * TIME_POINTS);
  if (s.lilies.every(Boolean)) completeRound(s);
  startTrip(s);
}

function tryJump(s: RanariaState, dir: Dir): boolean {
  const { frog } = s;
  const { dc, dr } = DELTA[dir];
  const toCol = frog.col + dc;
  const toRow = frog.row + dr;
  frog.facing = dir;
  if (toCol < 0 || toCol > COLS - 1 || toRow < ROW_GOALS || toRow > ROW_START) {
    return false;
  }
  frog.jump = { fromCol: frog.col, fromRow: frog.row, toCol, toRow, t: 0 };
  return true;
}

// Resuelve la casilla de aterrizaje: meta, río, carretera y puntos por fila.
function land(s: RanariaState): void {
  const { frog } = s;
  const jump = frog.jump;
  if (!jump) return;
  frog.col = jump.toCol;
  frog.row = jump.toRow;
  frog.jump = null;

  if (frog.row === ROW_GOALS) {
    reachGoal(s);
    return;
  }
  if (!isRiverRow(frog.row)) frog.col = Math.round(frog.col);
  if (!checkCell(s)) return;
  if (frog.row < s.bestRow) {
    s.bestRow = frog.row;
    addScore(s, ROW_POINTS); // filas 12..1; la 0 se resuelve arriba
  }
}

// Choques y soporte de la casilla actual. Devuelve false si la rana muere.
function checkCell(s: RanariaState): boolean {
  const { frog } = s;
  if (isRiverRow(frog.row)) {
    if (frog.col < 0 || frog.col > COLS - 1 || !getSupport(s)) {
      kill(s);
      return false;
    }
    return true;
  }
  if (hitByVehicle(s)) {
    kill(s);
    return false;
  }
  return true;
}

function moveLanes(s: RanariaState, dt: number): void {
  for (const lane of s.lanes) {
    for (const e of lane.entities) {
      e.x = wrapLane(e.x + lane.speed * lane.dir * dt);
    }
  }
}

// Avanza la partida dt segundos. Muta s.
export function step(s: RanariaState, dt: number, input: RanariaInput): void {
  if (s.state === "gameover") return;
  s.time += dt;
  moveLanes(s, dt);

  if (s.state === "dead") {
    s.deadTimer -= dt;
    if (s.deadTimer > 0) return;
    if (s.lives <= 0) {
      s.state = "gameover"; // deathAt se conserva para el último frame
      return;
    }
    s.deathAt = null;
    s.state = "playing";
    startTrip(s);
    return;
  }

  const { frog } = s;

  // Arrastre del río antes de mirar el temporizador y la entrada.
  if (!frog.jump && isRiverRow(frog.row)) {
    const support = getSupport(s);
    if (support) frog.col += support.lane.speed * support.lane.dir * dt;
    if (!checkCell(s)) return;
  } else if (!frog.jump && !checkCell(s)) {
    return;
  }

  s.timeLeft = Math.max(0, s.timeLeft - dt);
  if (s.timeLeft <= 0) {
    kill(s);
    return;
  }

  for (const dir of input.jumps) {
    if (!frog.jump && !frog.pending) {
      if (!tryJump(s, dir)) continue;
    } else {
      frog.pending = dir;
    }
  }

  if (frog.jump) {
    frog.jump.t += dt;
    if (frog.jump.t >= JUMP_TIME) {
      land(s);
      if (s.state !== "playing") return;
      const pending = s.frog.pending;
      s.frog.pending = null;
      if (pending) tryJump(s, pending);
    }
  }
}
