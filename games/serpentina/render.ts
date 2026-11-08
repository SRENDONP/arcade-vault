// Dibujo de SERPENTINA en canvas a partir de SerpentinaState (SPEC 09).
// La paleta y el estilo de forma (relleno, contorno, pixelado, glow) salen del
// skin (skins.ts) y se aplican en tres helpers: glow(), drawShape() y markOn().
// Sin React. Puntuación, nivel y longitud los muestra el HUD: el canvas solo
// lleva el aviso de espera inicial.

import { BONUS_TIME, CELL, COLS, H, ROWS, W } from "./core";
import type { Cell, Dir, SerpentinaState } from "./core";
import type { Skin } from "./skins";

const PIXEL_FONT = '"Press Start 2P", system-ui, monospace'; // --pixel

const GAP = 2; // px entre bloques
const RADIUS = 5;

type Shape =
  | { kind: "rect"; x: number; y: number; w: number; h: number; r: number }
  | { kind: "disc"; x: number; y: number; r: number }
  | { kind: "diamond"; x: number; y: number; r: number };

// ---------------------------------------------------------------------------
// Helpers de estilo (lo único que consulta skin.style / skin.glow)
// ---------------------------------------------------------------------------

function glow(
  ctx: CanvasRenderingContext2D,
  skin: Skin,
  color: string,
  blur: number,
) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur * skin.glow;
}

// Color de las marcas dibujadas encima de una forma (ojos, cruz del choque):
// recortadas en el fondo sobre formas rellenas, del color de la forma sobre
// el relleno translúcido del contorno.
function markOn(skin: Skin, shapeColor: string): string {
  return skin.style === "outline" ? shapeColor : skin.palette.bg;
}

// Opacidad de un elemento que parpadea o se atenúa: el estilo pixel no usa alfa.
function fade(skin: Skin, alpha: number): number {
  return skin.style === "pixel" ? 1 : alpha;
}

function tracePath(ctx: CanvasRenderingContext2D, s: Shape, inset: number) {
  ctx.beginPath();
  if (s.kind === "rect") {
    ctx.roundRect(
      s.x + inset,
      s.y + inset,
      s.w - 2 * inset,
      s.h - 2 * inset,
      s.r,
    );
  } else if (s.kind === "disc") {
    ctx.arc(s.x, s.y, s.r - inset, 0, Math.PI * 2);
  } else {
    const r = s.r - inset;
    ctx.moveTo(s.x, s.y - r);
    ctx.lineTo(s.x + r, s.y);
    ctx.lineTo(s.x, s.y + r);
    ctx.lineTo(s.x - r, s.y);
    ctx.closePath();
  }
}

// Celdas de la rejilla de "píxeles" cuyo centro cae dentro de la forma.
function pixelShape(ctx: CanvasRenderingContext2D, cell: number, s: Shape) {
  if (s.kind === "rect") {
    ctx.fillRect(s.x, s.y, s.w, s.h);
    return;
  }
  const inside =
    s.kind === "disc"
      ? (dx: number, dy: number) => dx * dx + dy * dy <= s.r * s.r
      : (dx: number, dy: number) => Math.abs(dx) + Math.abs(dy) <= s.r;
  const x0 = Math.floor((s.x - s.r) / cell) * cell;
  const y0 = Math.floor((s.y - s.r) / cell) * cell;
  for (let y = y0; y < s.y + s.r; y += cell) {
    for (let x = x0; x < s.x + s.r; x += cell) {
      if (inside(x + cell / 2 - s.x, y + cell / 2 - s.y))
        ctx.fillRect(x, y, cell, cell);
    }
  }
}

// Segmento rasterizado en celdas (estilo pixel).
function pixelLine(
  ctx: CanvasRenderingContext2D,
  cell: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
) {
  const n = Math.max(
    1,
    Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) / cell),
  );
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    const y = y0 + ((y1 - y0) * i) / n;
    ctx.fillRect(
      Math.floor(x / cell) * cell,
      Math.floor(y / cell) * cell,
      cell,
      cell,
    );
  }
}

// Dibuja una forma según el estilo del skin, con la opacidad dada.
function drawShape(
  ctx: CanvasRenderingContext2D,
  skin: Skin,
  color: string,
  shape: Shape,
  alpha = 1,
) {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  if (skin.style === "pixel") {
    pixelShape(ctx, skin.cell, shape);
    return;
  }
  if (skin.style === "solid") {
    ctx.globalAlpha = alpha;
    tracePath(ctx, shape, 0);
    ctx.fill();
    ctx.globalAlpha = 1;
    return;
  }
  // outline: relleno translúcido + contorno.
  tracePath(ctx, shape, 1);
  ctx.globalAlpha = alpha * skin.fillAlpha;
  ctx.fill();
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// Elementos del juego
// ---------------------------------------------------------------------------

function center(c: Cell) {
  return { x: c.col * CELL + CELL / 2, y: c.row * CELL + CELL / 2 };
}

function blockShape(skin: Skin, c: Cell): Shape {
  // En pixel: bloque de bordes duros alineado a la rejilla de "píxeles".
  const inset = skin.style === "pixel" ? skin.cell / 2 : GAP / 2;
  return {
    kind: "rect",
    x: c.col * CELL + inset,
    y: c.row * CELL + inset,
    w: CELL - 2 * inset,
    h: CELL - 2 * inset,
    r: skin.style === "pixel" ? 0 : RADIUS,
  };
}

// Rejilla de puntos tenue en las esquinas de las casillas (decorativa).
function drawGrid(ctx: CanvasRenderingContext2D, skin: Skin) {
  ctx.fillStyle = skin.palette.faint;
  ctx.globalAlpha = fade(skin, 0.35);
  for (let r = 1; r < ROWS; r++) {
    for (let c = 1; c < COLS; c++) {
      ctx.fillRect(c * CELL - 1, r * CELL - 1, 2, 2);
    }
  }
  ctx.globalAlpha = 1;
}

function drawWalls(ctx: CanvasRenderingContext2D, skin: Skin) {
  const color = skin.palette.wall;
  if (skin.style === "pixel") {
    const t = skin.cell / 2; // borde duro de medio "píxel" para no tapar casillas
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, W, t);
    ctx.fillRect(0, H - t, W, t);
    ctx.fillRect(0, 0, t, H);
    ctx.fillRect(W - t, 0, t, H);
    return;
  }
  glow(ctx, skin, color, 10);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W - 2, H - 2);
  ctx.shadowBlur = 0;
}

function drawFood(
  ctx: CanvasRenderingContext2D,
  skin: Skin,
  c: Cell,
  t: number,
) {
  const { x, y } = center(c);
  const pulse = skin.style === "pixel" ? 0 : Math.sin(t * 6);
  const { food, foodShine } = skin.palette;
  glow(ctx, skin, food, 12 + 4 * pulse);
  drawShape(ctx, skin, food, {
    kind: "disc",
    x,
    y,
    r: skin.style === "pixel" ? 9 : 6 + 1.5 * pulse,
  });
  ctx.shadowBlur = 0;
  ctx.fillStyle = foodShine;
  if (skin.style === "pixel") {
    ctx.fillRect(
      Math.floor((x - 4) / 4) * 4,
      Math.floor((y - 4) / 4) * 4,
      4,
      4,
    );
    return;
  }
  ctx.beginPath();
  ctx.arc(x - 1.5, y - 1.5, 1.8, 0, Math.PI * 2);
  ctx.fill();
}

function drawBonus(
  ctx: CanvasRenderingContext2D,
  skin: Skin,
  b: NonNullable<SerpentinaState["bonus"]>,
  t: number,
) {
  // Parpadea en el último segundo.
  if (b.timeLeft < 1 && Math.floor(t * 8) % 2 === 0) return;
  const { x, y } = center(b.cell);
  const color = skin.palette.bonus;
  const size = skin.style === "pixel" ? 8 : 7 + Math.sin(t * 5);

  glow(ctx, skin, color, 14);
  drawShape(ctx, skin, color, { kind: "diamond", x, y, r: size });
  ctx.shadowBlur = 0;

  // Anillo que se vacía con el tiempo restante.
  const frac = Math.max(0, Math.min(1, b.timeLeft / BONUS_TIME));
  const start = -Math.PI / 2;
  const end = start + frac * Math.PI * 2;
  const radius = CELL / 2 - 1;
  if (skin.style === "pixel") {
    const c = skin.cell / 2; // anillo de medio "píxel" dentro de la casilla
    ctx.fillStyle = color;
    const steps = Math.ceil(frac * 40);
    for (let i = 0; i <= steps; i++) {
      const a = start + ((end - start) * i) / Math.max(1, steps);
      const px = x + Math.cos(a) * (radius - c);
      const py = y + Math.sin(a) * (radius - c);
      ctx.fillRect(Math.floor(px / c) * c, Math.floor(py / c) * c, c, c);
    }
    return;
  }
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.8;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, radius, start, end);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// Ojos orientados según la dirección.
function drawEyes(
  ctx: CanvasRenderingContext2D,
  skin: Skin,
  c: Cell,
  dir: Dir,
) {
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
  ctx.fillStyle = markOn(skin, skin.palette.head);
  for (const k of [-1, 1]) {
    ctx.fillRect(
      Math.round(x + fx * fwd + px * side * k - 2),
      Math.round(y + fy * fwd + py * side * k - 2),
      4,
      4,
    );
  }
}

function drawSnake(
  ctx: CanvasRenderingContext2D,
  skin: Skin,
  s: SerpentinaState,
) {
  const n = s.body.length;
  const { snake, head } = skin.palette;
  // Cuerpo: de la cola a la cabeza, atenuado hacia la cola; glow solo si el
  // skin lo pide (bodyGlow).
  glow(ctx, skin, snake, skin.bodyGlow);
  for (let i = n - 1; i >= 1; i--) {
    const alpha = 1 - ((1 - skin.tailAlpha) * i) / Math.max(1, n - 1);
    drawShape(ctx, skin, snake, blockShape(skin, s.body[i]), alpha);
  }
  ctx.shadowBlur = 0;

  // Cabeza más brillante, con glow.
  const h = s.body[0];
  glow(ctx, skin, snake, 16);
  drawShape(ctx, skin, head, blockShape(skin, h));
  ctx.shadowBlur = 0;
  drawEyes(ctx, skin, h, s.dir);
}

// Marca del choque: la cabeza en el color de la comida con una cruz.
function drawCrash(ctx: CanvasRenderingContext2D, skin: Skin, c: Cell) {
  const color = skin.palette.food;
  glow(ctx, skin, color, 18);
  drawShape(ctx, skin, color, blockShape(skin, c));
  ctx.shadowBlur = 0;
  const x0 = c.col * CELL + 7;
  const y0 = c.row * CELL + 7;
  const x1 = (c.col + 1) * CELL - 7;
  const y1 = (c.row + 1) * CELL - 7;
  const mark = markOn(skin, color);
  if (skin.style === "pixel") {
    ctx.fillStyle = mark;
    const k = skin.cell / 2;
    pixelLine(ctx, k, x0, y0, x1 - k, y1 - k);
    pixelLine(ctx, k, x1 - k, y0, x0, y1 - k);
    return;
  }
  ctx.strokeStyle = mark;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.moveTo(x1, y0);
  ctx.lineTo(x0, y1);
  ctx.stroke();
}

function drawWaitingHint(ctx: CanvasRenderingContext2D, skin: Skin, t: number) {
  ctx.globalAlpha = fade(skin, 0.55 + 0.45 * Math.abs(Math.sin(t * 2.5)));
  glow(ctx, skin, skin.palette.wall, 8);
  ctx.fillStyle = skin.palette.ink;
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
  skin: Skin,
): void {
  ctx.save();
  ctx.fillStyle = skin.palette.bg;
  ctx.fillRect(0, 0, W, H);

  drawGrid(ctx, skin);
  drawWalls(ctx, skin);
  if (s.food) drawFood(ctx, skin, s.food, s.time);
  if (s.bonus) drawBonus(ctx, skin, s.bonus, s.time);
  drawSnake(ctx, skin, s);
  if (s.state === "gameover" && s.crash) drawCrash(ctx, skin, s.crash);
  if (s.state === "waiting") drawWaitingHint(ctx, skin, s.time);

  ctx.restore();
}
