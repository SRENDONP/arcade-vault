// Lógica pura de CAÍDA (port de references/claude-tetris/tetris-core.js):
// piezas, rotación, colisiones, borrado de líneas, niveles y generador.
// Sin React, DOM ni localStorage.

export const COLS = 10;
export const ROWS = 20;
export const MAX_START_LEVEL = 10;
export const LINE_SCORES = [0, 100, 300, 500, 800] as const;

export type PieceName =
  | "I"
  | "O"
  | "T"
  | "S"
  | "Z"
  | "J"
  | "L"
  | "PLUS"
  | "U"
  | "Y"
  | "SINGLE"
  | "RING";

export type PieceDef = { name: PieceName; color: string; shape: number[][] };
export type Cell = number; // 0 vacía, 1..12 = índice de PIECE_DEFS + 1
export type Board = Cell[][]; // ROWS × COLS
export type Shape = Cell[][];
export type ActivePiece = { type: number; shape: Shape; x: number; y: number };

export type SpawnConfig = {
  weights: Record<PieceName, number>; // SINGLE: 0, solo sale como recompensa
  rewardPiece: PieceName; // "SINGLE"
  rewardChance: number; // 0.35
  rewardMaxWait: number; // 4
};

export type Generator = {
  next(): number;
  grantReward(): void;
  readonly pendingRewards: number;
};

// Para añadir una pieza basta con añadir una entrada aquí (y su peso en
// SPAWN_CONFIG). Las formas usan 1 para los bloques; el tipo es índice + 1.
export const PIECE_DEFS: readonly PieceDef[] = [
  {
    name: "I",
    color: "#4dd0e1",
    shape: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },
  {
    name: "O",
    color: "#ffd54f",
    shape: [
      [1, 1],
      [1, 1],
    ],
  },
  {
    name: "T",
    color: "#ba68c8",
    shape: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
  {
    name: "S",
    color: "#81c784",
    shape: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
  },
  {
    name: "Z",
    color: "#e57373",
    shape: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
  },
  {
    name: "J",
    color: "#90caf9",
    shape: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
  {
    name: "L",
    color: "#ffb74d",
    shape: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
  // pentominós
  {
    name: "PLUS",
    color: "#f06292",
    shape: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 1, 0],
    ],
  },
  {
    name: "U",
    color: "#7986cb",
    shape: [
      [1, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
  {
    name: "Y",
    color: "#4db6ac",
    shape: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 1, 0, 0],
      [0, 0, 0, 0],
    ],
  },
  // especiales
  { name: "SINGLE", color: "#ffd700", shape: [[1]] }, // recompensa por 4 líneas
  {
    name: "RING",
    color: "#a1887f",
    shape: [
      [1, 1, 1],
      [1, 0, 1],
      [1, 1, 1],
    ],
  }, // reto
];

const STANDARD_WEIGHT = 90 / 7;

// Probabilidades de aparición. Los pesos son relativos (no hace falta que
// sumen 100). SINGLE tiene peso 0: solo sale como recompensa.
export const SPAWN_CONFIG: SpawnConfig = {
  weights: {
    I: STANDARD_WEIGHT,
    O: STANDARD_WEIGHT,
    T: STANDARD_WEIGHT,
    S: STANDARD_WEIGHT,
    Z: STANDARD_WEIGHT,
    J: STANDARD_WEIGHT,
    L: STANDARD_WEIGHT,
    PLUS: 3,
    U: 3,
    Y: 2,
    RING: 2,
    SINGLE: 0,
  },
  rewardPiece: "SINGLE",
  rewardChance: 0.35, // probabilidad por aparición de entregar la 1×1 pendiente
  rewardMaxWait: 4, // como mucho sale en esta aparición tras las 4 líneas
};

export const COLORS: readonly (string | null)[] = [
  null,
  ...PIECE_DEFS.map((d) => d.color),
];

export const PIECES: readonly (Shape | null)[] = [
  null,
  ...PIECE_DEFS.map((d, i) =>
    d.shape.map((row) => row.map((v) => (v ? i + 1 : 0))),
  ),
];

export const TYPE = Object.fromEntries(
  PIECE_DEFS.map((d, i) => [d.name, i + 1]),
) as Record<PieceName, number>;

export function createBoard(): Board {
  return Array.from({ length: ROWS }, () => new Array<Cell>(COLS).fill(0));
}

export function collide(
  board: Board,
  shape: Shape,
  ox: number,
  oy: number,
): boolean {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

export function rotateCW(shape: Shape): Shape {
  const rows = shape.length;
  const cols = shape[0].length;
  const result: Shape = Array.from({ length: cols }, () =>
    new Array<Cell>(rows).fill(0),
  );
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      result[c][rows - 1 - r] = shape[r][c];
    }
  }
  return result;
}

// Borra las filas completas del tablero (in place) y devuelve cuántas borró.
export function clearFullLines(board: Board): number {
  let cleared = 0;
  for (let r = board.length - 1; r >= 0; r--) {
    if (board[r].every((v) => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array<Cell>(board[0].length).fill(0));
      cleared++;
      r++;
    }
  }
  return cleared;
}

// Solo borrar 4 líneas en una jugada da la pieza de recompensa.
export function onLinesCleared(cleared: number, gen: Generator): boolean {
  if (cleared === 4) {
    gen.grantReward();
    return true;
  }
  return false;
}

// Nivel según las líneas borradas: se sube uno cada 10 desde el inicial.
export function levelForLines(lines: number, startLevel = 1): number {
  return startLevel + Math.floor(lines / 10);
}

// Milisegundos entre caídas automáticas; nunca baja de 100.
export function dropIntervalForLevel(level: number): number {
  return Math.max(100, 1000 - (level - 1) * 90);
}

export function clampStartLevel(level: unknown): number {
  const n = Math.round(Number(level));
  if (!Number.isFinite(n)) return 1;
  return Math.min(MAX_START_LEVEL, Math.max(1, n));
}

export function createGenerator(
  rng: () => number = Math.random,
  config: SpawnConfig = SPAWN_CONFIG,
): Generator {
  const pool = (Object.entries(config.weights) as [PieceName, number][])
    .filter(([, w]) => w > 0)
    .map(([name, w]) => ({ type: TYPE[name], w }));
  const total = pool.reduce((s, p) => s + p.w, 0);
  let pendingRewards = 0;
  let waited = 0;

  function weightedPick(): number {
    let roll = rng() * total;
    for (const p of pool) {
      if (roll < p.w) return p.type;
      roll -= p.w;
    }
    return pool[pool.length - 1].type;
  }

  return {
    grantReward() {
      pendingRewards++;
    },
    get pendingRewards() {
      return pendingRewards;
    },
    next() {
      if (pendingRewards > 0) {
        waited++;
        if (waited >= config.rewardMaxWait || rng() < config.rewardChance) {
          pendingRewards--;
          waited = 0;
          return TYPE[config.rewardPiece];
        }
      }
      return weightedPick();
    },
  };
}
