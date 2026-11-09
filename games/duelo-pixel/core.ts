// DUELO PIXEL — lógica pura (SPEC 10). Sin React, DOM, localStorage ni
// Math.random: la aleatoriedad llega por s.rng (createState) y el tiempo por dt.
// Coordenadas con origen arriba a la izquierda; px/s y segundos.

export const W = 800;
export const H = 500;
export const MAX_DT = 0.05;
export const MAX_SCORE = 99_999_999; // igual que lib/scores.ts y el CHECK de public.scores

export const PADDLE_W = 12;
export const PADDLE_H = 80; // NÉBULA usa su propio alto
export const PLAYER_X = 32; // borde izquierdo; cara frontal en 44
export const CPU_X = 756; // borde izquierdo = cara frontal
export const PLAYER_SPEED = 480; // px/s
export const BALL_SIZE = 10;
const R = BALL_SIZE / 2;
export const SUBSTEP = 5; // px máx. por subpaso
export const MAX_BOUNCE_ANGLE = (50 * Math.PI) / 180; // respecto a la horizontal
export const MIN_BOUNCE_ANGLE = (6 * Math.PI) / 180;
export const FLAT_MAX_ANGLE = (15 * Math.PI) / 180; // tope de ECO (estilo "flat")
export const SERVE_ANGLE = (20 * Math.PI) / 180;
export const RALLY_ACCEL = 1.04;
export const RALLY_MAX_MULT = 1.6; // × velocidad base del saque
export const BALL_ABS_MAX = 900; // px/s
export const SERVE_DELAY = 0.8; // s
export const SET_POINTS = 5;
export const SET_BANNER_TIME = 1.6; // s
export const PLASMA_CHARGE = 6; // devoluciones
export const PLASMA_WINDOW = 0.35; // s
export const PLASMA_SPEED_MULT = 1.8;
export const PLASMA_CURVE = 300; // px/s²
export const TRAIL_LENGTH = 4;
export const MAX_MULT = 5;
export const RALLY_SCORE_CAP = 20;
export const RETURN_POINTS = 10; // × multiplicador
export const POINT_POINTS = 100; // × multiplicador
export const PLASMA_POINT_BONUS = 250;
export const SET_POINTS_BASE = 1000; // × rival × circuito
export const PERFECT_SET_BONUS = 2000;
export const CPU_DEADZONE = 4; // px
export const CPU_SPEED_CAP = 700; // px/s
export const CPU_IDLE_FACTOR = 0.5; // velocidad al volver al centro
export const CORNER_OFFSET = 0.75; // punto de impacto buscado por "corners"

export type RivalStyle = "center" | "flat" | "corners";
export type Rival = {
  name: string;
  speed: number; // px/s
  reaction: number; // s
  error: number; // ±px
  paddleH: number; // px
  ballSpeed: number; // px/s
  style: RivalStyle;
  plasmaEvery: number | null; // devoluciones; null = no usa plasma
};

export const RIVALS: readonly Rival[] = [
  {
    name: "CHISPA",
    speed: 260,
    reaction: 0.3,
    error: 60,
    paddleH: 80,
    ballSpeed: 320,
    style: "center",
    plasmaEvery: null,
  },
  {
    name: "ECO",
    speed: 300,
    reaction: 0.22,
    error: 53,
    paddleH: 80,
    ballSpeed: 350,
    style: "flat",
    plasmaEvery: null,
  },
  {
    name: "PRISMA",
    speed: 340,
    reaction: 0.18,
    error: 18,
    paddleH: 80,
    ballSpeed: 380,
    style: "corners",
    plasmaEvery: null,
  },
  {
    name: "VOLTIO",
    speed: 380,
    reaction: 0.14,
    error: 17,
    paddleH: 80,
    ballSpeed: 410,
    style: "corners",
    plasmaEvery: 6,
  },
  {
    name: "NÉBULA",
    speed: 460,
    reaction: 0.1,
    error: 14,
    paddleH: 60,
    ballSpeed: 440,
    style: "corners",
    plasmaEvery: 5,
  },
];

export type EngineState = "serve" | "rally" | "setWon" | "gameover";

export type Paddle = { y: number; h: number }; // y = borde superior
export type Ball = {
  x: number; // centro
  y: number; // centro
  vx: number;
  vy: number;
  plasma: "player" | "cpu" | null;
  preSpeed: number; // velocidad antes del plasma
  trail: { x: number; y: number }[]; // estela del plasma
};

export type DueloPixelState = {
  player: Paddle;
  cpu: Paddle & { target: number | null; reactLeft: number; returns: number };
  ball: Ball;
  baseSpeed: number; // velocidad base del rival y circuito actuales
  rally: number; // devoluciones del jugador en el peloteo
  rival: number; // 1..5
  circuit: number; // 1..
  playerPoints: number;
  cpuPoints: number;
  serveDir: 1 | -1; // 1 = hacia la CPU
  timer: number; // s restantes de serve / setWon
  plasma: number; // 0..PLASMA_CHARGE
  plasmaArmed: number; // s restantes de la ventana; 0 = no armado
  mult: number; // 1..MAX_MULT
  streak: number;
  bestStreak: number;
  time: number; // s de partida (animaciones)
  score: number;
  state: EngineState;
  rng: () => number; // inyectable; la UI pasa Math.random
};

export type DueloPixelInput = {
  up: boolean; // ↑ o W mantenida
  down: boolean; // ↓ o S mantenida
  plasma: boolean; // Espacio, una vez por pulsación
};

const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;

// Rival `rival` (1..5) con el escalado del circuito `circuit` (1..).
export function rivalStats(rival: number, circuit: number): Rival {
  const base = RIVALS[clamp(rival, 1, RIVALS.length) - 1];
  const c = Math.max(0, circuit - 1);
  return {
    ...base,
    speed: Math.min(CPU_SPEED_CAP, base.speed * (1 + 0.08 * c)),
    ballSpeed: base.ballSpeed * (1 + 0.06 * c),
    reaction: base.reaction * Math.max(0.5, 1 - 0.1 * c),
  };
}

export function createState(rng: () => number): DueloPixelState {
  const r = rivalStats(1, 1);
  const s: DueloPixelState = {
    player: { y: (H - PADDLE_H) / 2, h: PADDLE_H },
    cpu: {
      y: (H - r.paddleH) / 2,
      h: r.paddleH,
      target: null,
      reactLeft: 0,
      returns: 0,
    },
    ball: {
      x: W / 2,
      y: H / 2,
      vx: 0,
      vy: 0,
      plasma: null,
      preSpeed: 0,
      trail: [],
    },
    baseSpeed: r.ballSpeed,
    rally: 0,
    rival: 1,
    circuit: 1,
    playerPoints: 0,
    cpuPoints: 0,
    serveDir: 1,
    timer: SERVE_DELAY,
    plasma: 0,
    plasmaArmed: 0,
    mult: 1,
    streak: 0,
    bestStreak: 0,
    time: 0,
    score: 0,
    state: "serve",
    rng,
  };
  return s;
}

function addScore(s: DueloPixelState, points: number) {
  s.score = Math.min(MAX_SCORE, s.score + Math.round(points));
}

// Pelota quieta en el centro y espera de saque.
function startServe(s: DueloPixelState) {
  const b = s.ball;
  b.x = W / 2;
  b.y = H / 2;
  b.vx = 0;
  b.vy = 0;
  b.plasma = null;
  b.preSpeed = 0;
  b.trail.length = 0;
  s.rally = 0;
  s.cpu.target = null;
  s.cpu.reactLeft = 0;
  s.timer = SERVE_DELAY;
  s.state = "serve";
}

function launch(s: DueloPixelState) {
  const angle = (s.rng() * 2 - 1) * SERVE_ANGLE;
  const b = s.ball;
  b.vx = s.serveDir * s.baseSpeed * Math.cos(angle);
  b.vy = s.baseSpeed * Math.sin(angle);
  if (s.serveDir === 1) aimCpu(s);
  s.state = "rally";
}

// La pelota empieza a ir hacia la CPU: espera su reacción antes de calcular.
function aimCpu(s: DueloPixelState) {
  s.cpu.target = null;
  s.cpu.reactLeft = rivalStats(s.rival, s.circuit).reaction;
}

// Y del centro de la pelota cuando cruce la cara frontal de la CPU, con los
// rebotes en las paredes (sin la curva del plasma).
function predictY(b: Ball): number {
  const faceX = CPU_X - R;
  if (b.vx <= 0) return H / 2;
  const t = Math.max(0, (faceX - b.x) / b.vx);
  const span = H - 2 * R;
  let m = (b.y - R + b.vy * t) % (2 * span);
  if (m < 0) m += 2 * span;
  if (m > span) m = 2 * span - m;
  return m + R;
}

function cpuTarget(s: DueloPixelState, r: Rival): number {
  const h = s.cpu.h;
  // El error crece con la velocidad de la pelota (peloteo largo o plasma):
  // así cada peloteo acaba tarde o temprano.
  const speedFactor = Math.hypot(s.ball.vx, s.ball.vy) / s.baseSpeed;
  const err = (s.rng() * 2 - 1) * r.error * Math.max(1, speedFactor);
  let offset = 0;
  if (r.style === "corners") {
    // Hacia el lado lejos del jugador: si su paleta está arriba, la manda abajo.
    const playerCenter = s.player.y + s.player.h / 2;
    offset = playerCenter < H / 2 ? CORNER_OFFSET : -CORNER_OFFSET;
  }
  // El centro de la paleta va donde el impacto caiga en `offset`.
  const cy = predictY(s.ball) + err - (offset * h) / 2;
  return clamp(cy, h / 2, H - h / 2);
}

function moveCpu(s: DueloPixelState, dt: number) {
  const r = rivalStats(s.rival, s.circuit);
  const cpu = s.cpu;
  let goal = H / 2;
  let speed = r.speed * CPU_IDLE_FACTOR;
  if (s.state === "rally" && s.ball.vx > 0) {
    if (cpu.target === null) {
      cpu.reactLeft -= dt;
      if (cpu.reactLeft <= 0) cpu.target = cpuTarget(s, r);
    }
    if (cpu.target !== null) {
      goal = cpu.target;
      speed = r.speed;
    }
  }
  const center = cpu.y + cpu.h / 2;
  const dist = goal - center;
  if (Math.abs(dist) > CPU_DEADZONE) {
    const move = Math.min(Math.abs(dist), speed * dt) * Math.sign(dist);
    cpu.y = clamp(cpu.y + move, 0, H - cpu.h);
  }
}

// Rebote en una paleta: ángulo según el punto de impacto, aceleración y plasma.
function bounce(s: DueloPixelState, side: "player" | "cpu") {
  const b = s.ball;
  const p = side === "player" ? s.player : s.cpu;
  const r = rivalStats(s.rival, s.circuit);

  const offset = clamp((b.y - (p.y + p.h / 2)) / (p.h / 2), -1, 1);
  let angle = offset * MAX_BOUNCE_ANGLE;
  if (side === "cpu" && r.style === "flat")
    angle = clamp(angle, -FLAT_MAX_ANGLE, FLAT_MAX_ANGLE);
  if (Math.abs(angle) < MIN_BOUNCE_ANGLE)
    angle =
      MIN_BOUNCE_ANGLE * (angle < 0 || (angle === 0 && b.vy < 0) ? -1 : 1);

  // Devolver un plasma del rival lo apaga: vuelve a la velocidad de antes.
  let speed = b.plasma ? b.preSpeed : Math.hypot(b.vx, b.vy);
  b.plasma = null;
  b.trail.length = 0;
  speed = Math.min(
    speed * RALLY_ACCEL,
    s.baseSpeed * RALLY_MAX_MULT,
    BALL_ABS_MAX,
  );

  let plasma = false;
  if (side === "player") {
    s.rally += 1;
    if (s.rally <= RALLY_SCORE_CAP) addScore(s, RETURN_POINTS * s.mult);
    if (s.plasmaArmed > 0) {
      plasma = true;
      s.plasma = 0;
      s.plasmaArmed = 0;
    } else {
      s.plasma = Math.min(PLASMA_CHARGE, s.plasma + 1);
    }
  } else {
    s.cpu.returns += 1;
    if (r.plasmaEvery !== null && s.cpu.returns >= r.plasmaEvery) {
      plasma = true;
      s.cpu.returns = 0;
    }
  }
  if (plasma) {
    b.plasma = side;
    b.preSpeed = speed;
    speed = Math.min(BALL_ABS_MAX, speed * PLASMA_SPEED_MULT);
  }

  const dir = side === "player" ? 1 : -1;
  b.vx = dir * speed * Math.cos(angle);
  b.vy = speed * Math.sin(angle);
  b.x = side === "player" ? PLAYER_X + PADDLE_W + R : CPU_X - R;

  if (side === "player") aimCpu(s);
  else s.cpu.target = null;
}

const overlaps = (b: Ball, x: number, p: Paddle) =>
  b.x + R >= x &&
  b.x - R <= x + PADDLE_W &&
  b.y + R >= p.y &&
  b.y - R <= p.y + p.h;

function playerPoint(s: DueloPixelState) {
  addScore(s, POINT_POINTS * s.mult);
  if (s.ball.plasma === "player") addScore(s, PLASMA_POINT_BONUS);
  s.mult = Math.min(MAX_MULT, s.mult + 1);
  s.streak += 1;
  s.bestStreak = Math.max(s.bestStreak, s.streak);
  s.playerPoints += 1;
  s.serveDir = -1; // hacia quien ganó el punto

  if (s.playerPoints < SET_POINTS) {
    startServe(s);
    return;
  }
  // Set ganado: puntos y siguiente rival (o circuito).
  addScore(s, SET_POINTS_BASE * s.rival * s.circuit);
  if (s.cpuPoints === 0) addScore(s, PERFECT_SET_BONUS);
  s.rival += 1;
  if (s.rival > RIVALS.length) {
    s.rival = 1;
    s.circuit += 1;
  }
  const r = rivalStats(s.rival, s.circuit);
  s.baseSpeed = r.ballSpeed;
  s.cpu.h = r.paddleH;
  s.cpu.y = clamp(s.cpu.y, 0, H - s.cpu.h);
  s.cpu.returns = 0;
  s.playerPoints = 0;
  s.cpuPoints = 0;
  s.serveDir = 1; // el primer saque de cada set va hacia la CPU
  startServe(s);
  s.state = "setWon";
  s.timer = SET_BANNER_TIME;
}

function cpuPoint(s: DueloPixelState) {
  s.mult = 1;
  s.streak = 0;
  s.plasma = 0;
  s.plasmaArmed = 0;
  s.cpuPoints += 1;
  s.serveDir = 1;
  startServe(s);
  if (s.cpuPoints >= SET_POINTS) s.state = "gameover";
}

function moveBall(s: DueloPixelState, dt: number) {
  const b = s.ball;
  if (b.plasma) {
    // Curva: el plasma acelera en vertical en el sentido de vy.
    const sign = b.vy < 0 ? -1 : 1;
    b.vy = clamp(b.vy + sign * PLASMA_CURVE * dt, -BALL_ABS_MAX, BALL_ABS_MAX);
    b.trail.unshift({ x: b.x, y: b.y });
    if (b.trail.length > TRAIL_LENGTH) b.trail.length = TRAIL_LENGTH;
  }

  const dist = Math.hypot(b.vx, b.vy) * dt;
  const n = Math.max(1, Math.ceil(dist / SUBSTEP));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    // vy puede cambiar de signo en un rebote dentro del bucle: se usa la actual.
    b.x += b.vx * h;
    b.y += b.vy * h;

    if (b.y - R < 0) {
      b.y = R;
      b.vy = Math.abs(b.vy);
    } else if (b.y + R > H) {
      b.y = H - R;
      b.vy = -Math.abs(b.vy);
    }

    if (b.vx < 0 && b.x > PLAYER_X && overlaps(b, PLAYER_X, s.player)) {
      bounce(s, "player");
      return; // el resto del recorrido de este frame se descarta
    }
    if (b.vx > 0 && b.x < CPU_X + PADDLE_W && overlaps(b, CPU_X, s.cpu)) {
      bounce(s, "cpu");
      return;
    }

    if (b.x < 0) {
      cpuPoint(s);
      return;
    }
    if (b.x > W) {
      playerPoint(s);
      return;
    }
  }
}

export function step(
  s: DueloPixelState,
  dt: number,
  input: DueloPixelInput,
): void {
  if (s.state === "gameover") return;
  s.time += dt;

  // Paleta del jugador: velocidad constante, sin inercia.
  const dir = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  s.player.y = clamp(s.player.y + dir * PLAYER_SPEED * dt, 0, H - s.player.h);

  // Golpe de plasma: Espacio arma la ventana si el medidor está cargado.
  if (input.plasma && s.plasma >= PLASMA_CHARGE && s.plasmaArmed === 0)
    s.plasmaArmed = PLASMA_WINDOW;
  else if (s.plasmaArmed > 0) {
    s.plasmaArmed -= dt;
    if (s.plasmaArmed <= 0) {
      s.plasmaArmed = 0;
      s.plasma = 0; // ventana agotada sin golpe
    }
  }

  switch (s.state) {
    case "setWon":
      moveCpu(s, dt);
      s.timer -= dt;
      if (s.timer <= 0) startServe(s);
      break;
    case "serve":
      moveCpu(s, dt);
      s.timer -= dt;
      if (s.timer <= 0) launch(s);
      break;
    case "rally":
      moveCpu(s, dt);
      moveBall(s, dt);
      break;
  }
}
