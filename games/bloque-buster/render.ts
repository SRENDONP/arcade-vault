// Dibujo de BLOQUE BUSTER en canvas a partir de BloqueBusterState.
// La paleta y el estilo de forma (cristal, contorno, pixelado, glow) salen del
// skin (skins.ts) y se aplican en los helpers glow(), fade() y drawBox().
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
  type Capsule,
  type Explosion,
  type Paddle,
} from "./core";
import { shade, type Skin } from "./skins";

const PIXEL_FONT = '"Press Start 2P", system-ui, monospace'; // --pixel

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

function noGlow(ctx: CanvasRenderingContext2D) {
  ctx.shadowBlur = 0;
}

// Opacidad de un elemento que se desvanece: el estilo pixel no usa alfa.
function fade(skin: Skin, alpha: number): number {
  return skin.style === "pixel" ? 1 : alpha;
}

// Encaja una coordenada en la rejilla de "píxeles" del skin.
function snap(skin: Skin, v: number): number {
  return Math.round(v / skin.cell) * skin.cell;
}

// Caja con el estilo del skin: ladrillos, pala y cápsula.
// glass: relleno translúcido + borde + franja de brillo (shine).
// outline: relleno muy translúcido + borde grueso.
// pixel: relleno opaco con bisel duro (claro arriba/izquierda, oscuro
// abajo/derecha) y esquinas recortadas en escalón si r > 0.
function drawBox(
  ctx: CanvasRenderingContext2D,
  skin: Skin,
  color: string,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  blur: number,
  shine = false,
  fillAlpha = skin.fillAlpha,
) {
  if (skin.style === "pixel") {
    const c = Math.min(2, skin.cell);
    const cut = r > 0 ? c : 0;
    ctx.fillStyle = color;
    ctx.fillRect(x + cut, y, w - 2 * cut, h);
    ctx.fillRect(x, y + cut, w, h - 2 * cut);
    ctx.fillStyle = shade(color, 0.4);
    ctx.fillRect(x + cut, y, w - 2 * cut, c);
    ctx.fillRect(x, y + cut, c, h - 2 * cut);
    ctx.fillStyle = shade(color, -0.3);
    ctx.fillRect(x + cut, y + h - c, w - 2 * cut, c);
    ctx.fillRect(x + w - c, y + cut, c, h - 2 * cut);
    return;
  }

  const line = skin.style === "outline" ? 2 : 1.5;
  glow(ctx, skin, color, blur);
  ctx.fillStyle = color;
  ctx.globalAlpha = fillAlpha;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = color;
  ctx.lineWidth = line;
  ctx.beginPath();
  ctx.roundRect(
    x + line / 2,
    y + line / 2,
    w - line,
    h - line,
    Math.max(0, r - 1),
  );
  ctx.stroke();
  noGlow(ctx);
  if (shine && skin.style === "glass") {
    // Brillo superior, como un bloque de cristal.
    ctx.fillStyle = color;
    ctx.fillRect(x + 3, y + 3, w - 6, 2);
  }
}

// ---------------------------------------------------------------------------
// Elementos del juego
// ---------------------------------------------------------------------------

// Línea fina del techo lógico (y = HUD_H), donde rebota la pelota.
function drawCeiling(ctx: CanvasRenderingContext2D, skin: Skin) {
  const color = skin.palette.ceiling;
  if (skin.style === "pixel") {
    // Línea discontinua de "píxeles" encima del techo.
    const c = skin.cell;
    ctx.fillStyle = color;
    for (let x = 0; x < W; x += c * 2) ctx.fillRect(x, HUD_H - c, c, c);
    return;
  }
  glow(ctx, skin, color, skin.style === "outline" ? 6 : 0);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, HUD_H - 0.5);
  ctx.lineTo(W, HUD_H - 0.5);
  ctx.stroke();
  noGlow(ctx);
}

// El gris destella al primer golpe y después queda en su tono dañado hasta
// romperse.
function drawBrick(
  ctx: CanvasRenderingContext2D,
  skin: Skin,
  b: Brick,
  time: number,
) {
  const p = skin.palette;
  const x = b.x + 1;
  const y = b.y + 1;
  const w = BRICK_W - 2;
  const h = BRICK_H - 2;

  if (b.flashUntil > time) {
    glow(ctx, skin, p.flash, 12);
    ctx.fillStyle = p.flash;
    ctx.fillRect(x, y, w, h);
    noGlow(ctx);
    return;
  }

  const color =
    b.color === "gray" && b.hits === 1 ? p.damaged : p.brick[b.color];
  drawBox(ctx, skin, color, x, y, w, h, 0, 8, true);
}

// Destello del color del ladrillo que crece y se desvanece en EXPLOSION_TIME.
function drawExplosion(
  ctx: CanvasRenderingContext2D,
  skin: Skin,
  ex: Explosion,
  time: number,
) {
  const t = Math.min(1, Math.max(0, (time - ex.startedAt) / EXPLOSION_TIME));
  const color = skin.palette.brick[ex.color];
  const grow = 1 + t * 0.8;
  const w = BRICK_W * grow;
  const h = BRICK_H * grow;
  const cx = ex.x + BRICK_W / 2;
  const cy = ex.y + BRICK_H / 2;
  const d = 6 + t * 18;
  const shards = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const;

  if (skin.style === "pixel") {
    // Marco y esquirlas en la rejilla, opacos.
    const c = skin.cell;
    const x0 = snap(skin, cx - w / 2);
    const y0 = snap(skin, cy - h / 2);
    const x1 = snap(skin, cx + w / 2);
    const y1 = snap(skin, cy + h / 2);
    ctx.fillStyle = color;
    ctx.fillRect(x0, y0, x1 - x0, c);
    ctx.fillRect(x0, y1 - c, x1 - x0, c);
    ctx.fillRect(x0, y0, c, y1 - y0);
    ctx.fillRect(x1 - c, y0, c, y1 - y0);
    for (const [sx, sy] of shards) {
      ctx.fillRect(
        snap(skin, cx + sx * d * 1.6),
        snap(skin, cy + sy * d),
        c,
        c,
      );
    }
    return;
  }

  ctx.globalAlpha = fade(skin, 1 - t);
  glow(ctx, skin, color, 14);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);
  // Esquirlas: cuatro puntos que salen hacia las esquinas.
  noGlow(ctx);
  ctx.fillStyle = color;
  for (const [sx, sy] of shards) {
    ctx.fillRect(cx + sx * d * 1.6 - 1.5, cy + sy * d - 1.5, 3, 3);
  }
  ctx.globalAlpha = 1;
}

// Cápsula con "+3": las pelotas que añade.
function drawCapsule(
  ctx: CanvasRenderingContext2D,
  skin: Skin,
  c: Capsule,
  now: number,
) {
  const p = skin.palette;
  const pulse = 10 + Math.sin(now / 120) * 4;
  const x = skin.style === "pixel" ? snap(skin, c.x) : c.x;
  const y = skin.style === "pixel" ? snap(skin, c.y) : c.y;

  if (skin.style === "glass") {
    // Cápsula opaca con brillo pulsante (look original).
    glow(ctx, skin, p.capsule, pulse);
    ctx.fillStyle = p.capsule;
    ctx.beginPath();
    ctx.roundRect(x, y, CAPSULE_W, CAPSULE_H, 7);
    ctx.fill();
    noGlow(ctx);
  } else {
    drawBox(ctx, skin, p.capsule, x, y, CAPSULE_W, CAPSULE_H, 7, pulse);
  }

  // Sobre el relleno translúcido del contorno el texto va del color de la
  // cápsula; sobre las cápsulas opacas, oscuro.
  ctx.fillStyle = skin.style === "outline" ? p.capsule : p.capsuleInk;
  ctx.font = `7px ${PIXEL_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("+3", x + CAPSULE_W / 2, y + CAPSULE_H / 2 + 1);
}

function drawPaddle(ctx: CanvasRenderingContext2D, skin: Skin, pd: Paddle) {
  const p = skin.palette;
  const x = skin.style === "pixel" ? snap(skin, pd.x) : pd.x;
  // La pala lleva algo más de relleno que los ladrillos (0.35 en el original).
  const fill = skin.style === "glass" ? 0.35 : skin.fillAlpha;
  drawBox(ctx, skin, p.cyan, x, pd.y, pd.w, pd.h, 7, 14, false, fill);
  // Núcleo central más brillante.
  ctx.fillStyle = p.ink;
  ctx.fillRect(x + pd.w / 2 - 12, pd.y + pd.h / 2 - 1, 24, 2);
}

function drawBall(ctx: CanvasRenderingContext2D, skin: Skin, b: Ball) {
  const r = b.size / 2;
  ctx.fillStyle = skin.palette.ink;
  if (skin.style === "pixel") {
    // Disco de "píxeles": celdas cuyo centro cae dentro del círculo.
    const c = skin.cell;
    const x0 = snap(skin, b.x);
    const y0 = snap(skin, b.y);
    for (let yy = 0; yy < b.size; yy += c) {
      for (let xx = 0; xx < b.size; xx += c) {
        const dx = xx + c / 2 - r;
        const dy = yy + c / 2 - r;
        if (dx * dx + dy * dy <= r * r) ctx.fillRect(x0 + xx, y0 + yy, c, c);
      }
    }
    return;
  }
  ctx.beginPath();
  ctx.arc(b.x + r, b.y + r, r, 0, Math.PI * 2);
  ctx.fill();
}

// Aviso "NIVEL 0N SUPERADO" sobre un velo, mientras dure ese estado.
function drawLevelClear(
  ctx: CanvasRenderingContext2D,
  skin: Skin,
  level: number,
) {
  const p = skin.palette;
  ctx.fillStyle = p.veil;
  ctx.fillRect(0, HUD_H, W, H - HUD_H);

  glow(ctx, skin, p.cyan, 12);
  ctx.fillStyle = p.cyan;
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
  skin: Skin,
): void {
  ctx.save();
  ctx.fillStyle = skin.palette.bg;
  ctx.fillRect(0, 0, W, H);

  drawCeiling(ctx, skin);
  for (const b of s.bricks) drawBrick(ctx, skin, b, s.time);
  for (const ex of s.explosions) drawExplosion(ctx, skin, ex, s.time);
  if (s.capsule) drawCapsule(ctx, skin, s.capsule, now);
  drawPaddle(ctx, skin, s.paddle);

  // Glow ligero común a todas las pelotas (con multibola hay hasta 4).
  glow(ctx, skin, skin.palette.ink, 6);
  for (const b of s.balls) drawBall(ctx, skin, b);
  noGlow(ctx);

  if (s.state === "levelclear") drawLevelClear(ctx, skin, s.level);

  ctx.restore();
}
