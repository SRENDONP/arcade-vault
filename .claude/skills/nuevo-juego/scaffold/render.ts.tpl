// __id__ — dibujo en canvas a partir del estado. Sin React.
// Paleta neón de la plataforma; glow (shadowBlur) solo en los elementos
// principales. El canvas no dibuja lo que ya muestra el HUD (puntuación,
// vidas, nivel).

import { H, W, type __Pascal__State } from "./core";

// Mismos valores que los tokens de app/globals.css (el canvas no lee CSS).
const COLORS = {
  bg: "#0a0a0f", // --bg
  ink: "#e6e9ff", // --ink
  cyan: "#00f5ff", // --cyan
  magenta: "#ff006e", // --magenta
  yellow: "#f5ff00", // --yellow
  green: "#00ff88", // --green
} as const;

// now = performance.now(), para parpadeos y pulsos.
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  s: __Pascal__State,
  now: number,
): void {
  ctx.save();
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);

  // TODO: dibujar entidades. Patrón de glow:
  // ctx.shadowColor = COLORS.cyan;
  // ctx.shadowBlur = 12;
  // ctx.strokeStyle = COLORS.cyan;
  // ...
  // ctx.shadowBlur = 0;
  void s;
  void now;

  ctx.restore();
}
