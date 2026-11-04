# SPEC 05 — Primer juego real: CAÍDA (port del Tetris de referencia)

> **Estado:** Aprobado
> **Depende de:** SPEC 01
> **Fecha:** 2026-11-03
> **Objetivo:** Hacer jugable `/juegos/caida/jugar` con un port a TypeScript + React del Tetris de `references/claude-tetris/`, alojado en la nueva carpeta `games/caida/`, integrado con el HUD, la pausa y el modal de fin de partida de la plataforma.

---

## Por qué existe este spec

Hoy todos los juegos del catálogo usan `components/game-player.tsx`, que solo simula una partida (la puntuación sube sola).
El catálogo (`lib/games.ts`) ya tiene "CAÍDA" (`id: "caida"`, `PUZZLE`, portada `cover-tetro`), descrito como un juego de piezas que caen.
En `references/claude-tetris/` existe un Tetris completo en JavaScript vanilla: `tetris-core.js` (lógica pura), `game.js` (bucle, canvas, entrada, menús), `skins.js`, `records.js` y `style.css`.
Este spec lo convierte en el primer juego real de la plataforma y fija la convención de la carpeta `games/`, donde vivirán los juegos futuros.
El nombre visible sigue siendo "CAÍDA"; la marca "Tetris" no aparece en la UI.

---

## Alcance

**Dentro:**

- Carpeta `games/` en la raíz del repo (al nivel de `app/`, `lib/`, `components/`), con una subcarpeta por juego. Primera: `games/caida/`.
- Registro `games/index.ts` que asocia `id` del catálogo con el componente jugable. Solo `caida` tiene entrada.
- `app/juegos/[id]/jugar/page.tsx` monta el componente del registro si existe y, si no, el `GamePlayer` simulado actual.
- Port a TypeScript (sin DOM) de `tetris-core.js` en `games/caida/core.ts`: 12 piezas (7 estándar, 3 pentominós `PLUS`/`U`/`Y`, especiales `SINGLE`/`RING`), pesos de aparición, recompensa `SINGLE` tras un Tetris, colisiones, rotación, borrado de líneas, niveles y velocidad.
- Port de `skins.js` en `games/caida/skins.ts`: Retro, Neon, Pastel y Pixel art, con selector en el panel.
- Client Component `games/caida/caida-game.tsx`: tablero en `<canvas>` 10×20 (300×600), pieza fantasma, vista de la siguiente pieza, soft drop (+1 por fila), hard drop (+2 por celda), puntuación `[0, 100, 300, 500, 800] × nivel`, nivel cada 10 líneas, combo y combo máximo, wall kicks `[0, -1, 1, -2, 2]`.
- Menú de pausa completo (P / Esc o botón PAUSA del HUD): Reanudar, Reiniciar, Ver controles y Nivel inicial (1–10, se aplica en la próxima partida). Con el menú abierto el juego no recibe teclas, y las que sigan pulsadas al reanudar se ignoran hasta soltarlas.
- Toggle claro/oscuro **solo del área del juego** (atributo `data-theme` en el contenedor del juego, no en `<html>`). Oscuro por defecto.
- Preferencias en `localStorage` con prefijo `av_caida_`: skin, tema y nivel inicial.
- HUD de la plataforma arriba: Jugador, Puntuación, Líneas (en lugar de Vidas), Nivel y botones PAUSA / FIN / SALIR.
- Dentro del marco CRT: tablero y panel lateral con SIGUIENTE, SKIN, TEMA y lista de controles.
- Pantalla de inicio "¿JUGAMOS?" con botón JUGAR (también Enter) antes de la primera partida.
- Fin de partida (game over natural o botón FIN) con el modal "FIN DEL JUEGO" de la plataforma, que además muestra líneas y combo máximo, y guarda con `saveScore()` de la sesión simulada (`av_scores`).
- Extraer el modal de fin de partida de `components/game-player.tsx` a `components/game-over-modal.tsx` para que lo usen el simulador y CAÍDA.
- Estilos del juego en `games/caida/caida.css`, importado desde `caida-game.tsx`, con la paleta de la referencia mapeada a la estética neón de la plataforma.
- Nota en `CLAUDE.md` sobre la convención de `games/` y el registro.

**Fuera de alcance (para futuros specs):**

- Tabla de récords propia del juego (`records.js`, top 5 local con nombre). Se descarta en favor del modal de la plataforma.
- Guardar puntuaciones en Supabase o mostrarlas en el Salón de la Fama / leaderboard de la ficha.
- Controles táctiles o gestos en móvil.
- Modo claro global de la plataforma.
- Implementar cualquier otro juego del catálogo.
- Sonido y música.
- Cambios en la ficha `/juegos/caida` (tags, stats, leaderboard sembrado).
- Tests automatizados (no hay test runner configurado); los tests de la referencia no se portan.
- Cambiar `references/claude-tetris/` (es solo referencia).
- tener presente que el juego y sus resultados deben comunicarse con la plataforma vault para en specs futuros se guarde resultado en la bd de supabase

---

## Modelo de datos

```text
games/
  index.ts              # registro id → componente jugable
  caida/
    core.ts             # lógica pura (port de tetris-core.js), sin DOM ni React
    skins.ts            # skins (port de skins.js)
    prefs.ts            # lectura/escritura de preferencias en localStorage
    caida-game.tsx      # "use client": canvas, bucle, entrada, panel, pausa, inicio
    caida.css           # estilos del área del juego (tema claro/oscuro por variables)
```

```ts
// games/index.ts
import type { ComponentType } from "react";
import type { Game } from "@/lib/games";

export type PlayableProps = { game: Game };

// Solo los juegos con implementación real tienen entrada.
export const PLAYABLE: Partial<Record<string, ComponentType<PlayableProps>>> = {
  caida: CaidaGame,
};

export function getPlayable(
  id: string,
): ComponentType<PlayableProps> | undefined;
```

```ts
// games/caida/core.ts
export const COLS = 10;
export const ROWS = 20;
export const MAX_START_LEVEL = 10;
export const LINE_SCORES = [0, 100, 300, 500, 800] as const;

export type PieceName =
  | "I"
  | "O"
  | "T"
  | "S"
  | "Z"
  | "J"
  | "L"
  | "PLUS"
  | "U"
  | "Y"
  | "SINGLE"
  | "RING";

export type PieceDef = { name: PieceName; color: string; shape: number[][] };
export type Cell = number; // 0 vacía, 1..12 = índice de PIECE_DEFS + 1
export type Board = Cell[][]; // ROWS × COLS
export type Shape = Cell[][];
export type ActivePiece = { type: number; shape: Shape; x: number; y: number };

export type SpawnConfig = {
  weights: Record<PieceName, number>; // SINGLE: 0, solo sale como recompensa
  rewardPiece: PieceName; // "SINGLE"
  rewardChance: number; // 0.35
  rewardMaxWait: number; // 4
};

export type Generator = {
  next(): number;
  grantReward(): void;
  readonly pendingRewards: number;
};

export const PIECE_DEFS: readonly PieceDef[];
export const SPAWN_CONFIG: SpawnConfig;
export const COLORS: readonly (string | null)[];
export const PIECES: readonly (Shape | null)[];
export const TYPE: Record<PieceName, number>;

export function createBoard(): Board;
export function collide(
  board: Board,
  shape: Shape,
  ox: number,
  oy: number,
): boolean;
export function rotateCW(shape: Shape): Shape;
export function clearFullLines(board: Board): number; // in place
export function onLinesCleared(cleared: number, gen: Generator): boolean; // 4 → recompensa
export function levelForLines(lines: number, startLevel?: number): number;
export function dropIntervalForLevel(level: number): number; // max(100, 1000 − (level − 1) × 90)
export function clampStartLevel(level: unknown): number; // 1..10
export function createGenerator(
  rng?: () => number,
  config?: SpawnConfig,
): Generator;
```

```ts
// games/caida/skins.ts
export type SkinName = "retro" | "neon" | "pastel" | "pixel";
export type DrawOpts = { shine: string; ghost?: boolean };
export type Skin = {
  label: string;
  palette: Partial<Record<PieceName, string>>; // las que falten usan COLORS de core
  draw(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    color: string,
    opts: DrawOpts,
  ): void;
};
export const DEFAULT_SKIN: SkinName; // "retro"
export const SKINS: Record<SkinName, Skin>;
export function isSkinName(v: unknown): v is SkinName;
```

```ts
// games/caida/prefs.ts — todo acceso en try/catch, igual que lib/session.ts
export const SKIN_KEY = "av_caida_skin"; // SkinName
export const THEME_KEY = "av_caida_theme"; // "dark" | "light"
export const START_LEVEL_KEY = "av_caida_start_level"; // "1".."10"

export type CaidaTheme = "dark" | "light";
export type CaidaPrefs = {
  skin: SkinName;
  theme: CaidaTheme;
  startLevel: number;
};

export const DEFAULT_PREFS: CaidaPrefs; // { skin: "retro", theme: "dark", startLevel: 1 }
export function readPrefs(): CaidaPrefs; // valores inválidos o ausentes → por defecto
export function writePref<K extends keyof CaidaPrefs>(
  key: K,
  value: CaidaPrefs[K],
): void;
```

```ts
// games/caida/caida-game.tsx — estado visible en React; el estado del bucle vive en refs
type Phase = "start" | "playing" | "paused" | "over";
type RunStats = {
  score: number;
  lines: number;
  level: number;
  maxCombo: number;
};
```

```ts
// components/game-over-modal.tsx ("use client")
export type GameOverModalProps = {
  game: Game;
  score: number;
  extra?: { label: string; value: string }[]; // CAÍDA: Líneas y Combo máx.
  onRestart: () => void; // "JUGAR DE NUEVO"
};
// Mantiene el input de iniciales (mayúsculas, máx. 10), "GUARDAR PUNTUACIÓN" → saveScore({ game: game.id, score, name }),
// el toast "▸ PUNTUACIÓN GUARDADA_" y el enlace "VOLVER AL VAULT".
```

Convenciones:

- Cada juego vive en `games/<id>/`, con `<id>` igual al `id` de `lib/games.ts`, y se registra en `games/index.ts`.
- La lógica pura de un juego (`core.ts`) no importa React, DOM ni `localStorage`.
- Las claves de `localStorage` de un juego usan el prefijo `av_<id>_`.
- La partida en curso (tablero, pieza, puntuación) no se persiste: recargar la página empieza de cero.
- El tema y la skin solo afectan al contenedor del juego (`.caida-root[data-theme][data-skin]`); el resto de la página no cambia.

---

## Plan de implementación

Usar la skill `/frontend-design` para el trabajo de UI (indicación de `CLAUDE.md`), tomando `references/claude-tetris/` como referencia funcional y la estética CRT/neón actual de `/juegos/[id]/jugar` como referencia visual.
Antes de escribir el componente, leer en `node_modules/next/dist/docs/01-app/` las guías de CSS (importar CSS global desde un componente) y de Client Components.

1. **Carpeta y lógica pura.** Crear `games/caida/core.ts` portando `tetris-core.js` con los tipos del modelo de datos, sin cambiar reglas ni valores. Verificar: `npm run build` pasa.
2. **Skins y preferencias.** Crear `games/caida/skins.ts` (port de `skins.js`, las 4 skins) y `games/caida/prefs.ts` con las tres claves `av_caida_*`. Verificar: `npm run build` pasa.
3. **Modal compartido.** Extraer el modal "FIN DEL JUEGO" de `components/game-player.tsx` a `components/game-over-modal.tsx` (con `extra` opcional) y usarlo desde `GamePlayer`. Verificar: `/juegos/bloque-buster/jugar` se ve y funciona igual que antes (FIN, guardar, jugar de nuevo).
4. **Registro y ruta.** Crear `games/index.ts` con `PLAYABLE` y `getPlayable`. En `app/juegos/[id]/jugar/page.tsx`, renderizar `getPlayable(id) ?? GamePlayer`. Mientras no exista el juego, registrar un componente provisional mínimo. Verificar: `npm run build` pasa y la tabla de rutas mantiene el mismo tipo para `/juegos/[id]/jugar`.
5. **Juego jugable.** Crear `games/caida/caida-game.tsx` (`"use client"`) con: HUD de la plataforma (Jugador, Puntuación, Líneas, Nivel; PAUSA / FIN / SALIR), marco CRT con `<canvas>` 300×600 y panel lateral (SIGUIENTE 120×120, SKIN, TEMA, controles), bucle `requestAnimationFrame` con estado en refs, entrada de teclado (← → mover, ↑ / X rotar, ↓ soft drop, Espacio hard drop, P / Esc pausa) con `preventDefault` en esas teclas para que la página no haga scroll, pieza fantasma y vista de la siguiente. Al desmontar se cancela el frame y se quitan los listeners. Sustituir el provisional del paso 4. Verificar: se juega una partida completa con teclado.
6. **Inicio, pausa y fin.** Overlay "¿JUGAMOS?" con botón JUGAR (y Enter). Menú de pausa con Reanudar, Reiniciar, Ver controles / Volver y stepper de nivel inicial (− / +, 1–10, texto "Se aplica en la próxima partida"). Perder el foco de la ventana con partida en curso abre la pausa. Game over natural o FIN abren `GameOverModal` con la puntuación, `extra` = Líneas y Combo máx., y `onRestart` que empieza una partida nueva con el nivel inicial guardado. Verificar: todos los botones del menú y del modal funcionan.
7. **Skins, tema y estilos.** Crear `games/caida/caida.css` con variables de la referencia (`--board-bg`, `--grid`, `--block-shine`, etc.) para `data-theme="dark"` y `"light"` sobre `.caida-root`, más el bloque `data-skin="neon"`. Selector de skin y toggle de tema en el panel, persistidos con `writePref` y leídos con `readPrefs` tras montar (sin desajuste de hidratación). El toggle pierde el foco tras el clic para que Espacio no lo vuelva a pulsar. Verificar: cambiar skin y tema se aplica sin recargar y se conserva tras recargar.
8. **Documentación y cierre.** Añadir a `CLAUDE.md` una entrada sobre `games/` (una carpeta por juego, `core.ts` puro, registro en `games/index.ts`, prefijo `av_<id>_`). Verificar: `npm run lint` y `npm run build` pasan.

---

## Criterios de aceptación

- [ ] `npm run lint` termina sin errores.
- [ ] `npm run build` termina sin errores y `/juegos/[id]/jugar` mantiene el mismo tipo de ruta que antes de este spec.
- [ ] Existen `games/index.ts` y `games/caida/{core.ts,skins.ts,prefs.ts,caida-game.tsx,caida.css}`.
- [ ] `games/caida/core.ts` no importa `react` ni usa `window`, `document` ni `localStorage`.
- [ ] `/juegos/caida/jugar` muestra la pantalla "¿JUGAMOS?"; pulsar JUGAR o Enter empieza la partida.
- [ ] El tablero es un `<canvas>` de 300×600 y la vista de siguiente pieza uno de 120×120.
- [ ] ← y → mueven la pieza, ↑ y X la rotan, ↓ la baja una fila sumando 1 punto y Espacio la deja caer sumando 2 puntos por celda.
- [ ] Rotar una pieza pegada a la pared la desplaza (wall kick) en lugar de bloquear el giro cuando hay hueco.
- [ ] Pulsar flechas o Espacio durante la partida no hace scroll de la página.
- [ ] La pieza fantasma se dibuja translúcida en la posición de aterrizaje.
- [ ] Borrar 1, 2, 3 y 4 líneas en nivel 1 suma 100, 300, 500 y 800 puntos respectivamente.
- [ ] Tras 10 líneas el HUD muestra nivel 02 y la caída es más rápida.
- [ ] Tras borrar 4 líneas de golpe, en las 4 apariciones siguientes sale la pieza 1×1 dorada.
- [ ] El HUD muestra Jugador, Puntuación, Líneas y Nivel, y no muestra Vidas.
- [ ] P, Esc y el botón PAUSA abren el menú de pausa y la pieza deja de caer.
- [ ] Con el menú abierto, las flechas no mueven la pieza; al reanudar con una flecha pulsada, la pieza no se mueve hasta soltarla.
- [ ] "Ver controles" muestra la lista de controles y "Volver" regresa al menú.
- [ ] El stepper de nivel inicial va de 1 a 10, no sale de ese rango y el valor se guarda en `av_caida_start_level`.
- [ ] Con nivel inicial 5, "Reiniciar" empieza una partida en nivel 05.
- [ ] Cambiar a otra pestaña durante la partida la deja en pausa.
- [ ] Llenar el tablero hasta arriba abre el modal "FIN DEL JUEGO" con la puntuación final, las líneas y el combo máximo.
- [ ] El botón FIN termina la partida en curso y abre el mismo modal con la puntuación actual.
- [ ] "GUARDAR PUNTUACIÓN" añade a `av_scores` una entrada con `game: "caida"`, la puntuación y las iniciales, y muestra "▸ PUNTUACIÓN GUARDADA_".
- [ ] "JUGAR DE NUEVO" empieza una partida nueva con puntuación 0.
- [ ] El selector de skin ofrece Retro, Neon, Pastel y Pixel art, cambia el dibujo de los bloques sin recargar y el valor se guarda en `av_caida_skin`.
- [ ] El toggle de tema cambia el área del juego entre oscuro y claro, el resto de la página (nav, footer) no cambia y el valor se guarda en `av_caida_theme`.
- [ ] Tras recargar, skin, tema y nivel inicial se conservan.
- [ ] Con valores inválidos en las claves `av_caida_*` (p. ej. `av_caida_skin = "xyz"`), el juego carga con los valores por defecto sin errores.
- [ ] Con `localStorage` bloqueado, el juego se puede jugar y solo deja de persistir.
- [ ] Salir con SALIR durante una partida y volver no deja bucles ni listeners duplicados (la pieza cae a velocidad normal y una pulsación mueve una sola celda).
- [ ] `/juegos/bloque-buster/jugar` y el resto de juegos siguen mostrando el simulador, con el mismo modal de fin de partida.
- [ ] La consola del navegador no muestra errores ni avisos de hidratación en `/juegos/caida/jugar`.
- [ ] La palabra "Tetris" no aparece en ningún texto visible de la UI.
- [ ] `CLAUDE.md` documenta la convención de `games/`.

---

## Decisiones

- **Sí:** el juego real ocupa la entrada existente `caida` del catálogo. Reutiliza nombre, portada y ficha; evita la marca "Tetris" en la UI.
- **No:** renombrar a `tetris` ni añadir una entrada nueva.
- **Sí:** carpeta `games/` en la raíz con una subcarpeta por juego. Decisión del usuario para separar juegos de la plataforma.
- **No:** `lib/games/` (choca con `lib/games.ts`) ni `components/games/` (mezcla lógica de juego con UI).
- **Sí:** port a TypeScript + React con `<canvas>`. Tipado estricto e integración directa con sesión, HUD y modal.
- **No:** copiar los archivos a `public/` y usar un iframe. Aísla el juego de la sesión y de los estilos.
- **No:** montar el JS vanilla original vía refs. Sin tipos y con manipulación directa del DOM dentro de React.
- **Sí:** estado del bucle en refs y solo el estado visible (HUD, fase, preferencias) en `useState`. Evita re-renderizar React 60 veces por segundo.
- **Sí:** se mantienen las 12 piezas y las reglas de la referencia sin cambios (pesos, recompensa `SINGLE`, `RING`).
- **Sí:** modal "FIN DEL JUEGO" de la plataforma con `saveScore()` (`av_scores`), extraído a `components/game-over-modal.tsx`. Una sola vía de guardado para todos los juegos.
- **No:** tabla de récords propia de la referencia. Duplicaría el ranking de la plataforma.
- **No:** guardar en Supabase en este spec. Necesita tabla, RLS y auth; va en el spec de puntuaciones.
- **Sí:** menú de pausa completo, skins y toggle de tema. Decisión del usuario.
- **Sí:** el tema solo afecta al área del juego, con `data-theme` en su contenedor. La plataforma no tiene modo claro.
- **No:** modo claro global. Merece su propio spec.
- **Sí:** claves `av_caida_skin`, `av_caida_theme`, `av_caida_start_level`. Sigue la convención `av_` de `lib/session.ts` y evita choques entre juegos.
- **Sí:** HUD de plataforma arriba (Líneas en lugar de Vidas) y panel del juego dentro del CRT.
- **Sí:** pantalla de inicio "¿JUGAMOS?" y botón FIN que termina la partida. La partida no arranca sola al cargar.
- **Sí:** los juegos sin implementación siguen con el simulador, elegido por el registro `games/index.ts`.
- **No:** controles táctiles. Van en otro spec.
- **No:** portar los tests de la referencia. No hay test runner; coherente con specs anteriores.

---

## Riesgos

| Riesgo                                                                                                    | Mitigación                                                                                                               |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Bucles `requestAnimationFrame` o listeners duplicados al navegar o con Strict Mode (doble montaje en dev) | Todo efecto devuelve limpieza (`cancelAnimationFrame`, `removeEventListener`); criterio de aceptación de salir y volver. |
| Desajuste de hidratación al leer `localStorage` en el render                                              | Render inicial con `DEFAULT_PREFS`; `readPrefs()` solo dentro de `useEffect`.                                            |
| Re-renders de React en cada frame degradan el rendimiento                                                 | Estado del bucle en refs; `setState` solo cuando cambian puntuación, líneas, nivel o fase.                               |
| Espacio o flechas hacen scroll o activan el botón enfocado                                                | `preventDefault` en las teclas del juego y `blur()` de botones/toggle tras el clic.                                      |
| En móvil el juego se ve pero no es jugable (la ficha dice "TECLADO / TÁCTIL")                             | Documentado como fuera de alcance; controles táctiles en un spec futuro.                                                 |
| El tablero de 300×600 más el panel no cabe en pantallas bajas o estrechas                                 | Escalar el canvas por CSS manteniendo su resolución interna; revisar a 1440 px y 390 px.                                 |
| El CSS del juego afecta a otras páginas                                                                   | Todas las reglas de `caida.css` cuelgan de `.caida-root`.                                                                |
| `cacheComponents` cambia el tipo de la ruta `/jugar` al añadir el registro                                | El registro es un import estático; criterio de aceptación sobre la tabla de rutas del build.                             |

---

## Lo que **no** está en este spec

- Tabla de récords propia del juego.
- Puntuaciones en Supabase y ranking real.
- Controles táctiles.
- Modo claro de la plataforma.
- Otros juegos del catálogo.
- Sonido.
- Cambios en la ficha `/juegos/caida`.
- Tests automatizados.

Cada uno de esos, si llega, va en su propio spec.
