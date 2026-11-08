# SPEC NN — Juego real: INVASORES (diseño original del género disparos contra formaciones)

> **Estado:** Borrador
> **Depende de:** SPEC 05, SPEC 06, SPEC 07
> **Fecha:** 2026-11-07
> **Objetivo:** Hacer jugable `/juegos/invasores/jugar` con un juego original del género disparos contra formaciones, alojado en `games/invasores/`, con el HUD, la pausa y el modal de fin de partida de la plataforma, y su puntuación en el ranking de Supabase.

---

## Por qué existe este spec

La entrada `invasores` de `lib/games.ts` (`SHOOTER`, portada `cover-invaders`, color `green`) usa hoy el simulador `components/game-player.tsx`. No está en `PLAYABLE`.
No hay referencia en `references/`: las reglas se diseñan aquí. Nace de la jam "Invasores" (`specs/game-jam/invasores/`) y de la sugerencia de `game-planner` (35/40): "oleadas de formaciones que cambian de patrón y escudos que se recargan con combos".
El diseño toma del género solo la idea general (un cañón que se mueve en horizontal y dispara a una formación que baja) y añade dos giros propios:

- **Formación que cambia de figura:** BLOQUE → CUÑA → ANILLO → COLUMNAS. Durante el cambio (0,8 s) los invasores no disparan y valen el doble.
- **Escudo de fase:** un anillo alrededor del cañón que absorbe impactos y se recarga encadenando aciertos. No hay búnkeres en el suelo ni nave nodriza.

Los invasores son formas geométricas de neón (rombo, triángulo, hexágono), no sprites de criaturas.
SPEC 05 y 06 fijaron la convención `games/<id>/` y el registro `games/index.ts`; SPEC 07 conectó el modal a Supabase. Al registrar `invasores` en `PLAYABLE`, el juego entra en el ranking sin migraciones.
El nombre visible es "INVASORES"; ningún nombre de un juego comercial aparece en la UI.

---

## Alcance

**Dentro:**

- Carpeta `games/invasores/` y entrada `invasores: InvasoresGame` en `PLAYABLE` de `games/index.ts`.
- Sin entrada nueva en el catálogo: se reutiliza `invasores` de `lib/games.ts` con su portada `cover-invaders` y su color `green`. Solo se ajusta el texto `long` (ver al final de esta lista).
- Lógica pura en `games/invasores/core.ts`, con reglas originales:
  - **Campo lógico:** 480×640 px, origen arriba a la izquierda. Superficie en `GROUND_Y = 576`, dibujada como una línea.
  - **Cañón:** rectángulo de 36×16 px con el centro en y = 600. Empieza en x = 240. Se mueve a 300 px/s con ← → o A D, con el centro limitado a [18, 462].
  - **Formación:** 45 invasores en 5 filas × 9 columnas lógicas (`row` 0–4, `col` 0–8). Cada invasor mide 28×20 px. El tipo depende de la fila:
    - Vigía (fila 0): 30 puntos.
    - Soldado (filas 1–2): 20 puntos.
    - Larva (filas 3–4): 10 puntos.
  - **Ancla de la formación:** `anchor = { x, y }`. `x` es el centro horizontal; `y` es la **línea inferior** de la figura completa (el borde inferior del hueco más bajo, esté vivo o no). Así, cambiar de figura nunca acerca la formación a la superficie.
  - **Figuras:** cada hueco `(row, col)` tiene una posición bruta `(px, py)` en px según la figura. Su desplazamiento respecto al ancla es `dx = px`, `dy = py − maxPy − 10`, donde `maxPy` es la mayor `py` de los 45 huecos de esa figura.
    - **BLOQUE:** `px = (col − 4) × 40`, `py = row × 32`.
    - **CUÑA** (punta hacia abajo): `px = (col − 4) × 40`, `py = row × 28 + (4 − |col − 4|) × 14`.
    - **ANILLO:** índice `i = row × 9 + col`.
      - Si `i < 18`: radio 104 y ángulo `i × 20°`.
      - Si no: radio 156 y ángulo `(i − 18) × 360/27°`.
      - Con el ángulo 0 arriba: `px = R × sin(a)`, `py = −R × cos(a)`.
    - **COLUMNAS:** grupo `g = floor(col / 3)`, `c = col % 3`; `px = (g − 1) × 144 + (c − 1) × 32`, `py = row × 28`. Son tres pilares de 3×5 separados por 52 px.
  - **Ciclo de figuras:** `PATTERNS = ["bloque", "cuna", "anillo", "columnas"]`. Cada oleada empieza en BLOQUE con el ancla en (240, 220). Cada cambio pasa a la siguiente figura del ciclo, volviendo a BLOQUE después de COLUMNAS.
  - **Cambio de figura** (decisión del usuario):
    - Se dispara cuando `patternTime` llega a 12 s.
    - También se dispara al caer el invasor 15 y el invasor 30 de la oleada (1/3 y 2/3 de la formación). Cada umbral solo dispara una vez por oleada.
    - Vale lo que llegue antes, y cada cambio pone `patternTime` a 0.
    - Un umbral alcanzado durante un cambio queda pendiente y empieza al terminar ese cambio.
    - `patternTime` no avanza durante el cambio.
  - **Transición (`morph`):** dura `MORPH_TIME = 0.8` s. Cada invasor interpola su desplazamiento entre la figura de origen y la de destino con `smoothstep(t / 0.8)`. Durante la transición:
    - la formación sigue bajando y oscilando;
    - los invasores no disparan;
    - cada baja vale el doble.
  - **Movimiento horizontal:** la formación oscila en horizontal a `horizontalSpeed(wave, alive) = (40 + 2 × (45 − alive)) × min(1.9; 1 + 0.1 × (wave − 1))` px/s.
    - Cambia de sentido cuando la caja de los invasores **vivos** toca el margen izquierdo (x = 12) o el derecho (x = 468).
    - Si un cambio de figura saca la caja de los márgenes, el ancla se recoloca dentro.
  - **Descenso continuo** (no a saltos): `descentSpeed(wave) = min(20; 6 × 1,12^(wave − 1))` px/s. La formación baja un 12 % más rápido en cada oleada, con un tope de 20 px/s desde la oleada 12.
  - **Disparo del jugador** (decisión del usuario): Espacio dispara una bala por pulsación.
    - Hasta 2 balas en pantalla (`MAX_PLAYER_BULLETS = 2`) y 0,25 s de espera entre disparos (`FIRE_COOLDOWN`).
    - La bala mide 4×12 px y sube a 520 px/s desde el borde superior del cañón.
    - Una pulsación con 2 balas en pantalla o en espera se descarta.
    - No se dispara en `waveclear`.
  - **Acierto:** una bala que solapa (AABB) con un invasor vivo lo destruye y desaparece. Se aplican, en este orden:
    - `combo += 1` y `shotsHit += 1`;
    - multiplicador `multiplier(combo) = min(4; 1 + floor(combo / 5))`, es decir, ×1 con combo 1–4, ×2 con 5–9, ×3 con 10–14 y ×4 desde 15;
    - suma `base × multiplier × (morph ? 2 : 1)`.
  - **Fallo:** una bala que sale por arriba (y + 12 < 0) sin acertar pone `combo` y `shieldStreak` a 0. Los invasores por encima de y = 0 (fuera de pantalla tras un cambio a ANILLO) no se pueden alcanzar.
  - **Escudo de fase** (decisión del usuario):
    - Empieza con 1 carga (`START_SHIELD`) y llega a 3 como máximo (`MAX_SHIELD`).
    - Cada acierto suma 1 a `shieldStreak`. Al llegar a 8 (`SHIELD_STREAK`) se gana 1 carga si hay menos de 3, y `shieldStreak` vuelve a 0 en ambos casos.
    - Un impacto enemigo con cargas resta 1 carga, elimina la bala y da 0,5 s de gracia (`SHIELD_GRACE`). No quita vida ni rompe el combo.
  - **Disparo enemigo:**
    - Un temporizador dispara cada `fireInterval(wave) = max(0,4; 1,2 / (1 + 0,15 × (wave − 1)))` s, siempre que no haya transición y haya menos de 3 balas enemigas (`MAX_ENEMY_BULLETS = 3`).
    - Dispara un invasor vivo y visible (y ≥ 0) elegido al azar con `s.rng` entre los **expuestos**: los que no tienen otro invasor vivo debajo con el centro a menos de 28 px en horizontal.
    - La bala mide 4×10 px y cae en vertical a 180 px/s.
    - **Desde la oleada 3,** con probabilidad 1/3 (si queda algún Vigía vivo y visible) dispara un Vigía al azar con una bala **apuntada** al centro del cañón. La velocidad es de 180 px/s y la componente horizontal se limita a |vx| ≤ 108 px/s, con `vy = √(180² − vx²)`.
  - **Impacto sin escudo:**
    - Si hay invulnerabilidad activa, la bala desaparece sin efecto.
    - Si no, se pierde 1 vida, `combo` y `shieldStreak` pasan a 0 y hay 1,5 s de invulnerabilidad (`HIT_INVUL`), con el cañón parpadeando.
    - Sin vidas → `gameover`.
  - **Vidas:** 3 (`START_LIVES`), sin vidas extra.
  - **Superficie:** si algún invasor vivo tiene el borde inferior en y ≥ 576, la partida termina al instante (`gameover`), tenga las vidas que tenga.
  - **Fin de oleada:** al caer el último invasor:
    - suma `500 × wave` (`WAVE_BONUS`);
    - borra todas las balas;
    - pasa a `waveclear` durante 1,5 s (`WAVE_PAUSE`). En ese tiempo el cañón se mueve pero no dispara y el canvas muestra "OLEADA NN" con la oleada siguiente.
    - Después empieza la oleada `wave + 1`, de nuevo en BLOQUE, con los umbrales reiniciados, `patternTime` a 0 y `fireTimer = fireInterval(wave)`.
  - **Contadores** para el HUD y el modal: `wave`, `lives`, `shotsFired`, `shotsHit`, `maxCombo`. La precisión es `accuracy(s) = shotsFired === 0 ? 0 : round(100 × shotsHit / shotsFired)`.
  - Puntuación entera, acotada a `MAX_SCORE` (99 999 999).
  - `dt` limitado a 50 ms (`MAX_DT = 0.05`).
  - `s.time` (segundos de partida) para las animaciones. `core.ts` no usa `performance`.
- Dibujo en `games/invasores/render.ts`, neón vectorial con glow solo en lo principal:
  - Fondo oscuro con unas 40 estrellas fijas tenues (`--ink-faint`), generadas en `createState` con `s.rng`.
  - Superficie: línea verde (`--green`) discontinua en y = 576.
  - Cañón: trapecio verde con glow; parpadea a 10 Hz durante la invulnerabilidad.
  - Escudo de fase: hexágono cyan (`--cyan`) alrededor del cañón, dividido en 3 segmentos. Se iluminan tantos como cargas; destella en blanco 0,2 s al absorber un impacto.
  - Invasores:
    - Vigía: rombo magenta (`--magenta`).
    - Soldado: triángulo invertido cyan.
    - Larva: hexágono verde.
    - Todos laten ligeramente con `s.time`.
  - Durante la transición, los invasores llevan un contorno amarillo (`--yellow`) que avisa de que valen el doble.
  - Balas del jugador amarillas; balas enemigas magenta; las apuntadas, con una estela corta.
  - Multiplicador activo ("×2", "×3", "×4") en pequeño junto al cañón, solo si es mayor que 1.
  - "OLEADA NN" centrado en `waveclear`, con la fuente pixel.
  - El canvas no dibuja puntuación, vidas ni oleada: van en el HUD.
- Client Component `games/invasores/invasores-game.tsx`:
  - HUD de la plataforma: Jugador, Puntuación, Vidas (`♥` repetido) y Oleada (dos dígitos, `pad2`), y botones PAUSA / FIN / SALIR.
  - Marco CRT con `<canvas>` de 480×640, escalado por CSS en proporción 3:4.
  - Lista de controles visible bajo el canvas.
  - Bucle `requestAnimationFrame` con el estado del juego en refs.
  - Teclado:
    - ← → o A D mueven (teclas mantenidas).
    - Espacio dispara (flag de una vez por pulsación, ignorando `ev.repeat`).
    - P / Esc pausa.
    - `preventDefault` en las flechas y en Espacio.
- Pantalla de inicio "¿JUGAMOS?" con JUGAR (también Enter).
- Menú de pausa (P / Esc o PAUSA): Reanudar, Reiniciar y Ver controles / Volver.
  - Con el menú abierto el juego no recibe teclas, y las que sigan pulsadas al reanudar se ignoran hasta soltarlas.
  - Perder el foco con partida en curso abre la pausa.
- Fin de partida con `GameOverModal` (`ranked`) y `onRestart` que empieza una partida nueva. Se llega al perder la última vida, cuando la formación toca la superficie o con el botón FIN. `extra`:
  - Oleada: la alcanzada, con dos dígitos.
  - Precisión: `accuracy(s)` con `%`.
  - Combo máx.: `maxCombo`.
- Guardado en Supabase por la vía existente (`submitScore` → `submit_score`). El ranking aparece en `/juegos/invasores` y `/salon?juego=invasores`.
- Estilos en `games/invasores/invasores.css`, con todas las reglas bajo `.invasores-root`.
- Ajustar el texto `long` de `invasores` en `lib/games.ts` para que describa las reglas nuevas. Propuesta: "Formaciones de neón descienden oleada tras oleada y cambian de figura en pleno ataque: bloque, cuña, anillo y columnas. Encadena aciertos para multiplicar tus puntos y recargar el escudo de fase, y derríbalas antes de que toquen la superficie."

**Fuera de alcance (para futuros specs):**

- Búnkeres o barreras en el suelo, nave nodriza y potenciadores.
- Más figuras que las cuatro del ciclo, o figuras aleatorias.
- Controles táctiles o gestos en móvil.
- Sonido y música.
- Preferencias en `localStorage` (skins, dificultad inicial).
- Guardar en Supabase la oleada, la precisión o el combo máximo.
- Cambios en la ficha `/juegos/invasores` aparte del texto `long`.
- Otros juegos del catálogo (COLMENA y ASEDIO tienen sus propios specs en esta jam).
- Tests automatizados (no hay test runner configurado).

---

## Modelo de datos

```text
games/
  index.ts               # + invasores: InvasoresGame
  invasores/
    core.ts              # lógica pura, sin DOM, React ni localStorage
    render.ts            # dibujo en canvas a partir de InvasoresState
    invasores-game.tsx   # "use client": canvas, bucle, entrada, HUD, inicio, pausa, fin
    invasores.css        # estilos del área del juego, bajo .invasores-root
```

```ts
// games/invasores/core.ts
export const W = 480;
export const H = 640;
export const MAX_DT = 0.05;
export const GROUND_Y = 576;

export const CANNON_W = 36;
export const CANNON_H = 16;
export const CANNON_Y = 600; // centro
export const CANNON_SPEED = 300; // px/s
export const CANNON_MIN_X = 18;
export const CANNON_MAX_X = 462;

export const ROWS = 5;
export const COLS = 9;
export const INVADER_W = 28;
export const INVADER_H = 20;
export const START_ANCHOR = { x: 240, y: 220 } as const; // y = línea inferior
export const MARGIN = 12; // px a cada lado

export const POINTS = { vigia: 30, soldado: 20, larva: 10 } as const;
export const MORPH_TIME = 0.8; // s
export const MORPH_MULT = 2;
export const PATTERN_TIME = 12; // s
export const KILL_THRESHOLDS = [15, 30] as const; // bajas por oleada

export const PLAYER_BULLET_SPEED = 520; // px/s
export const PLAYER_BULLET_W = 4;
export const PLAYER_BULLET_H = 12;
export const MAX_PLAYER_BULLETS = 2;
export const FIRE_COOLDOWN = 0.25; // s

export const ENEMY_BULLET_SPEED = 180; // px/s
export const ENEMY_BULLET_W = 4;
export const ENEMY_BULLET_H = 10;
export const MAX_ENEMY_BULLETS = 3;
export const AIMED_FROM_WAVE = 3;
export const AIMED_CHANCE = 1 / 3;
export const AIMED_MAX_VX = 108; // px/s
export const EXPOSED_DX = 28; // px

export const START_LIVES = 3;
export const HIT_INVUL = 1.5; // s
export const START_SHIELD = 1;
export const MAX_SHIELD = 3;
export const SHIELD_STREAK = 8; // aciertos seguidos por carga
export const SHIELD_GRACE = 0.5; // s
export const MAX_MULT = 4;
export const COMBO_STEP = 5;

export const WAVE_BONUS = 500; // × oleada
export const WAVE_PAUSE = 1.5; // s
export const STAR_COUNT = 40;

export const PATTERNS = ["bloque", "cuna", "anillo", "columnas"] as const;
export type Pattern = (typeof PATTERNS)[number];
export type Kind = "vigia" | "soldado" | "larva";
export type EngineState = "playing" | "waveclear" | "gameover";

export type Invader = { row: number; col: number; kind: Kind; alive: boolean };
export type Bullet = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  aimed: boolean;
};
export type Vec = { x: number; y: number };

export type InvasoresState = {
  cannonX: number;
  invul: number; // s restantes de invulnerabilidad o gracia
  shield: number; // cargas 0..MAX_SHIELD
  shieldStreak: number;
  shieldFlash: number; // s restantes del destello
  combo: number;
  maxCombo: number;
  cooldown: number; // s hasta poder disparar
  playerBullets: Bullet[];
  enemyBullets: Bullet[];
  invaders: Invader[]; // 45, fila a fila
  anchor: Vec;
  dirX: 1 | -1;
  pattern: Pattern; // figura actual (destino si hay transición)
  morph: { from: Pattern; t: number } | null;
  patternTime: number;
  thresholdsHit: number; // 0..2 en la oleada
  pendingMorph: boolean;
  fireTimer: number;
  wave: number;
  killedWave: number;
  waveTimer: number; // s restantes de waveclear
  lives: number;
  score: number;
  shotsFired: number;
  shotsHit: number;
  stars: Vec[];
  time: number; // s de partida
  state: EngineState;
  rng: () => number; // inyectable; la UI pasa Math.random
};

export type InvasoresInput = {
  left: boolean; // mantenida
  right: boolean; // mantenida
  fire: boolean; // una vez por pulsación
};

export function patternOffset(p: Pattern, row: number, col: number): Vec; // ya normalizado al ancla
export function invaderCenter(s: InvasoresState, inv: Invader): Vec; // aplica la transición
export function multiplier(combo: number): number;
export function horizontalSpeed(wave: number, alive: number): number;
export function descentSpeed(wave: number): number;
export function fireInterval(wave: number): number;
export function accuracy(s: InvasoresState): number; // 0..100 entero
export function createState(rng: () => number): InvasoresState;
export function step(
  s: InvasoresState,
  dt: number,
  input: InvasoresInput,
): void; // muta s
```

```ts
// games/invasores/render.ts
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  s: InvasoresState,
): void; // usa s.time
```

```ts
// games/invasores/invasores-game.tsx — estado visible en React; el del bucle en refs
type Phase = "start" | "playing" | "paused" | "over";
type PauseView = "main" | "controls";
type RunStats = {
  score: number;
  lives: number;
  wave: number;
  accuracy: number;
  maxCombo: number;
};
```

Convenciones (las de SPEC 05/06, detalladas en `.claude/skills/nuevo-juego/integracion.md`):

- `core.ts` no importa React ni usa `window`, `document`, `performance`, `localStorage` ni `Math.random`.
- Coordenadas con origen arriba a la izquierda; velocidades en px/s; tiempos en segundos.
- `EngineState` es del motor; `Phase` es de la UI. `playing` y `waveclear` del motor van dentro de la fase `playing`; `gameover` lleva la UI a `over`.
- La partida en curso no se persiste. Este juego no crea claves `av_invasores_*`.
- `setState` solo cuando cambian los datos del HUD o la fase.

---

## Plan de implementación

Seguir `.claude/skills/nuevo-juego/integracion.md` y partir de `.claude/skills/nuevo-juego/scaffold/`. Usar `/frontend-design` para la UI, con `games/rocas/` como referencia de integración (canvas, disparo y balas).

1. **Catálogo.** Ajustar el texto `long` de `invasores` en `lib/games.ts`. No hay entrada ni portada nuevas. Verificar: `/juegos/invasores` muestra el texto nuevo y la portada `cover-invaders`.
2. **Lógica pura.** Crear `games/invasores/core.ts` desde `scaffold/core.ts.tpl` con los tipos, constantes y reglas del modelo de datos: figuras, transición, descenso, disparos, combo, escudo y oleadas. Verificar: `npm run build` pasa.
3. **Dibujo.** Crear `games/invasores/render.ts` con `drawFrame`. Verificar: `npm run build` pasa.
4. **Componente jugable.** Crear `games/invasores/invasores-game.tsx` desde `scaffold/game.tsx.tpl`, con HUD, CRT, canvas, bucle y teclado. Registrar `invasores: InvasoresGame` en `games/index.ts`. Verificar: `/juegos/invasores/jugar` arranca una partida jugable con teclado.
5. **Inicio, pausa y fin.** Overlay "¿JUGAMOS?", menú de pausa, pausa por foco y `GameOverModal` con `ranked` y `extra`. Verificar: todos los botones del menú y del modal funcionan.
6. **Estilos.** Crear `games/invasores/invasores.css` desde `scaffold/game.css.tpl`. Revisar a 1440 px y 390 px. Verificar: el canvas cabe sin scroll horizontal.
7. **Ranking y cierre.** Guardar una partida de prueba, comprobarla con `execute_sql` y en la ficha y el Salón, y borrar las filas de prueba tras confirmarlo con el usuario. Verificar: `npm run lint` y `npm run build` pasan.

---

## Criterios de aceptación

- [ ] `npm run lint` termina sin errores.
- [ ] `npm run build` termina sin errores y `/juegos/[id]/jugar` mantiene el mismo tipo de ruta.
- [ ] Existen `games/invasores/{core.ts,render.ts,invasores-game.tsx,invasores.css}` y `games/index.ts` tiene la entrada `invasores`.
- [ ] `games/invasores/core.ts` no importa `react` ni usa `window`, `document`, `performance`, `localStorage` ni `Math.random`.
- [ ] `/juegos/invasores/jugar` muestra "¿JUGAMOS?"; JUGAR o Enter empiezan la partida.
- [ ] El canvas tiene `width=480` y `height=640` y mantiene la proporción 3:4 a 1440 px y 390 px sin scroll horizontal.
- [ ] Al empezar hay 45 invasores en BLOQUE (Vigías magenta arriba, Soldados cyan, Larvas verdes abajo), el cañón en el centro con 1 segmento de escudo encendido, 3 vidas y la oleada 01.
- [ ] ← → y A D mueven el cañón, que no sale de los márgenes.
- [ ] Mantener Espacio dispara una sola bala. Nunca hay más de 2 balas del jugador en pantalla y dos disparos seguidos están separados al menos 0,25 s.
- [ ] Abatir un Vigía, un Soldado o una Larva suma 30, 20 o 10 × multiplicador; con 5 aciertos seguidos el multiplicador pasa a ×2 y se ve junto al cañón.
- [ ] Una bala que sale por arriba sin acertar devuelve el multiplicador a ×1.
- [ ] La formación cambia de figura a los 12 s o al caer el invasor 15 y el 30, lo que ocurra antes, en el orden BLOQUE → CUÑA → ANILLO → COLUMNAS. La transición dura 0,8 s, con contorno amarillo.
- [ ] Durante la transición no cae ninguna bala enemiga nueva y cada baja suma el doble.
- [ ] Un cambio de figura nunca acerca a la superficie el borde inferior de la formación.
- [ ] La formación baja de forma continua y oscila entre los márgenes; en la oleada 2 baja más rápido que en la 1.
- [ ] Desde la oleada 3, algunas balas de los Vigías van apuntadas hacia el cañón.
- [ ] 8 aciertos seguidos encienden un segmento más del escudo, hasta 3. Con escudo, un impacto apaga un segmento sin quitar vida.
- [ ] Sin escudo, un impacto quita una vida y el cañón parpadea 1,5 s, tiempo en el que es invulnerable.
- [ ] Al limpiar una oleada se suman `500 × oleada`, aparece "OLEADA NN" y la siguiente empieza en BLOQUE arriba.
- [ ] Perder la última vida o que un invasor toque la superficie termina la partida.
- [ ] Pulsar las teclas del juego no hace scroll de la página.
- [ ] El HUD muestra Jugador, Puntuación, Vidas y Oleada; el canvas no los duplica.
- [ ] P, Esc y el botón PAUSA abren el menú de pausa y el juego se congela, incluidos la formación, las balas y el reloj de figura.
- [ ] Con el menú abierto las teclas no afectan al juego; al reanudar con una tecla pulsada, no actúa hasta soltarla.
- [ ] "Ver controles" muestra la lista y "Volver" regresa al menú.
- [ ] "Reiniciar" empieza una partida nueva con puntuación 0.
- [ ] Cambiar a otra pestaña durante la partida la deja en pausa.
- [ ] El fin de partida abre "FIN DEL JUEGO" con la puntuación final, Oleada, Precisión (%) y Combo máx.
- [ ] El botón FIN termina la partida y abre el mismo modal con la puntuación actual.
- [ ] "GUARDAR PUNTUACIÓN" muestra "GUARDANDO…" y después "PUESTO #N" con el top 10 y la fila del jugador resaltada.
- [ ] La fila guardada está en `public.scores` con `game_id = 'invasores'` y aparece en `/juegos/invasores` y `/salon?juego=invasores` tras recargar.
- [ ] "JUGAR DE NUEVO" empieza una partida nueva con puntuación 0.
- [ ] El juego no escribe claves `av_invasores_*`.
- [ ] Salir con SALIR durante una partida y volver la deja en pausa, sin bucles ni listeners duplicados.
- [ ] `/juegos/caida/jugar`, `/juegos/rocas/jugar`, `/juegos/bloque-buster/jugar` y `/juegos/serpentina/jugar` siguen igual, y un juego simulado sigue mostrando "MODO DEMO".
- [ ] La consola no muestra errores ni avisos de hidratación en `/juegos/invasores/jugar`.
- [ ] Ningún nombre de un juego comercial aparece en los textos visibles.

---

## Decisiones

- **Sí:** el juego ocupa la entrada existente `invasores` del catálogo. Reutiliza el nombre, la portada (`cover-invaders`), el color y la ficha; solo cambia el texto `long`.
- **Sí:** diseño original del género, implementado en TypeScript + React con `<canvas>`, con `core.ts` puro separado de `render.ts`. No hay referencia con lógica.
- **No:** iframe ni JS vanilla montado vía refs.
- **Sí:** `rng` inyectable en el estado. Partidas reproducibles para depurar.
- **Sí:** cambio de figura cada 12 s o al caer 1/3 y 2/3 de la formación, lo que llegue antes; durante los 0,8 s del cambio no disparan y valen el doble. Decisión del usuario.
- **Sí:** escudo de fase con 1 carga inicial, máximo 3, +1 carga cada 8 aciertos seguidos y una carga por impacto. Decisión del usuario.
- **Sí:** hasta 2 balas a la vez y 0,25 s entre disparos. Decisión del usuario; equilibra el ritmo con el castigo del combo al fallar.
- **Sí:** el ancla de la formación es su línea inferior. Así un cambio de figura nunca la acerca a la superficie y no hay muertes injustas por cambiar a ANILLO, que es más alta.
- **Sí:** descenso continuo con oscilación horizontal, sin el paso a saltos clásico. Lo hace distinto del clásico del género y permite que la velocidad crezca un 12 % por oleada de forma limpia.
- **Sí:** los invasores fuera de pantalla (y < 0) no disparan ni se pueden alcanzar. Pasa tras un cambio a ANILLO y es coherente con lo que se ve.
- **Sí:** solo disparan los invasores expuestos. Las balas enemigas no atraviesan visualmente a sus compañeros.
- **Sí:** formas geométricas en vez de criaturas pixeladas, y sin búnkeres ni nave nodriza. Evita recrear el aspecto de un juego comercial concreto.
- **Sí:** el impacto absorbido por el escudo no rompe el combo; perder vida sí. El escudo premia la habilidad sin castigar dos veces.
- **Sí:** HUD con Vidas y Oleada; modal con `extra` = Oleada, Precisión y Combo máx. Los datos que mejor miden la habilidad en este diseño.
- **Sí:** modal de la plataforma con `ranked`; guarda con `submitScore`, la única vía de escritura.
- **No:** migración de Supabase. `scores` es común a todos los juegos; los datos de `extra` no se guardan.
- **No:** récords locales del juego. Duplicaría el ranking.
- **Sí:** campo lógico fijo 480×640 escalado por CSS. La dificultad no depende de la pantalla.
- **No:** controles táctiles. Van en otro spec.

---

## Riesgos

| Riesgo                                                               | Mitigación                                                                                                              |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Bucles o listeners duplicados al navegar (`<Activity>`, Strict Mode) | Estado del bucle en refs; toda limpieza cancela el frame y quita listeners; criterio de salir y volver.                 |
| Salto de `dt` al reanudar o volver a la ruta                         | Reiniciar el último timestamp al arrancar el bucle; `dt` limitado a 50 ms.                                              |
| Espacio activa el botón enfocado                                     | `preventDefault` en las teclas del juego y `blur()` de los botones tras el clic.                                        |
| Puntuación no entera o fuera de rango y el guardado falla            | Puntos enteros en `core.ts`; `validateScore` y la RPC rechazan el resto.                                                |
| El canvas no cabe en pantallas bajas o estrechas                     | Escalado CSS con resolución fija; revisar a 1440 px y 390 px.                                                           |
| El CSS del juego afecta a otras páginas                              | Todas las reglas bajo `.invasores-root`.                                                                                |
| Invasores que se solapan durante la transición o en ANILLO           | Radios 104/156 con cuerdas mayores de 34 px entre vecinos; la transición es breve (0,8 s) y solo visual.                |
| El escudo hace la partida infinita para jugadores muy precisos       | Máximo 3 cargas, ninguna recarga al fallar, y descenso y cadencia que crecen por oleada hasta topes de 20 px/s y 0,4 s. |
| Recalcular la caja de la formación cada frame con 45 invasores       | Es un recorrido de 45 elementos por frame, despreciable; no se cachea.                                                  |
| La formación se parece demasiado a la de un clásico del género       | Figuras cambiantes, formas geométricas, sin búnkeres ni nave nodriza, y descenso continuo.                              |

---

## Lo que **no** está en este spec

- Búnkeres, nave nodriza y potenciadores.
- Figuras extra o aleatorias.
- Controles táctiles.
- Sonido.
- Preferencias en `localStorage`.
- Datos extra de la partida en Supabase.
- Tests automatizados.

Cada uno de esos, si llega, va en su propio spec.
