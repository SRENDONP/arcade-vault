# SPEC <NN> — Juego real: <TÍTULO> (<port de la referencia X | diseño original>)

> **Estado:** Borrador
> **Depende de:** SPEC 05, SPEC 06, SPEC 07
> **Fecha:** <AAAA-MM-DD>
> **Objetivo:** Hacer jugable `/juegos/<id>/jugar` con <un port a TypeScript + React de `references/<carpeta>/` | un juego original de <género>>, alojado en `games/<id>/`, con el HUD, la pausa y el modal de fin de partida de la plataforma, y su puntuación en el ranking de Supabase.

---

## Por qué existe este spec

<Estado actual: la entrada `<id>` de `lib/games.ts` usa el simulador `components/game-player.tsx` | el catálogo no tiene este juego.>
<Origen: qué hay en la referencia (archivos, canvas, clases) | qué propone el diseño original.>
SPEC 05 y 06 fijaron la convención `games/<id>/` y el registro `games/index.ts`; SPEC 07 conectó el modal a Supabase. Al registrar `<id>` en `PLAYABLE`, el juego entra en el ranking sin migraciones.
El nombre visible es "<TÍTULO>"; <la marca "<Original>" no aparece en la UI>.

---

## Alcance

**Dentro:**

- Carpeta `games/<id>/` y entrada `<id>: <Pascal>Game` en `PLAYABLE` de `games/index.ts`.
- <Solo si es nuevo:> entrada `<id>` en `GAMES` de `lib/games.ts` (`title`, `short`, `long`, `cat`, `cover`, `color`, `best`, `plays`) y clase `cover-<…>` en `app/globals.css`.
- Lógica pura en `games/<id>/core.ts` <portando `<archivo>` sin cambiar reglas ni valores>:
  - <Campo lógico W×H.>
  - <Reglas con sus valores numéricos exactos: movimiento, colisiones, puntos, vidas, niveles, dificultad, probabilidades.>
  - Puntuación entera.
  - `dt` limitado a 50 ms.
- Dibujo en `games/<id>/render.ts` con la paleta neón de la plataforma: <qué elemento va en qué color>. El canvas no dibuja lo que ya muestra el HUD.
- Client Component `games/<id>/<id>-game.tsx`:
  - HUD de la plataforma: Jugador, Puntuación, <stat>, <stat> y botones PAUSA / FIN / SALIR.
  - Marco CRT con `<canvas>` de <W>×<H>, escalado por CSS en proporción <W:H>.
  - Lista de controles visible bajo el canvas.
  - Bucle `requestAnimationFrame` con el estado del juego en refs.
  - Teclado: <teclas → acción>, P / Esc pausa, con `preventDefault` en esas teclas.
- Pantalla de inicio "¿JUGAMOS?" con JUGAR (también Enter).
- Menú de pausa (P / Esc o PAUSA): Reanudar, Reiniciar y Ver controles / Volver. Con el menú abierto el juego no recibe teclas, y las que sigan pulsadas al reanudar se ignoran hasta soltarlas. Perder el foco con partida en curso abre la pausa.
- Fin de partida (<condición> o botón FIN) con `GameOverModal` (`ranked`), `extra` = <datos>, y `onRestart` que empieza una partida nueva.
- Guardado en Supabase por la vía existente (`submitScore` → `submit_score`); el ranking aparece en `/juegos/<id>` y `/salon?juego=<id>`.
- Skins en `games/<id>/skins.ts` (§7 de `integracion.md`): Clásico (por defecto), Neón y Retro, con su paleta <qué elemento en qué color en cada skin>, preferencia `av_<id>_skin`, selector y contraste verificado en oscuro.
- Estilos en `games/<id>/<id>.css`, con todas las reglas bajo `.<id>-root`.
- <Ajuste del texto `long` si las reglas no coinciden con el catálogo.>

**Fuera de alcance (para futuros specs):**

- Controles táctiles o gestos en móvil.
- Sonido y música.
- Guardar datos extra de la partida (<datos de `extra`>) en Supabase.
- <Preferencias en `localStorage` distintas del skin / skins extra / tema claro, si no se piden.>
- <Mecánicas de la referencia o del género que se dejan fuera.>
- Cambios de balance respecto a la referencia.
- Otros juegos del catálogo.
- Tests automatizados (no hay test runner configurado).
- Cambiar `references/<carpeta>/` (es solo referencia).

---

## Modelo de datos

```text
games/
  index.ts              # + <id>: <Pascal>Game
  <id>/
    core.ts             # lógica pura, sin DOM, React ni localStorage
    render.ts           # dibujo en canvas a partir de <Pascal>State
    <id>-game.tsx       # "use client": canvas, bucle, entrada, HUD, inicio, pausa, fin
    <id>.css            # estilos del área del juego, bajo .<id>-root
```

```ts
// games/<id>/core.ts
export const W = <W>;
export const H = <H>;
export const MAX_DT = 0.05;
// <constantes de reglas con sus valores>

export type EngineState = "playing" | "gameover"; // <+ "dead" si hay vidas con espera>

export type <Pascal>State = {
  // <entidades>
  score: number;
  // <lives, level, contadores para `extra`>
  state: EngineState;
  rng: () => number; // inyectable; la UI pasa Math.random
};

export type <Pascal>Input = {
  // <teclas mantenidas: boolean>
  // <acciones de una sola vez por pulsación: boolean>
};

export function createState(rng: () => number): <Pascal>State;
export function step(s: <Pascal>State, dt: number, input: <Pascal>Input): void; // muta s
```

```ts
// games/<id>/render.ts
export function drawFrame(ctx: CanvasRenderingContext2D, s: <Pascal>State, now: number): void;
```

```ts
// games/<id>/<id>-game.tsx — estado visible en React; el del bucle en refs
type Phase = "start" | "playing" | "paused" | "over";
type RunStats = { score: number /* , <stats del HUD y del modal> */ };
```

Convenciones (las de SPEC 05/06, detalladas en `.claude/skills/nuevo-juego/integracion.md`):

- `core.ts` no importa React ni usa `window`, `document`, `performance`, `localStorage` ni `Math.random`.
- Coordenadas con origen arriba a la izquierda; velocidades en px/s; tiempos en segundos.
- `EngineState` es del motor; `Phase` es de la UI. `gameover` lleva la UI a `over`.
- La partida en curso no se persiste. <Este juego no crea claves `av_<id>_*` | Claves: …>.
- `setState` solo cuando cambian los datos del HUD o la fase.

---

## Plan de implementación

Seguir `.claude/skills/nuevo-juego/integracion.md` y partir de `.claude/skills/nuevo-juego/scaffold/`. Usar `/frontend-design` para la UI, con <`references/<carpeta>/` como referencia funcional y> `games/rocas/` como referencia de integración.

1. **Catálogo.** <Solo si es nuevo: entrada en `lib/games.ts` y portada en `app/globals.css`.> Verificar: `/biblioteca` muestra el juego y `/juegos/<id>` su ficha.
2. **Lógica pura.** Crear `games/<id>/core.ts` desde `scaffold/core.ts.tpl` con los tipos y constantes del modelo de datos. Verificar: `npm run build` pasa.
3. **Dibujo.** Crear `games/<id>/render.ts` con `drawFrame`. Verificar: `npm run build` pasa.
4. **Componente jugable.** Crear `games/<id>/<id>-game.tsx` desde `scaffold/game.tsx.tpl`, con HUD, CRT, canvas, bucle y teclado. Registrar `<id>: <Pascal>Game` en `games/index.ts`. Verificar: `/juegos/<id>/jugar` arranca una partida jugable con teclado.
5. **Inicio, pausa y fin.** Overlay "¿JUGAMOS?", menú de pausa, pausa por foco y `GameOverModal` con `ranked` y `extra`. Verificar: todos los botones del menú y del modal funcionan.
6. **Estilos.** Crear `games/<id>/<id>.css` desde `scaffold/game.css.tpl`. Revisar a 1440 px y 390 px. Verificar: el canvas cabe sin scroll horizontal.
7. **Ranking y cierre.** Guardar una partida de prueba, comprobarla con `execute_sql` y en la ficha y el Salón, y borrar las filas de prueba. Verificar: `npm run lint` y `npm run build` pasan.

---

## Criterios de aceptación

- [ ] `npm run lint` termina sin errores.
- [ ] `npm run build` termina sin errores y `/juegos/[id]/jugar` mantiene el mismo tipo de ruta.
- [ ] Existen `games/<id>/{core.ts,render.ts,<id>-game.tsx,<id>.css}` y `games/index.ts` tiene la entrada `<id>`.
- [ ] `games/<id>/core.ts` no importa `react` ni usa `window`, `document`, `performance`, `localStorage` ni `Math.random`.
- [ ] `/juegos/<id>/jugar` muestra "¿JUGAMOS?"; JUGAR o Enter empiezan la partida.
- [ ] El canvas tiene `width=<W>` y `height=<H>` y mantiene la proporción a 1440 px y 390 px sin scroll horizontal.
- [ ] <Un criterio observable por cada regla del alcance: estado inicial, controles, puntos por acción, subida de nivel, pérdida de vida, fin de partida.>
- [ ] Pulsar las teclas del juego no hace scroll de la página.
- [ ] El HUD muestra Jugador, Puntuación, <stats>; el canvas no los duplica.
- [ ] P, Esc y el botón PAUSA abren el menú de pausa y el juego se congela.
- [ ] Con el menú abierto las teclas no afectan al juego; al reanudar con una tecla pulsada, no actúa hasta soltarla.
- [ ] "Ver controles" muestra la lista y "Volver" regresa al menú.
- [ ] "Reiniciar" empieza una partida nueva con puntuación 0.
- [ ] Cambiar a otra pestaña durante la partida la deja en pausa.
- [ ] <Condición de fin> abre "FIN DEL JUEGO" con la puntuación final y <extra>.
- [ ] El botón FIN termina la partida y abre el mismo modal con la puntuación actual.
- [ ] "GUARDAR PUNTUACIÓN" muestra "GUARDANDO…" y después "PUESTO #N" con el top 10 y la fila del jugador resaltada.
- [ ] La fila guardada está en `public.scores` con `game_id = '<id>'` y aparece en `/juegos/<id>` y `/salon?juego=<id>` tras recargar.
- [ ] "JUGAR DE NUEVO" empieza una partida nueva con puntuación 0.
- [ ] <El juego no escribe claves `av_<id>_*` | las preferencias se guardan en `av_<id>_*`.>
- [ ] Salir con SALIR durante una partida y volver la deja en pausa, sin bucles ni listeners duplicados.
- [ ] `/juegos/caida/jugar`, `/juegos/rocas/jugar` siguen igual y un juego simulado sigue mostrando "MODO DEMO".
- [ ] La consola no muestra errores ni avisos de hidratación en `/juegos/<id>/jugar`.
- [ ] <La palabra "<Original>" no aparece en ningún texto visible.>

---

## Decisiones

- **Sí:** <el juego ocupa la entrada existente `<id>` | entrada nueva `<id>`>. <Motivo.>
- **Sí:** port a TypeScript + React con `<canvas>`, `core.ts` puro separado de `render.ts`. Mismas razones que en SPEC 05/06.
- **No:** iframe ni JS vanilla montado vía refs.
- **Sí:** `rng` inyectable en el estado. Partidas reproducibles para depurar.
- **Sí:** <reglas y valores de la referencia sin cambios | reglas originales del género: …>.
- **Sí:** modal de la plataforma con `ranked` y `extra` = <datos>; guarda con `submitScore`, la única vía de escritura.
- **No:** migración de Supabase. `scores` es común a todos los juegos; los datos de `extra` no se guardan.
- **No:** récords locales del juego. Duplicaría el ranking.
- **Sí:** campo lógico fijo <W>×<H> escalado por CSS. La dificultad no depende de la pantalla.
- **No:** controles táctiles. Van en otro spec.
- <Decisiones tomadas en las preguntas, con su motivo.>

---

## Riesgos

| Riesgo                                                               | Mitigación                                                                                              |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Bucles o listeners duplicados al navegar (`<Activity>`, Strict Mode) | Estado del bucle en refs; toda limpieza cancela el frame y quita listeners; criterio de salir y volver. |
| Salto de `dt` al reanudar o volver a la ruta                         | Reiniciar el último timestamp al arrancar el bucle; `dt` limitado a 50 ms.                              |
| Espacio activa el botón enfocado                                     | `preventDefault` en las teclas del juego y `blur()` de los botones tras el clic.                        |
| Puntuación no entera o fuera de rango y el guardado falla            | Puntos enteros en `core.ts`; `validateScore` y la RPC rechazan el resto.                                |
| El canvas no cabe en pantallas bajas o estrechas                     | Escalado CSS con resolución fija; revisar a 1440 px y 390 px.                                           |
| El CSS del juego afecta a otras páginas                              | Todas las reglas bajo `.<id>-root`.                                                                     |
| <Riesgo propio del juego>                                            | <Mitigación>                                                                                            |

---

## Lo que **no** está en este spec

- Controles táctiles.
- Sonido.
- Datos extra de la partida en Supabase.
- <…>
- Tests automatizados.

Cada uno de esos, si llega, va en su propio spec.
