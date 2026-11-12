# SPEC 13 — Juego real: RANARIA (diseño original del género «cruzar la carretera»)

> **Estado:** Aprobado
> **Depende de:** SPEC 05, SPEC 06, SPEC 07, SPEC 11, SPEC 12
> **Fecha:** 2026-11-11
> **Objetivo:** Hacer jugable `/juegos/ranaria/jugar` con un juego original del género «cruzar la carretera y el río», alojado en `games/ranaria/`, con el HUD, la pausa y el modal de fin de partida de la plataforma, su puntuación en el ranking de Supabase, skins y controles táctiles.

---

## Por qué existe este spec

La entrada `ranaria` de `lib/games.ts` (`ARCADE`, portada `cover-rana`, color `green`) usa hoy el simulador `components/game-player.tsx`.
Este spec adapta el borrador de la game jam `specs/game-jam/frogger/01-frogger-core.md` al contrato del repo. Conserva su mecánica: rejilla de 16×14, salto de una casilla en 120 ms, 5 carriles de carretera, 6 de río con troncos y tortugas que se sumergen, 5 metas, temporizador, 3 vidas y su tabla de puntos. Cambia la integración: no hay tabla `games`, ni página de juego propia, ni INSERT directo en `scores`, ni HUD duplicado en el canvas. Además, resuelve las contradicciones del borrador (tamaño del canvas y filas de las zonas) y le añade skins y controles táctiles.
`references/` no trae nada de este juego: las reglas se diseñan aquí y todo se dibuja con primitivas de canvas.
SPEC 05 y 06 fijaron la convención `games/<id>/` y el registro `games/index.ts`; SPEC 07 conectó el modal a Supabase. Al registrar `ranaria` en `PLAYABLE`, el juego entra en el ranking sin migraciones.
El nombre visible es "RANARIA"; el nombre del arcade comercial del género no aparece en la UI. Las metas se llaman **nenúfares**, como en el texto del catálogo.

---

## Alcance

**Dentro:**

- Carpeta `games/ranaria/` y entrada `ranaria: RanariaGame` en `PLAYABLE` de `games/index.ts`.
- Lógica pura en `games/ranaria/core.ts`, por casillas:
  - **Tablero:** 16 columnas × 14 filas de 40 px (campo lógico de 640×560). Fila 0 arriba.
    - Fila 0: orilla con **5 nenúfares** de 2 columnas cada uno, en las columnas 1–2, 4–5, 7–8, 10–11 y 13–14. Las columnas 0, 3, 6, 9, 12 y 15 son orilla.
    - Filas 1–6: río (6 carriles).
    - Fila 7: mediana segura.
    - Filas 8–12: carretera (5 carriles).
    - Fila 13: base de salida, segura.
  - **Rana:** empieza en la fila 13, columna 7. Su `col` es decimal porque el río la arrastra; `row` es entera.
  - **Salto:** cada pulsación de ↑ ↓ ← → (una por pulsación) salta exactamente 1 casilla con una animación de 120 ms (`JUMP_TIME = 0.12`). Si llega una pulsación durante un salto, queda pendiente (solo una; gana la última) y se ejecuta al aterrizar. Un salto que dejaría la rana fuera del tablero (col < 0, col > 15 o fila > 13) se ignora. Al aterrizar en una fila que no es de río, `col` se redondea al entero más cercano.
  - **Carriles:** las entidades se mueven en horizontal a velocidad constante. Cada carril tiene un ciclo de 20 casillas (`LANE_SPAN = 20`): la entidad que sale por un borde vuelve a entrar por el contrario fuera de la vista. Al empezar cada ronda, cada carril desplaza sus posiciones iniciales un número entero al azar de casillas (`s.rng`), entre 0 y 19. Velocidades base en casillas/s, que equivalen a las del borrador en px/frame a 60 Hz (carretera 2,25–4,5 y río 1,5–3,0, dentro de sus rangos de 2,25–6 y 1,5–4,5):

    | Fila | Zona      | Entidad          | Ancho | Sentido | Vel. base | Inicios      |
    | ---- | --------- | ---------------- | ----- | ------- | --------- | ------------ |
    | 12   | carretera | coche            | 1     | ←       | 2,25      | 0, 5, 10, 15 |
    | 11   | carretera | coche            | 1     | →       | 3,0       | 2, 9, 16     |
    | 10   | carretera | camión           | 2     | ←       | 2,5       | 1, 8, 15     |
    | 9    | carretera | coche            | 1     | →       | 4,5       | 4, 14        |
    | 8    | carretera | camión           | 3     | ←       | 2,25      | 3, 13        |
    | 6    | río       | tortugas (grupo) | 3     | ←       | 2,25      | 0, 7, 14     |
    | 5    | río       | tronco           | 3     | →       | 1,5       | 0, 7, 14     |
    | 4    | río       | tronco           | 4     | →       | 3,0       | 1, 10        |
    | 3    | río       | tortugas (grupo) | 2     | ←       | 2,25      | 0, 5, 10, 15 |
    | 2    | río       | tronco           | 2     | →       | 2,25      | 2, 8, 14     |
    | 1    | río       | tronco           | 4     | ←       | 1,5       | 0, 9         |

  - **Dificultad:** velocidad real = base × `speedFactor(level) = min(2,5; 1 + 0,15 × (level − 1))`, es decir, +15 % por nivel hasta ×2,5 (nivel 11).
  - **Tortugas:** cada grupo alterna 3 s visible y 1,5 s sumergido (`TURTLE_UP = 3`, `TURTLE_DOWN = 1.5`), con un desfase de 1,5 s × índice del grupo en su carril. El ciclo corre con el tiempo de partida y se congela en pausa. Sumergidas no sostienen a la rana.
  - **Soporte en el río:** sin salto en curso, la rana se sostiene si el centro de su casilla (`col + 0,5`) cae dentro de un tronco o de un grupo de tortugas visible del mismo carril. En ese caso se desplaza con él (`col += vel × sentido × dt`).
  - **Muerte** (pasa al estado `dead`):
    - (a) un vehículo toca la rana: su caja `[col + 0,15; col + 0,85]` se solapa con `[x; x + ancho)` en la misma fila;
    - (b) cae al agua: está en el río sin soporte;
    - (c) se sumergen las tortugas que la sostienen (es el caso b);
    - (d) el arrastre la saca del tablero (col < 0 o col > 15);
    - (e) se agota el temporizador;
    - (f) aterriza en la fila 0 fuera de un nenúfar libre (orilla o nenúfar ocupado).

    Los choques y el soporte se comprueban en cada frame sin salto en curso y al aterrizar.

  - **Temporizador por viaje:** `tripTime(level) = max(8; 15 − (level − 1))` s. Se reinicia cada vez que la rana vuelve a la salida (al morir, al llegar a un nenúfar y al completar la ronda). Corre solo en `step`.
  - **Nenúfares:** aterrizar en la fila 0 con el centro de la rana en un nenúfar libre lo ocupa y la rana vuelve a la salida. Un nenúfar ocupado no se puede volver a usar en la misma ronda.
  - **Ronda:** con los 5 nenúfares ocupados, la ronda se completa: +200 puntos, `level + 1`, los nenúfares se vacían, se reconstruyen los carriles con la nueva velocidad y se reinicia el temporizador.
  - **Puntuación** (entera, acotada a `MAX_SCORE`):
    - +10 por cada fila nueva alcanzada hacia arriba en el viaje actual (filas 12 a 1; se reinicia con cada viaje);
    - +50 al ocupar un nenúfar, más `floor(tiempo restante) × 10`;
    - +200 al completar la ronda.
  - **Vidas:** empieza con 3 (`START_LIVES`). Cada muerte resta 1. El estado `dead` dura 0,8 s (`DEATH_TIME`) con la rana marcada en el sitio del choque. Después, si quedan vidas, la rana vuelve a la salida; si no, `gameover`. La pulsación pendiente se descarta al morir.
  - Contadores para el HUD y el modal: `lives`, `level`, `lilies` (nenúfares ocupados en total).
  - `dt` limitado a 50 ms (`MAX_DT = 0.05`).
  - `s.time` (segundos de partida) para tortugas y animaciones. `core.ts` no usa `performance`.
- Dibujo en `games/ranaria/render.ts`, solo con primitivas de canvas (sin imágenes) y la paleta neón de la plataforma:
  - **Zonas:**
    - carretera de asfalto muy oscuro con líneas discontinuas tenues entre carriles;
    - río azul oscuro con ondas tenues;
    - mediana y salida verde oscuro;
    - orilla superior verde oscuro con los nenúfares como discos verdes con muesca y borde amarillo (`--yellow`).
  - **Vehículos:** coches en rectángulos redondeados de color por carril (magenta, cyan, amarillo) con ruedas; camiones con cabina diferenciada.
  - **Río:** troncos marrones con vetas; tortugas en cúpulas verdes con dibujo de caparazón. En los últimos 0,5 s antes de sumergirse parpadean, y sumergidas se ven como contorno semitransparente.
  - **Rana:** verde brillante (`--green`) con glow, elipse con ojos orientados según el último salto y patas extendidas durante el salto. En un nenúfar ocupado se dibuja una rana pequeña. Al morir se marca en magenta.
  - **Barra de tiempo:** franja de 6 px en el borde superior de la fila 0, con ancho proporcional al tiempo restante; verde, amarillo por debajo del 50 % y magenta por debajo del 25 %.
  - El canvas no dibuja puntuación, vidas ni nivel: van en el HUD.
- Client Component `games/ranaria/ranaria-game.tsx`:
  - HUD de la plataforma: Jugador, Puntuación, Vidas (`♥`), Nivel (dos dígitos) y botones PAUSA / FIN / SALIR.
  - Marco CRT con `<canvas>` de 640×560, escalado por CSS en proporción 8:7 (`--crt-ar: 8/7`).
  - Lista de controles visible bajo el canvas.
  - Bucle `requestAnimationFrame` con el estado del juego en refs.
  - Teclado: flechas o W A S D saltan (una vez por pulsación, ignorando `ev.repeat`), P / Esc pausa. `preventDefault` en las flechas y en Espacio.
- Pantalla de inicio "¿JUGAMOS?" con JUGAR (también Enter).
- Menú de pausa (P / Esc o PAUSA): Reanudar, Reiniciar y Ver controles / Volver.
  - Con el menú abierto el juego no recibe teclas, y las que sigan pulsadas al reanudar se ignoran hasta soltarlas.
  - Al pausar se descarta el salto pendiente.
  - Perder el foco con partida en curso abre la pausa.
- Fin de partida con `GameOverModal` (`ranked`) y `onRestart` que empieza una partida nueva. Se llega al perder la última vida o al pulsar FIN. `extra`:
  - Nivel: el alcanzado, con dos dígitos.
  - Nenúfares: el total ocupado.
- Guardado en Supabase por la vía existente (`submitScore` → `submit_score`). El ranking aparece en `/juegos/ranaria` y `/salon?juego=ranaria`.
- Estilos en `games/ranaria/ranaria.css`, con todas las reglas bajo `.ranaria-root`, y bloque móvil según SPEC 11.
- Skins (§7 de `integracion.md`): Clásico (por defecto), Neón y Retro, con la preferencia `av_ranaria_skin`, selector y contraste verificado en oscuro. Los hace el agente `skin-designer` en la fase 5 de `/spec-impl-game`.
- Controles táctiles con `TouchControls` (SPEC 12, fase 6 de `/spec-impl-game`), con este mapeo:

  | ↑                        | ↓                       | ← / →                         | A                  | B                  |
  | ------------------------ | ----------------------- | ----------------------------- | ------------------ | ------------------ |
  | saltar arriba (un toque) | saltar abajo (un toque) | saltar a los lados (un toque) | sin uso (atenuado) | sin uso (atenuado) |

- Ajustar el texto `long` de `ranaria` en `lib/games.ts`. Propuesta: "Salta entre carriles de coches y camiones a toda velocidad y cruza el río sobre troncos y tortugas que se sumergen. Llena los cinco nenúfares antes de que se acabe el tiempo: cada ronda acelera el tráfico."

**Fuera de alcance (para futuros specs):**

- Sprites o imágenes externas.
- Animaciones de muerte elaboradas (explosiones, partículas).
- Bonus en los nenúfares (insectos), cocodrilos, serpientes u otros enemigos del género.
- Gestos táctiles (swipe, tocar el canvas).
- Sonido y música.
- Guardar el nivel o los nenúfares en Supabase.
- Otros juegos del catálogo.
- Tests automatizados (no hay test runner configurado).

---

## Modelo de datos

```text
games/
  index.ts              # + ranaria: RanariaGame
  ranaria/
    core.ts             # lógica pura, sin DOM, React ni localStorage
    render.ts           # dibujo en canvas a partir de RanariaState
    ranaria-game.tsx    # "use client": canvas, bucle, entrada, HUD, inicio, pausa, fin
    ranaria.css         # estilos del área del juego, bajo .ranaria-root
    skins.ts, prefs.ts  # fase 5 (skin-designer)
```

```ts
// games/ranaria/core.ts
export const COLS = 16;
export const ROWS = 14;
export const CELL = 40; // px
export const W = COLS * CELL; // 640
export const H = ROWS * CELL; // 560
export const MAX_DT = 0.05;
export const ROW_GOALS = 0;
export const ROW_RIVER_TOP = 1;
export const ROW_RIVER_BOT = 6;
export const ROW_SAFE_MID = 7;
export const ROW_ROAD_TOP = 8;
export const ROW_ROAD_BOT = 12;
export const ROW_START = 13;
export const START_COL = 7;
export const LILY_COLS = [1, 4, 7, 10, 13] as const; // cada nenúfar ocupa col y col + 1
export const LANE_SPAN = 20; // casillas por ciclo de carril
export const JUMP_TIME = 0.12; // s
export const DEATH_TIME = 0.8; // s
export const START_LIVES = 3;
export const TURTLE_UP = 3; // s visibles
export const TURTLE_DOWN = 1.5; // s sumergidas
export const ROW_POINTS = 10;
export const LILY_POINTS = 50;
export const TIME_POINTS = 10; // × segundo restante
export const ROUND_POINTS = 200;

export type Dir = "up" | "down" | "left" | "right";
export type EntityKind = "car" | "truck" | "log" | "turtle";
export type EngineState = "playing" | "dead" | "gameover";

export type Entity = {
  x: number;
  width: number;
  kind: EntityKind;
  phase: number;
}; // phase: desfase del ciclo de inmersión
export type Lane = {
  row: number;
  dir: 1 | -1;
  speed: number;
  entities: Entity[];
}; // speed en casillas/s, ya escalada

export type Frog = {
  col: number; // decimal en el río
  row: number;
  facing: Dir;
  jump: {
    fromCol: number;
    fromRow: number;
    toCol: number;
    toRow: number;
    t: number;
  } | null;
  pending: Dir | null;
};

export type RanariaState = {
  frog: Frog;
  lanes: Lane[];
  lilies: boolean[]; // 5
  bestRow: number; // fila más alta alcanzada en el viaje
  timeLeft: number;
  deadTimer: number;
  deathAt: { col: number; row: number } | null;
  time: number;
  score: number;
  lives: number;
  level: number;
  liliesTotal: number;
  state: EngineState;
  rng: () => number; // inyectable; la UI pasa Math.random
};

export type RanariaInput = { jumps: Dir[] }; // pulsaciones desde el último frame

export function speedFactor(level: number): number;
export function tripTime(level: number): number;
export function buildLanes(level: number, rng: () => number): Lane[];
export function isSubmerged(e: Entity, time: number): boolean;
export function createState(rng: () => number): RanariaState;
export function step(s: RanariaState, dt: number, input: RanariaInput): void; // muta s
```

```ts
// games/ranaria/render.ts
export function drawFrame(ctx: CanvasRenderingContext2D, s: RanariaState): void; // usa s.time
```

```ts
// games/ranaria/ranaria-game.tsx — estado visible en React; el del bucle en refs
type Phase = "start" | "playing" | "paused" | "over";
type PauseView = "main" | "controls";
type RunStats = { score: number; lives: number; level: number; lilies: number };
```

Convenciones (las de SPEC 05/06, detalladas en `.claude/skills/nuevo-juego/integracion.md`):

- `core.ts` no importa React ni usa `window`, `document`, `performance`, `localStorage` ni `Math.random`.
- Coordenadas de casilla con origen arriba a la izquierda; tiempos en segundos; velocidades en casillas/s.
- `EngineState` es del motor; `Phase` es de la UI. `playing` y `dead` del motor van dentro de la fase `playing`; `gameover` lleva la UI a `over`.
- La partida en curso no se persiste. La única clave es `av_ranaria_skin` (fase 5).
- `setState` solo cuando cambian los datos del HUD o la fase.

---

## Plan de implementación

Seguir `.claude/skills/nuevo-juego/integracion.md` y partir de `.claude/skills/nuevo-juego/scaffold/`. Usar `/frontend-design` para la UI, con `games/rocas/` como referencia de integración y `games/serpentina/` como referencia de juego por casillas.

1. **Catálogo.** Ajustar el texto `long` de `ranaria` en `lib/games.ts`. Verificar: `/juegos/ranaria` muestra el texto nuevo.
2. **Lógica pura.** Crear `games/ranaria/core.ts` desde `scaffold/core.ts.tpl` con los tipos, constantes y reglas del modelo de datos: carriles, salto, soporte, choques, nenúfares, temporizador, rondas, vidas y puntos. Verificar: `npm run build` pasa, y un script contra `core.ts` comprueba que cada carril tiene al menos 2 entidades con huecos de al menos 1 casilla.
3. **Dibujo.** Crear `games/ranaria/render.ts` con `drawFrame`. Verificar: `npm run build` pasa.
4. **Componente jugable.** Crear `games/ranaria/ranaria-game.tsx` desde `scaffold/game.tsx.tpl`, con HUD, CRT, canvas, bucle y teclado. Registrar `ranaria: RanariaGame` en `games/index.ts`. Verificar: `/juegos/ranaria/jugar` arranca una partida jugable con teclado.
5. **Inicio, pausa y fin.** Overlay "¿JUGAMOS?", menú de pausa, pausa por foco y `GameOverModal` con `ranked` y `extra`. Verificar: todos los botones del menú y del modal funcionan.
6. **Estilos.** Crear `games/ranaria/ranaria.css` desde `scaffold/game.css.tpl`, con `--crt-ar: 8/7` y bloque móvil. Revisar a 1440×900, 390×844, 360×740 y 844×390. Verificar: el canvas cabe con el HUD sin scroll horizontal.
7. **Ranking y cierre.** Guardar una partida de prueba, comprobarla con `execute_sql` y en la ficha y el Salón, y borrar las filas de prueba tras confirmarlo. Verificar: `npm run lint` y `npm run build` pasan.

Después, `/spec-impl-game` añade la fase 5 (skins, agente `skin-designer`) y la fase 6 (controles táctiles con el mapeo de la tabla).

---

## Criterios de aceptación

- [x] `npm run lint` termina sin errores.
- [x] `npm run build` termina sin errores y `/juegos/[id]/jugar` mantiene el mismo tipo de ruta.
- [x] Existen `games/ranaria/{core.ts,render.ts,ranaria-game.tsx,ranaria.css}` y `games/index.ts` tiene la entrada `ranaria`.
- [x] `games/ranaria/core.ts` no importa `react` ni usa `window`, `document`, `performance`, `localStorage` ni `Math.random`.
- [x] `/juegos/ranaria/jugar` muestra "¿JUGAMOS?"; JUGAR o Enter empiezan la partida.
- [x] El canvas tiene `width=640` y `height=560` y mantiene la proporción 8:7 a 1440 px y 390 px sin scroll horizontal. Canvas de 594×520 a 1440×900 y de 338×296 a 390×844; también 308×270 a 360×740 y 409×358 a 844×390.
- [x] Se distinguen la carretera, el río, la mediana, la salida y la orilla con 5 nenúfares.
- [x] La rana empieza en la fila 13, columna 7.
- [x] Cada pulsación de dirección salta exactamente una casilla con una animación de 120 ms; mantener la tecla no encadena saltos. Salto completo en 128 ms con frames de 16 ms (script contra `core.ts`); mantener ↑ o el D-pad 2,5 s da un solo salto.
- [x] La rana no sale por los bordes laterales ni por debajo de la salida.
- [x] Coches, camiones, troncos y tortugas se mueven en bucle por sus carriles y vuelven a entrar por el lado contrario.
- [x] Las tortugas alternan 3 s visibles y 1,5 s sumergidas, y avisan parpadeando antes de sumergirse. Ciclo comprobado con `isSubmerged()` en un script; parpadeo y contorno sumergido vistos en una captura del canvas.
- [x] Sobre un tronco o unas tortugas visibles, la rana se desplaza con ellos.
- [x] La rana muere al tocar un vehículo, al caer al agua, al sumergirse las tortugas que la sostienen, al ser arrastrada fuera del tablero, al agotarse el tiempo y al aterrizar en la orilla o en un nenúfar ocupado. Los seis casos, con un script contra `core.ts`.
- [x] Al morir se pierde una vida y, tras 0,8 s, la rana vuelve a la salida con el temporizador lleno.
- [x] Avanzar a una fila nueva del viaje suma 10; ocupar un nenúfar libre suma 50 + 10 × segundos restantes y lo marca con una rana. Con 9,7 s restantes suma 50 + 90 = 140; la rana pequeña del nenúfar se ve en la captura del canvas.
- [x] Al ocupar los 5 nenúfares se suman 200, sube el nivel, los nenúfares se vacían y el tráfico va más rápido. Nivel 2: todas las velocidades ×1,15 y viaje de 14 s.
- [x] El tiempo por viaje es de 15 s en el nivel 1 y baja 1 s por nivel hasta 8 s. Comprobado con `tripTime()` en un script.
- [x] Pulsar las teclas del juego no hace scroll de la página.
- [x] El HUD muestra Jugador, Puntuación, Vidas y Nivel; el canvas no los duplica y dibuja la barra de tiempo.
- [x] P, Esc y el botón PAUSA abren el menú de pausa y el juego se congela, incluidos el temporizador y las tortugas. `s.time` y `timeLeft` no cambian en 1 s de pausa.
- [x] Con el menú abierto las teclas no afectan al juego; al reanudar con una tecla pulsada, no actúa hasta soltarla.
- [x] "Ver controles" muestra la lista y "Volver" regresa al menú.
- [x] "Reiniciar" empieza una partida nueva con puntuación 0 y 3 vidas.
- [x] Cambiar a otra pestaña durante la partida la deja en pausa. Comprobado con `blur` de la ventana y con `visibilitychange` con la página oculta.
- [x] Perder la última vida abre "FIN DEL JUEGO" con la puntuación final, Nivel y Nenúfares.
- [x] El botón FIN termina la partida y abre el mismo modal con la puntuación actual.
- [x] "GUARDAR PUNTUACIÓN" muestra "GUARDANDO…" y después "PUESTO #N" con el top 10 y la fila del jugador resaltada. Prueba con `TEST` / 0 → «PUESTO #1».
- [x] La fila guardada está en `public.scores` con `game_id = 'ranaria'` y aparece en `/juegos/ranaria` y `/salon?juego=ranaria` tras recargar. La fila de prueba se borró después, con confirmación del usuario.
- [x] "JUGAR DE NUEVO" empieza una partida nueva con puntuación 0.
- [x] Salir con SALIR durante una partida y volver la deja en pausa, sin bucles ni listeners duplicados.
- [x] El selector cambia entre Clásico, Neón y Retro (Clásico por defecto), y el skin persiste en `av_ranaria_skin` (fase 5). Agente `skin-designer`; el cambio guarda `av_ranaria_skin` y pone `data-skin`.
- [x] Con emulación táctil, el D-pad hace un salto por toque en cada dirección y A / B se ven atenuados (fase 6). Emulación de Playwright (`hasTouch` + `isMobile`) a 390×844, 360×740 y 844×390. En 844×390 el D-pad queda entero en pantalla al desplazar 69 px, igual que en SERPENTINA (layout compartido). *Sin probar en un móvil real.*
- [x] Los demás juegos jugables siguen igual, y un juego simulado sigue mostrando "MODO DEMO". CAÍDA, ROCAS, BLOQUE BUSTER, SERPENTINA y DUELO PIXEL responden 200 con «¿JUGAMOS?»; `gloton` muestra «MODO DEMO · ESTA PARTIDA NO PUNTÚA» al terminar con FIN.
- [x] La consola no muestra errores ni avisos de hidratación en `/juegos/ranaria/jugar`.
- [x] El nombre del arcade comercial del género no aparece en ningún texto visible.

---

## Decisiones

- **Sí:** el juego ocupa la entrada existente `ranaria` del catálogo, con su nombre, portada (`cover-rana`), color y ficha. No se usa el id `frogger` del borrador ni su nombre: el juego tiene identidad propia.
- **Sí:** se mantienen las reglas del borrador de la game jam (rejilla de 16×14 casillas de 40 px, salto de 120 ms, 3 vidas, 5 metas, tortugas 3 s / 1,5 s, +15 % de velocidad por nivel, 15 s de temporizador y la tabla de puntos).
- **Sí:** se adopta la disposición de filas de las constantes del borrador (metas en la fila 0, río en 1–6, mediana en 7, carretera en 8–12, salida en 13) y el canvas de 640×560. El borrador también decía 480×640 y metas en la fila 1; se descartan.
- **No:** tabla `games`, `app/games/frogger/play/page.tsx`, `dynamic(..., { ssr: false })`, INSERT directo y la clave `av_player_name`. El repo usa `lib/games.ts`, `/juegos/[id]/jugar` con `getPlayable`, `submitScore` como única vía de escritura y la sesión de `useSession()`.
- **No:** HUD duplicado en el canvas. `integracion.md` dice que el canvas no dibuja lo que muestra el HUD; solo queda la barra de tiempo, que no está en el HUD.
- **Sí:** el temporizador y los puntos por fila son **por viaje** (se reinician cada vez que la rana vuelve a la salida). Con 15 s para llenar los 5 nenúfares la ronda sería imposible, y los puntos por fila solo valdrían en el primer viaje.
- **Sí:** el incremento de velocidad es lineal (+15 % del valor base por nivel) con tope ×2,5. Con un crecimiento compuesto y sin tope, el juego se volvería injugable hacia el nivel 10.
- **Sí:** velocidades en casillas/s y tiempos en segundos (convención del repo), equivalentes a los px/frame del borrador a 60 Hz.
- **Sí:** la rana tiene `col` decimal para el arrastre del río, y se redondea al aterrizar fuera del río. Así los choques en carretera siguen siendo por casilla.
- **Sí:** caja de choque de la rana en la carretera de 0,7 casillas centrada; soporte en el río por el centro de la rana. Evita muertes por roce.
- **Sí:** un salto pendiente como máximo, que se descarta al morir y al pausar.
- **Sí:** estado `dead` de 0,8 s con la rana marcada antes de reaparecer. Sin él, la muerte sería ilegible; no es una animación elaborada.
- **Sí:** desfase aleatorio de los carriles en cada ronda (`s.rng`) y parpadeo de aviso de las tortugas. Dan variedad entre rondas y hacen justa la inmersión.
- **Sí:** modal de la plataforma con `ranked` y `extra` = Nivel y Nenúfares; guarda con `submitScore`.
- **No:** migración de Supabase. `scores` es común a todos los juegos.
- **No:** récords locales del juego. Duplicaría el ranking.
- **Sí:** skins y controles táctiles dentro de este spec (SPEC 11/12 y §7 de `integracion.md`). El borrador los dejaba fuera, pero hoy son obligatorios para todo juego jugable.
- **Sí:** D-pad de un toque por salto y A / B deshabilitados. Un salto por pulsación es la mecánica central.
- **Sí:** el salto pendiente también se descarta al llegar a un nenúfar, porque empieza un viaje nuevo desde la salida (decidido durante la implementación).
- **Sí:** `deathAt` se conserva al pasar a `gameover`, para que el último frame muestre dónde murió la rana (decidido durante la implementación).
- **Sí:** la barra inferior del CRT muestra `NIVEL NN`, como los demás juegos. «NENÚFARES NN» se montaba con los otros textos con el CRT estrecho, y los nenúfares ya salen en el modal (decidido durante la implementación).
- **Sí:** acento verde (`--green`, color del catálogo y de la rana) en los overlays, el foco y las teclas, en lugar del cyan de la plantilla (decidido durante la implementación).

---

## Riesgos

| Riesgo                                                               | Mitigación                                                                                              |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Bucles o listeners duplicados al navegar (`<Activity>`, Strict Mode) | Estado del bucle en refs; toda limpieza cancela el frame y quita listeners; criterio de salir y volver. |
| Salto de `dt` al reanudar o volver a la ruta                         | Reiniciar el último timestamp al arrancar el bucle; `dt` limitado a 50 ms.                              |
| Espacio activa el botón enfocado                                     | `preventDefault` en las teclas del juego y `blur()` de los botones tras el clic.                        |
| Puntuación no entera y el guardado falla                             | `floor` del tiempo restante; puntos enteros en `core.ts`.                                               |
| Entidades que aparecen de golpe al envolver el carril                | `LANE_SPAN` (20) mayor que `COLS` + ancho máximo (4): la vuelta ocurre fuera de la vista.               |
| Muertes injustas al sumergirse las tortugas sin aviso                | Parpadeo en los últimos 0,5 s visibles y desfase entre grupos.                                          |
| Canvas 8:7 con controles táctiles en vertical                        | `--crt-ar: 8/7` y el layout compartido de SPEC 11/12; revisar a 360×740.                                |
| El CSS del juego afecta a otras páginas                              | Todas las reglas bajo `.ranaria-root`.                                                                  |

---

## Lo que **no** está en este spec

- Sprites o imágenes.
- Animaciones de muerte elaboradas.
- Bonus, cocodrilos y otros enemigos.
- Gestos táctiles.
- Sonido.
- Datos extra de la partida en Supabase.
- Tests automatizados.

Cada uno de esos, si llega, va en su propio spec.
