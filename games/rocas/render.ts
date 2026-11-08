// Dibujo de ROCAS en canvas a partir de RocasState. Mismo trazo vectorial que
// references/asteroids/game.js; colores y estilo de trazo (glow, contorno con
// relleno, pixelado) salen del skin (skins.ts). Sin React. Puntuación, nivel y
// vidas los muestra el HUD de la plataforma: aquí solo queda el contador del
// disparo triple.

import { H, W } from "./core";
import type {
  Asteroid,
  Bullet,
  Particle,
  PowerUp,
  RocasState,
  Ship,
} from "./core";
import type { Skin } from "./skins";

const PIXEL_FONT = '"Press Start 2P", system-ui, monospace'; // --pixel

type Pt = readonly [number, number];

// ---------------------------------------------------------------------------
// Helpers de estilo: el único sitio que consulta skin.style / glow / fillAlpha
// ---------------------------------------------------------------------------

// Glow solo en nave, rocas y power-up; balas con uno mínimo y partículas sin
// glow, para no cargar el frame con shadowBlur. skin.glow lo escala (0 = nada).
function glow(
  ctx: CanvasRenderingContext2D,
  skin: Skin,
  color: string,
  blur: number,
) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur * skin.glow;
}

// Puntos locales → coordenadas del campo (rotación + traslación).
function place(pts: readonly Pt[], x: number, y: number, angle: number): Pt[] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return pts.map(([px, py]) => [x + px * c - py * s, y + px * s + py * c]);
}

// Segmento rasterizado en celdas de skin.cell (estilo pixel).
function pixelLine(ctx: CanvasRenderingContext2D, cell: number, a: Pt, b: Pt) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const steps = Math.max(
    1,
    Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / cell),
  );
  for (let i = 0; i <= steps; i++) {
    const x = a[0] + (dx * i) / steps;
    const y = a[1] + (dy * i) / steps;
    ctx.fillRect(
      Math.floor(x / cell) * cell,
      Math.floor(y / cell) * cell,
      cell,
      cell,
    );
  }
}

type ShapeOpts = {
  closed: boolean;
  width: number;
  blur: number;
  join?: CanvasLineJoin;
};

// Polígono o polilínea en coordenadas del campo, según el estilo del skin.
function strokeShape(
  ctx: CanvasRenderingContext2D,
  skin: Skin,
  pts: readonly Pt[],
  color: string,
  { closed, width, blur, join = "round" }: ShapeOpts,
) {
  ctx.save();
  if (skin.style === "pixel") {
    ctx.shadowBlur = 0;
    ctx.fillStyle = color;
    const last = closed ? pts.length : pts.length - 1;
    for (let i = 0; i < last; i++) {
      pixelLine(ctx, skin.cell, pts[i], pts[(i + 1) % pts.length]);
    }
    ctx.restore();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (closed) ctx.closePath();

  if (closed && skin.fillAlpha > 0) {
    ctx.shadowBlur = 0;
    ctx.globalAlpha = skin.fillAlpha;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = join;
  glow(ctx, skin, color, blur);
  ctx.stroke();
  ctx.restore();
}

// Punto relleno (balas): círculo, o celda de la rejilla en el estilo pixel.
function dot(
  ctx: CanvasRenderingContext2D,
  skin: Skin,
  x: number,
  y: number,
  radius: number,
  color: string,
  blur: number,
) {
  ctx.save();
  ctx.fillStyle = color;
  if (skin.style === "pixel") {
    ctx.shadowBlur = 0;
    const c = skin.cell;
    ctx.fillRect(Math.floor(x / c) * c, Math.floor(y / c) * c, c, c);
  } else {
    glow(ctx, skin, color, blur);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function label(
  ctx: CanvasRenderingContext2D,
  skin: Skin,
  text: string,
  x: number,
  y: number,
  size: number,
  align: CanvasTextAlign,
  baseline: CanvasTextBaseline,
  blur: number,
) {
  const color = skin.palette.powerUp;
  ctx.save();
  glow(ctx, skin, color, blur);
  ctx.fillStyle = color;
  ctx.font = `${size}px ${PIXEL_FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Elementos
// ---------------------------------------------------------------------------

function drawParticle(ctx: CanvasRenderingContext2D, skin: Skin, p: Particle) {
  const color = skin.palette.particle;
  if (skin.style === "pixel") {
    // Paleta de 8 bits: sin alfa, la chispa es una celda sólida.
    ctx.fillStyle = color;
    const c = skin.cell;
    ctx.fillRect(Math.floor(p.x / c) * c, Math.floor(p.y / c) * c, c, c);
    return;
  }
  ctx.save();
  ctx.globalAlpha = p.ttl / p.life;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05);
  ctx.stroke();
  ctx.restore();
}

function drawAsteroid(ctx: CanvasRenderingContext2D, skin: Skin, a: Asteroid) {
  strokeShape(ctx, skin, place(a.verts, a.x, a.y, a.rot), skin.palette.rock, {
    closed: true,
    width: 1.5,
    blur: 10,
  });
}

function drawPowerUp(
  ctx: CanvasRenderingContext2D,
  skin: Skin,
  p: PowerUp,
  now: number,
) {
  // Parpadea los últimos 2 s antes de desaparecer.
  if (p.ttl < 2 && Math.floor(p.ttl * 8) % 2 === 0) return;
  const pulse = 0.85 + Math.sin(now / 150) * 0.15;
  const r = p.radius * pulse;

  // Cuadrado girado 45°.
  const square: Pt[] = [
    [-r, -r],
    [r, -r],
    [r, r],
    [-r, r],
  ];
  strokeShape(
    ctx,
    skin,
    place(square, p.x, p.y, Math.PI / 4),
    skin.palette.powerUp,
    { closed: true, width: 2, blur: 14, join: "miter" },
  );
  label(ctx, skin, "3x", p.x + 1, p.y + 1, 8, "center", "middle", 6);
}

function drawBullet(ctx: CanvasRenderingContext2D, skin: Skin, b: Bullet) {
  dot(ctx, skin, b.x, b.y, b.radius, skin.palette.bullet, 4);
}

// Silueta clásica: triángulo con muesca trasera.
const SHIP_SHAPE: Pt[] = [
  [20, 0], // nariz
  [-12, -9], // ala izquierda
  [-7, 0], // muesca trasera
  [-12, 9], // ala derecha
];

function drawShip(ctx: CanvasRenderingContext2D, skin: Skin, ship: Ship) {
  if (ship.dead) return;
  // Parpadeo durante la invencibilidad de reaparición.
  if (ship.invincible > 0 && Math.floor(ship.invincible * 8) % 2 === 0) return;

  strokeShape(
    ctx,
    skin,
    place(SHIP_SHAPE, ship.x, ship.y, ship.angle),
    skin.palette.ship,
    { closed: true, width: 1.5, blur: 12 },
  );

  // Llama del propulsor (parpadeo aleatorio, solo visual).
  if (ship.thrusting && Math.random() > 0.35) {
    const flame: Pt[] = [
      [-8, -4],
      [-8 - (6 + Math.random() * 8), 0],
      [-8, 4],
    ];
    strokeShape(
      ctx,
      skin,
      place(flame, ship.x, ship.y, ship.angle),
      skin.palette.flame,
      { closed: false, width: 1.5, blur: 10 },
    );
  }
}

function drawTripleShotTimer(
  ctx: CanvasRenderingContext2D,
  skin: Skin,
  ship: Ship,
) {
  if (ship.tripleShot <= 0) return;
  label(
    ctx,
    skin,
    `3x ${ship.tripleShot.toFixed(1)}s`,
    16,
    16,
    12,
    "left",
    "top",
    8,
  );
}

// now = performance.now(), para el pulso del power-up.
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  s: RocasState,
  now: number,
  skin: Skin,
): void {
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.fillStyle = skin.palette.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  for (const p of s.particles) drawParticle(ctx, skin, p);
  for (const a of s.asteroids) drawAsteroid(ctx, skin, a);
  for (const p of s.powerUps) drawPowerUp(ctx, skin, p, now);
  for (const b of s.bullets) drawBullet(ctx, skin, b);
  drawShip(ctx, skin, s.ship);
  drawTripleShotTimer(ctx, skin, s.ship);
}
