# SPEC NN — Juego real: COLMENA (diseño original del género disparo de colores)

> **Estado:** Borrador
> **Depende de:** SPEC 05, SPEC 06, SPEC 07
> **Fecha:** 2026-11-07
> **Objetivo:** Hacer jugable `/juegos/colmena/jugar` con un juego original del género disparo de colores, alojado en `games/colmena/`, con el HUD, la pausa y el modal de fin de partida de la plataforma, y su puntuación en el ranking de Supabase.

---

## Por qué existe este spec

El catálogo no tiene este juego. Sería el segundo `PUZZLE` después de CAÍDA, y usa el magenta, el color menos repetido del catálogo.
Nace de la jam "Invasores" (`specs/game-jam/invasores/`), que interpreta la invasión como un rompecabezas: una colmena de invasores de colores cuelga del techo y crece hacia abajo.

- **Mecánica:** tu cañón dispara invasores de color hacia arriba, por columnas; tres o más del mismo color conectados revientan.
- **Giro propio:** la colmena **se alimenta de tus fallos**. Cinco disparos seguidos sin reventar nada añaden una fila de golpe.
- **Rejilla cuadrada y disparo vertical,** sin rebotes ni ángulos: se juega cómodo con teclado.

SPEC 05 y 06 fijaron la convención `games/<id>/` y el registro `games/index.ts`; SPEC 07 conectó el modal a Supabase. Al registrar `colmena` en `PLAYABLE`, el juego entra en el ranking sin migraciones.
El nombre visible es "COLMENA"; ningún nombre de un juego comercial aparece en la UI.

---

## Alcance

**Dentro:**

- Carpeta `games/colmena/` y entrada `colmena: ColmenaGame` en `PLAYABLE` de `games/index.ts`.
- Entrada nueva `colmena` en `GAMES` de `lib/games.ts`, tras `caida`:
  - `title`: "COLMENA"
  - `short`: "Revienta la colmena antes de que toque el suelo."
  - `long`: "Una colmena de invasores de colores desciende fila a fila desde el techo. Dispara tu cañón en vertical, junta tres o más del mismo color para reventarlos y deja caer los que se quedan colgando. Cuidado: cada cinco fallos seguidos la colmena crece de golpe."
  - `cat`: `"PUZZLE"`
  - `cover`: `"cover-colmena"`
  - `color`: `"magenta"`
  - `best`: `0`
  - `plays`: `"0"`
- Clase `cover-colmena` en `app/globals.css`, junto a las demás `cover-*`:
  - fondo `linear-gradient(180deg, #2a0030, #0a0a18)`;
  - en `::after`, tres filas de círculos de 10 px colgando de arriba (magenta, cyan, amarillo y verde alternos, con `radial-gradient`) y un cañón cyan pequeño abajo en el centro;
  - `drop-shadow` magenta.
- Lógica pura en `games/colmena/core.ts`, por casillas y con reglas originales:
  - **Tablero:** 9 columnas × 15 filas de 40 px (zona de colmena de 360×600). Debajo, una franja de 40 px para el cañón. Campo lógico de 360×640.
    - Coordenadas de casilla `(col, row)`, origen arriba a la izquierda.
    - La fila 0 es el techo.
  - **Colores:** índices 0–3 → cyan, magenta, amarillo y verde. `numColors(level) = level < 3 ? 3 : 4`.
  - **Estado inicial:**
    - Filas 0–4 llenas (45 invasores), nivel 1 y cañón en la columna 4.
    - Se rellenan fila a fila, de izquierda a derecha, eligiendo al azar (`s.rng`) un color que **no** forme un grupo de 3 o más con sus vecinos ya colocados. Con 3 colores y como mucho 2 vecinos ya colocados siempre hay alguno válido.
    - El tablero inicial no tiene ninguna explosión gratis.
  - **Conectividad:** 4 vecinos (arriba, abajo, izquierda, derecha).
  - **Cañón:** se mueve una columna por pulsación con ← → o A D, dentro de 0–8.
    - Si se mantiene la tecla, repite tras 0,18 s (`MOVE_DELAY`) cada 0,08 s (`MOVE_REPEAT`).
    - Lleva un color **cargado** y otro de **reserva**. X los intercambia (una vez por pulsación).
  - **Disparo:** Espacio dispara el color cargado por su columna (una vez por pulsación).
    - Solo hay un disparo en vuelo a la vez; una pulsación con un disparo en vuelo se descarta.
    - El proyectil sube desde y = 600 a 1200 px/s (`SHOT_SPEED`, 30 casillas/s).
    - Se queda en la casilla de debajo del invasor más bajo de su columna, o en la fila 0 si la columna está vacía. Se comprueba cada frame contra el estado actual, porque la colmena puede bajar con el proyectil en vuelo.
    - Tras disparar, el cargado pasa a ser el de reserva y entra una reserva nueva.
  - **Colores que salen:** cada color nuevo (cargado o reserva) se elige al azar entre los colores **presentes** en el tablero. Si el tablero está vacío, se elige entre `numColors(level)`.
  - **Resolución de un disparo**, en este orden:
    1. **Explosión:** relleno por inundación desde la casilla colocada con su color. Si el grupo tiene `n ≥ 3`, se eliminan todos y se suma `10 × n × max(1, n − 2) × level`, con el nivel anterior al disparo. Por ejemplo, 3 → 30, 4 → 80 y 5 → 150, × nivel. `biggest = max(biggest, n)`.
    2. **Caída:** tras una explosión, los invasores que ya no están conectados al techo (con cualquier color) caen y se eliminan. Cada uno suma `30 × level` (`DROP_POINTS`).
    3. **Fallos:** si no hubo explosión, `missStreak += 1`; si la hubo, `missStreak = 0`. Al llegar a 5 (`MISS_LIMIT`) se empuja una fila de inmediato y `missStreak` vuelve a 0.
    4. **Colmena limpia:** si el tablero queda vacío, se suma `1000 × level` (`CLEAR_BONUS`) y se generan 5 filas nuevas sin grupos, como al empezar.
    5. **Nivel:** `level = 1 + floor(removed / 30)`, donde `removed` cuenta los eliminados por explosión y por caída.
    6. **Peligro:** si hay algún invasor en la fila 14 (`DANGER_ROW`), `gameover`.
  - **Empuje por tiempo:**
    - Cada `pushInterval(level) = max(3; 9 − 0,5 × (level − 1))` s, toda la colmena baja una fila y entra una fila nueva en la fila 0. Son 9 s en el nivel 1, y el mínimo de 3 s se alcanza en el nivel 13.
    - La fila nueva se genera con el mismo algoritmo sin grupos, con `numColors(level)` colores y teniendo en cuenta la fila de debajo.
    - El temporizador (`pushTimer`) se reinicia al empujar por tiempo. El empuje por fallos no lo toca.
    - Tras cualquier empuje se comprueba el peligro: si hay algún invasor en la fila 14, `gameover`.
  - **Fin:** no hay vidas. La partida termina cuando la colmena llega a la fila 14.
  - Contadores para el HUD y el modal: `level`, `removed`, `biggest`.
  - Puntuación entera, acotada a `MAX_SCORE` (99 999 999).
  - `dt` limitado a 50 ms (`MAX_DT = 0.05`).
  - `s.time` (segundos de partida) para las animaciones, y `s.pops` (efectos de explosión con 0,3 s de vida) solo para el dibujo. La lógica se resuelve en el instante.
- Dibujo en `games/colmena/render.ts`, neón vectorial con glow solo en lo principal:
  - Fondo oscuro con una rejilla de puntos tenue (`--ink-faint`).
  - Línea de peligro magenta discontinua en el borde superior de la fila 14. Parpadea si algún invasor está en la fila 13.
  - Invasores como celdas redondeadas de 34 px con su color (`--cyan`, `--magenta`, `--yellow`, `--green`), un "ojo" oscuro y un latido leve con `s.time`.
  - Explosiones (`pops`): anillos que se expanden y se apagan en 0,3 s, del color del grupo.
  - Cañón en la franja inferior: base cyan con el color cargado dentro y el de reserva en pequeño a su lado.
  - Proyectil: celda del color cargado con una estela corta.
  - Contador de fallos: 5 puntos bajo el tablero que se encienden en magenta con cada fallo seguido.
  - Barra fina sobre la franja del cañón que se vacía con el tiempo que queda para el próximo empuje.
  - El canvas no dibuja puntuación, nivel ni eliminados: van en el HUD.
- Client Component `games/colmena/colmena-game.tsx`:
  - HUD de la plataforma: Jugador, Puntuación, Nivel (dos dígitos, `pad2`) y Eliminados, y botones PAUSA / FIN / SALIR.
  - Marco CRT con `<canvas>` de 360×640, escalado por CSS en proporción 9:16.
  - Lista de controles visible bajo el canvas.
  - Bucle `requestAnimationFrame` con el estado del juego en refs.
  - Teclado:
    - ← → o A D mueven (pulsación y mantenido).
    - Espacio dispara (flag de una vez por pulsación, ignorando `ev.repeat`).
    - X intercambia (flag de una vez por pulsación).
    - P / Esc pausa.
    - `preventDefault` en las flechas y en Espacio.
- Pantalla de inicio "¿JUGAMOS?" con JUGAR (también Enter).
- Menú de pausa (P / Esc o PAUSA): Reanudar, Reiniciar y Ver controles / Volver.
  - Con el menú abierto el juego no recibe teclas, y las que sigan pulsadas al reanudar se ignoran hasta soltarlas.
  - Perder el foco con partida en curso abre la pausa.
- Fin de partida con `GameOverModal` (`ranked`) y `onRestart` que empieza una partida nueva. Se llega cuando la colmena alcanza la fila 14 o con el botón FIN. `extra`:
  - Nivel: el alcanzado, con dos dígitos.
  - Eliminados: `removed`.
  - Mayor explosión: `biggest`.
- Guardado en Supabase por la vía existente (`submitScore` → `submit_score`). El ranking aparece en `/juegos/colmena` y `/salon?juego=colmena`.
- Estilos en `games/colmena/colmena.css`, con todas las reglas bajo `.colmena-root`.

**Fuera de alcance (para futuros specs):**

- Disparo en ángulo, rebotes en las paredes y rejilla hexagonal.
- Invasores especiales (bombas, comodines, bloques fijos).
- Controles táctiles o gestos en móvil.
- Sonido y música.
- Preferencias en `localStorage` (nivel inicial, paleta para daltónicos).
- Guardar en Supabase el nivel, los eliminados o la mayor explosión.
- Otros juegos del catálogo (INVASORES y ASEDIO tienen sus propios specs en esta jam).
- Tests automatizados (no hay test runner configurado).

---

## Modelo de datos

```text
games/
  index.ts             # + colmena: ColmenaGame
  colmena/
    core.ts            # lógica pura, sin DOM, React ni localStorage
    render.ts          # dibujo en canvas a partir de ColmenaState
    colmena-game.tsx   # "use client": canvas, bucle, entrada, HUD, inicio, pausa, fin
    colmena.css        # estilos del área del juego, bajo .colmena-root
lib/games.ts           # + entrada colmena
app/globals.css        # + .cover-colmena
```

```ts
// games/colmena/core.ts
export const COLS = 9;
export const ROWS = 15;
export const CELL = 40; // px
export const BOARD_H = ROWS * CELL; // 600
export const W = COLS * CELL; // 360
export const H = BOARD_H + CELL; // 640 (franja del cañón)
export const MAX_DT = 0.05;

export const START_ROWS = 5;
export const START_COL = 4;
export const DANGER_ROW = 14;
export const MIN_GROUP = 3;

export const SHOT_SPEED = 1200; // px/s
export const MOVE_DELAY = 0.18; // s
export const MOVE_REPEAT = 0.08; // s

export const BASE_PUSH = 9; // s en el nivel 1
export const PUSH_DEC = 0.5; // s menos por nivel
export const MIN_PUSH = 3; // s
export const MISS_LIMIT = 5;

export const GROUP_POINTS = 10; // × n × max(1, n − 2) × nivel
export const DROP_POINTS = 30; // × nivel, por invasor caído
export const CLEAR_BONUS = 1000; // × nivel
export const REMOVED_PER_LEVEL = 30;
export const FOUR_COLORS_FROM = 3; // nivel
export const POP_TIME = 0.3; // s, solo dibujo

export type Color = 0 | 1 | 2 | 3; // cyan, magenta, amarillo, verde
export type Cell = { col: number; row: number };
export type Grid = (Color | null)[][]; // [row][col]
export type EngineState = "playing" | "gameover";

export type ColmenaState = {
  grid: Grid;
  cannonCol: number;
  current: Color;
  reserve: Color;
  shot: { col: number; y: number; color: Color } | null;
  moveDir: -1 | 0 | 1; // dirección mantenida
  moveTimer: number; // s hasta la siguiente repetición
  pushTimer: number; // s acumulados desde el último empuje por tiempo
  missStreak: number;
  removed: number;
  biggest: number;
  level: number;
  score: number;
  pops: { cell: Cell; color: Color; ttl: number }[];
  time: number; // s de partida
  state: EngineState;
  rng: () => number; // inyectable; la UI pasa Math.random
};

export type ColmenaInput = {
  left: boolean; // mantenida
  right: boolean; // mantenida
  leftPressed: boolean; // flanco de pulsación
  rightPressed: boolean; // flanco de pulsación
  fire: boolean; // una vez por pulsación
  swap: boolean; // una vez por pulsación
};

export function numColors(level: number): number;
export function pushInterval(level: number): number;
export function groupPoints(n: number, level: number): number;
export function lowestRow(grid: Grid, col: number): number; // −1 si la columna está vacía
export function floodGroup(grid: Grid, from: Cell): Cell[];
export function floating(grid: Grid): Cell[]; // no conectados al techo
export function createState(rng: () => number): ColmenaState;
export function step(s: ColmenaState, dt: number, input: ColmenaInput): void; // muta s
```

```ts
// games/colmena/render.ts
export function drawFrame(ctx: CanvasRenderingContext2D, s: ColmenaState): void; // usa s.time
```

```ts
// games/colmena/colmena-game.tsx — estado visible en React; el del bucle en refs
type Phase = "start" | "playing" | "paused" | "over";
type PauseView = "main" | "controls";
type RunStats = {
  score: number;
  level: number;
  removed: number;
  biggest: number;
};
```

Convenciones (las de SPEC 05/06, detalladas en `.claude/skills/nuevo-juego/integracion.md`):

- `core.ts` no importa React ni usa `window`, `document`, `performance`, `localStorage` ni `Math.random`.
- Coordenadas de casilla con origen arriba a la izquierda; velocidades en px/s; tiempos en segundos.
- `EngineState` es del motor; `Phase` es de la UI. `gameover` lleva la UI a `over`.
- La partida en curso no se persiste. Este juego no crea claves `av_colmena_*`.
- `setState` solo cuando cambian los datos del HUD o la fase.

---

## Plan de implementación

Seguir `.claude/skills/nuevo-juego/integracion.md` y partir de `.claude/skills/nuevo-juego/scaffold/`. Usar `/frontend-design` para la UI y la portada, con `games/rocas/` como referencia de integración y `games/caida/` como referencia de juego por casillas con repetición de movimiento.

1. **Catálogo.** Añadir la entrada `colmena` en `lib/games.ts` y la clase `cover-colmena` en `app/globals.css`. Verificar: `/biblioteca` muestra COLMENA con su portada en el filtro PUZZLE y `/juegos/colmena` muestra su ficha.
2. **Lógica pura.** Crear `games/colmena/core.ts` desde `scaffold/core.ts.tpl` con los tipos, constantes y reglas del modelo de datos: generación sin grupos, disparo, inundación, caída, fallos, empuje y niveles. Verificar: `npm run build` pasa.
3. **Dibujo.** Crear `games/colmena/render.ts` con `drawFrame`. Verificar: `npm run build` pasa.
4. **Componente jugable.** Crear `games/colmena/colmena-game.tsx` desde `scaffold/game.tsx.tpl`, con HUD, CRT, canvas, bucle y teclado. Registrar `colmena: ColmenaGame` en `games/index.ts`. Verificar: `/juegos/colmena/jugar` arranca una partida jugable con teclado.
5. **Inicio, pausa y fin.** Overlay "¿JUGAMOS?", menú de pausa, pausa por foco y `GameOverModal` con `ranked` y `extra`. Verificar: todos los botones del menú y del modal funcionan.
6. **Estilos.** Crear `games/colmena/colmena.css` desde `scaffold/game.css.tpl`. Revisar a 1440 px y 390 px. Verificar: el canvas cabe sin scroll horizontal.
7. **Ranking y cierre.** Guardar una partida de prueba, comprobarla con `execute_sql` y en la ficha y el Salón, y borrar las filas de prueba tras confirmarlo con el usuario. Verificar: `npm run lint` y `npm run build` pasan.

---

## Criterios de aceptación

- [ ] `npm run lint` termina sin errores.
- [ ] `npm run build` termina sin errores y `/juegos/[id]/jugar` mantiene el mismo tipo de ruta.
- [ ] Existen `games/colmena/{core.ts,render.ts,colmena-game.tsx,colmena.css}` y `games/index.ts` tiene la entrada `colmena`.
- [ ] `games/colmena/core.ts` no importa `react` ni usa `window`, `document`, `performance`, `localStorage` ni `Math.random`.
- [ ] `/biblioteca` muestra COLMENA (PUZZLE, magenta) con la portada `cover-colmena`, y `/juegos/colmena` muestra su ficha.
- [ ] `/juegos/colmena/jugar` muestra "¿JUGAMOS?"; JUGAR o Enter empiezan la partida.
- [ ] El canvas tiene `width=360` y `height=640` y mantiene la proporción 9:16 a 1440 px y 390 px sin scroll horizontal.
- [ ] Al empezar hay 5 filas llenas con 3 colores, ningún grupo de 3 o más del mismo color conectado, y el cañón en la columna central con un color cargado y otro de reserva.
- [ ] ← → y A D mueven el cañón una columna por pulsación; mantenidas, repiten tras una breve espera; el cañón no sale del tablero.
- [ ] X intercambia el color cargado y el de reserva.
- [ ] Espacio dispara una sola vez por pulsación; con un disparo en vuelo no sale otro.
- [ ] El disparo se queda bajo el invasor más bajo de su columna, o en el techo si la columna está vacía.
- [ ] Juntar 3 del mismo color los revienta y suma `30 × nivel`; 4 suman `80 × nivel` y 5 `150 × nivel`.
- [ ] Los invasores que quedan sin conexión con el techo caen y suman `30 × nivel` cada uno.
- [ ] Cinco disparos seguidos sin reventar nada encienden los 5 puntos de fallo y añaden una fila de inmediato; una explosión los apaga.
- [ ] Cada 9 s (nivel 1) la colmena baja una fila; el intervalo baja 0,5 s por nivel hasta 3 s.
- [ ] Cada 30 eliminados sube el nivel; desde el nivel 3 aparece el cuarto color (verde).
- [ ] Vaciar el tablero suma `1000 × nivel` y genera 5 filas nuevas.
- [ ] Un invasor en la fila 14 (tras un disparo o un empuje) termina la partida.
- [ ] Pulsar las teclas del juego no hace scroll de la página.
- [ ] El HUD muestra Jugador, Puntuación, Nivel y Eliminados; el canvas no los duplica.
- [ ] P, Esc y el botón PAUSA abren el menú de pausa y el juego se congela, incluido el temporizador de empuje.
- [ ] Con el menú abierto las teclas no afectan al juego; al reanudar con una tecla pulsada, no actúa hasta soltarla.
- [ ] "Ver controles" muestra la lista y "Volver" regresa al menú.
- [ ] "Reiniciar" empieza una partida nueva con puntuación 0.
- [ ] Cambiar a otra pestaña durante la partida la deja en pausa.
- [ ] El fin de partida abre "FIN DEL JUEGO" con la puntuación final, Nivel, Eliminados y Mayor explosión.
- [ ] El botón FIN termina la partida y abre el mismo modal con la puntuación actual.
- [ ] "GUARDAR PUNTUACIÓN" muestra "GUARDANDO…" y después "PUESTO #N" con el top 10 y la fila del jugador resaltada.
- [ ] La fila guardada está en `public.scores` con `game_id = 'colmena'` y aparece en `/juegos/colmena` y `/salon?juego=colmena` tras recargar.
- [ ] "JUGAR DE NUEVO" empieza una partida nueva con puntuación 0.
- [ ] El juego no escribe claves `av_colmena_*`.
- [ ] Salir con SALIR durante una partida y volver la deja en pausa, sin bucles ni listeners duplicados.
- [ ] `/juegos/caida/jugar`, `/juegos/rocas/jugar` y el resto de juegos jugables siguen igual, y un juego simulado sigue mostrando "MODO DEMO".
- [ ] La consola no muestra errores ni avisos de hidratación en `/juegos/colmena/jugar`.
- [ ] Ningún nombre de un juego comercial aparece en los textos visibles.

---

## Decisiones

- **Sí:** entrada nueva `colmena` en el catálogo (PUZZLE, magenta, `cover-colmena`). Da un segundo PUZZLE y usa el color menos repetido.
- **Sí:** `best: 0` y `plays: "0"` en la entrada. Es un juego nuevo y no se inventan estadísticas; "Mejor global" sale del ranking real.
- **Sí:** diseño original del género, implementado en TypeScript + React con `<canvas>`, con `core.ts` puro separado de `render.ts`.
- **No:** iframe ni JS vanilla montado vía refs.
- **Sí:** `rng` inyectable en el estado. Partidas reproducibles para depurar.
- **Sí:** el juego forma parte de la jam junto a INVASORES y ASEDIO. Decisión del usuario.
- **Sí:** rejilla cuadrada con 4 vecinos y disparo solo vertical. Evita la geometría de ángulos y rebotes, se juega bien con teclado y se aleja del aspecto de los clásicos del género.
- **Sí:** cinco fallos seguidos empujan una fila. Es el giro del tema (la colmena se alimenta de tus fallos) y premia la precisión en el ranking.
- **Sí:** el tablero inicial y las filas nuevas no tienen grupos. Sin explosiones gratis al empezar ni al empujar.
- **Sí:** los colores que salen se eligen entre los presentes en el tablero. Evita disparos imposibles de aprovechar al final de una limpieza.
- **Sí:** la resolución de un disparo (explosión y caída) va antes de comprobar el peligro. Un disparo que revienta un grupo junto a la línea salva la partida.
- **Sí:** puntos `10 × n × max(1, n − 2) × nivel` por grupo y `30 × nivel` por caído. Los grupos grandes y las caídas valen mucho más que limpiar de tres en tres.
- **Sí:** HUD con Nivel y Eliminados; modal con `extra` = Nivel, Eliminados y Mayor explosión.
- **Sí:** modal de la plataforma con `ranked`; guarda con `submitScore`, la única vía de escritura.
- **No:** migración de Supabase. `scores` es común a todos los juegos; los datos de `extra` no se guardan.
- **No:** récords locales del juego. Duplicaría el ranking.
- **Sí:** campo lógico fijo 360×640 escalado por CSS. La dificultad no depende de la pantalla.
- **No:** controles táctiles. Van en otro spec.

---

## Riesgos

| Riesgo                                                                | Mitigación                                                                                                             |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Bucles o listeners duplicados al navegar (`<Activity>`, Strict Mode)  | Estado del bucle en refs; toda limpieza cancela el frame y quita listeners; criterio de salir y volver.                |
| Salto de `dt` al reanudar o volver a la ruta                          | Reiniciar el último timestamp al arrancar el bucle; `dt` limitado a 50 ms.                                             |
| Espacio activa el botón enfocado                                      | `preventDefault` en las teclas del juego y `blur()` de los botones tras el clic.                                       |
| Puntuación no entera o fuera de rango y el guardado falla             | Puntos enteros en `core.ts`; `validateScore` y la RPC rechazan el resto.                                               |
| El canvas no cabe en pantallas bajas o estrechas                      | Escalado CSS con resolución fija; el marco se estrecha con `100svh`; revisar a 1440 px y 390 px.                       |
| El CSS del juego afecta a otras páginas                               | Todas las reglas bajo `.colmena-root`.                                                                                 |
| La colmena baja con el proyectil en vuelo y este atraviesa un invasor | La casilla de destino se recalcula cada frame con `lowestRow` del estado actual, no al disparar.                       |
| Con 3 colores la partida es demasiado fácil o con 4 demasiado dura    | Cuarto color solo desde el nivel 3 y colores tomados de los presentes; ajustar con partidas de prueba antes de cerrar. |
| Se confunde con un clon de un juego de burbujas comercial             | Rejilla cuadrada, disparo vertical sin rebotes, invasores en vez de burbujas y castigo por fallos propio.              |

---

## Lo que **no** está en este spec

- Disparo en ángulo, rebotes y rejilla hexagonal.
- Invasores especiales.
- Controles táctiles.
- Sonido.
- Preferencias en `localStorage`.
- Datos extra de la partida en Supabase.
- Tests automatizados.

Cada uno de esos, si llega, va en su propio spec.
