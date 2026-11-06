# SPEC 08 — Juego real: BLOQUE BUSTER (port del rompeladrillos de referencia)

> **Estado:** Implementado
> **Depende de:** SPEC 05, SPEC 06, SPEC 07
> **Fecha:** 2026-11-05
> **Objetivo:** Hacer jugable `/juegos/bloque-buster/jugar` con un port a TypeScript + React del rompeladrillos de `references/arkanoid/`, alojado en `games/bloque-buster/`, con el HUD, la pausa y el modal de fin de partida de la plataforma, sus sonidos con botón de silencio y su puntuación en el ranking de Supabase.

---

## Por qué existe este spec

La entrada `bloque-buster` de `lib/games.ts` (`ARCADE`, portada `cover-bricks`, color `cyan`) usa hoy el simulador `components/game-player.tsx`.
En `references/arkanoid/` hay un rompeladrillos completo en JavaScript vanilla: `game.js` (canvas 480×640, estado, física, dibujo y bucle), `assets/spritesheet.js` + PNG, y dos sonidos en `assets/sounds/`. Tiene 3 niveles en cuadrículas ASCII, ladrillos de 7 tipos, multibola y un top 5 local.
SPEC 05 y 06 fijaron la convención `games/<id>/` y el registro `games/index.ts`. SPEC 07 conectó el modal a Supabase. Al registrar `bloque-buster` en `PLAYABLE`, el juego entra en el ranking sin migraciones.
El nombre visible es "BLOQUE BUSTER"; las marcas "Arkanoid" y "Breakout" no aparecen en la UI.

---

## Alcance

**Dentro:**

- Carpeta `games/bloque-buster/` y entrada `"bloque-buster": BloqueBusterGame` en `PLAYABLE` de `games/index.ts`.
- Lógica pura en `games/bloque-buster/core.ts`, portando `game.js` **sin cambiar reglas ni valores**:
  - Campo lógico 480×640. El techo de la pelota sigue en `y = 32` (`HUD_H`), aunque el canvas ya no dibuja HUD.
  - Ladrillos de 32×16 en una cuadrícula de 13 columnas con origen en (32, 64).
  - Paleta de 80×14 en `y = 600`, a 420 px/s y limitada a los bordes. Empieza centrada (`x = 200`).
  - Pelota de 12 px. Velocidad 300 px/s en el nivel 1, +15 % por nivel (300, 345 y 390 px/s).
  - Saque a 30° a la derecha de la vertical. En la paleta, el ángulo de salida depende del punto de impacto, hasta 60°, y solo rebota si la pelota baja.
  - Rebote en las paredes laterales y en el techo.
  - Colisión AABB con ladrillos: se invierte la velocidad en el eje de menor solapamiento, con un ladrillo como máximo por pelota y frame.
  - Tipos de ladrillo (letra → color, golpes, puntos):

    | Letra | Color    | Golpes | Puntos |
    | ----- | -------- | ------ | ------ |
    | `S`   | gris     | 2      | 50     |
    | `Y`   | amarillo | 1      | 120    |
    | `P`   | rosa     | 1      | 110    |
    | `M`   | magenta  | 1      | 100    |
    | `R`   | rojo     | 1      | 90     |
    | `G`   | verde    | 1      | 80     |
    | `C`   | cian     | 1      | 70     |

  - El ladrillo gris destella en blanco 0,1 s al primer golpe y queda atenuado (alfa 0,6) hasta romperse.
  - Los 3 niveles de la referencia (`LEVEL_1`, `LEVEL_2`, `LEVEL_3`) copiados tal cual.
  - 3 vidas. Se pierde una cuando cae la última pelota en juego; quedan vidas → nuevo saque con la pelota sobre la paleta.
  - Limpiar el nivel 1 o 2 → estado "nivel superado"; Espacio (o el botón CONTINUAR) pasa al siguiente, conservando puntos y vidas, con la paleta centrada y la pelota en la paleta.
  - Limpiar el nivel 3 → victoria: la partida termina.
  - Multibola: cada ladrillo roto tiene un 10 % de soltar una cápsula de 32×14 que cae a 150 px/s. Solo hay una cápsula a la vez y no aparece con más de una pelota en juego. Atraparla con la paleta añade 3 pelotas desde la posición de la original (−45°, 0° y 45° respecto a la vertical, hacia arriba). La cápsula que llega abajo se pierde. Perder una vida la elimina.
  - Las pelotas chocan entre sí intercambiando la componente normal y conservando su rapidez. Las que caen se pierden sin coste mientras quede al menos una.
  - Explosión de 0,15 s al romper un ladrillo, sin colisión.
  - Contador nuevo `bricksBroken` (ladrillos rotos en la partida).
  - `dt` limitado a 1/30 s, como la referencia.
- Dibujo en `games/bloque-buster/render.ts`, estilo neón vectorial con glow (`shadowBlur`), sin spritesheet:
  - Ladrillos rellenos con borde brillante, cada uno en su color neón (gris acero, amarillo, rosa, magenta, rojo, verde y cian).
  - Paleta cyan; pelota blanca (`--ink`); cápsula naranja (`#ff8800`) con el texto "+3".
  - Explosión neón propia: destello del color del ladrillo que se expande y se desvanece en 0,15 s.
  - Línea fina de techo en `y = 32`.
  - Sobre el canvas solo queda el aviso "NIVEL 0N SUPERADO" mientras dure ese estado. Puntuación, vidas y nivel van al HUD de la plataforma.
- Sonidos de la referencia: `ball-bounce.mp3` y `break-sound.mp3` copiados a `public/games/bloque-buster/sounds/`.
  - Rebote: en paredes, techo, paleta, ladrillos que no se rompen, choques entre pelotas y al atrapar la cápsula. Rotura: al romper un ladrillo.
  - Cada reproducción usa un clon para que se solapen. Los errores de autoplay se ignoran.
  - `core.ts` no reproduce nada: deja eventos (`"bounce"` / `"break"`) en el estado y el componente los consume tras cada `step`.
- Botón de silencio "SONIDO: SÍ / NO" bajo el CRT y tecla `M`. Se guarda en `localStorage` como `av_bloque-buster_muted` (`"1"` / `"0"`), activado por defecto.
- Client Component `games/bloque-buster/bloque-buster-game.tsx`:
  - HUD de la plataforma: Jugador, Puntuación, Vidas, Nivel y botones PAUSA / FIN / SALIR.
  - Marco CRT con `<canvas>` de 480×640, escalado por CSS en proporción 3:4 para caber en pantallas bajas o estrechas.
  - Lista de controles y botón SONIDO visibles bajo el canvas.
  - Bucle `requestAnimationFrame` con el estado del juego en refs.
  - Teclado: ← → o A D mueven la paleta, Espacio lanza la pelota o continúa tras "nivel superado", P / Esc pausa, M silencio. `preventDefault` en esas teclas.
  - Ratón: mover el cursor sobre el canvas centra la paleta en su X, convertida a coordenadas lógicas según el escalado. Un clic en el canvas lanza la pelota en el saque.
- Pantalla de inicio "¿JUGAMOS?" con JUGAR (también Enter). Sustituye al "Pulsa Espacio para empezar" de la referencia.
- Estado "nivel superado" dentro del CRT: "NIVEL 0N SUPERADO", botón CONTINUAR y pista "o pulsa Espacio".
- Menú de pausa (P / Esc o PAUSA): Reanudar, Reiniciar y Ver controles / Volver.
  - Con el menú abierto el juego no recibe teclas ni ratón, y las teclas que sigan pulsadas al reanudar se ignoran hasta soltarlas.
  - Perder el foco con partida en curso abre la pausa.
- Fin de partida con `GameOverModal` (`ranked`) y `onRestart` que empieza una partida nueva. Se llega por victoria (nivel 3 superado), por perder la última vida o por el botón FIN. `extra`:
  - Nivel: el alcanzado, con dos dígitos.
  - Ladrillos rotos.
  - Resultado: VICTORIA o DERROTA (sin vidas o con FIN).
- Guardado en Supabase por la vía existente (`submitScore` → `submit_score`). El ranking aparece en `/juegos/bloque-buster` y `/salon?juego=bloque-buster`.
- Estilos en `games/bloque-buster/bloque-buster.css`, con todas las reglas bajo `.bloque-buster-root`.
- Ajustar el texto `long` de `bloque-buster` en `lib/games.ts`. Debe mencionar los tres muros, los ladrillos blindados de dos golpes y la cápsula que multiplica las pelotas, y quitar la idea de que los niveles son infinitos.

**Fuera de alcance (para futuros specs):**

- Top 5 local de la referencia (`arkanoid:highscores:v1`) y el "RÉCORD" del HUD. Los sustituye el ranking de la plataforma.
- Spritesheet y explosión por frames de la referencia.
- Control de volumen, música o sonidos nuevos.
- Controles táctiles o gestos en móvil.
- Niveles nuevos, bucle infinito de niveles, otros power-ups o cualquier cambio de balance.
- Guardar en Supabase el nivel, los ladrillos rotos o el resultado.
- Cambios en la ficha `/juegos/bloque-buster` aparte del texto `long`.
- Otros juegos del catálogo.
- Tests automatizados (no hay test runner configurado).
- Cambiar `references/arkanoid/` (es solo referencia).

---

## Modelo de datos

```text
games/
  index.ts                    # + "bloque-buster": BloqueBusterGame
  bloque-buster/
    core.ts                   # lógica pura (port de game.js), sin DOM, React ni localStorage
    render.ts                 # dibujo neón en canvas a partir de BloqueBusterState
    prefs.ts                  # av_bloque-buster_muted
    bloque-buster-game.tsx    # "use client": canvas, bucle, entrada, sonido, HUD, inicio, pausa, fin
    bloque-buster.css         # estilos del área del juego, bajo .bloque-buster-root
public/
  games/bloque-buster/sounds/
    ball-bounce.mp3
    break-sound.mp3
```

```ts
// games/bloque-buster/core.ts
export const W = 480;
export const H = 640;
export const HUD_H = 32; // techo lógico de la pelota
export const BRICK_W = 32;
export const BRICK_H = 16;
export const COLS = 13;
export const GRID_X = 32;
export const GRID_Y = 64;
export const PADDLE_W = 80;
export const PADDLE_H = 14;
export const PADDLE_Y = 600;
export const PADDLE_START_X = 200;
export const BALL_SIZE = 12;
export const PADDLE_SPEED = 420; // px/s
export const BALL_SPEED = 300; // px/s en el nivel 1
export const SPEED_STEP = 0.15; // +15 % por nivel
export const SERVE_ANGLE = Math.PI / 6;
export const MAX_BOUNCE_ANGLE = Math.PI / 3;
export const FLASH_TIME = 0.1; // s
export const EXPLOSION_TIME = 0.15; // s
export const POWERUP_CHANCE = 0.1;
export const CAPSULE_W = 32;
export const CAPSULE_H = 14;
export const CAPSULE_SPEED = 150; // px/s
export const MULTIBALL_ANGLES = [-Math.PI / 4, 0, Math.PI / 4] as const;
export const START_LIVES = 3;
export const MAX_DT = 1 / 30;

export type BrickColor =
  "gray" | "yellow" | "hotpink" | "magenta" | "red" | "green" | "cyan";
export type BrickType = { color: BrickColor; hits: number; points: number };
export const BRICK_TYPES: Record<
  "S" | "Y" | "P" | "M" | "R" | "G" | "C",
  BrickType
>;
export const LEVELS: readonly (readonly string[])[]; // LEVEL_1..3 de la referencia, sin cambios

export type Brick = {
  x: number;
  y: number;
  color: BrickColor;
  hits: number;
  points: number;
  flashUntil: number;
};
export type Ball = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
};
export type Capsule = { x: number; y: number };
export type Explosion = {
  x: number;
  y: number;
  color: BrickColor;
  startedAt: number;
};
export type Paddle = { x: number; y: number; w: number; h: number };

export type SoundEvent = "bounce" | "break";
export type EngineState =
  "serve" | "playing" | "levelclear" | "won" | "gameover";

export type BloqueBusterState = {
  state: EngineState;
  level: number; // 1..LEVELS.length
  score: number; // entero
  lives: number;
  bricksBroken: number;
  paddle: Paddle;
  balls: Ball[]; // en el saque, exactamente 1
  capsule: Capsule | null;
  bricks: Brick[];
  explosions: Explosion[];
  time: number; // s de partida; sustituye a performance.now() de la referencia
  events: SoundEvent[]; // sonidos pendientes; el componente los vacía tras cada step
  rng: () => number; // inyectable; la UI pasa Math.random
};

export type BloqueBusterInput = {
  left: boolean;
  right: boolean;
  mouseX: number | null; // X lógica del cursor desde el último frame, o null
  action: boolean; // Espacio o clic: lanza en "serve", continúa en "levelclear"
};

export function createState(rng: () => number): BloqueBusterState; // nivel 1, "serve", pelota en la paleta
export function step(
  s: BloqueBusterState,
  dt: number,
  input: BloqueBusterInput,
): void; // muta s
export function isAnimating(s: BloqueBusterState): boolean; // quedan explosiones
export function buildBricks(level: readonly string[]): Brick[];
export function ballSpeed(level: number): number; // 300, 345, 390
export function spawnCapsule(s: BloqueBusterState, x: number, y: number): void; // para depurar
```

```ts
// games/bloque-buster/render.ts
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  s: BloqueBusterState,
  now: number,
): void;
```

```ts
// games/bloque-buster/prefs.ts — todo acceso en try/catch, igual que games/caida/prefs.ts
export const MUTED_KEY = "av_bloque-buster_muted"; // "1" | "0"
export function readMuted(): boolean; // ausente o inválido → false
export function writeMuted(muted: boolean): void;
```

```ts
// games/bloque-buster/bloque-buster-game.tsx — estado visible en React; el del bucle en refs
type Phase = "start" | "playing" | "paused" | "over";
type RunStats = {
  score: number;
  lives: number;
  level: number;
  bricksBroken: number;
  levelClear: boolean; // overlay "NIVEL 0N SUPERADO"
  result: "VICTORIA" | "DERROTA" | null;
};
```

Convenciones (las de SPEC 05/06, detalladas en `.claude/skills/nuevo-juego/integracion.md`):

- `core.ts` no importa React ni usa `window`, `document`, `performance`, `localStorage`, `Audio` ni `Math.random`.
- Coordenadas con origen arriba a la izquierda. Velocidades en px/s y tiempos en segundos (los 100 ms y 150 ms de la referencia pasan a 0,1 s y 0,15 s sobre `s.time`).
- `EngineState` es del motor y `Phase` de la UI. `won` y `gameover` llevan la UI a `over`. `serve` y `levelclear` ocurren dentro de `playing`.
- `step` solo mueve la física en `serve` y `playing`, como `update` de la referencia. En `levelclear` solo atiende `action`.
- La partida en curso no se persiste. La única clave es `av_bloque-buster_muted`.
- `setState` solo cuando cambian los datos del HUD, el aviso de nivel superado o la fase.

---

## Plan de implementación

Seguir `.claude/skills/nuevo-juego/integracion.md` y partir de `.claude/skills/nuevo-juego/scaffold/`. Usar `/frontend-design` para la UI, con `references/arkanoid/game.js` como referencia funcional y `games/rocas/` como referencia de integración (`games/caida/prefs.ts` para la preferencia).

1. **Lógica pura.** Crear `games/bloque-buster/core.ts` desde `scaffold/core.ts.tpl` portando `game.js` con los tipos y constantes del modelo de datos:
   - Quitar entrada DOM, sonido, dibujo y récords.
   - Pasar los tiempos a `s.time`.
   - Añadir `bricksBroken` y los eventos de sonido.
   - Verificar: `npm run build` pasa.
2. **Dibujo.** Crear `games/bloque-buster/render.ts` con `drawFrame`: fondo, techo, ladrillos (destello y atenuado del gris), explosiones, cápsula "+3", paleta, pelotas y aviso de nivel superado. Paleta neón con glow. Verificar: `npm run build` pasa.
3. **Sonido y preferencia.** Copiar los dos mp3 a `public/games/bloque-buster/sounds/`. Crear `prefs.ts` con `readMuted` / `writeMuted`. Verificar: `npm run build` pasa.
4. **Componente jugable.** Crear `games/bloque-buster/bloque-buster-game.tsx` desde `scaffold/game.tsx.tpl`:
   - HUD, CRT y canvas 480×640.
   - Bucle con teclado (← → A D, Espacio como pulsación) y ratón (mousemove escalado, clic).
   - Tras cada `step` se reproducen los eventos de sonido salvo en silencio. Los `Audio` se crean en un efecto.
   - Registrar `"bloque-buster": BloqueBusterGame` en `games/index.ts`.
   - Verificar: `/juegos/bloque-buster/jugar` arranca una partida jugable con teclado y ratón, con sonido.
5. **Inicio, nivel superado, pausa y fin.**
   - Overlay "¿JUGAMOS?" y overlay "NIVEL 0N SUPERADO" con CONTINUAR.
   - Menú de pausa y pausa por foco.
   - `GameOverModal` con `ranked` y `extra` = Nivel, Ladrillos rotos y Resultado.
   - Botón SONIDO y tecla M, leídos con `readMuted()` tras montar.
   - Verificar: todos los botones del menú, del overlay y del modal funcionan.
6. **Estilos.** Crear `games/bloque-buster/bloque-buster.css` desde `scaffold/game.css.tpl`, con `aspect-ratio: 3 / 4` en `.crt-screen` y el `max-width` del marco calculado con 3/4. Revisar a 1440 px y 390 px. Verificar: el canvas cabe sin scroll horizontal y entero en alto.
7. **Catálogo, ranking y cierre.**
   - Cambiar el `long` de `bloque-buster` en `lib/games.ts`.
   - Guardar una partida de prueba (`TEST`) y comprobarla con `execute_sql`, en la ficha y en el Salón.
   - Borrar las filas de prueba tras confirmarlo.
   - Verificar: `npm run lint` y `npm run build` pasan.

---

## Criterios de aceptación

- [x] `npm run lint` termina sin errores.
- [x] `npm run build` termina sin errores y `/juegos/[id]/jugar` mantiene el mismo tipo de ruta.
- [x] Existen `games/bloque-buster/{core.ts,render.ts,prefs.ts,bloque-buster-game.tsx,bloque-buster.css}`, los dos mp3 en `public/games/bloque-buster/sounds/`, y `games/index.ts` tiene la entrada `bloque-buster`.
- [x] `games/bloque-buster/core.ts` no importa `react` ni usa `window`, `document`, `performance`, `localStorage`, `Audio` ni `Math.random`.
- [x] `/juegos/bloque-buster/jugar` muestra "¿JUGAMOS?"; JUGAR o Enter empiezan con la pelota sobre la paleta centrada.
- [x] El canvas tiene `width=480` y `height=640` y se ve en proporción 3:4 a 1440 px y a 390 px sin scroll horizontal.
  - Nota: el área del juego no desborda a 390 px; la página sí desborda 6 px por el botón hamburguesa del nav de la plataforma (igual que en CAÍDA y ROCAS, anotado en SPEC 06).
- [x] El nivel 1 tiene 7 filas de 13 ladrillos (gris arriba, cian abajo), como `LEVEL_1`.
- [x] Espacio o un clic en el canvas lanza la pelota a 30° a la derecha; mantener Espacio no hace nada más.
- [x] ← → y A D mueven la paleta sin salirse del campo; mover el ratón sobre el canvas la centra en el cursor, también con el canvas escalado.
- [x] La pelota sale de la paleta casi vertical por el centro y en diagonal por los extremos.
- [x] Romper un ladrillo amarillo, rosa, magenta, rojo, verde y cian suma 120, 110, 100, 90, 80 y 70 puntos.
- [x] Un ladrillo gris destella al primer golpe, queda atenuado y se rompe al segundo sumando 50.
- [x] Limpiar el nivel 1 muestra "NIVEL 01 SUPERADO"; Espacio o CONTINUAR cargan el nivel 2 con la pelota en la paleta y la misma puntuación y vidas, y la pelota va más rápida.
- [x] Superar el nivel 3 abre "FIN DEL JUEGO" con Resultado VICTORIA.
- [x] Al caer la última pelota se resta una vida y vuelve el saque; con la tercera vida perdida se abre el modal con Resultado DERROTA.
- [x] Atrapar la cápsula naranja "+3" (forzada con `spawnCapsule` si hace falta) añade 3 pelotas que rebotan entre sí; perder todas menos una no resta vida.
- [x] No aparece una cápsula nueva mientras haya otra cayendo o más de una pelota en juego.
- [x] Rebotes y roturas suenan; con SONIDO: NO o tras pulsar M no suena nada, y el valor se conserva tras recargar (`av_bloque-buster_muted`).
- [x] Con `localStorage` bloqueado o un valor inválido en `av_bloque-buster_muted`, el juego carga con sonido y sin errores.
- [x] Pulsar flechas o Espacio durante la partida no hace scroll de la página.
- [x] El HUD muestra Jugador, Puntuación, Vidas y Nivel; el canvas no dibuja puntos, récord, nivel ni vidas.
- [x] Ladrillos, paleta, pelota y cápsula se dibujan en neón con glow, sin spritesheet.
- [x] P, Esc y el botón PAUSA abren el menú de pausa y el juego se congela; el ratón no mueve la paleta en pausa.
- [x] Con el menú abierto las teclas no afectan al juego; al reanudar con una flecha pulsada, la paleta no se mueve hasta soltarla.
- [x] "Ver controles" muestra la lista y "Volver" regresa al menú.
- [x] "Reiniciar" empieza una partida nueva con puntuación 0, 3 vidas y nivel 01.
- [x] Cambiar a otra pestaña durante la partida la deja en pausa.
- [x] El botón FIN termina la partida y abre el modal con la puntuación actual y Resultado DERROTA.
- [x] El modal muestra Nivel, Ladrillos rotos y Resultado.
- [x] "GUARDAR PUNTUACIÓN" muestra "GUARDANDO…" y después "PUESTO #N" con el top 10 y la fila del jugador resaltada.
- [x] La fila guardada está en `public.scores` con `game_id = 'bloque-buster'` y aparece en `/juegos/bloque-buster` y `/salon?juego=bloque-buster` tras recargar.
- [x] El modal de `/juegos/bloque-buster/jugar` ya no muestra "MODO DEMO".
- [x] "JUGAR DE NUEVO" empieza una partida nueva con puntuación 0.
- [x] El juego no escribe en `localStorage` más clave que `av_bloque-buster_muted`.
- [x] Salir con SALIR durante una partida y volver la deja en pausa, sin bucles ni listeners duplicados (la paleta se mueve a velocidad normal y un Espacio lanza una sola vez).
- [x] `/juegos/caida/jugar` y `/juegos/rocas/jugar` siguen igual, y `/juegos/serpentina/jugar` sigue mostrando el simulador con "MODO DEMO".
- [x] La consola no muestra errores ni avisos de hidratación en `/juegos/bloque-buster/jugar`.
- [x] Las palabras "Arkanoid" y "Breakout" no aparecen en ningún texto visible.
- [x] El texto `long` de `bloque-buster` menciona los tres muros, los ladrillos de dos golpes y la cápsula de multibola.

---

## Decisiones

- **Sí:** el juego ocupa la entrada existente `bloque-buster` del catálogo. Reutiliza nombre, portada, color y ficha, y evita las marcas en la UI.
- **No:** añadir una entrada nueva `arkanoid`.
- **Sí:** port a TypeScript + React con `<canvas>`, con `core.ts` puro separado de `render.ts`. Mismas razones que en SPEC 05/06.
- **No:** iframe ni JS vanilla montado vía refs.
- **Sí:** reglas y valores de la referencia sin cambios, incluidos los 3 niveles y `MAX_DT = 1/30`.
- **Sí:** superar el nivel 3 termina la partida con victoria. Decisión del usuario; es la regla de la referencia.
- **No:** bucle infinito de niveles. Es un cambio de balance.
- **Sí:** neón vectorial con glow, como ROCAS. Decisión del usuario; encaja con la plataforma.
- **No:** spritesheet de la referencia.
- **Sí:** la cápsula muestra "+3" en lugar de la "D" de la referencia. Explica el efecto y no arrastra la terminología del juego original.
- **Sí:** sonidos de la referencia con botón SONIDO y tecla M, persistido en `av_bloque-buster_muted`. Decisión del usuario.
- **Sí:** `core.ts` emite eventos de sonido y el componente los reproduce. Mantiene el motor puro.
- **Sí:** tiempo de partida `s.time` en lugar de `performance.now()`. El destello y las explosiones se congelan con la pausa y `core.ts` sigue puro.
- **Sí:** el techo lógico sigue en `y = 32` aunque el HUD salga del canvas. No cambia la geometría ni la dificultad.
- **Sí:** el ratón se convierte a coordenadas lógicas con el tamaño en pantalla del canvas. La referencia no escalaba el canvas.
- **Sí:** "nivel superado" es un estado del motor dentro de la fase `playing`, con su overlay. Solo la pausa y el fin cambian la `Phase` de la UI.
- **Sí:** en "nivel superado" el canvas dibuja el título y el overlay HTML solo lleva CONTINUAR y la pista. Evita el título duplicado (decidido durante la implementación).
- **Sí:** el botón SONIDO usa la fuente mono y un LED como el "SEÑAL OK" del CRT. La fuente pixel no tiene la "Í" de "SÍ" (decidido durante la implementación).
- **Sí:** modal de la plataforma con `ranked` y `extra` = Nivel, Ladrillos rotos y Resultado. Guarda con `submitScore`, la única vía de escritura. Decisión del usuario.
- **Sí:** el botón FIN cuenta como DERROTA. La partida no se ha completado.
- **No:** top 5 local ni "RÉCORD" en el HUD. Duplicaría el ranking.
- **No:** migración de Supabase. `scores` es común a todos los juegos y los datos de `extra` no se guardan.
- **Sí:** campo lógico fijo 480×640 escalado por CSS (3:4). La dificultad no depende de la pantalla.
- **No:** controles táctiles. Van en otro spec.

---

## Riesgos

| Riesgo                                                                      | Mitigación                                                                                                                        |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Bucles o listeners duplicados al navegar (`<Activity>`, Strict Mode)        | Estado del bucle en refs; toda limpieza cancela el frame y quita listeners, incluidos los del canvas; criterio de salir y volver. |
| Salto de `dt` al reanudar o volver a la ruta                                | Reiniciar el último timestamp al arrancar el bucle; `dt` limitado a 1/30 s.                                                       |
| Espacio activa el botón enfocado (JUGAR, CONTINUAR, PAUSA) además de lanzar | `preventDefault` en las teclas del juego y `blur()` de los botones tras el clic.                                                  |
| El canvas 3:4 no cabe en pantallas bajas (es más alto que ancho)            | `max-width` del marco calculado con `100svh` y proporción 3/4; revisar a 1440 px y 390 px.                                        |
| El ratón mueve la paleta a una X errónea con el canvas escalado             | Convertir con `(clientX − rect.left) × W / rect.width`.                                                                           |
| El navegador bloquea el audio antes de la primera interacción               | El sonido empieza tras JUGAR (un gesto); los rechazos de `play()` se ignoran.                                                     |
| Muchas pelotas o explosiones con `shadowBlur` bajan los FPS                 | Glow en ladrillos, paleta y cápsula; explosiones y pelotas con glow ligero o sin él si hace falta.                                |
| Una pelota rápida atraviesa un ladrillo en un frame largo                   | Igual que la referencia: `dt` acotado a 1/30 s (13 px por frame a 390 px/s, menos que un ladrillo).                               |
| El CSS del juego afecta a otras páginas                                     | Todas las reglas bajo `.bloque-buster-root`.                                                                                      |

---

## Lo que **no** está en este spec

- Top 5 local y récord en el HUD.
- Spritesheet de la referencia.
- Volumen, música o sonidos nuevos.
- Controles táctiles.
- Niveles nuevos, bucle infinito u otros power-ups.
- Datos extra de la partida en Supabase.
- Tests automatizados.

Cada uno de esos, si llega, va en su propio spec.
