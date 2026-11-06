# SPEC 09 — Juego real: SERPENTINA (diseño original del género serpiente)

> **Estado:** Implementado
> **Depende de:** SPEC 05, SPEC 06, SPEC 07
> **Fecha:** 2026-11-05
> **Objetivo:** Hacer jugable `/juegos/serpentina/jugar` con un juego original del género serpiente, alojado en `games/serpentina/`, con el HUD, la pausa y el modal de fin de partida de la plataforma, y su puntuación en el ranking de Supabase.

---

## Por qué existe este spec

La entrada `serpentina` de `lib/games.ts` (`ARCADE`, portada `cover-snake`, color `green`) usa hoy el simulador `components/game-player.tsx`.
En `references/snake/` solo hay una hoja de sprites de frutas (`fruits.png`) y su atlas (`sprites.js`). No hay lógica de juego, así que las reglas se diseñan en este spec con las convenciones del género: rejilla, crecimiento al comer y muerte por choque. Según `sprites.js`, la hoja sale de un juego comercial, así que **no se usa**: la comida se dibuja por código con la paleta neón.
SPEC 05 y 06 fijaron la convención `games/<id>/` y el registro `games/index.ts`; SPEC 07 conectó el modal a Supabase. Al registrar `serpentina` en `PLAYABLE`, el juego entra en el ranking sin migraciones.
El nombre visible es "SERPENTINA"; la palabra "Snake" no aparece en la UI.

---

## Alcance

**Dentro:**

- Carpeta `games/serpentina/` y entrada `serpentina: SerpentinaGame` en `PLAYABLE` de `games/index.ts`.
- Lógica pura en `games/serpentina/core.ts`, por casillas y con reglas originales:
  - Tablero de 24×24 casillas de 24 px (campo lógico de 576×576). Coordenadas de casilla `(col, row)` con origen arriba a la izquierda.
  - La serpiente empieza con longitud 3: cabeza en (8, 12) y cuerpo en (7, 12) y (6, 12), orientada a la derecha.
  - **Espera inicial:** la serpiente está quieta hasta la primera dirección válida. ← no vale en ese momento porque metería la cabeza en el cuello. Hasta entonces el canvas muestra "PULSA UNA DIRECCIÓN".
  - **Movimiento por ticks:** un acumulador de tiempo dentro de `step` avanza una casilla cada `stepTime(level) = max(0,06; 0,15 − 0,01 × (level − 1))` segundos. Son 150 ms en el nivel 1, y el mínimo de 60 ms se alcanza en el nivel 10.
  - **Cola de giros:** hasta 2 direcciones pendientes. Una dirección se encola solo si no es igual ni opuesta a la última de la cola (o a la actual si la cola está vacía). Cada tick consume como mucho una. Con la cola llena, las pulsaciones nuevas se descartan.
  - **Muros mortales:** salir del tablero termina la partida.
  - **Autocolisión:** entrar en una casilla del cuerpo termina la partida. Excepción: la casilla de la punta de la cola, si en ese tick la cola avanza (es decir, si no está creciendo).
  - **Núcleo (comida normal):** siempre hay uno en una casilla libre al azar (`s.rng`). Al comerlo:
    - suma `10 × level` puntos, con el nivel anterior al bocado;
    - la serpiente crece 1 casilla (`GROW_PER_FOOD = 1`, aplicada en el siguiente tick);
    - aparece otro núcleo.
  - **Nivel:** sube 1 cada 5 núcleos (`FOOD_PER_LEVEL = 5`). Empieza en 1 y no tiene tope; la velocidad se queda en el mínimo a partir del nivel 10.
  - **Bonus:** al comer cada 5.º núcleo aparece un núcleo dorado en una casilla libre (distinta del núcleo normal) durante 5 s de partida (`BONUS_TIME`).
    - Comerlo suma `50 × level` y no alarga la serpiente.
    - Si se agota el tiempo, desaparece. Si aparece otro mientras sigue uno activo, el nuevo lo sustituye.
    - Su temporizador solo corre durante `step`, así que se congela en pausa.
  - **Tablero lleno:** si no queda casilla libre para un núcleo nuevo, la partida termina (`gameover`) con la puntuación conseguida.
  - Contadores para el HUD y el modal: `length`, `level`, `foodEaten`, `bonusEaten`.
  - Puntuación entera, acotada a `MAX_SCORE`.
  - `dt` limitado a 50 ms (`MAX_DT = 0.05`). Como es menor que el tick mínimo, no hay más de un avance por frame, aunque el acumulador lo resuelve igualmente con `while`.
  - `s.time` (segundos de partida) para las animaciones. `core.ts` no usa `performance`.
- Dibujo en `games/serpentina/render.ts`, neón vectorial con glow:
  - Fondo oscuro con una rejilla de puntos tenue (`--ink-faint` a baja opacidad).
  - Borde del tablero (los muros) como un marco fino cyan con glow.
  - Serpiente verde (`--green`) en bloques redondeados con un hueco de 2 px. La cabeza es más brillante, con glow y dos "ojos" orientados según la dirección. El cuerpo se atenúa ligeramente hacia la cola.
  - Núcleo magenta (`--magenta`) que late (radio y glow en función de `s.time`).
  - Bonus amarillo (`--yellow`) con forma de rombo y un anillo que se vacía con el tiempo restante. Parpadea en el último segundo.
  - Al morir, la cabeza queda marcada en magenta sobre la casilla del choque (dentro del tablero si fue contra el muro), dibujada una vez en `gameover`.
  - El canvas no dibuja puntuación, nivel ni longitud: van en el HUD.
- Client Component `games/serpentina/serpentina-game.tsx`:
  - HUD de la plataforma: Jugador, Puntuación, Nivel (dos dígitos), Longitud y botones PAUSA / FIN / SALIR.
  - Marco CRT con `<canvas>` de 576×576, escalado por CSS en proporción 1:1.
  - Lista de controles visible bajo el canvas.
  - Bucle `requestAnimationFrame` con el estado del juego en refs.
  - Teclado: flechas o W A S D cambian de dirección (una entrada en la cola por pulsación, ignorando `ev.repeat`), P / Esc pausa. `preventDefault` en las flechas y en Espacio.
- Pantalla de inicio "¿JUGAMOS?" con JUGAR (también Enter).
- Menú de pausa (P / Esc o PAUSA): Reanudar, Reiniciar y Ver controles / Volver.
  - Con el menú abierto el juego no recibe teclas, y las que sigan pulsadas al reanudar se ignoran hasta soltarlas.
  - Al pausar se vacía la cola de giros.
  - Perder el foco con partida en curso abre la pausa.
- Fin de partida con `GameOverModal` (`ranked`) y `onRestart` que empieza una partida nueva. Se llega por chocar contra el muro, morderse, llenar el tablero o pulsar FIN. `extra`:
  - Nivel: el alcanzado, con dos dígitos.
  - Longitud: la final.
  - Bonus: núcleos dorados atrapados.
- Guardado en Supabase por la vía existente (`submitScore` → `submit_score`). El ranking aparece en `/juegos/serpentina` y `/salon?juego=serpentina`.
- Estilos en `games/serpentina/serpentina.css`, con todas las reglas bajo `.serpentina-root`.
- Ajustar el texto `long` de `serpentina` en `lib/games.ts`, porque la velocidad sube por niveles y no en cada bocado. Propuesta: "Una serpiente de luz recorre la grilla buscando núcleos magenta. Cada bocado la alarga; cada cinco, sube de nivel y acelera. Atrapa los núcleos dorados antes de que se apaguen y no toques los muros ni tu propia cola."

**Fuera de alcance (para futuros specs):**

- La hoja de sprites `references/snake/fruits.png` y cualquier fruta con imagen.
- Bordes que se atraviesan, obstáculos, varios tipos de fruta o modos extra.
- Controles táctiles o gestos en móvil.
- Sonido y música.
- Preferencias en `localStorage` (skins, velocidad inicial, tema).
- Guardar en Supabase el nivel, la longitud o los bonus.
- Cambios en la ficha `/juegos/serpentina` aparte del texto `long`.
- Otros juegos del catálogo.
- Tests automatizados (no hay test runner configurado).
- Cambiar `references/snake/` (es solo referencia).

---

## Modelo de datos

```text
games/
  index.ts                # + serpentina: SerpentinaGame
  serpentina/
    core.ts               # lógica pura, sin DOM, React ni localStorage
    render.ts             # dibujo en canvas a partir de SerpentinaState
    serpentina-game.tsx   # "use client": canvas, bucle, entrada, HUD, inicio, pausa, fin
    serpentina.css        # estilos del área del juego, bajo .serpentina-root
```

```ts
// games/serpentina/core.ts
export const COLS = 24;
export const ROWS = 24;
export const CELL = 24; // px
export const W = COLS * CELL; // 576
export const H = ROWS * CELL; // 576
export const MAX_DT = 0.05;
export const START_LENGTH = 3;
export const START_HEAD = { col: 8, row: 12 } as const;
export const BASE_STEP = 0.15; // s por casilla en el nivel 1
export const STEP_DEC = 0.01; // s menos por nivel
export const MIN_STEP = 0.06; // s
export const FOOD_PER_LEVEL = 5;
export const FOOD_POINTS = 10; // × nivel
export const GROW_PER_FOOD = 1;
export const BONUS_POINTS = 50; // × nivel
export const BONUS_TIME = 5; // s
export const MAX_QUEUE = 2;

export type Dir = "up" | "down" | "left" | "right";
export type Cell = { col: number; row: number };
export type EngineState = "waiting" | "playing" | "gameover"; // waiting = quieta hasta la primera dirección

export type SerpentinaState = {
  body: Cell[]; // body[0] = cabeza
  dir: Dir; // dirección actual (orientación inicial: right)
  queue: Dir[]; // giros pendientes, máx. MAX_QUEUE
  grow: number; // casillas pendientes de crecer
  food: Cell | null; // null solo con el tablero lleno
  bonus: { cell: Cell; timeLeft: number } | null;
  acc: number; // acumulador del tick
  time: number; // segundos de partida (animaciones)
  score: number;
  level: number;
  foodEaten: number;
  bonusEaten: number;
  crash: Cell | null; // casilla del choque, para el dibujo final
  state: EngineState;
  rng: () => number; // inyectable; la UI pasa Math.random
};

export type SerpentinaInput = {
  turns: Dir[]; // direcciones pulsadas desde el último frame (una por pulsación)
};

export function stepTime(level: number): number;
export function enqueueTurn(s: SerpentinaState, d: Dir): void; // aplica las reglas de la cola
export function createState(rng: () => number): SerpentinaState;
export function step(
  s: SerpentinaState,
  dt: number,
  input: SerpentinaInput,
): void; // muta s
```

```ts
// games/serpentina/render.ts
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  s: SerpentinaState,
): void; // usa s.time
```

```ts
// games/serpentina/serpentina-game.tsx — estado visible en React; el del bucle en refs
type Phase = "start" | "playing" | "paused" | "over";
type PauseView = "main" | "controls";
type RunStats = {
  score: number;
  level: number;
  length: number;
  bonusEaten: number;
};
```

Convenciones (las de SPEC 05/06, detalladas en `.claude/skills/nuevo-juego/integracion.md`):

- `core.ts` no importa React ni usa `window`, `document`, `performance`, `localStorage` ni `Math.random`.
- Coordenadas de casilla con origen arriba a la izquierda; tiempos en segundos.
- `EngineState` es del motor; `Phase` es de la UI. `waiting` y `playing` del motor van dentro de la fase `playing`; `gameover` lleva la UI a `over`.
- La partida en curso no se persiste. Este juego no crea claves `av_serpentina_*`.
- `setState` solo cuando cambian los datos del HUD o la fase.

---

## Plan de implementación

Seguir `.claude/skills/nuevo-juego/integracion.md` y partir de `.claude/skills/nuevo-juego/scaffold/`. Usar `/frontend-design` para la UI, con `games/rocas/` como referencia de integración y `games/caida/` como referencia de juego por casillas.

1. **Catálogo.** Ajustar el texto `long` de `serpentina` en `lib/games.ts`. Verificar: `/juegos/serpentina` muestra el texto nuevo.
2. **Lógica pura.** Crear `games/serpentina/core.ts` desde `scaffold/core.ts.tpl` con los tipos, constantes y reglas del modelo de datos (ticks, cola de giros, colisiones, comida, bonus, niveles). Verificar: `npm run build` pasa.
3. **Dibujo.** Crear `games/serpentina/render.ts` con `drawFrame`. Verificar: `npm run build` pasa.
4. **Componente jugable.** Crear `games/serpentina/serpentina-game.tsx` desde `scaffold/game.tsx.tpl`, con HUD, CRT, canvas, bucle y teclado. Registrar `serpentina: SerpentinaGame` en `games/index.ts`. Verificar: `/juegos/serpentina/jugar` arranca una partida jugable con teclado.
5. **Inicio, pausa y fin.** Overlay "¿JUGAMOS?", menú de pausa, pausa por foco y `GameOverModal` con `ranked` y `extra`. Verificar: todos los botones del menú y del modal funcionan.
6. **Estilos.** Crear `games/serpentina/serpentina.css` desde `scaffold/game.css.tpl`. Revisar a 1440 px y 390 px. Verificar: el canvas cabe sin scroll horizontal.
7. **Ranking y cierre.** Guardar una partida de prueba, comprobarla con `execute_sql` y en la ficha y el Salón, y borrar las filas de prueba tras confirmarlo. Verificar: `npm run lint` y `npm run build` pasan.

---

## Criterios de aceptación

- [x] `npm run lint` termina sin errores.
- [x] `npm run build` termina sin errores y `/juegos/[id]/jugar` mantiene el mismo tipo de ruta.
- [x] Existen `games/serpentina/{core.ts,render.ts,serpentina-game.tsx,serpentina.css}` y `games/index.ts` tiene la entrada `serpentina`.
- [x] `games/serpentina/core.ts` no importa `react` ni usa `window`, `document`, `performance`, `localStorage` ni `Math.random`.
- [x] `/juegos/serpentina/jugar` muestra "¿JUGAMOS?"; JUGAR o Enter empiezan la partida.
- [x] El canvas tiene `width=576` y `height=576` y mantiene la proporción 1:1 a 1440 px y 390 px sin scroll horizontal. Canvas de 520×520 a 1440 px y de 319×319 a 390 px. *Pendiente de la plataforma:* a 390 px hay 6 px de scroll horizontal por el botón hamburguesa del menú, igual que en `/juegos/rocas/jugar`; el área del juego cabe entera.
- [x] Al empezar, la serpiente (longitud 3, mirando a la derecha) está quieta con el aviso "PULSA UNA DIRECCIÓN"; ← no la mueve y ↑, ↓ o → la ponen en marcha.
- [x] Flechas y W A S D giran; la media vuelta directa se ignora; dos giros rápidos (p. ej. ↑ → estando hacia la izquierda) se ejecutan en dos ticks seguidos.
- [x] Mantener pulsada una flecha no encola más de un giro.
- [x] Comer un núcleo suma `10 × nivel`, alarga la serpiente 1 casilla y hace aparecer otro en una casilla libre.
- [x] Cada 5 núcleos sube el nivel y la serpiente avanza más rápido (150 ms en el nivel 1, mínimo de 60 ms desde el nivel 10). Comprobado en el navegador hasta el nivel 2; los 60 ms del nivel 10 se comprobaron con `stepTime()` en un script contra `core.ts`.
- [x] Al 5.º núcleo de cada tanda aparece un bonus dorado durante 5 s: comerlo suma `50 × nivel` sin alargar la serpiente; si no se come, desaparece. Aparición y dibujo comprobados en el navegador; comerlo (+50 × nivel, sin crecer) y su caducidad se comprobaron con un script contra `core.ts`.
- [x] Chocar contra un muro o contra el propio cuerpo termina la partida y marca la cabeza en magenta; avanzar hacia la casilla que deja la cola no mata.
- [x] Pulsar las teclas del juego no hace scroll de la página.
- [x] El HUD muestra Jugador, Puntuación, Nivel y Longitud; el canvas no los duplica.
- [x] P, Esc y el botón PAUSA abren el menú de pausa y el juego se congela, incluido el temporizador del bonus.
- [x] Con el menú abierto las teclas no afectan al juego; al reanudar con una tecla pulsada, no actúa hasta soltarla.
- [x] "Ver controles" muestra la lista y "Volver" regresa al menú.
- [x] "Reiniciar" empieza una partida nueva con puntuación 0.
- [x] Cambiar a otra pestaña durante la partida la deja en pausa. Comprobado con `blur` de la ventana; `visibilitychange` usa el mismo manejador.
- [x] Morir abre "FIN DEL JUEGO" con la puntuación final, Nivel, Longitud y Bonus.
- [x] El botón FIN termina la partida y abre el mismo modal con la puntuación actual.
- [x] "GUARDAR PUNTUACIÓN" muestra "GUARDANDO…" y después "PUESTO #N" con el top 10 y la fila del jugador resaltada.
- [x] La fila guardada está en `public.scores` con `game_id = 'serpentina'` y aparece en `/juegos/serpentina` y `/salon?juego=serpentina` tras recargar. Prueba con `TEST` / 70. *Pendiente:* borrar la fila de prueba cuando el usuario lo confirme.
- [x] "JUGAR DE NUEVO" empieza una partida nueva con puntuación 0.
- [x] El juego no escribe claves `av_serpentina_*`.
- [x] Salir con SALIR durante una partida y volver la deja en pausa, sin bucles ni listeners duplicados.
- [x] `/juegos/caida/jugar`, `/juegos/rocas/jugar` y `/juegos/bloque-buster/jugar` siguen igual, y un juego simulado sigue mostrando "MODO DEMO". CAÍDA y ROCAS muestran "¿JUGAMOS?"; BLOQUE BUSTER responde 200; `gloton` muestra "MODO DEMO" al terminar.
- [x] La consola no muestra errores ni avisos de hidratación en `/juegos/serpentina/jugar`.
- [x] La palabra "Snake" no aparece en ningún texto visible.

---

## Decisiones

- **Sí:** el juego ocupa la entrada existente `serpentina` del catálogo. Reutiliza nombre, portada (`cover-snake`), color y ficha.
- **Sí:** diseño original del género, implementado en TypeScript + React con `<canvas>`, con `core.ts` puro separado de `render.ts`. La referencia no trae lógica.
- **No:** usar `references/snake/fruits.png`. Según su propio atlas, es arte de un juego comercial; la comida se dibuja por código.
- **Sí:** núcleos neón (magenta el normal, amarillo el bonus) y serpiente verde, como describe el catálogo. Decisión del usuario.
- **Sí:** `rng` inyectable en el estado. Partidas reproducibles para depurar.
- **Sí:** muros mortales. Decisión del usuario; es la regla clásica y la más exigente para el ranking.
- **Sí:** nivel cada 5 núcleos, con un tick de 150 ms que baja 10 ms por nivel hasta 60 ms. Decisión del usuario.
- **Sí:** puntos `10 × nivel` por núcleo y bonus temporal de `50 × nivel` durante 5 s. Decisión del usuario.
- **Sí:** cola de hasta 2 giros y espera inicial hasta la primera dirección. Decisión del usuario; evita perder giros rápidos y muertes al empezar.
- **Sí:** la cola se vacía al pausar. Un giro pulsado antes de la pausa no debe ejecutarse al reanudar.
- **Sí:** avanzar a la casilla que libera la cola en el mismo tick es legal. Es la convención del género y evita muertes injustas al girar en espiral.
- **Sí:** llenar el tablero termina la partida. Sin casilla libre no hay núcleo nuevo.
- **Sí:** HUD con Nivel y Longitud; modal con `extra` = Nivel, Longitud y Bonus. Decisión del usuario.
- **Sí:** tiempo de partida `s.time` para las animaciones y el bonus. Se congelan con la pausa y `core.ts` sigue puro.
- **Sí:** modal de la plataforma con `ranked`; guarda con `submitScore`, la única vía de escritura.
- **No:** migración de Supabase. `scores` es común a todos los juegos; los datos de `extra` no se guardan.
- **No:** récords locales del juego. Duplicaría el ranking.
- **Sí:** campo lógico fijo 576×576 (24×24 casillas de 24 px) escalado por CSS. Decisión del usuario; la dificultad no depende de la pantalla.
- **No:** controles táctiles. Van en otro spec.
- **Sí:** acento verde (`--green`, color del catálogo y de la serpiente) en los títulos de los overlays, el foco y las teclas, en lugar del cyan de la plantilla (decidido durante la implementación).
- **Sí:** "PULSA UNA DIRECCIÓN" con la fuente pixel. La "Ó" sale como minúscula, igual que en el resto de la plataforma ("CRÉDITOS" del menú); se acepta por coherencia (decidido durante la implementación).

---

## Riesgos

| Riesgo                                                               | Mitigación                                                                                                  |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Bucles o listeners duplicados al navegar (`<Activity>`, Strict Mode) | Estado del bucle en refs; toda limpieza cancela el frame y quita listeners; criterio de salir y volver.     |
| Salto de `dt` al reanudar o volver a la ruta                         | Reiniciar el último timestamp al arrancar el bucle; `dt` limitado a 50 ms.                                  |
| Espacio activa el botón enfocado                                     | `preventDefault` en las teclas del juego y `blur()` de los botones tras el clic.                            |
| Puntuación no entera o fuera de rango y el guardado falla            | Puntos enteros en `core.ts`; `validateScore` y la RPC rechazan el resto.                                    |
| El canvas no cabe en pantallas bajas o estrechas                     | Escalado CSS con resolución fija; revisar a 1440 px y 390 px.                                               |
| El CSS del juego afecta a otras páginas                              | Todas las reglas bajo `.serpentina-root`.                                                                   |
| Giros perdidos o media vuelta mortal con pulsaciones rápidas         | Cola de 2 giros validada contra la última dirección encolada, no contra la actual; criterio de giro rápido. |
| Buscar casilla libre al azar se vuelve lento con la serpiente larga  | Elegir entre la lista de casillas libres (576 como máximo), no reintentar al azar.                          |

---

## Lo que **no** está en este spec

- Sprites o frutas con imagen.
- Bordes que se atraviesan, obstáculos y modos extra.
- Controles táctiles.
- Sonido.
- Preferencias en `localStorage`.
- Datos extra de la partida en Supabase.
- Tests automatizados.

Cada uno de esos, si llega, va en su propio spec.
