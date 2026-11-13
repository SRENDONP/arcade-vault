# SPEC NN — Juego real: REFLUJO (diseño original del género puzle de emparejar)

> **Estado:** Borrador
> **Depende de:** SPEC 05, SPEC 06, SPEC 07
> **Fecha:** 2026-11-13
> **Objetivo:** Hacer jugable `/juegos/reflujo/jugar` con un juego original de emparejar piezas contra una marea que sube, alojado en `games/reflujo/`, con el HUD, la pausa y el modal de fin de partida de la plataforma, y su puntuación en el ranking de Supabase.

---

## Por qué existe este spec

El catálogo no tiene este juego. Hoy hay un solo `PUZZLE` (CAÍDA, piezas que caen) y ninguno de emparejar por intercambio, así que falta una mecánica de puzle de decisión pausada, distinta de los juegos de reflejos.
El diseño nace del tema "Mareas": un tablero de piezas marinas de 8×10 casillas y un nivel de agua que sube a intervalos fijos. El jugador intercambia piezas vecinas para formar grupos de 3 o más; los grupos que alcanzan piezas **sumergidas** hacen retroceder el agua (el reflujo que da nombre al juego). Si la marea llega a la línea roja, la partida termina. El giro propio es que la marea no es un reloj de fondo: solo se vence emparejando contra el agua, y las piezas sumergidas no se pueden mover, solo "pescar" desde arriba.
SPEC 05 y 06 fijaron la convención `games/<id>/` y el registro `games/index.ts`; SPEC 07 conectó el modal a Supabase. Al registrar `reflujo` en `PLAYABLE`, el juego entra en el ranking sin migraciones.
El nombre visible es "REFLUJO". No recrea ningún juego comercial concreto: ni nombre, ni piezas, ni arte, ni reglas de un título existente.

---

## Alcance

**Dentro:**

- Carpeta `games/reflujo/` y entrada `reflujo: ReflujoGame` en `PLAYABLE` de `games/index.ts`.
- Entrada nueva `reflujo` en `GAMES` de `lib/games.ts`:
  - `title: "REFLUJO"`, `cat: "PUZZLE"`, `color: "cyan"`, `cover: "cover-reflujo"`, `best: 0`, `plays: "0"` (sin estadísticas inventadas).
  - `short: "Empareja piezas antes de que suba la marea."`
  - `long: "Una bahía de piezas marinas y una marea que no perdona. Intercambia piezas vecinas para formar grupos de tres o más; los grupos que tocan piezas sumergidas hacen retroceder el agua. Encadena cascadas para multiplicar los puntos y no dejes que el mar llegue a la línea roja."`
  - Clase `cover-reflujo` en `app/globals.css`: degradado vertical de azul noche a cian, tres líneas onduladas de agua (cian, con `::after`) y puntos de colores de las piezas, en la línea de `cover-bricks`.
- Lógica pura en `games/reflujo/core.ts`, con reglas originales:
  - **Tablero:** 8 columnas × 10 filas de casillas de 56 px (campo lógico 448×560). Casilla `(col, row)` con origen arriba a la izquierda. El tablero está siempre lleno.
  - **Piezas:** 5 tipos (`Kind` 0–4), cada uno con forma y color propios para no depender solo del color: 0 círculo cian, 1 rombo magenta, 2 triángulo amarillo, 3 cuadrado verde, 4 hexágono naranja. En los niveles 1–3 solo salen los tipos 0–3; desde el nivel 4, los cinco (`kindsForLevel(level) = level >= 4 ? 5 : 4`).
  - **Marea:** `s.tide` es un entero (filas cubiertas por abajo). Empieza en `START_TIDE = 2`. La fila `r` está **sumergida** si `r >= ROWS - s.tide`. Se pierde al llegar a `LOSE_TIDE = 8` (solo quedan 2 filas secas). `s.riseAcc` acumula segundos en reposo.
    - Sube 1 fila cada `riseTime(level) = max(3, 9 − 0,75 × (level − 1))` s: 9 s en el nivel 1, 3 s desde el nivel 9.
    - El reloj de la marea solo corre con el tablero en reposo (`wave === "idle"`): durante la resolución de un intercambio se detiene.
    - Para el dibujo, `tideFloat = s.tide + s.riseAcc / riseTime(level)`.
  - **Cursor:** ocupa una pareja de casillas, `{ col, row, vertical }`. Horizontal: `(col, row)` y `(col + 1, row)`; vertical: `(col, row)` y `(col, row + 1)`. Empieza en `col = 3, row = 4, vertical = false`.
    - Se mueve de casilla en casilla, una por pulsación; los límites son el tablero y la zona seca (`row + (vertical ? 1 : 0) <= ROWS - s.tide - 1`).
    - Si sube la marea y el cursor queda en agua, se desplaza hacia arriba (`row` mínimo necesario).
    - Puede moverse y girar en cualquier momento, incluso durante una resolución.
  - **Intercambio (acción A):** solo en `wave === "idle"`. Intercambia las dos piezas del cursor.
    - Si el intercambio no forma ningún grupo, se deshace, `s.shake = SHAKE_TIME` (0,2 s) y no hay castigo.
    - Si forma algún grupo, empieza la resolución con `s.chain = 1`.
    - Las piezas sumergidas no se pueden intercambiar: el cursor no entra en el agua.
  - **Girar cursor (acción B):** alterna horizontal ↔ vertical y, si el nuevo cursor se sale del tablero o del agua, se reubica en la casilla válida más cercana.
  - **Grupos:** línea de 3 o más piezas del mismo tipo en horizontal o vertical. Dos líneas que comparten una pieza forman un solo grupo (conexión ortogonal del mismo tipo entre líneas marcadas). Las piezas sumergidas cuentan para formar grupos.
  - **Resolución por olas** (`s.wave`): `"idle"` → `"clearing"` → `"settling"` → vuelve a `"idle"` o repite.
    1. Al marcar grupos (`marked[]`) se puntúan y se aplica el reflujo; `s.timer = CLEAR_TIME` (0,25 s) y `wave = "clearing"` (las piezas marcadas parpadean).
    2. Al agotarse el temporizador se retiran las piezas marcadas, las columnas caen (gravedad) y se rellenan arriba con piezas nuevas elegidas con `s.rng` entre `kindsForLevel(level)` tipos; `s.timer = SETTLE_TIME` (0,2 s) y `wave = "settling"`. El dibujo anima la caída con ese temporizador.
    3. Al agotarse, se buscan grupos nuevos. Si hay, `s.chain += 1` (máximo `MAX_CHAIN = 8` para la puntuación), se marcan y se vuelve a 1. Si no hay, `s.chain = 0`, `wave = "idle"` y se comprueba que exista algún movimiento (ver "Sin movimientos").
  - **Puntos por grupo**, `groupPoints(size) × min(chain, 8) × level`, con `groupPoints = 30` para 3 piezas, `80` para 4, `150` para 5 y `250` para 6 o más. Siempre entero.
  - **Reflujo:** al marcar un grupo que contiene al menos una pieza sumergida, `s.tide -= 1`; si el grupo tiene 4 o más piezas, `s.tide -= 2`. Mínimo `MIN_TIDE = 0`. Los grupos formados solo con piezas secas puntúan pero no bajan la marea. Tras bajar la marea, `s.riseAcc = 0`.
  - **Nivel:** `level = 1 + floor(groupsCleared / GROUPS_PER_LEVEL)` con `GROUPS_PER_LEVEL = 10`, sin tope (la marea se queda en 3 s desde el nivel 9; los tipos en 5 desde el nivel 4).
  - **Sin movimientos:** en reposo se comprueba que exista al menos un intercambio válido entre piezas secas (que forme un grupo). Si no existe, las piezas **secas** se barajan con `s.rng` (sin crear grupos hechos) hasta que haya movimiento, con un máximo de `SHUFFLE_TRIES = 50` intentos; si no se logra, la marea sube 1 fila como penalización y se vuelve a comprobar en el siguiente reposo.
  - **Tablero inicial:** relleno con `s.rng` sin ningún grupo hecho y con al menos un movimiento válido (se reintenta hasta conseguirlo, con el mismo máximo de intentos; el último intento se acepta).
  - **Fin:** `s.tide >= LOSE_TIDE` (al subir la marea o por la penalización) pasa a `gameover`. El botón FIN también lo fija.
  - Contadores para el HUD y el modal: `tide`, `level`, `groupsCleared`, `bestChain`.
  - Puntuación entera, acotada a `MAX_SCORE` de `lib/scores.ts`.
  - `dt` limitado a 50 ms (`MAX_DT = 0.05`). `s.time` (segundos de partida) para las animaciones; `core.ts` no usa `performance`.
- Dibujo en `games/reflujo/render.ts`, neón vectorial; los colores salen del skin:
  - Fondo oscuro con rejilla tenue de casillas.
  - Piezas: forma y color de su tipo (ver Piezas), con un hueco de 4 px a la casilla. Las sumergidas se dibujan atenuadas y desplazadas con un vaivén suave (`sin(time)` de 2 px).
  - Agua: rectángulo translúcido cian desde `H − tideFloat × CELL` hasta el fondo, con la línea de superficie ondulada (onda en función de `time`) y burbujas.
  - Línea de peligro: línea discontinua magenta en `y = (ROWS − LOSE_TIDE) × CELL` (112 px); parpadea si `tide >= LOSE_TIDE − 2`.
  - Cursor: dos corchetes amarillos que rodean la pareja (más gruesos con glow).
  - Intercambio rechazado: la pareja tiembla (`shake`) y el cursor se tiñe de magenta.
  - Piezas marcadas: parpadean en blanco mientras `wave === "clearing"`.
  - Cadenas: texto `x2`, `x3`… sobre el grupo (fuente pixel) mientras dure la ola.
  - El canvas no dibuja puntuación, nivel ni marea: van en el HUD.
- Client Component `games/reflujo/reflujo-game.tsx`:
  - HUD de la plataforma: Jugador, Puntuación, Nivel (dos dígitos), Marea (`tide/8`) y botones PAUSA / FIN / SALIR.
  - Marco CRT con `<canvas>` de 448×560, escalado por CSS en proporción 4:5 (`--crt-ar: 448/560`).
  - Lista de controles visible bajo el canvas.
  - Bucle `requestAnimationFrame` con el estado del juego en refs.
  - Teclado: ← → ↑ ↓ o A D W S mueven el cursor (una casilla por pulsación; mantener repite tras 170 ms cada 60 ms), Espacio o Enter intercambian, Z / X / Mayús giran el cursor, P / Esc pausa. `preventDefault` en flechas y Espacio.
  - Un solo `Enter` en `start` empieza la partida; en `playing` Enter intercambia, así que se ignora hasta soltarlo (mecanismo de `suppressedRef`).
- Pantalla de inicio "¿JUGAMOS?" con JUGAR (también Enter).
- Menú de pausa (P / Esc o PAUSA): Reanudar, Reiniciar y Ver controles / Volver. Con el menú abierto el juego no recibe teclas, y las que sigan pulsadas al reanudar se ignoran hasta soltarlas. Perder el foco con partida en curso abre la pausa.
- Fin de partida (marea en `LOSE_TIDE` o botón FIN) con `GameOverModal` (`ranked`) y `onRestart` que empieza una partida nueva. `extra`:
  - Nivel: el alcanzado, con dos dígitos.
  - Mejor cadena: `x{bestChain}` (`x0` si no hubo ninguna).
  - Grupos: grupos formados.
- Guardado en Supabase por la vía existente (`submitScore` → `submit_score`); el ranking aparece en `/juegos/reflujo` y `/salon?juego=reflujo`.
- Skins en `games/reflujo/skins.ts` (§7 de `integracion.md`), preferencia `av_reflujo_skin`, selector y contraste verificado en oscuro:
  - **Clásico (por defecto):** fondo `#0a0a1a`; piezas en cian `#00f0ff`, magenta `#ff2bd6`, amarillo `#ffe600`, verde `#39ff88` y naranja `#ff9d2e`; agua cian al 22 % con superficie cian; sin glow en las piezas.
  - **Neón:** fondo negro; mismos tonos más saturados con contorno blanco de 2 px y `shadowBlur` en las piezas y el cursor; agua con degradado cian → azul y glow en la superficie.
  - **Retro:** paleta limitada de 8 bits (cian `#2cc8d8`, magenta `#d83890`, amarillo `#d8c82c`, verde `#38b838`, naranja `#d87c2c`), sin glow, piezas con bordes duros de 2 px y agua con bloques escalonados.
  - La forma de cada pieza se mantiene en los tres skins; el contraste de cada tipo contra el fondo es ≥ 3:1 y el de los textos ≥ 4,5:1.
- Estilos en `games/reflujo/reflujo.css`, con todas las reglas bajo `.reflujo-root`, `--crt-ar: 448 / 560` y su bloque móvil (select de skin a `var(--tap-min)`, overlays).
- Controles táctiles con `TouchControls` (§ Controles táctiles de `integracion.md`), con este mapeo:

  | ↑                           | ↓                           | ← / →                       | A                       | B                                 |
  | --------------------------- | --------------------------- | --------------------------- | ----------------------- | --------------------------------- |
  | Mover cursor (repite 180/60 ms) | Mover cursor (repite 180/60 ms) | Mover cursor (repite 180/60 ms) | Intercambiar (un toque) | Girar cursor (un toque)           |

**Fuera de alcance (para futuros specs):**

- Gestos táctiles (swipe para intercambiar, tocar casillas del canvas).
- Sonido y música.
- Guardar datos extra de la partida (nivel, cadena, grupos) en Supabase.
- Piezas especiales (perlas, bombas, comodines) y modos de juego.
- Preferencias en `localStorage` distintas del skin.
- Animación suave de intercambio entre casillas (el intercambio es instantáneo en el dibujo).
- Pistas de movimiento posible.
- Cambios de balance posteriores a la primera implementación (los valores son de partida y se ajustan jugando).
- Otros juegos del catálogo.
- Tests automatizados (no hay test runner configurado).

---

## Modelo de datos

```text
games/
  index.ts              # + reflujo: ReflujoGame
  reflujo/
    core.ts             # lógica pura, sin DOM, React ni localStorage
    render.ts           # dibujo en canvas a partir de ReflujoState y el skin
    skins.ts            # skins clasico / neon / retro
    prefs.ts            # av_reflujo_skin
    reflujo-game.tsx    # "use client": canvas, bucle, entrada, HUD, inicio, pausa, fin
    reflujo.css         # estilos del área del juego, bajo .reflujo-root
```

```ts
// games/reflujo/core.ts
export const COLS = 8;
export const ROWS = 10;
export const CELL = 56; // px
export const W = COLS * CELL; // 448
export const H = ROWS * CELL; // 560
export const MAX_DT = 0.05;
export const START_TIDE = 2;
export const LOSE_TIDE = 8;
export const MIN_TIDE = 0;
export const RISE_BASE = 9; // s por fila en el nivel 1
export const RISE_DEC = 0.75; // s menos por nivel
export const RISE_MIN = 3; // s
export const CLEAR_TIME = 0.25; // s
export const SETTLE_TIME = 0.2; // s
export const SHAKE_TIME = 0.2; // s
export const GROUPS_PER_LEVEL = 10;
export const MAX_CHAIN = 8;
export const SHUFFLE_TRIES = 50;
export const GROUP_POINTS = { 3: 30, 4: 80, 5: 150, 6: 250 } as const; // 6 = 6 o más
export const CURSOR_START = { col: 3, row: 4, vertical: false } as const;

export type Kind = 0 | 1 | 2 | 3 | 4;
export type Dir = "up" | "down" | "left" | "right";
export type EngineState = "playing" | "gameover";
export type Wave = "idle" | "clearing" | "settling";

export type ReflujoState = {
  grid: Kind[]; // COLS × ROWS, índice row * COLS + col; siempre lleno
  marked: boolean[]; // piezas del grupo en curso (misma indexación)
  cursor: { col: number; row: number; vertical: boolean };
  tide: number; // filas sumergidas (enteras)
  riseAcc: number; // s acumulados hacia la siguiente subida
  wave: Wave;
  timer: number; // s restantes de la ola actual
  chain: number; // 0 en reposo
  shake: number; // s restantes del temblor de intercambio rechazado
  time: number; // segundos de partida (animaciones)
  score: number;
  level: number;
  groupsCleared: number;
  bestChain: number;
  state: EngineState;
  rng: () => number; // inyectable; la UI pasa Math.random
};

export type ReflujoInput = {
  moves: Dir[]; // movimientos del cursor desde el último frame (uno por pulsación o repetición)
  swap: boolean; // intercambio pedido desde el último frame
  rotate: boolean; // giro del cursor pedido desde el último frame
};

export function kindsForLevel(level: number): number;
export function riseTime(level: number): number;
export function groupPoints(size: number): number;
export function isSubmerged(s: ReflujoState, row: number): boolean;
export function createState(rng: () => number): ReflujoState;
export function step(s: ReflujoState, dt: number, input: ReflujoInput): void; // muta s
```

```ts
// games/reflujo/skins.ts
export type SkinName = "clasico" | "neon" | "retro";
export const DEFAULT_SKIN: SkinName = "clasico";
export type Skin = {
  label: string;
  bg: string;
  grid: string;
  kinds: [string, string, string, string, string]; // color de cada tipo de pieza
  water: string;
  surface: string;
  danger: string;
  cursor: string;
  glow: boolean;
  outline: boolean;
};
export const SKINS: Record<SkinName, Skin>;
export function isSkinName(v: unknown): v is SkinName;
export function getSkin(name: SkinName): Skin;
```

```ts
// games/reflujo/render.ts
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  s: ReflujoState,
  skin: Skin,
): void; // usa s.time
```

```ts
// games/reflujo/reflujo-game.tsx — estado visible en React; el del bucle en refs
type Phase = "start" | "playing" | "paused" | "over";
type PauseView = "main" | "controls";
type RunStats = {
  score: number;
  level: number;
  tide: number;
  groupsCleared: number;
  bestChain: number;
};
```

Convenciones (las de SPEC 05/06, detalladas en `.claude/skills/nuevo-juego/integracion.md`):

- `core.ts` no importa React ni usa `window`, `document`, `performance`, `localStorage` ni `Math.random`.
- Casillas con origen arriba a la izquierda; tiempos en segundos.
- `EngineState` es del motor; `Phase` es de la UI. `gameover` lleva la UI a `over`.
- La partida en curso no se persiste. Única clave: `av_reflujo_skin`.
- `setState` solo cuando cambian los datos del HUD o la fase.

---

## Plan de implementación

Seguir `.claude/skills/nuevo-juego/integracion.md` y partir de `.claude/skills/nuevo-juego/scaffold/`. Usar `/frontend-design` para la UI, con `games/caida/` como referencia de juego por casillas y de skins, y `games/rocas/` como referencia de integración.

1. **Catálogo.** Añadir la entrada `reflujo` en `lib/games.ts` y la portada `cover-reflujo` en `app/globals.css`. Verificar: `/biblioteca` muestra el juego y `/juegos/reflujo` su ficha.
2. **Lógica pura.** Crear `games/reflujo/core.ts` desde `scaffold/core.ts.tpl` con los tipos, constantes y reglas del modelo de datos (tablero, grupos, olas, marea, puntos, nivel, barajado). Verificar: `npm run build` pasa y un script contra `core.ts` con un `rng` fijo comprueba tablero inicial sin grupos, puntos por tamaño y cadena, reflujo y fin.
3. **Dibujo y skins.** Crear `games/reflujo/render.ts` con `drawFrame`, `skins.ts` y `prefs.ts`. Verificar: `npm run build` pasa.
4. **Componente jugable.** Crear `games/reflujo/reflujo-game.tsx` desde `scaffold/game.tsx.tpl`, con HUD, CRT, canvas, bucle y teclado. Registrar `reflujo: ReflujoGame` en `games/index.ts`. Verificar: `/juegos/reflujo/jugar` arranca una partida jugable con teclado.
5. **Inicio, pausa y fin.** Overlay "¿JUGAMOS?", menú de pausa, pausa por foco y `GameOverModal` con `ranked` y `extra`. Verificar: todos los botones del menú y del modal funcionan.
6. **Estilos y táctil.** Crear `games/reflujo/reflujo.css` desde `scaffold/game.css.tpl`, integrar `<TouchControls>` con el mapeo del alcance y revisar a 360×740, 390×844, 844×390, 768×1024 y 1440×900. Verificar: el canvas cabe sin scroll horizontal y el D-pad, A y B funcionan.
7. **Ranking y cierre.** Guardar una partida de prueba, comprobarla con `execute_sql` y en la ficha y el Salón, y borrar las filas de prueba tras confirmarlo. Verificar: `npm run lint` y `npm run build` pasan.

---

## Criterios de aceptación

- [ ] `npm run lint` termina sin errores.
- [ ] `npm run build` termina sin errores y `/juegos/[id]/jugar` mantiene el mismo tipo de ruta.
- [ ] Existen `games/reflujo/{core.ts,render.ts,skins.ts,prefs.ts,reflujo-game.tsx,reflujo.css}` y `games/index.ts` tiene la entrada `reflujo`.
- [ ] `games/reflujo/core.ts` no importa `react` ni usa `window`, `document`, `performance`, `localStorage` ni `Math.random`.
- [ ] `/biblioteca` muestra REFLUJO (PUZZLE, cian) con su portada, y `/juegos/reflujo` su ficha con el texto `long` del alcance.
- [ ] `/juegos/reflujo/jugar` muestra "¿JUGAMOS?"; JUGAR o Enter empiezan la partida.
- [ ] El canvas tiene `width=448` y `height=560` y mantiene la proporción 4:5 a 1440 px y 390 px sin scroll horizontal.
- [ ] Al empezar, el tablero tiene 8×10 piezas, ningún grupo hecho, al menos un movimiento posible, marea 2 (dos filas bajo el agua) y el cursor horizontal en (3, 4).
- [ ] Las flechas y W A S D mueven el cursor una casilla por pulsación; no entra en el agua ni sale del tablero. Z / X / Mayús lo giran entre horizontal y vertical.
- [ ] Espacio o Enter intercambian la pareja; si no forma grupo, se deshace con temblor y sin castigo.
- [ ] Un grupo de 3 suma `30 × cadena × nivel`; de 4, `80 × …`; de 5, `150 × …`; de 6 o más, `250 × …`.
- [ ] Una cascada tras la caída de piezas puntúa con la cadena ×2, ×3… (tope ×8) y el modal muestra la mejor cadena.
- [ ] Un grupo que contiene una pieza sumergida baja la marea 1 fila (2 si es de 4 o más); un grupo solo de piezas secas no la baja.
- [ ] La marea sube 1 fila cada 9 s en el nivel 1 y cada vez menos hasta 3 s desde el nivel 9; no avanza mientras se resuelve un intercambio ni durante la pausa.
- [ ] Cada 10 grupos sube el nivel; desde el nivel 4 aparecen piezas del tipo 4 (hexágono).
- [ ] Con la marea en 8 la partida termina y la línea de peligro parpadea desde la marea 6.
- [ ] Sin movimientos posibles, las piezas secas se barajan sin crear grupos hechos.
- [ ] Pulsar las teclas del juego no hace scroll de la página.
- [ ] El HUD muestra Jugador, Puntuación, Nivel y Marea (`n/8`); el canvas no los duplica.
- [ ] P, Esc y el botón PAUSA abren el menú de pausa y el juego se congela, incluida la marea.
- [ ] Con el menú abierto las teclas no afectan al juego; al reanudar con una tecla pulsada, no actúa hasta soltarla.
- [ ] "Ver controles" muestra la lista y "Volver" regresa al menú.
- [ ] "Reiniciar" empieza una partida nueva con puntuación 0 y marea 2.
- [ ] Cambiar a otra pestaña durante la partida la deja en pausa.
- [ ] Perder abre "FIN DEL JUEGO" con la puntuación final, Nivel, Mejor cadena y Grupos.
- [ ] El botón FIN termina la partida y abre el mismo modal con la puntuación actual.
- [ ] "GUARDAR PUNTUACIÓN" muestra "GUARDANDO…" y después "PUESTO #N" con el top 10 y la fila del jugador resaltada.
- [ ] La fila guardada está en `public.scores` con `game_id = 'reflujo'` y aparece en `/juegos/reflujo` y `/salon?juego=reflujo` tras recargar.
- [ ] "JUGAR DE NUEVO" empieza una partida nueva con puntuación 0.
- [ ] El selector ofrece Clásico (por defecto), Neón y Retro; el skin persiste en `av_reflujo_skin` y los tres se leen bien en oscuro.
- [ ] Con emulación táctil se ven D-pad, A, B y pausa sin tapar el canvas: el D-pad mueve el cursor (con repetición), A intercambia y B gira; en escritorio no aparecen.
- [ ] Salir con SALIR durante una partida y volver la deja en pausa, sin bucles ni listeners duplicados.
- [ ] `/juegos/caida/jugar` y `/juegos/rocas/jugar` siguen igual y un juego simulado sigue mostrando "MODO DEMO".
- [ ] La consola no muestra errores ni avisos de hidratación en `/juegos/reflujo/jugar`.

---

## Decisiones

- **Sí:** entrada nueva `reflujo` en el catálogo. Decisión del agente: es el segundo PUZZLE del catálogo y el primero de decisión pausada; ninguna entrada existente cubre ese hueco.
- **Sí:** diseño original; los valores numéricos son de partida y se ajustarán jugando. Decisión del agente.
- **Sí:** port a TypeScript + React con `<canvas>`, `core.ts` puro separado de `render.ts`. Mismas razones que en SPEC 05/06.
- **No:** iframe ni JS vanilla montado vía refs.
- **Sí:** `rng` inyectable en el estado. Partidas reproducibles para depurar.
- **Sí:** las piezas sumergidas no se pueden mover y solo se pescan desde arriba o por cascada. Decisión del agente: es el giro del tema; convierte la marea en una decisión (dónde emparejar) y no solo en un reloj.
- **Sí:** las piezas se distinguen por forma y color. Decisión del agente: accesibilidad para daltonismo y para el skin Retro.
- **Sí:** el reloj de la marea se detiene durante la resolución. Decisión del agente: evita castigar al jugador por una cadena larga que él mismo provoca.
- **Sí:** el intercambio que no forma grupo se deshace sin castigo. Decisión del agente: la presión ya la pone la marea; castigar el error sería doble.
- **Sí:** el cursor no entra en el agua. Decisión del agente: simplifica la regla ("lo mojado no se toca") y el criterio de aceptación.
- **Sí:** reflujo de 1 fila por grupo que toca agua y de 2 si tiene 4 o más piezas. Decisión del agente: premia las combinaciones largas sin romper la dificultad.
- **Sí:** barajar solo las piezas secas cuando no hay movimientos, con penalización de 1 fila si falla tras 50 intentos. Decisión del agente: evita partidas bloqueadas y mantiene la regla de pérdida.
- **Sí:** puntos `groupPoints × cadena (máx. 8) × nivel`. Decisión del agente: la cadena y el nivel premian la habilidad y el aguante; con 8 × nivel 30 el tope teórico queda muy por debajo de `MAX_SCORE`.
- **Sí:** HUD con Nivel y Marea; modal con `extra` = Nivel, Mejor cadena y Grupos. Decisión del agente.
- **Sí:** modal de la plataforma con `ranked`; guarda con `submitScore`, la única vía de escritura.
- **No:** migración de Supabase. `scores` es común a todos los juegos; los datos de `extra` no se guardan.
- **No:** récords locales del juego. Duplicaría el ranking.
- **Sí:** campo lógico fijo 448×560 escalado por CSS. La dificultad no depende de la pantalla.
- **Sí:** controles táctiles con `TouchControls` y el mapeo de la tabla. El juego se puede jugar en móvil desde el primer día.
- **Sí:** skins Clásico, Neón y Retro desde el primer día (contrato §7), con `av_reflujo_skin`.

---

## Riesgos

| Riesgo                                                               | Mitigación                                                                                                  |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Bucles o listeners duplicados al navegar (`<Activity>`, Strict Mode) | Estado del bucle en refs; toda limpieza cancela el frame y quita listeners; criterio de salir y volver.     |
| Salto de `dt` al reanudar o volver a la ruta                         | Reiniciar el último timestamp al arrancar el bucle; `dt` limitado a 50 ms.                                  |
| Espacio activa el botón enfocado                                     | `preventDefault` en las teclas del juego y `blur()` de los botones tras el clic.                            |
| Puntuación no entera o fuera de rango y el guardado falla            | Puntos enteros en `core.ts`; `validateScore` y la RPC rechazan el resto.                                    |
| El canvas no cabe en pantallas bajas o estrechas                     | Escalado CSS con resolución fija y `--crt-ar`; revisar a 360 px, 390 px y 1440 px.                          |
| El CSS del juego afecta a otras páginas                              | Todas las reglas bajo `.reflujo-root`.                                                                      |
| La marea vuelve el juego demasiado difícil: lo mojado solo se pesca desde arriba | Valores de partida (9 s, 0,75 s por nivel, reflujo 1 o 2) en constantes exportadas, fáciles de ajustar; probar un nivel 1 jugable sin cascadas. |
| Bucles de barajado infinitos o tablero sin movimiento                | Máximo de 50 intentos, penalización de marea y comprobación en cada reposo; criterio de aceptación.         |
| Cascadas largas que paran la marea y permiten partidas interminables | El reloj solo se detiene durante la resolución (≤ 0,45 s por ola) y el reflujo exige tocar agua; las cadenas no dan tiempo extra. |
| Repetición de teclas de mantener contra un cursor por casillas       | Repetición propia (170 ms, luego 60 ms) en la UI; no se confía en `ev.repeat` del sistema.                  |

---

## Lo que **no** está en este spec

- Gestos táctiles o tocar casillas.
- Sonido.
- Datos extra de la partida en Supabase.
- Piezas especiales y modos de juego.
- Animación suave del intercambio.
- Tests automatizados.

Cada uno de esos, si llega, va en su propio spec.
