// BLOQUE BUSTER — lógica pura del juego (port de references/arkanoid/game.js).
// Sin React, window, document, performance, localStorage, Audio ni Math.random:
// la aleatoriedad llega por s.rng y el tiempo por s.time (segundos de partida).
// Los sonidos se dejan como eventos en s.events y los reproduce el componente.
// Unidades: px, px/s y segundos; origen arriba a la izquierda.

// ---------------------------------------------------------------------------
// Constantes (mismos valores que la referencia)
// ---------------------------------------------------------------------------

export const W = 480;
export const H = 640;
export const HUD_H = 32; // techo lógico de la pelota (la franja ya no se dibuja)
export const BRICK_W = 32;
export const BRICK_H = 16;
export const COLS = 13; // 13 × 32 = 416 px
export const GRID_X = 32;
export const GRID_Y = 64;
export const PADDLE_W = 80;
export const PADDLE_H = 14;
export const PADDLE_Y = 600;
export const PADDLE_START_X = 200;
export const BALL_SIZE = 12;

export const PADDLE_SPEED = 420; // px/s
export const BALL_SPEED = 300; // px/s en el nivel 1
export const SPEED_STEP = 0.15; // +15 % por nivel sobre BALL_SPEED
export const SERVE_ANGLE = Math.PI / 6; // saque: 30° a la derecha de la vertical
export const MAX_BOUNCE_ANGLE = Math.PI / 3; // 60° respecto a la vertical

export const FLASH_TIME = 0.1; // s: destello blanco del gris al primer golpe
export const EXPLOSION_TIME = 0.15; // s

export const POWERUP_CHANCE = 0.1; // probabilidad de cápsula al romper un ladrillo
export const CAPSULE_W = 32;
export const CAPSULE_H = 14;
export const CAPSULE_SPEED = 150; // px/s, caída vertical
// 3 pelotas nuevas, respecto a la vertical, hacia arriba
export const MULTIBALL_ANGLES = [-Math.PI / 4, 0, Math.PI / 4] as const;

export const START_LIVES = 3;
export const MAX_DT = 1 / 30; // s

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type BrickColor =
  "gray" | "yellow" | "hotpink" | "magenta" | "red" | "green" | "cyan";
export type BrickLetter = "S" | "Y" | "P" | "M" | "R" | "G" | "C";
export type BrickType = { color: BrickColor; hits: number; points: number };

export type Brick = {
  x: number;
  y: number;
  color: BrickColor;
  hits: number;
  points: number;
  flashUntil: number; // s (s.time)
};
export type Ball = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
};
export type Capsule = { x: number; y: number };
export type Explosion = {
  x: number;
  y: number;
  color: BrickColor;
  startedAt: number; // s (s.time)
};
export type Paddle = { x: number; y: number; w: number; h: number };

export type SoundEvent = "bounce" | "break";
export type EngineState =
  "serve" | "playing" | "levelclear" | "won" | "gameover";

export type BloqueBusterState = {
  state: EngineState;
  level: number; // 1..LEVELS.length
  score: number; // entero
  lives: number;
  bricksBroken: number; // ladrillos rotos en toda la partida
  paddle: Paddle;
  balls: Ball[]; // en el saque, exactamente 1
  capsule: Capsule | null; // como mucho una en vuelo
  bricks: Brick[];
  explosions: Explosion[];
  time: number; // s de partida
  events: SoundEvent[]; // sonidos pendientes; el componente los vacía
  rng: () => number;
};

// Entrada de un frame.
export type BloqueBusterInput = {
  left: boolean;
  right: boolean;
  mouseX: number | null; // X lógica del cursor desde el último frame, o null
  action: boolean; // Espacio o clic: lanza en "serve", continúa en "levelclear"
};

// ---------------------------------------------------------------------------
// Ladrillos y niveles
// ---------------------------------------------------------------------------

export const BRICK_TYPES: Record<BrickLetter, BrickType> = {
  S: { color: "gray", hits: 2, points: 50 },
  Y: { color: "yellow", hits: 1, points: 120 },
  P: { color: "hotpink", hits: 1, points: 110 },
  M: { color: "magenta", hits: 1, points: 100 },
  R: { color: "red", hits: 1, points: 90 },
  G: { color: "green", hits: 1, points: 80 },
  C: { color: "cyan", hits: 1, points: 70 },
};

// 13 columnas por fila, "." = hueco
const LEVEL_1 = [
  "SSSSSSSSSSSSS",
  "YYYYYYYYYYYYY",
  "PPPPPPPPPPPPP",
  "MMMMMMMMMMMMM",
  "RRRRRRRRRRRRR",
  "GGGGGGGGGGGGG",
  "CCCCCCCCCCCCC",
] as const;

const LEVEL_2 = [
  ".YYYYYYYYYYY.",
  "..PPPPPPPPP..",
  "S..MMMMMMM..S",
  "SS..RRRRR..SS",
  "SSS..GGG..SSS",
  "SSSS..C..SSSS",
] as const;

const LEVEL_3 = [
  "SSSSSSSSSSSSS",
  "Y.Y.Y.Y.Y.Y.Y",
  "PPPPPPPPPPPPP",
  "S.S.S.S.S.S.S",
  "MMMMMMMMMMMMM",
  "RRRRRRRRRRRRR",
  "G.G.G.G.G.G.G",
  "CCCCCCCCCCCCC",
] as const;

export const LEVELS: readonly (readonly string[])[] = [
  LEVEL_1,
  LEVEL_2,
  LEVEL_3,
];

const isBrickLetter = (ch: string): ch is BrickLetter =>
  Object.prototype.hasOwnProperty.call(BRICK_TYPES, ch);

// Convierte una cuadrícula ASCII en la lista de ladrillos.
export function buildBricks(level: readonly string[]): Brick[] {
  const bricks: Brick[] = [];
  level.forEach((row, r) => {
    for (let c = 0; c < COLS; c++) {
      const ch = row[c];
      if (ch === undefined || !isBrickLetter(ch)) continue;
      const type = BRICK_TYPES[ch];
      bricks.push({
        x: GRID_X + c * BRICK_W,
        y: GRID_Y + r * BRICK_H,
        color: type.color,
        hits: type.hits,
        points: type.points,
        flashUntil: 0,
      });
    }
  });
  return bricks;
}

// ---------------------------------------------------------------------------
// Partida
// ---------------------------------------------------------------------------

// Velocidad de la pelota en un nivel: 300, 345 y 390 px/s.
export function ballSpeed(level: number): number {
  return BALL_SPEED * (1 + SPEED_STEP * (level - 1));
}

function createBall(): Ball {
  return { x: 0, y: 0, vx: 0, vy: 0, size: BALL_SIZE };
}

// En el saque hay una sola pelota, s.balls[0], centrada sobre la paleta.
function placeBallOnPaddle(s: BloqueBusterState): void {
  const ball = s.balls[0];
  if (!ball) return;
  ball.x = s.paddle.x + s.paddle.w / 2 - ball.size / 2;
  ball.y = s.paddle.y - ball.size;
}

// Partida nueva: nivel 1, 0 puntos, 3 vidas, nivel completo y pelota en la paleta.
export function createState(rng: () => number): BloqueBusterState {
  const s: BloqueBusterState = {
    state: "serve",
    level: 1,
    score: 0,
    lives: START_LIVES,
    bricksBroken: 0,
    paddle: { x: PADDLE_START_X, y: PADDLE_Y, w: PADDLE_W, h: PADDLE_H },
    balls: [createBall()],
    capsule: null,
    bricks: buildBricks(LEVELS[0]),
    explosions: [],
    time: 0,
    events: [],
    rng,
  };
  placeBallOnPaddle(s);
  return s;
}

// Nivel siguiente: conserva puntos y vidas; paleta al centro y pelota en la paleta.
function nextLevel(s: BloqueBusterState): void {
  s.level += 1;
  s.bricks = buildBricks(LEVELS[s.level - 1]);
  s.explosions = [];
  s.paddle.x = PADDLE_START_X;
  s.balls = [createBall()];
  s.capsule = null;
  placeBallOnPaddle(s);
  s.state = "serve";
}

function launchBall(s: BloqueBusterState): void {
  if (s.state !== "serve") return;
  const speed = ballSpeed(s.level);
  const ball = s.balls[0];
  ball.vx = speed * Math.sin(SERVE_ANGLE);
  ball.vy = -speed * Math.cos(SERVE_ANGLE);
  s.state = "playing";
}

// Se llama cuando cae la última pelota.
function loseLife(s: BloqueBusterState): void {
  s.lives -= 1;
  s.capsule = null;
  if (s.lives > 0) {
    s.balls = [createBall()];
    placeBallOnPaddle(s);
    s.state = "serve";
  } else {
    s.state = "gameover";
  }
}

function updatePaddle(
  s: BloqueBusterState,
  dt: number,
  input: BloqueBusterInput,
): void {
  const paddle = s.paddle;

  // El ratón coloca el centro de la paleta en la X del cursor; el teclado
  // sigue mandando hasta el siguiente movimiento del ratón.
  if (input.mouseX !== null) paddle.x = input.mouseX - paddle.w / 2;

  let dir = 0;
  if (input.left) dir -= 1;
  if (input.right) dir += 1;
  paddle.x += dir * PADDLE_SPEED * dt;

  paddle.x = Math.max(0, Math.min(W - paddle.w, paddle.x));
}

// Solapamiento AABB entre dos rectángulos.
function overlaps(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// El ángulo de salida depende del punto de impacto: el centro manda la
// pelota casi vertical y los extremos, en diagonal (máx. MAX_BOUNCE_ANGLE).
function bounceOffPaddle(s: BloqueBusterState, ball: Ball): void {
  const paddle = s.paddle;
  const ballCenter = ball.x + ball.size / 2;
  const paddleCenter = paddle.x + paddle.w / 2;
  const offset = Math.max(
    -1,
    Math.min(1, (ballCenter - paddleCenter) / (PADDLE_W / 2)),
  );
  const angle = offset * MAX_BOUNCE_ANGLE;

  const speed = ballSpeed(s.level);
  ball.vx = speed * Math.sin(angle);
  ball.vy = -speed * Math.cos(angle);
  ball.y = paddle.y - ball.size;
}

// Como máximo un ladrillo por pelota y frame. Se invierte la velocidad en el
// eje de menor solapamiento, alejando la pelota del ladrillo para no volver a
// invertirla en el frame siguiente si aún se solapan.
function collideBricks(s: BloqueBusterState, ball: Ball): void {
  for (let i = 0; i < s.bricks.length; i++) {
    const brick = s.bricks[i];
    if (
      !overlaps(
        ball.x,
        ball.y,
        ball.size,
        ball.size,
        brick.x,
        brick.y,
        BRICK_W,
        BRICK_H,
      )
    )
      continue;

    const overlapX = Math.min(
      ball.x + ball.size - brick.x,
      brick.x + BRICK_W - ball.x,
    );
    const overlapY = Math.min(
      ball.y + ball.size - brick.y,
      brick.y + BRICK_H - ball.y,
    );
    const ballLeftOfCenter = ball.x + ball.size / 2 < brick.x + BRICK_W / 2;
    const ballAboveCenter = ball.y + ball.size / 2 < brick.y + BRICK_H / 2;

    if (overlapX < overlapY) {
      ball.vx = ballLeftOfCenter ? -Math.abs(ball.vx) : Math.abs(ball.vx);
    } else {
      ball.vy = ballAboveCenter ? -Math.abs(ball.vy) : Math.abs(ball.vy);
    }

    brick.hits -= 1;
    if (brick.hits <= 0) {
      s.bricks.splice(i, 1);
      s.score += brick.points;
      s.bricksBroken += 1;
      s.explosions.push({
        x: brick.x,
        y: brick.y,
        color: brick.color,
        startedAt: s.time,
      });
      s.events.push("break");
      // Solo una cápsula a la vez y nunca con multibola.
      if (
        s.capsule === null &&
        s.balls.length === 1 &&
        s.rng() < POWERUP_CHANCE
      ) {
        spawnCapsule(s, brick.x, brick.y + 1);
      }
    } else {
      if (brick.color === "gray") brick.flashUntil = s.time + FLASH_TIME;
      s.events.push("bounce");
    }
    return;
  }
}

// Choque entre pelotas: solo si se solapan y se acercan. n va del centro de A
// al de B; la componente de A sobre n pasa a negativa y la de B a positiva,
// así cada pelota se aleja de la otra y conserva su rapidez.
function collideBalls(s: BloqueBusterState): void {
  const balls = s.balls;
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i];
      const b = balls[j];
      const dx = b.x + b.size / 2 - (a.x + a.size / 2);
      const dy = b.y + b.size / 2 - (a.y + a.size / 2);
      const dist = Math.hypot(dx, dy);
      if (dist === 0 || dist >= BALL_SIZE) continue;

      const nx = dx / dist;
      const ny = dy / dist;
      const approaching = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny < 0;
      if (!approaching) continue;

      const an = a.vx * nx + a.vy * ny;
      const bn = b.vx * nx + b.vy * ny;
      a.vx += (-Math.abs(an) - an) * nx;
      a.vy += (-Math.abs(an) - an) * ny;
      b.vx += (Math.abs(bn) - bn) * nx;
      b.vy += (Math.abs(bn) - bn) * ny;
      s.events.push("bounce");
    }
  }
}

function updateBalls(s: BloqueBusterState, dt: number): void {
  // En el saque la pelota va pegada sobre el centro de la paleta.
  if (s.state === "serve") {
    placeBallOnPaddle(s);
    return;
  }

  for (const ball of s.balls) {
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Paredes laterales
    if (ball.x < 0) {
      ball.x = 0;
      ball.vx = Math.abs(ball.vx);
      s.events.push("bounce");
    } else if (ball.x + ball.size > W) {
      ball.x = W - ball.size;
      ball.vx = -Math.abs(ball.vx);
      s.events.push("bounce");
    }

    // Techo
    if (ball.y < HUD_H) {
      ball.y = HUD_H;
      ball.vy = Math.abs(ball.vy);
      s.events.push("bounce");
    }

    collideBricks(s, ball);
    if (s.bricks.length === 0) {
      s.state = s.level < LEVELS.length ? "levelclear" : "won";
      return;
    }

    // Paleta: solo rebota si la pelota baja.
    if (
      ball.vy > 0 &&
      overlaps(
        ball.x,
        ball.y,
        ball.size,
        ball.size,
        s.paddle.x,
        s.paddle.y,
        s.paddle.w,
        s.paddle.h,
      )
    ) {
      bounceOffPaddle(s, ball);
      s.events.push("bounce");
    }
  }

  collideBalls(s);

  // Las pelotas que caen por abajo se eliminan; la vida solo se pierde con la última.
  s.balls = s.balls.filter((ball) => ball.y <= H);
  if (s.balls.length === 0) loseLife(s);
}

// Suelta una cápsula en (x, y). Exportada para depurar la multibola.
export function spawnCapsule(s: BloqueBusterState, x: number, y: number): void {
  s.capsule = { x, y };
}

// La cápsula solo nace con 1 pelota en juego, así que s.balls[0] es el origen
// de las 3 nuevas; la original conserva su velocidad.
function activateMultiball(s: BloqueBusterState): void {
  const origin = s.balls[0];
  if (!origin) return;
  const speed = ballSpeed(s.level);
  for (const angle of MULTIBALL_ANGLES) {
    const ball = createBall();
    ball.x = origin.x;
    ball.y = origin.y;
    ball.vx = speed * Math.sin(angle);
    ball.vy = -speed * Math.cos(angle);
    s.balls.push(ball);
  }
}

// Cae en vertical; al tocar la paleta se atrapa y, si llega abajo, se pierde.
function updateCapsule(s: BloqueBusterState, dt: number): void {
  const capsule = s.capsule;
  if (!capsule) return;

  capsule.y += CAPSULE_SPEED * dt;

  const paddle = s.paddle;
  if (
    overlaps(
      capsule.x,
      capsule.y,
      CAPSULE_W,
      CAPSULE_H,
      paddle.x,
      paddle.y,
      paddle.w,
      paddle.h,
    )
  ) {
    s.capsule = null;
    s.events.push("bounce");
    activateMultiball(s);
  } else if (capsule.y > H) {
    s.capsule = null;
  }
}

// Avanza la partida dt segundos (ya limitado a MAX_DT). Muta s.
export function step(
  s: BloqueBusterState,
  dt: number,
  input: BloqueBusterInput,
): void {
  s.time += dt;
  // Explosiones: duran EXPLOSION_TIME y no colisionan.
  if (s.explosions.length > 0) {
    s.explosions = s.explosions.filter(
      (ex) => s.time - ex.startedAt <= EXPLOSION_TIME,
    );
  }

  if (s.state === "levelclear") {
    if (input.action) nextLevel(s);
    return;
  }
  // En victoria y game over la partida está congelada.
  if (s.state !== "serve" && s.state !== "playing") return;

  if (input.action) launchBall(s);
  updatePaddle(s, dt, input);
  updateBalls(s, dt);
  // updateBalls puede haber cambiado de estado (vida perdida, nivel superado).
  if (s.state === "playing") updateCapsule(s, dt);
}

// ¿Queda animación tras el fin de partida? El componente sigue dibujando mientras tanto.
export function isAnimating(s: BloqueBusterState): boolean {
  return s.explosions.length > 0;
}
