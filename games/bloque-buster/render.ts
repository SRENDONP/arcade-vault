// Dibujo de BLOQUE BUSTER en canvas a partir de BloqueBusterState.
// Estilo neón vectorial con glow, sin el spritesheet de la referencia.
// Sin React. Puntuación, vidas y nivel los muestra el HUD de la plataforma:
// sobre el canvas solo queda el aviso de nivel superado.

import {
  BRICK_H,
  BRICK_W,
  CAPSULE_H,
  CAPSULE_W,
  EXPLOSION_TIME,
  H,
  HUD_H,
  W,
  type Ball,
  type BloqueBusterState,
  type Brick,
  type BrickColor,
  type Capsule,
  type Explosion,
  type Paddle,
} from "./core";

// Tokens de app/globals.css (el canvas no lee variables CSS).
const COLOR = {
  bg: "#0a0a0f", // --bg
  ink: "#e6e9ff", // --ink
  cyan: "#00f5ff", // --cyan
  ceiling: "rgba(0, 245, 255, 0.35)",
  capsule: "#ff8800",
  veil: "rgba(5, 5, 12, 0.55)",
} as const;

// Color neón de cada tipo de ladrillo.
const BRICK_COLOR: Record<BrickColor, string> = {
  gray: "#8a8fb5", // acero (--ink-dim)
  yellow: "#f5ff00", // --yellow
  hotpink: "#ff4fd8",
  magenta: "#ff006e", // --magenta
  red: "#ff3b3b",
  green: "#00ff88", // --green
  cyan: "#00f5ff", // --cyan
};

const PIXEL_FONT = '"Press Start 2P", system-ui, monospace'; // --pixel

function glow(ctx: CanvasRenderingContext2D, color: string, blur: number) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

function noGlow(ctx: CanvasRenderingContext2D) {
  ctx.shadowBlur = 0;
}

// Línea fina del techo lógico (y = HUD_H), donde rebota la pelota.
function drawCeiling(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = COLOR.ceiling;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, HUD_H - 0.5);
  ctx.lineTo(W, HUD_H - 0.5);
  ctx.stroke();
}

// Relleno translúcido con borde brillante. El gris destella en blanco al
// primer golpe y después queda atenuado hasta romperse.
function drawBrick(ctx: CanvasRenderingContext2D, b: Brick, time: number) {
  const x = b.x + 1;
  const y = b.y + 1;
  const w = BRICK_W - 2;
  const h = BRICK_H - 2;

  if (b.flashUntil > time) {
    glow(ctx, "#ffffff", 12);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x, y, w, h);
    return;
  }

  const color = BRICK_COLOR[b.color];
  ctx.globalAlpha = b.color === "gray" && b.hits === 1 ? 0.6 : 1;
  glow(ctx, color, 8);
  ctx.fillStyle = color;
  ctx.globalAlpha *= 0.28;
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha /= 0.28;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5);
  // Brillo superior, como un bloque de cristal.
  noGlow(ctx);
  ctx.fillStyle = color;
  ctx.fillRect(x + 3, y + 3, w - 6, 2);
  ctx.globalAlpha = 1;
}

// Destello del color del ladrillo que crece y se desvanece en EXPLOSION_TIME.
function drawExplosion(
  ctx: CanvasRenderingContext2D,
  ex: Explosion,
  time: number,
) {
  const t = Math.min(1, Math.max(0, (time - ex.startedAt) / EXPLOSION_TIME));
  const color = BRICK_COLOR[ex.color];
  const grow = 1 + t * 0.8;
  const w = BRICK_W * grow;
  const h = BRICK_H * grow;
  const cx = ex.x + BRICK_W / 2;
  const cy = ex.y + BRICK_H / 2;

  ctx.globalAlpha = 1 - t;
  glow(ctx, color, 14);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);
  // Esquirlas: cuatro puntos que salen hacia las esquinas.
  noGlow(ctx);
  ctx.fillStyle = color;
  const d = 6 + t * 18;
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    ctx.fillRect(cx + sx * d * 1.6 - 1.5, cy + sy * d - 1.5, 3, 3);
  }
  ctx.globalAlpha = 1;
}

// Cápsula naranja con "+3": las pelotas que añade.
function drawCapsule(ctx: CanvasRenderingContext2D, c: Capsule, now: number) {
  const pulse = 10 + Math.sin(now / 120) * 4;
  glow(ctx, COLOR.capsule, pulse);
  ctx.fillStyle = COLOR.capsule;
  ctx.beginPath();
  ctx.roundRect(c.x, c.y, CAPSULE_W, CAPSULE_H, 7);
  ctx.fill();
  noGlow(ctx);

  ctx.fillStyle = "#ffffff";
  ctx.font = `7px ${PIXEL_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("+3", c.x + CAPSULE_W / 2, c.y + CAPSULE_H / 2 + 1);
}

function drawPaddle(ctx: CanvasRenderingContext2D, p: Paddle) {
  glow(ctx, COLOR.cyan, 14);
  ctx.fillStyle = COLOR.cyan;
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.roundRect(p.x, p.y, p.w, p.h, 7);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = COLOR.cyan;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(p.x + 1, p.y + 1, p.w - 2, p.h - 2, 6);
  ctx.stroke();
  noGlow(ctx);
  // Núcleo central más brillante.
  ctx.fillStyle = COLOR.ink;
  ctx.fillRect(p.x + p.w / 2 - 12, p.y + p.h / 2 - 1, 24, 2);
}

function drawBall(ctx: CanvasRenderingContext2D, b: Ball) {
  const r = b.size / 2;
  ctx.fillStyle = COLOR.ink;
  ctx.beginPath();
  ctx.arc(b.x + r, b.y + r, r, 0, Math.PI * 2);
  ctx.fill();
}

// Aviso "NIVEL 0N SUPERADO" sobre un velo, mientras dure ese estado.
function drawLevelClear(ctx: CanvasRenderingContext2D, level: number) {
  ctx.fillStyle = COLOR.veil;
  ctx.fillRect(0, HUD_H, W, H - HUD_H);

  glow(ctx, COLOR.cyan, 12);
  ctx.fillStyle = COLOR.cyan;
  ctx.font = `16px ${PIXEL_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    `NIVEL ${String(level).padStart(2, "0")} SUPERADO`,
    W / 2,
    H / 2 - 60,
  );
  noGlow(ctx);
}

// now = performance.now(), solo para el pulso de la cápsula; el resto de
// animaciones usa s.time y se congela con la pausa.
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  s: BloqueBusterState,
  now: number,
): void {
  ctx.save();
  ctx.fillStyle = COLOR.bg;
  ctx.fillRect(0, 0, W, H);

  drawCeiling(ctx);
  for (const b of s.bricks) drawBrick(ctx, b, s.time);
  for (const ex of s.explosions) drawExplosion(ctx, ex, s.time);
  if (s.capsule) drawCapsule(ctx, s.capsule, now);
  drawPaddle(ctx, s.paddle);

  // Glow ligero común a todas las pelotas (con multibola hay hasta 4).
  glow(ctx, COLOR.ink, 6);
  for (const b of s.balls) drawBall(ctx, b);
  noGlow(ctx);

  if (s.state === "levelclear") drawLevelClear(ctx, s.level);

  ctx.restore();
}
