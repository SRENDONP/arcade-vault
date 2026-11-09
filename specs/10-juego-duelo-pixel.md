# SPEC 10 — Juego real: DUELO PIXEL (diseño original del género de paletas)

> **Estado:** Implementado
> **Depende de:** SPEC 05, SPEC 06, SPEC 07
> **Fecha:** 2026-11-08
> **Objetivo:** Hacer jugable `/juegos/duelo-pixel/jugar` con un juego original del género de paletas (un jugador contra una escalera de rivales CPU), alojado en `games/duelo-pixel/`, con el HUD, la pausa y el modal de fin de partida de la plataforma, sus tres skins y su puntuación en el ranking de Supabase.

---

## Por qué existe este spec

La entrada `duelo-pixel` de `lib/games.ts` (`VERSUS`, portada `cover-duelo`, color `cyan`) usa hoy el simulador `components/game-player.tsx`.
`references/` no tiene material de paletas, así que las reglas se diseñan en este spec. Del género se toman solo las convenciones (dos paletas verticales, una pelota que rebota y un punto cuando la pelota cruza un fondo). Las reglas propias son la escalera de cinco rivales con nombre y estilo, los sets eliminatorios a 5, el golpe de plasma con medidor, el multiplicador de racha y los circuitos infinitos. Lo eligió el agente `game-planner` (2026-11-06, recomendado ⭐; elegido el 2026-11-08).
SPEC 05 y 06 fijaron la convención `games/<id>/` y el registro `games/index.ts`; SPEC 07 conectó el modal a Supabase. Al registrar `duelo-pixel` en `PLAYABLE`, el juego entra en el ranking sin migraciones.
El nombre visible es "DUELO PIXEL"; ningún texto visible nombra juegos de marca del género.

---

## Alcance

**Dentro:**

- Carpeta `games/duelo-pixel/` y entrada `"duelo-pixel": DueloPixelGame` en `PLAYABLE` de `games/index.ts`.
- Lógica pura en `games/duelo-pixel/core.ts`, con reglas originales:
  - **Campo lógico** de 800×500 px, horizontal. Los bordes superior (`y = 0`) e inferior (`y = H`) son paredes de rebote; los fondos izquierdo y derecho son las porterías.
  - **Paletas** de 12×80 px. La del jugador tiene su cara frontal en `x = 44` (borde izquierdo en `x = 32`) y la de la CPU en `x = 756` (borde izquierdo en `x = 756`, cara frontal hacia la izquierda). Empiezan centradas en vertical y se limitan a `0 ≤ y ≤ H − alto`.
  - **Jugador:** ↑/↓ o W/S mueven la paleta a velocidad constante de 480 px/s, sin inercia.
  - **Pelota** cuadrada de 10×10 px (caja de colisión). Rebota en las paredes invirtiendo `vy`.
  - **Rebote en paleta:** solo cuenta si la pelota va hacia esa paleta (evita dobles golpes). El ángulo de salida depende del punto de impacto: `offset = (centro pelota − centro paleta) / (alto paleta / 2)`, limitado a [−1, 1]; `ángulo = offset × 50°` respecto a la horizontal. Si `|ángulo| < 6°`, se usa 6° con el signo de `vy` (o hacia abajo si `vy = 0`), para que no haya peloteos perfectamente horizontales. La pelota sale hacia el rival.
  - **Aceleración por devolución:** cada golpe en una paleta multiplica la velocidad por 1,04, hasta 1,6 veces la velocidad base del saque, y nunca más de 900 px/s.
  - **Sin túneles:** el movimiento de la pelota se integra en subpasos de como máximo 5 px (media pelota), comprobando paredes y paletas en cada uno.
  - **Punto:** la pelota que sale por `x < 0` es punto de la CPU; por `x > W`, del jugador.
  - **Saque:** tras cada punto el motor pasa a `serve` durante 0,8 s con la pelota quieta en el centro. Después sale hacia quien **ganó** el punto (saca quien lo encajó, desde su lado). Ángulo al azar (`s.rng`) entre −20° y 20°. El primer saque de cada set va hacia la CPU. La velocidad vuelve a la base del rival.
  - **Sets a 5 puntos**, sin diferencia mínima. Si la CPU llega a 5, la partida termina (`gameover`). Si el jugador llega a 5, gana el set y pasa al siguiente rival.
  - **Escalera de rivales** (constantes en `RIVALS`):

    | #   | Rival  | Velocidad CPU | Reacción | Error de predicción | Alto de paleta | Velocidad base pelota | Estilo                                                                      |
    | --- | ------ | ------------- | -------- | ------------------- | -------------- | --------------------- | --------------------------------------------------------------------------- |
    | 1   | CHISPA | 260 px/s      | 0,30 s   | ±60 px              | 80 px          | 320 px/s              | devuelve con el centro de la paleta                                         |
    | 2   | ECO    | 300 px/s      | 0,22 s   | ±53 px              | 80 px          | 350 px/s              | ángulos planos: apunta al centro y sus devoluciones salen a 15° como máximo |
    | 3   | PRISMA | 340 px/s      | 0,18 s   | ±18 px              | 80 px          | 380 px/s              | busca las esquinas (`offset` ±0,75, hacia el lado lejos del jugador)        |
    | 4   | VOLTIO | 380 px/s      | 0,14 s   | ±17 px              | 80 px          | 410 px/s              | como PRISMA y lanza plasma cada 6 devoluciones suyas                        |
    | 5   | NÉBULA | 460 px/s      | 0,10 s   | ±14 px              | 60 px          | 440 px/s              | como PRISMA y lanza plasma cada 5 devoluciones suyas                        |

    Los errores se ajustaron con simulaciones del motor (ver Decisiones): con la pelota a velocidad de saque, la CPU falla en torno al 29 % de las devoluciones (CHISPA), 24 % (ECO), 14 % (PRISMA) y 10 % (VOLTIO y NÉBULA). Buscar las esquinas deja solo 15 px de margen en la paleta, por eso esos rivales necesitan un error menor.

  - **IA de la CPU** (determinista, todo con `s.rng`):
    - Cuando la pelota va hacia ella, espera el tiempo de reacción y entonces calcula dónde cruzará su cara frontal (simulando los rebotes en paredes). Le suma un error al azar dentro de su rango, una vez por aproximación, y desplaza el punto de impacto según su estilo. El rango del error se multiplica por `velocidad actual / velocidad base` (mínimo 1), así que los peloteos largos y los plasmas hacen fallar más a la CPU y ningún peloteo es infinito.
    - Se mueve hacia ese objetivo a su velocidad máxima, con una zona muerta de 4 px para no temblar.
    - Cuando la pelota se aleja, vuelve hacia el centro a la mitad de su velocidad.
  - **Circuitos:** al vencer a NÉBULA empieza el circuito siguiente desde CHISPA. En el circuito `c`, la velocidad de la CPU se multiplica por `1 + 0,08 × (c − 1)` (máx. 700 px/s), la velocidad base de la pelota por `1 + 0,06 × (c − 1)` y la reacción por `max(0,5; 1 − 0,1 × (c − 1))`. El error no cambia. No hay final: la partida solo termina al perder un set o con FIN.
  - **Golpe de plasma del jugador:**
    - Cada devolución del jugador suma 1 al medidor. Con 6 (`PLASMA_CHARGE`), queda **cargado**.
    - Con el medidor cargado, Espacio lo **arma** durante 0,35 s (`PLASMA_WINDOW`; una vez por pulsación, ignorando `ev.repeat`). Sin carga, Espacio no hace nada.
    - Si la pelota toca la paleta del jugador con el plasma armado, sale como **plasma**: velocidad × 1,8 sobre la actual (máx. 900 px/s) y una curva vertical de 300 px/s² en el sentido de su `vy`. El medidor se vacía.
    - Si la ventana se agota sin golpe, el medidor se vacía. Perder un punto también lo vacía.
    - El plasma termina cuando la CPU lo devuelve (la pelota vuelve a la velocidad que tenía antes del plasma) o con el punto.
  - **Plasma de la CPU** (VOLTIO y NÉBULA): cuando su contador llega al umbral, su siguiente devolución sale como plasma con las mismas reglas (× 1,8, curva) y el contador vuelve a 0.
  - **Racha multiplicadora:** el multiplicador empieza en x1. Cada punto ganado lo sube 1 (máx. x5) después de puntuar. Encajar un punto lo devuelve a x1. Se mantiene entre sets y circuitos.
  - **Puntuación** (entera, acotada con `Math.min(score, MAX_SCORE)`):

    | Evento                                                                           | Puntos                               |
    | -------------------------------------------------------------------------------- | ------------------------------------ |
    | Devolución del jugador (solo las 20 primeras de cada peloteo, `RALLY_SCORE_CAP`) | 10 × multiplicador                   |
    | Punto ganado                                                                     | 100 × multiplicador                  |
    | Punto ganado con un plasma del jugador                                           | +250                                 |
    | Set ganado                                                                       | 1 000 × nº de rival × nº de circuito |
    | Set ganado 5-0                                                                   | +2 000                               |

  - **Aviso entre sets:** al ganar un set el motor pasa a `setWon` durante 1,6 s. El canvas muestra "RIVAL SUPERADO" y debajo el siguiente rival ("RIVAL 02 · ECO", o "CIRCUITO 02" al empezar un circuito nuevo). Después hay saque. Antes del primer saque de la partida el canvas muestra "RIVAL 01 · CHISPA" durante la espera de `serve`.
  - Contadores para el HUD y el modal: `rival` (1–5), `circuit`, `playerPoints`, `cpuPoints`, `mult`, `streak`, `bestStreak` (puntos ganados seguidos), `plasma` (0–6) y `plasmaArmed`.
  - `dt` limitado a 50 ms (`MAX_DT = 0.05`). `s.time` (segundos de partida) para las animaciones; `core.ts` no usa `performance`.
- Dibujo en `games/duelo-pixel/render.ts`, a partir del estado y del skin:
  - Fondo oscuro. En el centro, una **barrera de energía**: una línea vertical fina con pulsos que la recorren de arriba abajo en función de `s.time`. Es decorativa y tenue.
  - Paleta del jugador en el color principal del skin y paleta de la CPU en el color rival.
  - Pelota en el color de pelota. Con plasma, color de plasma y una estela corta de 4 posiciones anteriores.
  - Medidor de plasma del jugador: 6 segmentos en la parte inferior izquierda del canvas, que se encienden con cada devolución. Al estar cargado parpadea, y al estar armado se ilumina entero.
  - Textos del aviso entre sets y del rival inicial en el centro, con la fuente pixel.
  - El canvas no dibuja puntuación, set, rival ni racha: van en el HUD. No hay marcadores gigantes en el campo.
- Client Component `games/duelo-pixel/duelo-pixel-game.tsx`:
  - HUD de la plataforma: Jugador, Puntuación, Rival (`02/05`), Set (`3–2`, jugador primero), Racha (`x3`) y botones PAUSA / FIN / SALIR.
  - Marco CRT con `<canvas>` de 800×500, escalado por CSS en proporción 8:5. `.crt-bottom` muestra como dato `CIRCUITO 01 · ECO`.
  - Lista de controles visible bajo el canvas: ↑ ↓ / W S mover, Espacio golpe de plasma, P / Esc pausa.
  - Bucle `requestAnimationFrame` con el estado del juego en refs.
  - Teclado: ↑/↓ o W/S mantenidas, Espacio de una vez por pulsación, P / Esc pausa. `preventDefault` en las flechas y en Espacio.
- Pantalla de inicio "¿JUGAMOS?" con JUGAR (también Enter).
- Menú de pausa (P / Esc o PAUSA): Reanudar, Reiniciar y Ver controles / Volver. Con el menú abierto el juego no recibe teclas, y las que sigan pulsadas al reanudar se ignoran hasta soltarlas. Perder el foco con partida en curso abre la pausa. Los temporizadores (saque, ventana de plasma, aviso entre sets) solo corren en `step`, así que se congelan.
- Fin de partida con `GameOverModal` (`ranked`) y `onRestart` que empieza una partida nueva. Se llega al perder un set o con FIN. `extra`:
  - Rival: el último alcanzado, `04 · VOLTIO`.
  - Circuito: dos dígitos, `01`.
  - Mejor racha: puntos ganados seguidos, `7`.
- Guardado en Supabase por la vía existente (`submitScore` → `submit_score`). El ranking aparece en `/juegos/duelo-pixel` y `/salon?juego=duelo-pixel`.
- Skins en `games/duelo-pixel/skins.ts` (§7 de `integracion.md`), con preferencia `av_duelo-pixel_skin` en `games/duelo-pixel/prefs.ts`, selector fuera de la pausa, `data-skin` en el root y contraste verificado en oscuro (≥ 3:1 elementos, ≥ 4,5:1 textos; la barrera central es decorativa, la pelota nunca):
  - **Clásico** (por defecto): paleta neón de la plataforma. Fondo `#0a0a0f`, jugador cyan, CPU magenta, pelota blanca, plasma amarillo, barrera cyan tenue.
  - **Neón**: fondo negro, colores saturados, contorno y `shadowBlur` en paletas, pelota y plasma (estela con glow).
  - **Retro**: paleta limitada de 8 bits, sin glow, bordes duros y sin antialiasing; la pelota se dibuja como un cuadrado pixelado y los pulsos de la barrera como bloques.
- Estilos en `games/duelo-pixel/duelo-pixel.css`, con todas las reglas bajo `.duelo-pixel-root`.
- Catálogo (`lib/games.ts`): reescribir `long`, porque ya no hay modo local a dos jugadores. Propuesta: "Tu paleta de luz contra una escalera de cinco rivales CPU. Gana sets a 5 para subir, encadena puntos para multiplicar y carga el golpe de plasma. Pierde un set y se acabó; vence a NÉBULA y el circuito vuelve a empezar, más rápido." Cambiar `best: 24` por `18500`, acorde con la escala nueva (es dato de muestra). `short`, `cat`, `cover` y `color` no cambian.

**Fuera de alcance (para futuros specs):**

- Modo local a dos jugadores (no puede puntuar en el ranking).
- Controles táctiles o gestos en móvil.
- Sonido y música.
- Segunda oportunidad o créditos al perder un set.
- Elegir rival o circuito inicial.
- Preferencias en `localStorage` distintas del skin; skins extra.
- Guardar en Supabase el rival, el circuito o la mejor racha.
- Otros juegos del catálogo.
- Tests automatizados (no hay test runner configurado).
- Cambiar cualquier carpeta de `references/` (es solo referencia).

---

## Modelo de datos

```text
games/
  index.ts                  # + "duelo-pixel": DueloPixelGame
  duelo-pixel/
    core.ts                 # lógica pura, sin DOM, React ni localStorage
    render.ts               # dibujo en canvas a partir de DueloPixelState y el skin
    duelo-pixel-game.tsx    # "use client": canvas, bucle, entrada, HUD, inicio, pausa, fin
    duelo-pixel.css         # estilos del área del juego, bajo .duelo-pixel-root
    skins.ts                # clasico / neon / retro
    prefs.ts                # av_duelo-pixel_skin
```

```ts
// games/duelo-pixel/core.ts
export const W = 800;
export const H = 500;
export const MAX_DT = 0.05;
export const PADDLE_W = 12;
export const PADDLE_H = 80; // NÉBULA usa su propio alto
export const PLAYER_X = 32; // borde izquierdo; cara frontal en 44
export const CPU_X = 756; // borde izquierdo = cara frontal
export const PLAYER_SPEED = 480; // px/s
export const BALL_SIZE = 10;
export const SUBSTEP = 5; // px máx. por subpaso
export const MAX_BOUNCE_ANGLE = (50 * Math.PI) / 180; // respecto a la horizontal
export const MIN_BOUNCE_ANGLE = (6 * Math.PI) / 180;
export const FLAT_MAX_ANGLE = (15 * Math.PI) / 180; // tope de ECO (estilo "flat")
export const SERVE_ANGLE = (20 * Math.PI) / 180;
export const RALLY_ACCEL = 1.04;
export const RALLY_MAX_MULT = 1.6; // × velocidad base del saque
export const BALL_ABS_MAX = 900; // px/s
export const SERVE_DELAY = 0.8; // s
export const SET_POINTS = 5;
export const SET_BANNER_TIME = 1.6; // s
export const PLASMA_CHARGE = 6; // devoluciones
export const PLASMA_WINDOW = 0.35; // s
export const PLASMA_SPEED_MULT = 1.8;
export const PLASMA_CURVE = 300; // px/s²
export const MAX_MULT = 5;
export const RALLY_SCORE_CAP = 20;
export const RETURN_POINTS = 10; // × multiplicador
export const POINT_POINTS = 100; // × multiplicador
export const PLASMA_POINT_BONUS = 250;
export const SET_POINTS_BASE = 1000; // × rival × circuito
export const PERFECT_SET_BONUS = 2000;
export const CPU_DEADZONE = 4; // px
export const CPU_SPEED_CAP = 700; // px/s
export const CPU_IDLE_FACTOR = 0.5; // velocidad al volver al centro
export const CORNER_OFFSET = 0.75; // punto de impacto buscado por "corners"
export const TRAIL_LENGTH = 4; // posiciones de la estela del plasma
export const MAX_SCORE = 99_999_999; // igual que lib/scores.ts

export type RivalStyle = "center" | "flat" | "corners";
export type Rival = {
  name: string; // "CHISPA", "ECO", "PRISMA", "VOLTIO", "NÉBULA"
  speed: number; // px/s
  reaction: number; // s
  error: number; // ±px
  paddleH: number; // px
  ballSpeed: number; // px/s
  style: RivalStyle;
  plasmaEvery: number | null; // devoluciones; null = no usa plasma
};
export const RIVALS: readonly Rival[];

export type EngineState = "serve" | "rally" | "setWon" | "gameover";

export type Paddle = { y: number; h: number };
export type Ball = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  plasma: "player" | "cpu" | null;
  preSpeed: number; // velocidad antes del plasma
  trail: { x: number; y: number }[]; // estela del plasma
};

export type DueloPixelState = {
  player: Paddle;
  cpu: Paddle & { target: number | null; reactLeft: number; returns: number };
  ball: Ball;
  baseSpeed: number; // velocidad base del rival y circuito actuales
  rally: number; // devoluciones del jugador en el peloteo
  rival: number; // 1..5
  circuit: number; // 1..
  playerPoints: number;
  cpuPoints: number;
  serveDir: 1 | -1; // 1 = hacia la CPU
  timer: number; // s restantes de serve / setWon
  plasma: number; // 0..PLASMA_CHARGE
  plasmaArmed: number; // s restantes de la ventana; 0 = no armado
  mult: number; // 1..MAX_MULT
  streak: number;
  bestStreak: number;
  time: number; // s de partida (animaciones)
  score: number;
  state: EngineState;
  rng: () => number; // inyectable; la UI pasa Math.random
};

export type DueloPixelInput = {
  up: boolean; // ↑ o W mantenida
  down: boolean; // ↓ o S mantenida
  plasma: boolean; // Espacio, una vez por pulsación
};

export function rivalStats(rival: number, circuit: number): Rival; // aplica el escalado del circuito
export function createState(rng: () => number): DueloPixelState;
export function step(
  s: DueloPixelState,
  dt: number,
  input: DueloPixelInput,
): void; // muta s
```

```ts
// games/duelo-pixel/render.ts
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  s: DueloPixelState,
  skin: Skin,
): void; // usa s.time
```

```ts
// games/duelo-pixel/duelo-pixel-game.tsx — estado visible en React; el del bucle en refs
type Phase = "start" | "playing" | "paused" | "over";
type PauseView = "main" | "controls";
type RunStats = {
  score: number;
  rival: number;
  circuit: number;
  playerPoints: number;
  cpuPoints: number;
  mult: number;
  bestStreak: number;
};
```

Convenciones (las de SPEC 05/06, detalladas en `.claude/skills/nuevo-juego/integracion.md`):

- `core.ts` no importa React ni usa `window`, `document`, `performance`, `localStorage` ni `Math.random`.
- Coordenadas con origen arriba a la izquierda; velocidades en px/s; tiempos en segundos.
- `EngineState` es del motor; `Phase` es de la UI. `serve`, `rally` y `setWon` van dentro de la fase `playing`; `gameover` lleva la UI a `over`.
- La partida en curso no se persiste. La única clave es `av_duelo-pixel_skin`.
- `setState` solo cuando cambian los datos del HUD o la fase.

---

## Plan de implementación

Seguir `.claude/skills/nuevo-juego/integracion.md` y partir de `.claude/skills/nuevo-juego/scaffold/`. Usar `/frontend-design` para la UI, con `games/rocas/` como referencia de integración, `games/bloque-buster/core.ts` como referencia de física de pelota y paleta, y `games/caida/` (o el resultado de `skin-designer` en `games/bloque-buster/`) como referencia de skins y preferencias.

1. **Catálogo.** Reescribir `long` y cambiar `best` de `duelo-pixel` en `lib/games.ts`. Verificar: `/juegos/duelo-pixel` muestra el texto nuevo.
2. **Lógica pura.** Crear `games/duelo-pixel/core.ts` desde `scaffold/core.ts.tpl` con las constantes, `RIVALS`, `rivalStats`, física con subpasos, IA, plasma, sets, circuitos y puntuación. Verificar: `npm run build` pasa y un script contra `core.ts` con `rng` fijo juega un set CPU contra CPU sin que la pelota atraviese paletas.
3. **Skins y dibujo.** Crear `skins.ts` y `prefs.ts`, y `render.ts` con `drawFrame(ctx, s, skin)`. Verificar: `npm run build` pasa.
4. **Componente jugable.** Crear `games/duelo-pixel/duelo-pixel-game.tsx` desde `scaffold/game.tsx.tpl`, con HUD, CRT, canvas, bucle, teclado y selector de skin. Registrar `"duelo-pixel": DueloPixelGame` en `games/index.ts`. Verificar: `/juegos/duelo-pixel/jugar` arranca una partida jugable con teclado.
5. **Inicio, pausa y fin.** Overlay "¿JUGAMOS?", menú de pausa, pausa por foco y `GameOverModal` con `ranked` y `extra`. Verificar: todos los botones del menú y del modal funcionan.
6. **Estilos.** Crear `games/duelo-pixel/duelo-pixel.css` desde `scaffold/game.css.tpl`, con CSS por `data-skin`. Revisar a 1440 px y 390 px. Verificar: el canvas cabe sin scroll horizontal y la pelota se distingue a 390 px.
7. **Ajuste de rivales.** Jugar contra cada rival (se puede forzar `rival` y `circuit` en `createState` durante la prueba, sin dejarlo en la UI). Verificar: CHISPA se gana con facilidad, NÉBULA exige plasma y ángulos, y ninguno es imbatible.
8. **Ranking y cierre.** Guardar una partida de prueba, comprobarla con `execute_sql` y en la ficha y el Salón, y borrar las filas de prueba tras confirmarlo. Verificar: `npm run lint` y `npm run build` pasan. Pedir a `skin-designer` una auditoría del juego y anotar el resultado en `references/game-with-themes.md`.

---

## Criterios de aceptación

- [x] `npm run lint` termina sin errores.
- [x] `npm run build` termina sin errores y `/juegos/[id]/jugar` mantiene el mismo tipo de ruta.
- [x] Existen `games/duelo-pixel/{core.ts,render.ts,duelo-pixel-game.tsx,duelo-pixel.css,skins.ts,prefs.ts}` y `games/index.ts` tiene la entrada `duelo-pixel`.
- [x] `games/duelo-pixel/core.ts` no importa `react` ni usa `window`, `document`, `performance`, `localStorage` ni `Math.random`.
- [x] `/juegos/duelo-pixel/jugar` muestra "¿JUGAMOS?"; JUGAR o Enter empiezan la partida.
- [x] El canvas tiene `width=800` y `height=500` y mantiene la proporción 8:5 a 1440 px y 390 px sin scroll horizontal del área del juego. Canvas de 334×209 a 390 px. _Pendiente de la plataforma:_ a 390 px hay 6 px de scroll horizontal por el botón hamburguesa del menú, igual que en los demás juegos; el área del juego cabe entera.
- [x] Al empezar, el canvas muestra "RIVAL 01 · CHISPA", la pelota espera 0,8 s en el centro y sale hacia la CPU.
- [x] ↑/↓ y W/S mueven la paleta del jugador sin salirse del campo.
- [x] La pelota rebota en las paredes; en la paleta, el ángulo depende del punto de impacto (centro casi horizontal, extremos hasta 50°) y nunca sale perfectamente horizontal.
- [x] Cada devolución acelera la pelota hasta su tope, y a velocidad máxima (incluido el plasma) no atraviesa ninguna paleta. Comprobado con simulaciones contra `core.ts` (cientos de partidas con `rng` fijo, 0 túneles).
- [x] Tras cada punto hay un saque de 0,8 s hacia quien ganó el punto.
- [x] Ganar un set 5-x muestra "RIVAL SUPERADO" con el siguiente rival y suma `1 000 × rival × circuito` (+2 000 si fue 5-0). En el navegador, un bot ganó el set a CHISPA 5-3: el aviso apareció y la puntuación subió de 720 a 1 920 (+200 del punto con x2 y +1 000 del set). El bonus de 5-0 se comprobó con un script contra `core.ts`.
- [x] Perder un set termina la partida y abre "FIN DEL JUEGO" con la puntuación final, Rival, Circuito y Mejor racha.
- [x] Vencer a NÉBULA empieza el circuito 02 contra CHISPA, más rápida que en el circuito 01. Comprobado con un script contra `core.ts`; en el navegador solo se jugó hasta ECO.
- [x] Cada rival se comporta según su estilo de la tabla (ECO ángulos planos, PRISMA esquinas, VOLTIO y NÉBULA lanzan plasma; NÉBULA con paleta más corta). Comprobado con scripts contra `core.ts` (ECO ≤ 15°, plasma de NÉBULA a la 5.ª devolución) y con simulaciones de dificultad; _pendiente:_ que una persona juegue contra cada rival para afinar la sensación.
- [x] Con 6 devoluciones el medidor queda cargado; Espacio lo arma 0,35 s y un golpe dentro de la ventana sale como plasma (más rápido y con curva). Sin carga, Espacio no hace nada; mantener Espacio no lo arma más de una vez.
- [x] Si la ventana se agota sin golpe o se pierde el punto, el medidor se vacía. Un punto ganado con plasma suma +250. Las reglas del plasma se comprobaron con un script contra `core.ts`; el medidor parpadeando no se capturó en el navegador.
- [x] Devolver suma `10 × multiplicador` solo en las 20 primeras devoluciones del peloteo; un punto ganado suma `100 × multiplicador` y luego sube el multiplicador (máx. x5); encajar un punto lo devuelve a x1. La racha se mantiene entre sets.
- [x] Pulsar las teclas del juego no hace scroll de la página.
- [x] El HUD muestra Jugador, Puntuación, Rival, Set y Racha; el canvas no los duplica. `.crt-bottom` muestra el circuito y el rival.
- [x] P, Esc y el botón PAUSA abren el menú de pausa y el juego se congela, incluidos el saque, la ventana de plasma y el aviso entre sets.
- [x] Con el menú abierto las teclas no afectan al juego; al reanudar con una tecla pulsada, no actúa hasta soltarla.
- [x] "Ver controles" muestra la lista y "Volver" regresa al menú.
- [x] "Reiniciar" empieza una partida nueva con puntuación 0 contra CHISPA en el circuito 01.
- [x] Cambiar a otra pestaña durante la partida la deja en pausa.
- [x] El botón FIN termina la partida y abre el mismo modal con la puntuación actual.
- [x] "GUARDAR PUNTUACIÓN" muestra "GUARDANDO…" y después "PUESTO #N" con el top 10 y la fila del jugador resaltada.
- [x] La fila guardada está en `public.scores` con `game_id = 'duelo-pixel'` y aparece en `/juegos/duelo-pixel` y `/salon?juego=duelo-pixel` tras recargar. Prueba con `TEST` / 1 920. _Pendiente:_ borrar la fila de prueba cuando el usuario lo confirme.
- [x] "JUGAR DE NUEVO" empieza una partida nueva con puntuación 0.
- [x] El selector cambia entre Clásico, Neón y Retro (Clásico por defecto); el skin se guarda en `av_duelo-pixel_skin` y persiste al recargar; un valor inválido vuelve a Clásico; con el foco en el selector las teclas no mueven la paleta. Ninguna otra clave `av_duelo-pixel_*`.
- [x] Los tres skins tienen fondo oscuro y pasan el contraste (≥ 3:1 en paletas, pelota, plasma y medidor; ≥ 4,5:1 en textos). Auditoría de `skin-designer`: cumple; peor ratio 4,14 (medidor vacío en Clásico) tras subir el de Retro a `#7a7a96`.
- [x] Salir con SALIR durante una partida y volver la deja en pausa, sin bucles ni listeners duplicados.
- [x] `/juegos/caida/jugar`, `/juegos/rocas/jugar`, `/juegos/bloque-buster/jugar` y `/juegos/serpentina/jugar` siguen igual, y un juego simulado sigue mostrando "MODO DEMO". Las cinco rutas (incluida `gloton`) responden 200; el "MODO DEMO" del simulador, que aparece al terminar su partida, no se volvió a comprobar.
- [x] La consola no muestra errores ni avisos de hidratación en `/juegos/duelo-pixel/jugar`.
- [x] Ningún texto visible nombra juegos de marca del género, y `/juegos/duelo-pixel` ya no menciona el modo a dos jugadores.
- [x] `git status` no muestra cambios dentro de las carpetas de juegos de `references/`.

---

## Decisiones

- **Sí:** el juego ocupa la entrada existente `duelo-pixel` del catálogo. Reutiliza nombre, portada (`cover-duelo`), color y ficha.
- **Sí:** diseño original del género, en TypeScript + React con `<canvas>`, con `core.ts` puro separado de `render.ts`. No hay referencia en `references/`.
- **Sí:** solo contra la CPU; se reescribe `long` para quitar el modo local a dos jugadores. Decisión del usuario: el ranking guarda una persona por partida.
- **Sí:** perder un set termina la partida, sin segunda oportunidad. Decisión del usuario: más tensión y ranking más justo.
- **Sí:** escalera de 5 rivales y circuitos infinitos al vencer a NÉBULA. Decisión del usuario: techo alto para el ranking.
- **Sí:** solo teclado, como el resto de juegos de la plataforma. Decisión del usuario.
- **Sí:** sets a 5 sin diferencia mínima, golpe de plasma con medidor de 6, racha x1–x5 que persiste entre sets y la tabla de puntos del alcance. Propuesta de `game-planner`.
- **Sí:** tope de 20 devoluciones puntuables por peloteo, aceleración por devolución y ángulo mínimo de 6°. Evitan acumular puntos alargando peloteos y los peloteos horizontales infinitos.
- **Sí:** saca quien encajó el punto, con la pelota hacia el ganador tras 0,8 s. Sin tecla de saque.
- **Sí:** pelota cuadrada de 10 px como caja de colisión e integración por subpasos de 5 px. A 900 px/s con `dt` de 50 ms recorre 45 px por frame, más que el grosor de la paleta.
- **Sí:** IA con reacción, predicción con rebotes y error por aproximación, todo con `s.rng`. Partidas reproducibles y dificultad ajustable por constantes.
- **Sí:** errores de la tabla recalculados y error escalado con la velocidad de la pelota (decidido durante la implementación). Con los valores del borrador (±40…±8 px) la CPU no fallaba nunca —el margen de una paleta de 80 px es de 45 px— y una simulación de 40 partidas no terminó ningún peloteo en 20 minutos de juego.
- **Sí:** `rng` inyectable en el estado. Partidas reproducibles para depurar.
- **Sí:** HUD con Rival, Set y Racha; circuito y rival en `.crt-bottom`; modal con `extra` = Rival, Circuito y Mejor racha.
- **Sí:** el canvas sí dibuja el medidor de plasma y los avisos de rival; no dibuja marcadores. Sin marcadores gigantes ni red punteada en el campo, para no copiar el look del clásico.
- **Sí:** modal de la plataforma con `ranked`; guarda con `submitScore`, la única vía de escritura.
- **No:** migración de Supabase. `scores` es común a todos los juegos; los datos de `extra` no se guardan.
- **No:** récords locales del juego. Duplicaría el ranking.
- **Sí:** campo lógico fijo 800×500 escalado por CSS. La dificultad no depende de la pantalla.
- **Sí:** skins Clásico, Neón y Retro desde el primer día (§7), con `av_duelo-pixel_skin` como única preferencia.
- **Sí:** `best` del catálogo a `18500`. Es dato de muestra y debe estar en la escala nueva.
- **No:** controles táctiles, sonido ni modo a dos jugadores. Van en otros specs.

---

## Riesgos

| Riesgo                                                                    | Mitigación                                                                                                    |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Bucles o listeners duplicados al navegar (`<Activity>`, Strict Mode)      | Estado del bucle en refs; toda limpieza cancela el frame y quita listeners; criterio de salir y volver.       |
| Salto de `dt` al reanudar o volver a la ruta                              | Reiniciar el último timestamp al arrancar el bucle; `dt` limitado a 50 ms.                                    |
| Espacio activa el botón enfocado                                          | `preventDefault` en las teclas del juego y `blur()` de los botones tras el clic.                              |
| Puntuación no entera o fuera de rango y el guardado falla                 | Puntos enteros en `core.ts`; `validateScore` y la RPC rechazan el resto.                                      |
| El canvas no cabe en pantallas bajas o estrechas                          | Escalado CSS con resolución fija; revisar a 1440 px y 390 px.                                                 |
| El CSS del juego afecta a otras páginas                                   | Todas las reglas bajo `.duelo-pixel-root`.                                                                    |
| IA perfecta (frustra) o torpe (aburre)                                    | Parámetros por rival en `RIVALS`; paso 7 del plan juega contra cada uno; el error de predicción nunca es 0.   |
| La pelota atraviesa la paleta a alta velocidad o con plasma               | Subpasos de 5 px; colisión solo si la pelota va hacia la paleta; criterio a velocidad máxima.                 |
| Peloteos infinitos para sumar puntos                                      | Aceleración por devolución, ángulo mínimo de 6° y tope de 20 devoluciones puntuables.                         |
| La curva del plasma saca la pelota del campo o la deja pegada a una pared | La curva solo cambia `vy`; las paredes siguen rebotando en cada subpaso y la curva se invierte con el rebote. |
| La pelota es difícil de ver a 390 px                                      | Contraste ≥ 3:1 en los tres skins; revisar a 390 px en el paso 6.                                             |
| Un agente o comando modifica las referencias                              | Reglas `deny` en `.claude/settings.json`; criterio de `git status` sin cambios en `references/`.              |

---

## Lo que **no** está en este spec

- Modo local a dos jugadores.
- Controles táctiles.
- Sonido.
- Segunda oportunidad, elegir rival o circuito inicial.
- Datos extra de la partida en Supabase.
- Tests automatizados.

Cada uno de esos, si llega, va en su propio spec.
