// DUELO PIXEL — dibujo en canvas a partir del estado y del skin. No dibuja
// puntuación, set, rival ni racha: van en el HUD. Las animaciones usan s.time,
// así que se congelan con la pausa.

import {
  BALL_SIZE,
  CPU_X,
  H,
  PADDLE_W,
  PLASMA_CHARGE,
  PLAYER_X,
  RIVALS,
  W,
  type DueloPixelState,
} from "./core";
import type { Skin } from "./skins";

const PIXEL_FONT = '"Press Start 2P", system-ui, monospace'; // --pixel
const R = BALL_SIZE / 2;

const pad2 = (n: number) => String(n).padStart(2, "0");

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

// Barrera de energía: línea fina con pulsos que bajan (decorativa).
function drawBarrier(
  ctx: CanvasRenderingContext2D,
  s: DueloPixelState,
  skin: Skin,
) {
  const p = skin.palette;
  const x = W / 2;
  if (skin.style === "pixel") {
    for (let y = 4; y < H; y += 16) {
      ctx.fillStyle = p.barrier;
      ctx.fillRect(x - 2, y, 4, 8);
    }
    for (let k = 0; k < 3; k++) {
      const py = Math.floor(((s.time * 120 + (k * H) / 3) % H) / 16) * 16 + 4;
      ctx.fillStyle = p.pulse;
      ctx.fillRect(x - 2, py, 4, 8);
    }
    return;
  }
  ctx.fillStyle = p.barrier;
  ctx.fillRect(x - 1, 0, 2, H);
  for (let k = 0; k < 3; k++) {
    const py = (s.time * 120 + (k * H) / 3) % H;
    const grad = ctx.createLinearGradient(0, py - 40, 0, py);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, p.pulse);
    ctx.fillStyle = grad;
    ctx.fillRect(x - 1, py - 40, 2, 40);
  }
}

function drawPaddle(
  ctx: CanvasRenderingContext2D,
  skin: Skin,
  x: number,
  y: number,
  h: number,
  color: string,
) {
  if (skin.style === "pixel") {
    ctx.fillStyle = color;
    ctx.fillRect(x, Math.round(y), PADDLE_W, Math.round(h));
    ctx.fillStyle = skin.palette.bg;
    ctx.fillRect(x + 4, Math.round(y) + 4, PADDLE_W - 8, 2); // muesca de 8 bits
    return;
  }
  if (skin.style === "outline") {
    glow(ctx, skin, color, 10);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.25;
    ctx.fillRect(x, y, PADDLE_W, h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, PADDLE_W - 2, h - 2);
    noGlow(ctx);
    return;
  }
  glow(ctx, skin, color, 12);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, PADDLE_W, h, 3);
  ctx.fill();
  noGlow(ctx);
}

function drawBall(
  ctx: CanvasRenderingContext2D,
  s: DueloPixelState,
  skin: Skin,
) {
  const b = s.ball;
  const p = skin.palette;
  const color = b.plasma ? p.plasma : p.ball;

  // Estela del plasma: posiciones anteriores, cada vez más pequeñas.
  b.trail.forEach((t, i) => {
    const k = 1 - (i + 1) / (b.trail.length + 1);
    if (skin.style === "pixel") {
      const size = Math.max(2, Math.round(BALL_SIZE * k));
      ctx.fillStyle = color;
      ctx.fillRect(
        Math.round(t.x - size / 2),
        Math.round(t.y - size / 2),
        size,
        size,
      );
    } else {
      ctx.globalAlpha = 0.5 * k;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(t.x, t.y, R * (0.4 + 0.6 * k), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  });

  if (skin.style === "pixel") {
    ctx.fillStyle = color;
    ctx.fillRect(
      Math.round(b.x - R),
      Math.round(b.y - R),
      BALL_SIZE,
      BALL_SIZE,
    );
    return;
  }
  glow(ctx, skin, color, b.plasma ? 18 : 10);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(b.x, b.y, R, 0, Math.PI * 2);
  ctx.fill();
  noGlow(ctx);
}

// Medidor de plasma: 6 segmentos abajo a la izquierda. Cargado parpadea,
// armado se ilumina entero en el color del plasma.
function drawMeter(
  ctx: CanvasRenderingContext2D,
  s: DueloPixelState,
  skin: Skin,
) {
  const p = skin.palette;
  const charged = s.plasma >= PLASMA_CHARGE;
  const armed = s.plasmaArmed > 0;
  const blinkOn = Math.floor(s.time * 4) % 2 === 0;
  const segW = 18;
  const segH = 8;
  const gap = 4;
  const x0 = 16;
  const y0 = H - 20;
  for (let i = 0; i < PLASMA_CHARGE; i++) {
    const x = x0 + i * (segW + gap);
    const lit = armed || i < s.plasma;
    if (lit) {
      const color = armed || (charged && blinkOn) ? p.plasma : p.meterOn;
      if (skin.style !== "pixel") glow(ctx, skin, color, armed ? 10 : 4);
      ctx.fillStyle = color;
      ctx.fillRect(x, y0, segW, segH);
      noGlow(ctx);
    } else {
      ctx.strokeStyle = p.meterOff;
      ctx.lineWidth = skin.style === "pixel" ? 2 : 1;
      ctx.strokeRect(x + 0.5, y0 + 0.5, segW - 1, segH - 1);
    }
  }
}

function rivalLabel(rival: number) {
  return `RIVAL ${pad2(rival)} · ${RIVALS[rival - 1]?.name ?? ""}`;
}

function text(
  ctx: CanvasRenderingContext2D,
  skin: Skin,
  value: string,
  y: number,
  size: number,
  color: string,
) {
  ctx.font = `${size}px ${PIXEL_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (skin.style !== "pixel") glow(ctx, skin, color, 8);
  ctx.fillStyle = color;
  ctx.fillText(value, W / 2, y);
  noGlow(ctx);
}

// Avisos: "RIVAL SUPERADO" entre sets y el rival al empezar cada set.
function drawBanners(
  ctx: CanvasRenderingContext2D,
  s: DueloPixelState,
  skin: Skin,
) {
  const p = skin.palette;
  if (s.state === "setWon") {
    ctx.fillStyle = p.veil;
    ctx.fillRect(0, 0, W, H);
    text(ctx, skin, "RIVAL SUPERADO", H * 0.42, 22, p.accent);
    const next =
      s.rival === 1 && s.circuit > 1
        ? `CIRCUITO ${pad2(s.circuit)}`
        : rivalLabel(s.rival);
    text(ctx, skin, next, H * 0.54, 12, p.text);
    return;
  }
  if (s.state === "serve" && s.playerPoints === 0 && s.cpuPoints === 0) {
    text(ctx, skin, rivalLabel(s.rival), H * 0.3, 14, p.text);
  }
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  s: DueloPixelState,
  skin: Skin,
): void {
  const p = skin.palette;
  ctx.imageSmoothingEnabled = skin.style !== "pixel";
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, W, H);

  drawBarrier(ctx, s, skin);
  drawPaddle(ctx, skin, PLAYER_X, s.player.y, s.player.h, p.player);
  drawPaddle(ctx, skin, CPU_X, s.cpu.y, s.cpu.h, p.cpu);
  drawMeter(ctx, s, skin);
  drawBall(ctx, s, skin);
  drawBanners(ctx, s, skin);
}
