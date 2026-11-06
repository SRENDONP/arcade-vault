// Dibujo de SERPENTINA en canvas a partir de SerpentinaState (SPEC 09).
// Neón vectorial con la paleta de la plataforma; glow (shadowBlur) solo en la
// cabeza, los núcleos y los muros. Sin React. Puntuación, nivel y longitud los
// muestra el HUD: el canvas solo lleva el aviso de espera inicial.

import { BONUS_TIME, CELL, COLS, H, ROWS, W } from "./core";
import type { Cell, Dir, SerpentinaState } from "./core";

// Tokens de app/globals.css (el canvas no lee variables CSS).
const COLOR = {
  bg: "#0a0a0f", // --bg
  ink: "#e6e9ff", // --ink
  faint: "#4a4f70", // --ink-faint
  wall: "#00f5ff", // --cyan
  snake: "#00ff88", // --green (color del catálogo)
  head: "#8affc6", // --green aclarado
  food: "#ff006e", // --magenta
  bonus: "#f5ff00", // --yellow
} as const;

const PIXEL_FONT = '"Press Start 2P", system-ui, monospace'; // --pixel

const GAP = 2; // px entre bloques
const BLOCK = CELL - GAP;
const RADIUS = 5;

function glow(ctx: CanvasRenderingContext2D, color: string, blur: number) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

function center(c: Cell) {
  return { x: c.col * CELL + CELL / 2, y: c.row * CELL + CELL / 2 };
}

function block(ctx: CanvasRenderingContext2D, c: Cell) {
  ctx.beginPath();
  ctx.roundRect(
    c.col * CELL + GAP / 2,
    c.row * CELL + GAP / 2,
    BLOCK,
    BLOCK,
    RADIUS,
  );
  ctx.fill();
}

// Rejilla de puntos tenue en las esquinas de las casillas.
function drawGrid(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = COLOR.faint;
  ctx.globalAlpha = 0.35;
  for (let r = 1; r < ROWS; r++) {
    for (let c = 1; c < COLS; c++) {
      ctx.fillRect(c * CELL - 1, r * CELL - 1, 2, 2);
    }
  }
  ctx.globalAlpha = 1;
}

function drawWalls(ctx: CanvasRenderingContext2D) {
  glow(ctx, COLOR.wall, 10);
  ctx.strokeStyle = COLOR.wall;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W - 2, H - 2);
  ctx.shadowBlur = 0;
}

function drawFood(ctx: CanvasRenderingContext2D, c: Cell, t: number) {
  const { x, y } = center(c);
  const pulse = Math.sin(t * 6);
  glow(ctx, COLOR.food, 12 + 4 * pulse);
  ctx.fillStyle = COLOR.food;
  ctx.beginPath();
  ctx.arc(x, y, 6 + 1.5 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffd0e4";
  ctx.beginPath();
  ctx.arc(x - 1.5, y - 1.5, 1.8, 0, Math.PI * 2);
  ctx.fill();
}

function drawBonus(
  ctx: CanvasRenderingContext2D,
  b: NonNullable<SerpentinaState["bonus"]>,
  t: number,
) {
  // Parpadea en el último segundo.
  if (b.timeLeft < 1 && Math.floor(t * 8) % 2 === 0) return;
  const { x, y } = center(b.cell);
  const size = 7 + Math.sin(t * 5);

  glow(ctx, COLOR.bonus, 14);
  ctx.fillStyle = COLOR.bonus;
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x, y + size);
  ctx.lineTo(x - size, y);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  // Anillo que se vacía con el tiempo restante.
  const frac = Math.max(0, Math.min(1, b.timeLeft / BONUS_TIME));
  ctx.strokeStyle = COLOR.bonus;
  ctx.globalAlpha = 0.8;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, CELL / 2 - 1, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// Ojos orientados según la dirección.
function drawEyes(ctx: CanvasRenderingContext2D, c: Cell, dir: Dir) {
  const { x, y } = center(c);
  const fwd = 4;
  const side = 4.5;
  const [fx, fy] =
    dir === "up"
      ? [0, -1]
      : dir === "down"
        ? [0, 1]
        : dir === "left"
          ? [-1, 0]
          : [1, 0];
  const px = -fy;
  const py = fx;
  ctx.fillStyle = COLOR.bg;
  for (const k of [-1, 1]) {
    ctx.fillRect(
      x + fx * fwd + px * side * k - 2,
      y + fy * fwd + py * side * k - 2,
      4,
      4,
    );
  }
}

function drawSnake(ctx: CanvasRenderingContext2D, s: SerpentinaState) {
  const n = s.body.length;
  // Cuerpo: de la cola a la cabeza, atenuado hacia la cola, sin glow.
  ctx.fillStyle = COLOR.snake;
  for (let i = n - 1; i >= 1; i--) {
    ctx.globalAlpha = 1 - (0.55 * i) / Math.max(1, n - 1);
    block(ctx, s.body[i]);
  }
  ctx.globalAlpha = 1;

  // Cabeza más brillante, con glow.
  const head = s.body[0];
  glow(ctx, COLOR.snake, 16);
  ctx.fillStyle = COLOR.head;
  block(ctx, head);
  ctx.shadowBlur = 0;
  drawEyes(ctx, head, s.dir);
}

// Marca del choque: la cabeza en magenta con una cruz.
function drawCrash(ctx: CanvasRenderingContext2D, c: Cell) {
  glow(ctx, COLOR.food, 18);
  ctx.fillStyle = COLOR.food;
  block(ctx, c);
  ctx.shadowBlur = 0;
  const x0 = c.col * CELL + 7;
  const y0 = c.row * CELL + 7;
  const x1 = (c.col + 1) * CELL - 7;
  const y1 = (c.row + 1) * CELL - 7;
  ctx.strokeStyle = COLOR.bg;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.moveTo(x1, y0);
  ctx.lineTo(x0, y1);
  ctx.stroke();
}

function drawWaitingHint(ctx: CanvasRenderingContext2D, t: number) {
  ctx.globalAlpha = 0.55 + 0.45 * Math.abs(Math.sin(t * 2.5));
  glow(ctx, COLOR.wall, 8);
  ctx.fillStyle = COLOR.ink;
  ctx.font = `14px ${PIXEL_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("PULSA UNA DIRECCIÓN", W / 2, 8 * CELL);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  s: SerpentinaState,
): void {
  ctx.save();
  ctx.fillStyle = COLOR.bg;
  ctx.fillRect(0, 0, W, H);

  drawGrid(ctx);
  drawWalls(ctx);
  if (s.food) drawFood(ctx, s.food, s.time);
  if (s.bonus) drawBonus(ctx, s.bonus, s.time);
  drawSnake(ctx, s);
  if (s.state === "gameover" && s.crash) drawCrash(ctx, s.crash);
  if (s.state === "waiting") drawWaitingHint(ctx, s.time);

  ctx.restore();
}
