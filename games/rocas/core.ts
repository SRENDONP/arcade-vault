// Lógica pura de ROCAS (port de references/asteroids/game.js): nave, balas,
// rocas, power-up de disparo triple, partículas, colisiones y niveles.
// Sin React, APIs del navegador ni aleatoriedad global: toda la
// aleatoriedad pasa por `s.rng`, que inyecta quien llama a `createState`. El estado es mutable y lo avanza `step`.

export const W = 800;
export const H = 600;
export const START_LIVES = 3;
export const RADII = [0, 16, 30, 50] as const; // por tamaño 1, 2, 3
export const SPEEDS = [0, 85, 55, 32] as const; // velocidad base por tamaño
export const POINTS = [0, 100, 50, 20] as const; // puntos por tamaño
export const POWERUP_DROP_CHANCE = 0.15;
export const POWERUP_GUARANTEED_KILLS = 5;
export const POWERUP_DURATION = 5; // s de disparo triple
export const POWERUP_TTL = 12; // s en pantalla
export const TRIPLE_SPREAD = 0.18; // rad
export const MAX_DT = 0.05;

// Valores internos de la referencia.
const BULLET_SPEED = 520; // px/s
const BULLET_TTL = 1.1; // s
const BULLET_RADIUS = 2;
const SHIP_RADIUS = 12;
const SHIP_ROT = 3.5; // rad/s
const SHIP_THRUST = 260; // px/s²
const SHIP_DRAG = 0.987; // por frame, como en la referencia
const SHIP_NOSE = 21; // distancia del centro a la boca del cañón
const SHOOT_COOLDOWN = 0.2; // s
const RESPAWN_INVINCIBLE = 3; // s
const RESPAWN_DELAY = 2; // s
const SHIP_HIT_FUDGE = 0.82;
const SAFE_DIST = 130; // px alrededor del centro al generar rocas
const START_ASTEROIDS = 4;
const POWERUP_RADIUS = 12;

export type Vec = { x: number; y: number };
export type AsteroidSize = 1 | 2 | 3;

export type Bullet = Vec & {
  vx: number;
  vy: number;
  ttl: number;
  radius: number;
  dead: boolean;
};
export type Asteroid = Vec & {
  size: AsteroidSize;
  radius: number;
  vx: number;
  vy: number;
  rot: number;
  rotSpeed: number;
  verts: [number, number][];
  dead: boolean;
};
export type PowerUp = Vec & {
  vx: number;
  vy: number;
  ttl: number;
  radius: number;
  dead: boolean;
};
export type Particle = Vec & {
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  dead: boolean;
};
export type Ship = Vec & {
  angle: number;
  vx: number;
  vy: number;
  radius: number;
  thrusting: boolean;
  invincible: number;
  shootCooldown: number;
  tripleShot: number;
  dead: boolean;
};

export type EngineState = "playing" | "dead" | "gameover";

export type RocasState = {
  ship: Ship;
  bullets: Bullet[];
  asteroids: Asteroid[];
  particles: Particle[];
  powerUps: PowerUp[];
  score: number;
  lives: number;
  level: number;
  destroyed: number; // rocas destruidas en la partida (todas las tallas)
  state: EngineState;
  deadTimer: number;
  powerUpSpawned: boolean;
  killsSinceSpawn: number;
  rng: () => number; // inyectable; la UI pasa el generador del navegador
};

// Entrada de un frame: teclas mantenidas + disparo de un solo frame.
export type RocasInput = {
  left: boolean;
  right: boolean;
  thrust: boolean;
  fire: boolean;
};

// ── Utilidades ───────────────────────────────────────────────────────────────

export function wrap(v: number, max: number): number {
  return ((v % max) + max) % max;
}

const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
const rand = (rng: () => number, min: number, max: number) =>
  min + rng() * (max - min);
const randInt = (rng: () => number, min: number, max: number) =>
  Math.floor(rand(rng, min, max + 1));

// ── Fábricas ─────────────────────────────────────────────────────────────────

function createBullet(x: number, y: number, angle: number): Bullet {
  return {
    x,
    y,
    vx: Math.cos(angle) * BULLET_SPEED,
    vy: Math.sin(angle) * BULLET_SPEED,
    ttl: BULLET_TTL,
    radius: BULLET_RADIUS,
    dead: false,
  };
}

function createAsteroid(
  rng: () => number,
  x: number,
  y: number,
  size: AsteroidSize = 3,
): Asteroid {
  const radius = RADII[size];
  const angle = rand(rng, 0, Math.PI * 2);
  const speed = SPEEDS[size] + rand(rng, -15, 15);
  const rotSpeed = rand(rng, -1.2, 1.2);
  const rot = rand(rng, 0, Math.PI * 2);

  // Polígono irregular
  const n = randInt(rng, 8, 13);
  const verts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = radius * rand(rng, 0.6, 1.0);
    verts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }

  return {
    x,
    y,
    size,
    radius,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    rot,
    rotSpeed,
    verts,
    dead: false,
  };
}

function createPowerUp(rng: () => number, x: number, y: number): PowerUp {
  const angle = rand(rng, 0, Math.PI * 2);
  const speed = rand(rng, 20, 40);
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    ttl: POWERUP_TTL,
    radius: POWERUP_RADIUS,
    dead: false,
  };
}

function createParticle(rng: () => number, x: number, y: number): Particle {
  const angle = rand(rng, 0, Math.PI * 2);
  const speed = rand(rng, 30, 130);
  const life = rand(rng, 0.4, 1.1);
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life,
    ttl: life,
    dead: false,
  };
}

function createShip(): Ship {
  const ship: Ship = {
    x: 0,
    y: 0,
    angle: 0,
    vx: 0,
    vy: 0,
    radius: SHIP_RADIUS,
    thrusting: false,
    invincible: 0,
    shootCooldown: 0,
    tripleShot: 0,
    dead: false,
  };
  resetShip(ship);
  return ship;
}

// Igual que Ship.reset() de la referencia: no toca `tripleShot`.
function resetShip(ship: Ship): void {
  ship.x = W / 2;
  ship.y = H / 2;
  ship.angle = -Math.PI / 2;
  ship.vx = 0;
  ship.vy = 0;
  ship.radius = SHIP_RADIUS;
  ship.thrusting = false;
  ship.invincible = RESPAWN_INVINCIBLE;
  ship.shootCooldown = 0;
  ship.dead = false;
}

// ── Actualización de entidades ───────────────────────────────────────────────

function updateMover(m: Vec & { vx: number; vy: number }, dt: number): void {
  m.x = wrap(m.x + m.vx * dt, W);
  m.y = wrap(m.y + m.vy * dt, H);
}

function updateShip(ship: Ship, dt: number, input: RocasInput): void {
  if (ship.dead) return;
  if (ship.invincible > 0) ship.invincible -= dt;
  if (ship.shootCooldown > 0) ship.shootCooldown -= dt;
  if (ship.tripleShot > 0) ship.tripleShot -= dt;

  if (input.left) ship.angle -= SHIP_ROT * dt;
  if (input.right) ship.angle += SHIP_ROT * dt;

  ship.thrusting = input.thrust;
  if (ship.thrusting) {
    ship.vx += Math.cos(ship.angle) * SHIP_THRUST * dt;
    ship.vy += Math.sin(ship.angle) * SHIP_THRUST * dt;
  }

  ship.vx *= SHIP_DRAG;
  ship.vy *= SHIP_DRAG;
  updateMover(ship, dt);
}

function tryShoot(ship: Ship): Bullet[] {
  if (ship.shootCooldown > 0 || ship.dead) return [];
  ship.shootCooldown = SHOOT_COOLDOWN;
  const ox = ship.x + Math.cos(ship.angle) * SHIP_NOSE;
  const oy = ship.y + Math.sin(ship.angle) * SHIP_NOSE;
  if (ship.tripleShot > 0) {
    return [
      createBullet(ox, oy, ship.angle - TRIPLE_SPREAD),
      createBullet(ox, oy, ship.angle),
      createBullet(ox, oy, ship.angle + TRIPLE_SPREAD),
    ];
  }
  return [createBullet(ox, oy, ship.angle)];
}

function splitAsteroid(rng: () => number, a: Asteroid): Asteroid[] {
  if (a.size <= 1) return [];
  const size = (a.size - 1) as AsteroidSize;
  return [
    createAsteroid(rng, a.x, a.y, size),
    createAsteroid(rng, a.x, a.y, size),
  ];
}

function updateParticles(s: RocasState, dt: number): void {
  for (const p of s.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.ttl -= dt;
    if (p.ttl <= 0) p.dead = true;
  }
  s.particles = s.particles.filter((p) => !p.dead);
}

// ── Estado de la partida ─────────────────────────────────────────────────────

function spawnAsteroids(s: RocasState, count: number): void {
  for (let i = 0; i < count; i++) {
    let x: number;
    let y: number;
    do {
      x = rand(s.rng, 0, W);
      y = rand(s.rng, 0, H);
    } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
    s.asteroids.push(createAsteroid(s.rng, x, y, 3));
  }
}

function explode(s: RocasState, x: number, y: number, count = 8): void {
  for (let i = 0; i < count; i++) s.particles.push(createParticle(s.rng, x, y));
}

// = initGame() de la referencia.
export function createState(rng: () => number): RocasState {
  const s: RocasState = {
    ship: createShip(),
    bullets: [],
    asteroids: [],
    particles: [],
    powerUps: [],
    score: 0,
    lives: START_LIVES,
    level: 1,
    destroyed: 0,
    state: "playing",
    deadTimer: 0,
    powerUpSpawned: false,
    killsSinceSpawn: 0,
    rng,
  };
  spawnAsteroids(s, START_ASTEROIDS);
  return s;
}

function nextLevel(s: RocasState): void {
  s.level++;
  s.bullets = [];
  s.particles = [];
  s.powerUps = [];
  s.powerUpSpawned = false;
  s.killsSinceSpawn = 0;
  resetShip(s.ship);
  spawnAsteroids(s, 3 + s.level);
}

function killShip(s: RocasState): void {
  explode(s, s.ship.x, s.ship.y, 14);
  s.ship.dead = true;
  s.lives--;
  if (s.lives <= 0) {
    s.state = "gameover";
  } else {
    s.state = "dead";
    s.deadTimer = RESPAWN_DELAY;
  }
}

// Avanza la partida `dt` segundos. El reinicio tras `gameover` lo hace la UI
// con un `createState()` nuevo.
export function step(s: RocasState, dt: number, input: RocasInput): void {
  dt = Math.min(Math.max(dt, 0), MAX_DT);

  if (s.state === "gameover") {
    updateParticles(s, dt);
    return;
  }

  if (s.state === "dead") {
    s.deadTimer -= dt;
    updateParticles(s, dt);
    for (const a of s.asteroids) {
      updateMover(a, dt);
      a.rot += a.rotSpeed * dt;
    }
    if (s.deadTimer <= 0) {
      s.state = "playing";
      resetShip(s.ship);
    }
    return;
  }

  // Disparar
  if (input.fire) s.bullets.push(...tryShoot(s.ship));

  updateShip(s.ship, dt, input);
  for (const b of s.bullets) {
    updateMover(b, dt);
    b.ttl -= dt;
    if (b.ttl <= 0) b.dead = true;
  }
  for (const a of s.asteroids) {
    updateMover(a, dt);
    a.rot += a.rotSpeed * dt;
  }
  updateParticles(s, dt);
  for (const p of s.powerUps) {
    updateMover(p, dt);
    p.ttl -= dt;
    if (p.ttl <= 0) p.dead = true;
  }

  s.bullets = s.bullets.filter((b) => !b.dead);
  s.powerUps = s.powerUps.filter((p) => !p.dead);

  // Nave vs power-up
  for (const p of s.powerUps) {
    if (!p.dead && dist(s.ship, p) < s.ship.radius + p.radius) {
      p.dead = true;
      s.ship.tripleShot = POWERUP_DURATION;
    }
  }

  // Bala vs roca
  const newAsteroids: Asteroid[] = [];
  for (const b of s.bullets) {
    for (const a of s.asteroids) {
      if (!a.dead && !b.dead && dist(b, a) < a.radius) {
        b.dead = true;
        a.dead = true;
        s.score += POINTS[a.size];
        s.destroyed++;
        explode(s, a.x, a.y, a.size * 5);
        newAsteroids.push(...splitAsteroid(s.rng, a));
        if (!s.powerUpSpawned) {
          s.killsSinceSpawn++;
          const guaranteed = s.killsSinceSpawn >= POWERUP_GUARANTEED_KILLS;
          if (guaranteed || s.rng() < POWERUP_DROP_CHANCE) {
            s.powerUps.push(createPowerUp(s.rng, a.x, a.y));
            s.powerUpSpawned = true;
          }
        }
      }
    }
  }
  s.asteroids = s.asteroids.filter((a) => !a.dead).concat(newAsteroids);
  s.bullets = s.bullets.filter((b) => !b.dead);

  // Nave vs roca
  if (s.ship.invincible <= 0) {
    for (const a of s.asteroids) {
      if (dist(s.ship, a) < s.ship.radius + a.radius * SHIP_HIT_FUDGE) {
        killShip(s);
        break;
      }
    }
  }

  // Nivel completado
  if (s.asteroids.length === 0) nextLevel(s);
}
