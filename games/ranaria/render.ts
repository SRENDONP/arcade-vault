// Dibujo de RANARIA en canvas a partir de RanariaState (SPEC 13).
// Solo primitivas de canvas, sin imágenes. La paleta y el estilo de forma
// (relleno, contorno, pixelado, glow) salen del skin (skins.ts) y se aplican
// en los helpers de estilo: glow(), paint(), markOn(), fade(), lw() y, para el
// estilo pixel, drawPixelated(). Puntuación, vidas y nivel los muestra el HUD:
// el canvas solo lleva la barra de tiempo.

import {
  CELL,
  COLS,
  H,
  LILY_COLS,
  LILY_WIDTH,
  ROW_GOALS,
  ROW_RIVER_BOT,
  ROW_RIVER_TOP,
  ROW_ROAD_BOT,
  ROW_ROAD_TOP,
  ROW_SAFE_MID,
  ROW_START,
  TURTLE_UP,
  W,
  frogPosition,
  isSubmerged,
  tripTime,
  turtleCycleTime,
} from "./core";
import type { Dir, Entity, Lane, RanariaState } from "./core";
import type { RanariaPalette, Skin } from "./skins";

// Token de la paleta de los coches por fila y de la cabina de los camiones por fila.
type Tint = "cyan" | "magenta" | "yellow";
const CAR_TINT: Record<number, Tint> = {
  12: "magenta",
  11: "cyan",
  9: "yellow",
};
const CAB_TINT: Record<number, Tint> = {
  10: "cyan",
  8: "magenta",
};

const TURTLE_WARN = 0.5; // s de parpadeo antes de sumergirse
const TIME_BAR_H = 6; // px

const ANGLE: Record<Dir, number> = {
  up: 0,
  right: Math.PI / 2,
  down: Math.PI,
  left: -Math.PI / 2,
};

// ---------------------------------------------------------------------------
// Helpers de estilo (lo único que consulta skin.style / glow / fillAlpha)
// ---------------------------------------------------------------------------

function glow(ctx: CanvasRenderingContext2D, color: string, blur: number) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

// Rellena el trazado actual según el estilo del skin: macizo (solid, pixel) o
// contorno opaco con relleno translúcido (outline). `blur` es el shadowBlur.
function paint(
  ctx: CanvasRenderingContext2D,
  skin: Skin,
  color: string,
  blur = 0,
) {
  if (blur > 0) glow(ctx, color, blur);
  ctx.fillStyle = color;
  if (skin.style === "outline") {
    const alpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha * skin.fillAlpha;
    ctx.fill();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    ctx.fill();
  }
  if (blur > 0) ctx.shadowBlur = 0;
}

// Color de las marcas dibujadas encima de una forma (parabrisas, cruz del
// choque): recortadas en `mark` sobre formas macizas, del color de la forma
// sobre el relleno translúcido del contorno.
function markOn(skin: Skin, shapeColor: string, mark: string): string {
  return skin.style === "outline" ? shapeColor : mark;
}

// Elemento atenuado con alfa (ondas, rayas, tortugas que parpadean o están
// sumergidas). El estilo pixel no usa alfa: cambia a otro color de la paleta.
function fade(
  skin: Skin,
  color: string,
  alpha: number,
  pixelColor: string,
): [string, number] {
  return skin.style === "pixel" ? [pixelColor, 1] : [color, alpha];
}

// Grosor de línea: en pixel, al menos un "píxel" para que no se pierda al reducir.
function lw(skin: Skin, width: number): number {
  return skin.style === "pixel" ? Math.max(width, skin.cell) : width;
}

// ---------------------------------------------------------------------------
// Fondo por zonas
// ---------------------------------------------------------------------------

function rowY(row: number): number {
  return row * CELL;
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  skin: Skin,
  time: number,
) {
  const P = skin.palette;
  ctx.fillStyle = P.bg;
  ctx.fillRect(0, 0, W, H);

  // Río con ondas tenues que se desplazan.
  const riverY = rowY(ROW_RIVER_TOP);
  const riverH = (ROW_RIVER_BOT - ROW_RIVER_TOP + 1) * CELL;
  ctx.fillStyle = P.river;
  ctx.fillRect(0, riverY, W, riverH);
  const [wave, waveAlpha] = fade(skin, P.wave, 0.35, P.wave);
  ctx.strokeStyle = wave;
  ctx.globalAlpha = waveAlpha;
  ctx.lineWidth = lw(skin, 1.5);
  for (let row = ROW_RIVER_TOP; row <= ROW_RIVER_BOT; row++) {
    const shift = ((time * 12 * (row % 2 ? 1 : -1)) % 40) + 40;
    const y = rowY(row) + CELL * 0.6;
    ctx.beginPath();
    for (let x = -40 + (shift % 40); x < W; x += 40) {
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 10, y - 4, x + 20, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Carretera con líneas discontinuas entre carriles.
  const roadY = rowY(ROW_ROAD_TOP);
  const roadH = (ROW_ROAD_BOT - ROW_ROAD_TOP + 1) * CELL;
  ctx.fillStyle = P.road;
  ctx.fillRect(0, roadY, W, roadH);
  const [dash, dashAlpha] = fade(skin, P.inkFaint, 0.6, P.inkFaint);
  ctx.strokeStyle = dash;
  ctx.globalAlpha = dashAlpha;
  ctx.lineWidth = lw(skin, 2);
  ctx.setLineDash([14, 12]);
  for (let row = ROW_ROAD_TOP + 1; row <= ROW_ROAD_BOT; row++) {
    ctx.beginPath();
    ctx.moveTo(0, rowY(row));
    ctx.lineTo(W, rowY(row));
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // Mediana, salida y orilla.
  const edge = lw(skin, 2);
  for (const row of [ROW_SAFE_MID, ROW_START, ROW_GOALS]) {
    ctx.fillStyle = P.grass;
    ctx.fillRect(0, rowY(row), W, CELL);
    ctx.fillStyle = P.grassEdge;
    ctx.fillRect(0, rowY(row), W, edge);
    ctx.fillRect(0, rowY(row) + CELL - edge, W, edge);
  }
}

// ---------------------------------------------------------------------------
// Nenúfares y barra de tiempo
// ---------------------------------------------------------------------------

function drawLilies(
  ctx: CanvasRenderingContext2D,
  s: RanariaState,
  skin: Skin,
) {
  const P = skin.palette;
  const cy = rowY(ROW_GOALS) + CELL / 2 + TIME_BAR_H / 2;
  LILY_COLS.forEach((col, i) => {
    const cx = (col + LILY_WIDTH / 2) * CELL;
    const r = CELL * 0.62;
    // Disco con muesca (sector abierto hacia abajo).
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, Math.PI * 0.62, Math.PI * 0.38 + Math.PI * 2);
    ctx.closePath();
    // Relleno (translúcido en outline) y borde amarillo.
    ctx.globalAlpha = skin.fillAlpha;
    ctx.fillStyle = P.lily;
    ctx.fill();
    ctx.globalAlpha = 1;
    if (skin.entityGlow > 0) glow(ctx, P.yellow, skin.entityGlow);
    ctx.strokeStyle = P.yellow;
    ctx.lineWidth = lw(skin, 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    if (s.lilies[i]) drawFrogShape(ctx, skin, cx, cy, 0.7, "up", null, false);
  });
}

function drawTimeBar(
  ctx: CanvasRenderingContext2D,
  s: RanariaState,
  skin: Skin,
) {
  const P = skin.palette;
  const k = Math.max(0, Math.min(1, s.timeLeft / tripTime(s.level)));
  const color = k < 0.25 ? P.magenta : k < 0.5 ? P.yellow : P.green;
  // En pixel la barra ocupa dos "píxeles" para no perderse al reducir.
  const barH = Math.max(TIME_BAR_H, lw(skin, 0) * 2);
  ctx.fillStyle = P.bg;
  ctx.fillRect(0, rowY(ROW_GOALS), W, barH);
  glow(ctx, color, 8 * skin.glow);
  ctx.fillStyle = color;
  ctx.fillRect(0, rowY(ROW_GOALS), W * k, barH);
  ctx.shadowBlur = 0;
}

// ---------------------------------------------------------------------------
// Entidades de los carriles
// ---------------------------------------------------------------------------

function drawWheel(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawCar(
  ctx: CanvasRenderingContext2D,
  skin: Skin,
  e: Entity,
  lane: Lane,
  color: string,
) {
  const P = skin.palette;
  const x = e.x * CELL + 3;
  const y = rowY(lane.row) + 7;
  const w = e.width * CELL - 6;
  const h = CELL - 14;
  // Ruedas.
  ctx.fillStyle = P.wheel;
  for (const wx of [x + 6, x + w - 6]) {
    for (const wy of [y - 1, y + h + 1]) drawWheel(ctx, wx, wy);
  }
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 6);
  paint(ctx, skin, color, skin.entityGlow);
  // Parabrisas hacia el sentido de la marcha.
  ctx.fillStyle = markOn(skin, color, P.bg);
  const wsx = lane.dir > 0 ? x + w - 12 : x + 6;
  ctx.fillRect(wsx, y + 4, 6, h - 8);
}

function drawTruck(
  ctx: CanvasRenderingContext2D,
  skin: Skin,
  e: Entity,
  lane: Lane,
) {
  const P = skin.palette;
  const x = e.x * CELL + 3;
  const y = rowY(lane.row) + 6;
  const w = e.width * CELL - 6;
  const h = CELL - 12;
  const cabW = 18;
  const cabX = lane.dir > 0 ? x + w - cabW : x;
  const boxX = lane.dir > 0 ? x : x + cabW + 3;
  // Ruedas.
  ctx.fillStyle = P.wheel;
  for (let wx = x + 8; wx < x + w; wx += 22) {
    for (const wy of [y - 1, y + h + 1]) drawWheel(ctx, wx, wy);
  }
  // Caja de carga con listones.
  ctx.beginPath();
  ctx.roundRect(boxX, y, w - cabW - 3, h, 3);
  paint(ctx, skin, P.truck, skin.entityGlow);
  ctx.strokeStyle = P.inkFaint;
  ctx.lineWidth = lw(skin, 1);
  const gap = Math.max(10, lw(skin, 0) * 3);
  for (let lx = boxX + gap; lx < boxX + w - cabW - 6; lx += gap) {
    ctx.beginPath();
    ctx.moveTo(lx, y + 3);
    ctx.lineTo(lx, y + h - 3);
    ctx.stroke();
  }
  // Cabina.
  ctx.beginPath();
  ctx.roundRect(cabX, y + 2, cabW, h - 4, 5);
  paint(ctx, skin, P[CAB_TINT[lane.row] ?? "cyan"], skin.entityGlow);
}

function drawLog(
  ctx: CanvasRenderingContext2D,
  skin: Skin,
  e: Entity,
  lane: Lane,
) {
  const P = skin.palette;
  const x = e.x * CELL + 2;
  const y = rowY(lane.row) + 6;
  const w = e.width * CELL - 4;
  const h = CELL - 12;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  paint(ctx, skin, P.log, skin.entityGlow);
  // Vetas.
  ctx.strokeStyle = P.logVein;
  ctx.lineWidth = lw(skin, 2);
  for (let i = 1; i < e.width * 2; i++) {
    const lx = x + (w * i) / (e.width * 2);
    const ly = y + (i % 2 ? h * 0.35 : h * 0.65);
    ctx.beginPath();
    ctx.moveTo(lx - 8, ly);
    ctx.lineTo(lx + 8, ly);
    ctx.stroke();
  }
  // Anillos de los extremos.
  ctx.beginPath();
  ctx.ellipse(x + h / 2, y + h / 2, h / 4, h / 3, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawTurtles(
  ctx: CanvasRenderingContext2D,
  skin: Skin,
  e: Entity,
  lane: Lane,
  time: number,
) {
  const P = skin.palette;
  const submerged = isSubmerged(e, time);
  const t = turtleCycleTime(e, time);
  // Parpadeo de aviso en los últimos TURTLE_WARN s visibles.
  const warning = !submerged && t >= TURTLE_UP - TURTLE_WARN;
  const blinkOff = warning && Math.floor(t * 10) % 2 === 0;
  const cy = rowY(lane.row) + CELL / 2;
  const r = CELL * 0.38;
  for (let i = 0; i < e.width; i++) {
    const cx = (e.x + i + 0.5) * CELL;
    if (submerged) {
      // Sumergida: solo una onda tenue (no se puede pisar).
      const [ring, ringAlpha] = fade(skin, P.turtle, 0.35, P.wave);
      ctx.globalAlpha = ringAlpha;
      ctx.strokeStyle = ring;
      ctx.lineWidth = lw(skin, 1.5);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      continue;
    }
    const [body, alpha] = blinkOff
      ? fade(skin, P.turtle, 0.45, P.turtleShell)
      : [P.turtle, 1];
    ctx.globalAlpha = alpha;
    // Cabeza hacia el sentido de la marcha.
    ctx.beginPath();
    ctx.arc(cx + lane.dir * r * 1.05, cy, r * 0.32, 0, Math.PI * 2);
    paint(ctx, skin, body, skin.entityGlow);
    // Caparazón con dibujo.
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    paint(ctx, skin, body, skin.entityGlow);
    ctx.strokeStyle = P.turtleShell;
    ctx.lineWidth = lw(skin, 2);
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3;
      ctx.moveTo(cx + Math.cos(a) * r * 0.5, cy + Math.sin(a) * r * 0.5);
      ctx.lineTo(cx + Math.cos(a) * r * 0.95, cy + Math.sin(a) * r * 0.95);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawLanes(ctx: CanvasRenderingContext2D, s: RanariaState, skin: Skin) {
  const P = skin.palette;
  // Solo la franja visible del tablero.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, COLS * CELL, H);
  ctx.clip();
  for (const lane of s.lanes) {
    for (const e of lane.entities) {
      if (e.x + e.width <= 0 || e.x >= COLS) continue;
      if (e.kind === "car") {
        drawCar(ctx, skin, e, lane, P[CAR_TINT[lane.row] ?? "magenta"]);
      } else if (e.kind === "truck") drawTruck(ctx, skin, e, lane);
      else if (e.kind === "log") drawLog(ctx, skin, e, lane);
      else drawTurtles(ctx, skin, e, lane, s.time);
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Rana
// ---------------------------------------------------------------------------

// Rana centrada en (cx, cy). jumpT: avance del salto 0..1 (patas extendidas) o null.
function drawFrogShape(
  ctx: CanvasRenderingContext2D,
  skin: Skin,
  cx: number,
  cy: number,
  scale: number,
  facing: Dir,
  jumpT: number | null,
  dead: boolean,
) {
  const P = skin.palette;
  const color = dead ? P.magenta : P.green;
  const blur = scale < 1 ? 0 : 12 * skin.glow;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ANGLE[facing]);
  ctx.scale(scale, scale);
  glow(ctx, color, blur);
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";

  // Patas: recogidas en reposo, estiradas a mitad del salto.
  const stretch = jumpT === null ? 0 : Math.sin(jumpT * Math.PI);
  const legs: [number, number, number, number][] = [
    [-10, -6, -17, -12 - 6 * stretch],
    [10, -6, 17, -12 - 6 * stretch],
    [-10, 7, -17, 13 + 7 * stretch],
    [10, 7, 17, 13 + 7 * stretch],
  ];
  ctx.beginPath();
  for (const [x1, y1, x2, y2] of legs) {
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
  }
  ctx.stroke();

  // Cuerpo: elipse 24 × 28 (el lado largo en el sentido del salto).
  ctx.beginPath();
  ctx.ellipse(0, 0, 12, 14, 0, 0, Math.PI * 2);
  paint(ctx, skin, color, blur);
  ctx.shadowBlur = 0;

  // Ojos al frente.
  for (const ex of [-6, 6]) {
    ctx.fillStyle = P.ink;
    ctx.beginPath();
    ctx.arc(ex, -9, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = P.bg;
    ctx.beginPath();
    ctx.arc(ex, -10, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cruz del choque.
  if (dead) {
    ctx.strokeStyle = markOn(skin, color, P.bg);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-6, -2);
    ctx.lineTo(6, 10);
    ctx.moveTo(6, -2);
    ctx.lineTo(-6, 10);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFrog(ctx: CanvasRenderingContext2D, s: RanariaState, skin: Skin) {
  if (s.state !== "playing" && s.deathAt) {
    const { col, row } = s.deathAt;
    drawFrogShape(
      ctx,
      skin,
      (col + 0.5) * CELL,
      rowY(row) + CELL / 2,
      1,
      s.frog.facing,
      null,
      true,
    );
    return;
  }
  const p = frogPosition(s);
  // Durante el salto la rana se eleva un poco (sombra de salto).
  const lift = p.jumpT === null ? 0 : Math.sin(p.jumpT * Math.PI) * 4;
  drawFrogShape(
    ctx,
    skin,
    (p.col + 0.5) * CELL,
    p.row * CELL + CELL / 2 - lift,
    1 + lift * 0.02,
    s.frog.facing,
    p.jumpT,
    false,
  );
}

function drawScene(ctx: CanvasRenderingContext2D, s: RanariaState, skin: Skin) {
  ctx.save();
  drawBackground(ctx, skin, s.time);
  drawLilies(ctx, s, skin);
  drawLanes(ctx, s, skin);
  drawFrog(ctx, s, skin);
  drawTimeBar(ctx, s, skin);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Estilo pixel: la escena se dibuja a tamaño completo en un lienzo auxiliar,
// se reduce sin suavizado a una rejilla de (W / cell) × (H / cell), se
// cuantiza a los colores de la paleta (bordes duros, sin los tonos intermedios
// del antialiasing) y se amplía sin suavizado sobre el canvas del juego.
// ---------------------------------------------------------------------------

let fullBuf: CanvasRenderingContext2D | null = null;
let smallBuf: CanvasRenderingContext2D | null = null;
const paletteRgb = new WeakMap<RanariaPalette, number[][]>();

function buffer(
  prev: CanvasRenderingContext2D | null,
  w: number,
  h: number,
  readFrequently: boolean,
): CanvasRenderingContext2D | null {
  if (prev && prev.canvas.width === w && prev.canvas.height === h) return prev;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return canvas.getContext("2d", { willReadFrequently: readFrequently });
}

function rgbOf(palette: RanariaPalette): number[][] {
  let list = paletteRgb.get(palette);
  if (!list) {
    const hexes = [...new Set(Object.values(palette))];
    list = hexes.map((hex) =>
      [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)),
    );
    paletteRgb.set(palette, list);
  }
  return list;
}

// Cada píxel pasa al color de la paleta más cercano (distancia RGB).
function quantize(ctx: CanvasRenderingContext2D, palette: RanariaPalette) {
  const { width, height } = ctx.canvas;
  const img = ctx.getImageData(0, 0, width, height);
  const d = img.data;
  const colors = rgbOf(palette);
  for (let i = 0; i < d.length; i += 4) {
    let best = colors[0];
    let bestDist = Infinity;
    for (const c of colors) {
      const dr = d[i] - c[0];
      const dg = d[i + 1] - c[1];
      const db = d[i + 2] - c[2];
      const dist = dr * dr + dg * dg + db * db;
      if (dist < bestDist) {
        bestDist = dist;
        best = c;
      }
    }
    d[i] = best[0];
    d[i + 1] = best[1];
    d[i + 2] = best[2];
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

function drawPixelated(
  ctx: CanvasRenderingContext2D,
  s: RanariaState,
  skin: Skin,
): boolean {
  const cell = skin.cell;
  fullBuf = buffer(fullBuf, W, H, false);
  smallBuf = buffer(smallBuf, Math.ceil(W / cell), Math.ceil(H / cell), true);
  if (!fullBuf || !smallBuf) return false;
  drawScene(fullBuf, s, skin);
  const small = smallBuf;
  small.imageSmoothingEnabled = false;
  small.drawImage(
    fullBuf.canvas,
    0,
    0,
    small.canvas.width,
    small.canvas.height,
  );
  quantize(small, skin.palette);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    small.canvas,
    0,
    0,
    small.canvas.width * cell,
    small.canvas.height * cell,
  );
  ctx.restore();
  return true;
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  s: RanariaState,
  skin: Skin,
): void {
  if (skin.style === "pixel" && skin.cell > 1 && drawPixelated(ctx, s, skin))
    return;
  drawScene(ctx, s, skin);
}
