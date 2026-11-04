// Dibujo de ROCAS en canvas a partir de RocasState. Mismo trazo vectorial que
// references/asteroids/game.js, con la paleta neón de la plataforma y glow.
// Sin React. Puntuación, nivel y vidas los muestra el HUD de la plataforma:
// aquí solo queda el contador del disparo triple.

import { H, W } from "./core";
import type {
  Asteroid,
  Bullet,
  Particle,
  PowerUp,
  RocasState,
  Ship,
} from "./core";

// Tokens de app/globals.css (el canvas no lee variables CSS).
const COLOR = {
  bg: "#0a0a0f", // --bg
  ship: "#00f5ff", // --cyan
  rock: "#f5ff00", // --yellow (color del catálogo)
  powerUp: "#ff006e", // --magenta
  bullet: "#ffffff",
  flame: "rgba(255, 130, 0, 0.9)",
} as const;

const PIXEL_FONT = '"Press Start 2P", system-ui, monospace'; // --pixel

// Glow solo en nave, rocas y power-up; balas con uno mínimo y partículas sin
// glow, para no cargar el frame con shadowBlur.
function glow(ctx: CanvasRenderingContext2D, color: string, blur: number) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle) {
  const alpha = p.ttl / p.life;
  ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05);
  ctx.stroke();
}

function drawAsteroid(ctx: CanvasRenderingContext2D, a: Asteroid) {
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.rotate(a.rot);
  ctx.strokeStyle = COLOR.rock;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = "round";
  glow(ctx, COLOR.rock, 10);
  ctx.beginPath();
  ctx.moveTo(a.verts[0][0], a.verts[0][1]);
  for (let i = 1; i < a.verts.length; i++) {
    ctx.lineTo(a.verts[i][0], a.verts[i][1]);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawPowerUp(ctx: CanvasRenderingContext2D, p: PowerUp, now: number) {
  // Parpadea los últimos 2 s antes de desaparecer.
  if (p.ttl < 2 && Math.floor(p.ttl * 8) % 2 === 0) return;
  const pulse = 0.85 + Math.sin(now / 150) * 0.15;
  const r = p.radius * pulse;

  ctx.save();
  glow(ctx, COLOR.powerUp, 14);
  ctx.translate(p.x, p.y);
  ctx.rotate(Math.PI / 4);
  ctx.strokeStyle = COLOR.powerUp;
  ctx.lineWidth = 2;
  ctx.strokeRect(-r, -r, r * 2, r * 2);
  ctx.restore();

  ctx.save();
  glow(ctx, COLOR.powerUp, 6);
  ctx.fillStyle = COLOR.powerUp;
  ctx.font = `8px ${PIXEL_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("3x", p.x + 1, p.y + 1);
  ctx.restore();
}

function drawBullet(ctx: CanvasRenderingContext2D, b: Bullet) {
  ctx.save();
  glow(ctx, COLOR.bullet, 4);
  ctx.fillStyle = COLOR.bullet;
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawShip(ctx: CanvasRenderingContext2D, ship: Ship) {
  if (ship.dead) return;
  // Parpadeo durante la invencibilidad de reaparición.
  if (ship.invincible > 0 && Math.floor(ship.invincible * 8) % 2 === 0) return;

  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.rotate(ship.angle);
  ctx.lineWidth = 1.5;
  ctx.lineJoin = "round";

  // Silueta clásica: triángulo con muesca trasera.
  ctx.strokeStyle = COLOR.ship;
  glow(ctx, COLOR.ship, 12);
  ctx.beginPath();
  ctx.moveTo(20, 0); // nariz
  ctx.lineTo(-12, -9); // ala izquierda
  ctx.lineTo(-7, 0); // muesca trasera
  ctx.lineTo(-12, 9); // ala derecha
  ctx.closePath();
  ctx.stroke();

  // Llama del propulsor (parpadeo aleatorio, solo visual).
  if (ship.thrusting && Math.random() > 0.35) {
    ctx.strokeStyle = COLOR.flame;
    glow(ctx, COLOR.flame, 10);
    ctx.beginPath();
    ctx.moveTo(-8, -4);
    ctx.lineTo(-8 - (6 + Math.random() * 8), 0);
    ctx.lineTo(-8, 4);
    ctx.stroke();
  }

  ctx.restore();
}

function drawTripleShotTimer(ctx: CanvasRenderingContext2D, ship: Ship) {
  if (ship.tripleShot <= 0) return;
  ctx.save();
  glow(ctx, COLOR.powerUp, 8);
  ctx.fillStyle = COLOR.powerUp;
  ctx.font = `12px ${PIXEL_FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`3x ${ship.tripleShot.toFixed(1)}s`, 16, 16);
  ctx.restore();
}

// now = performance.now(), para el pulso del power-up.
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  s: RocasState,
  now: number,
): void {
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.fillStyle = COLOR.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  for (const p of s.particles) drawParticle(ctx, p);
  for (const a of s.asteroids) drawAsteroid(ctx, a);
  for (const p of s.powerUps) drawPowerUp(ctx, p, now);
  for (const b of s.bullets) drawBullet(ctx, b);
  drawShip(ctx, s.ship);
  drawTripleShotTimer(ctx, s.ship);
}
