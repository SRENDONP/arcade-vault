# SPEC 06 — Segundo juego real: ROCAS (port del Asteroids de referencia)

> **Estado:** Implementado
> **Depende de:** SPEC 01, SPEC 05
> **Fecha:** 2026-11-03
> **Objetivo:** Hacer jugable `/juegos/rocas/jugar` con un port a TypeScript + React del Asteroids de `references/asteroids/`, alojado en `games/rocas/` y montado con el registro, el HUD, la pausa y el modal de fin de partida que fijó SPEC 05.

---

## Por qué existe este spec

El catálogo (`lib/games.ts`) ya tiene "ROCAS" (`id: "rocas"`, `SHOOTER`, portada `cover-rocas`, color `yellow`), descrito como una nave que pulveriza asteroides.
Hoy esa entrada usa el simulador `components/game-player.tsx`.
En `references/asteroids/` existe un Asteroids completo en un solo archivo vanilla (`game.js`, canvas 800×600): clases `Bullet`, `Asteroid`, `PowerUp`, `Ship`, `Particle`, espacio toroidal y power-up de disparo triple.
SPEC 05 dejó lista la convención `games/<id>/` y el registro `games/index.ts`; este spec es el segundo juego que la usa.
El nombre visible es "ROCAS"; la marca "Asteroids" no aparece en la UI.
Igual que CAÍDA, el resultado de la partida sale por `GameOverModal` + `saveScore()`, la vía única que un spec futuro conectará a Supabase.

---

## Alcance

**Dentro:**

- Carpeta `games/rocas/` y entrada `rocas: RocasGame` en `PLAYABLE` de `games/index.ts`.
- Port a TypeScript (sin DOM ni React) de la lógica de `game.js` en `games/rocas/core.ts`, **sin cambiar reglas ni valores**:
  - Campo lógico 800×600 con envolvimiento toroidal de nave, balas, rocas y power-ups.
  - Nave: rotación 3.5 rad/s, empuje 260 px/s², fricción 0.987, radio 12, cooldown de disparo 0.2 s, un disparo por pulsación de Espacio.
  - Balas: velocidad 520 px/s, vida 1.1 s.
  - Rocas: tamaños 3/2/1 con radios 50/30/16, velocidades base 32/55/85 (±15), puntos 20/50/100; se parten en dos del tamaño inferior; polígono irregular de 8–13 vértices.
  - Nivel 1 con 4 rocas grandes; cada nivel siguiente `3 + nivel` rocas; aparecen a más de 130 px del centro.
  - 3 vidas; al morir, 2 s de espera y reaparición en el centro con 3 s de invencibilidad (parpadeo).
  - Colisión nave–roca con factor `0.82` sobre el radio de la roca.
  - Power-up "3x": 15 % de probabilidad por roca destruida, garantizado a la 5.ª baja, máximo uno por nivel, dura 12 s en pantalla (parpadea los últimos 2 s) y da 5 s de disparo triple (abertura 0.18 rad).
  - Partículas de explosión (5 por tamaño de roca, 14 al morir la nave).
  - `dt` limitado a 50 ms.
- Dibujo en `games/rocas/render.ts` (recibe un `CanvasRenderingContext2D` y el estado; sin React): estilo vectorial de la referencia con paleta neón de la plataforma y glow (`shadowBlur`):
  - Nave y llama: cyan / naranja.
  - Rocas: amarillo (color del catálogo).
  - Balas: blanco.
  - Power-up "3x": magenta.
  - Partículas: blanco con alfa decreciente.
  - Sobre el canvas solo queda el contador `3x 4.2s` mientras dure el disparo triple; puntuación, nivel y vidas pasan al HUD de la plataforma.
- Client Component `games/rocas/rocas-game.tsx`:
  - HUD de la plataforma arriba: Jugador, Puntuación, Vidas, Nivel y botones PAUSA / FIN / SALIR.
  - Marco CRT con `<canvas>` de resolución interna 800×600, escalado por CSS en proporción 4:3 para caber en pantallas bajas o estrechas.
  - Lista de controles visible junto o bajo el canvas.
  - Bucle `requestAnimationFrame` con el estado del juego en refs.
  - Entrada de teclado: ← → rotar, ↑ propulsar, Espacio disparar, P / Esc pausa, con `preventDefault` en esas teclas.
- Pantalla de inicio "¿JUGAMOS?" con botón JUGAR (también Enter) antes de la primera partida.
- Menú de pausa (P / Esc o botón PAUSA): Reanudar, Reiniciar y Ver controles / Volver. Con el menú abierto el juego no recibe teclas, y las que sigan pulsadas al reanudar se ignoran hasta soltarlas. Perder el foco de la ventana con partida en curso abre la pausa.
- Fin de partida (última vida perdida o botón FIN) con `GameOverModal`, `extra` = Nivel y Rocas destruidas, y `onRestart` que empieza una partida nueva.
- Estilos en `games/rocas/rocas.css`, importado desde `rocas-game.tsx`, con todas las reglas bajo `.rocas-root`.
- Ajustar el texto `long` de `rocas` en `lib/games.ts`: se quita la frase de los OVNIs y se menciona el power-up de disparo triple.

**Fuera de alcance (para futuros specs):**

- Guardar puntuaciones en Supabase o mostrarlas en el Salón de la Fama / leaderboard de la ficha.
- Enemigo OVNI.
- Vida extra por puntos o cualquier otro cambio de balance.
- Skins, toggle de tema claro/oscuro o cualquier preferencia en `localStorage`.
- Controles táctiles o gestos en móvil.
- Sonido y música.
- Campo de juego que crece con la ventana.
- Cambios en la ficha `/juegos/rocas` aparte del texto `long`.
- Otros juegos del catálogo.
- Tests automatizados (no hay test runner configurado).
- Cambiar `references/asteroids/` (es solo referencia).

---

## Modelo de datos

```text
games/
  index.ts            # + rocas: RocasGame
  rocas/
    core.ts           # lógica pura (port de game.js), sin DOM, React ni localStorage
    render.ts         # dibujo en canvas a partir de RocasState
    rocas-game.tsx    # "use client": canvas, bucle, entrada, HUD, inicio, pausa, fin
    rocas.css         # estilos del área del juego, bajo .rocas-root
```

```ts
// games/rocas/core.ts
export const W = 800;
export const H = 600;
export const START_LIVES = 3;
export const RADII = [0, 16, 30, 50] as const; // por tamaño 1, 2, 3
export const SPEEDS = [0, 85, 55, 32] as const;
export const POINTS = [0, 100, 50, 20] as const;
export const POWERUP_DROP_CHANCE = 0.15;
export const POWERUP_GUARANTEED_KILLS = 5;
export const POWERUP_DURATION = 5; // s de disparo triple
export const POWERUP_TTL = 12; // s en pantalla
export const TRIPLE_SPREAD = 0.18; // rad
export const MAX_DT = 0.05;

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
  rng: () => number; // inyectable; la UI pasa Math.random
};

// Entrada de un frame: teclas mantenidas + disparo de un solo frame.
export type RocasInput = {
  left: boolean;
  right: boolean;
  thrust: boolean;
  fire: boolean;
};

export function createState(rng: () => number): RocasState; // = initGame(); rocas-game.tsx pasa Math.random
export function step(s: RocasState, dt: number, input: RocasInput): void; // muta s; dt ya limitado a MAX_DT
export function wrap(v: number, max: number): number;
```

```ts
// games/rocas/render.ts
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  s: RocasState,
  now: number,
): void;
// now = performance.now(), para el pulso del power-up y la llama aleatoria
```

```ts
// games/rocas/rocas-game.tsx — estado visible en React; el estado del bucle vive en refs
type Phase = "start" | "playing" | "paused" | "over";
type RunStats = {
  score: number;
  lives: number;
  level: number;
  destroyed: number;
};
```

Convenciones (las de SPEC 05):

- `core.ts` no importa React ni usa `window`, `document`, `performance` ni `localStorage`.
- Coordenadas con origen arriba a la izquierda; velocidades en px/s; tiempos en segundos.
- La aleatoriedad pasa por `s.rng`, nunca por `Math.random` directo dentro de `core.ts`.
- `EngineState` (`playing`/`dead`/`gameover`) es del motor; `Phase` es de la UI. `gameover` del motor lleva la UI a `over`.
- La partida en curso no se persiste. Este juego no crea claves `av_rocas_*`.
- `setState` de React solo cuando cambian puntuación, vidas, nivel, rocas destruidas o fase, nunca en cada frame.

---

## Plan de implementación

Usar la skill `/frontend-design` para el trabajo de UI (indicación de `CLAUDE.md`), tomando `references/asteroids/game.js` como referencia funcional y `games/caida/` como referencia de integración (HUD, overlays, pausa, limpieza del bucle).

1. **Lógica pura.** Crear `games/rocas/core.ts` portando `game.js` con los tipos y constantes del modelo de datos, sin cambiar reglas ni valores. Añadir el contador `destroyed`. El reinicio por Espacio en `gameover` no se porta (lo hace la UI). Verificar: `npm run build` pasa.
2. **Dibujo.** Crear `games/rocas/render.ts` con `drawFrame`: fondo, partículas, rocas, power-ups, balas, nave con parpadeo y llama, y el contador `3x`. Paleta neón del alcance con glow. Sin HUD de puntuación, nivel ni vidas en el canvas. Verificar: `npm run build` pasa.
3. **Componente jugable mínimo.** Crear `games/rocas/rocas-game.tsx` (`"use client"`) con el HUD de la plataforma, marco CRT, `<canvas>` 800×600, bucle `requestAnimationFrame` en refs y teclado (← → ↑ Espacio con `preventDefault`). Registrar `rocas: RocasGame` en `games/index.ts`. Al desmontar se cancela el frame y se quitan los listeners. Verificar: `/juegos/rocas/jugar` arranca una partida jugable con teclado.
4. **Inicio, pausa y fin.** Overlay "¿JUGAMOS?" con JUGAR (y Enter). Menú de pausa con Reanudar, Reiniciar y Ver controles / Volver; pausa por P, Esc, botón PAUSA, `visibilitychange` y `blur`. Teclas mantenidas al reanudar se ignoran hasta soltarlas. `gameover` del motor o el botón FIN abren `GameOverModal` con `extra` = Nivel y Rocas destruidas; `onRestart` llama a `createState()`. Verificar: todos los botones del menú y del modal funcionan.
5. **Estilos.** Crear `games/rocas/rocas.css` bajo `.rocas-root`: escalado 4:3 del canvas, overlays, lista de controles. Revisar a 1440 px y 390 px. Verificar: el canvas cabe sin scroll horizontal en ambos anchos.
6. **Catálogo y cierre.** Cambiar el `long` de `rocas` en `lib/games.ts` (sin OVNIs, con el power-up de disparo triple). Verificar: `npm run lint` y `npm run build` pasan.

---

## Criterios de aceptación

- [x] `npm run lint` termina sin errores.
- [x] `npm run build` termina sin errores y `/juegos/[id]/jugar` mantiene el mismo tipo de ruta que antes de este spec.
- [x] Existen `games/rocas/{core.ts,render.ts,rocas-game.tsx,rocas.css}` y `games/index.ts` tiene la entrada `rocas`.
- [x] `games/rocas/core.ts` no importa `react` ni usa `window`, `document`, `performance`, `localStorage` ni `Math.random`.
- [x] `/juegos/rocas/jugar` muestra la pantalla "¿JUGAMOS?"; pulsar JUGAR o Enter empieza la partida.
- [x] El canvas tiene `width=800` y `height=600` y se ve en proporción 4:3 a 1440 px y a 390 px de ancho sin scroll horizontal.
  - Nota: el área del juego no desborda a 390 px; la página sí desborda 6 px por el botón hamburguesa del nav de la plataforma (también en `/juegos/caida/jugar`). Queda para otro spec, junto con el botón "GUARDAR PUNTUACIÓN" del modal compartido, que se corta a 390 px.
- [x] La partida empieza con 4 rocas grandes, ninguna a menos de 130 px del centro, y la nave en el centro apuntando hacia arriba.
- [x] ← y → rotan la nave, ↑ la impulsa y al soltar se frena poco a poco.
- [x] Mantener Espacio dispara una sola bala; cada nueva pulsación dispara otra.
- [x] Pulsar flechas o Espacio durante la partida no hace scroll de la página.
- [x] Nave, balas, rocas y power-ups que salen por un borde reaparecen por el opuesto.
- [x] Destruir una roca grande, una mediana y una pequeña suma 20, 50 y 100 puntos, y la grande y la mediana se parten en dos.
- [x] Al vaciar el campo el HUD pasa a nivel 02 y aparecen 5 rocas grandes.
- [x] El HUD muestra Jugador, Puntuación, Vidas y Nivel; el canvas no dibuja puntuación, nivel ni vidas.
- [x] Chocar con una roca resta una vida, la nave reaparece en el centro unos 2 s después y parpadea mientras es invencible.
- [x] A más tardar en la 5.ª roca destruida de un nivel aparece un power-up "3x" magenta; recogerlo dispara 3 balas por pulsación durante 5 s y el canvas muestra el contador `3x`.
- [x] Nave, rocas y power-up se dibujan en cyan, amarillo y magenta con glow.
- [x] P, Esc y el botón PAUSA abren el menú de pausa y todo el campo se congela.
- [x] Con el menú abierto, las flechas no mueven la nave; al reanudar con una flecha pulsada, la nave no gira hasta soltarla.
- [x] "Ver controles" muestra la lista de controles y "Volver" regresa al menú.
- [x] "Reiniciar" empieza una partida nueva con puntuación 0, 3 vidas y nivel 01.
- [x] Cambiar a otra pestaña durante la partida la deja en pausa.
- [x] Perder la tercera vida abre el modal "FIN DEL JUEGO" con la puntuación final, el nivel y las rocas destruidas.
- [x] El botón FIN termina la partida en curso y abre el mismo modal con la puntuación actual.
- [x] "GUARDAR PUNTUACIÓN" añade a `av_scores` una entrada con `game: "rocas"`, la puntuación y las iniciales, y muestra "▸ PUNTUACIÓN GUARDADA_".
- [x] "JUGAR DE NUEVO" empieza una partida nueva con puntuación 0.
- [x] El juego no escribe ninguna clave `av_rocas_*` en `localStorage`.
- [x] Salir con SALIR durante una partida y volver no deja bucles ni listeners duplicados (la nave gira a velocidad normal y una pulsación de Espacio dispara una sola bala).
- [x] `/juegos/caida/jugar` sigue funcionando igual y `/juegos/bloque-buster/jugar` sigue mostrando el simulador.
- [x] La consola del navegador no muestra errores ni avisos de hidratación en `/juegos/rocas/jugar`.
- [x] La palabra "Asteroids" no aparece en ningún texto visible de la UI.
- [x] El texto `long` de `rocas` en `lib/games.ts` ya no menciona OVNIs y menciona el disparo triple.

---

## Decisiones

- **Sí:** el juego ocupa la entrada existente `rocas` del catálogo. Reutiliza nombre, portada y ficha; evita la marca "Asteroids" en la UI.
- **No:** añadir una entrada nueva `asteroids`.
- **Sí:** port a TypeScript + React con `<canvas>`, igual que CAÍDA. Mismas razones que en SPEC 05.
- **No:** iframe con el `game.js` original ni montar el JS vanilla vía refs.
- **Sí:** separar `core.ts` (reglas) de `render.ts` (dibujo). La referencia mezcla `update` y `draw` en cada clase; separarlos mantiene `core.ts` puro.
- **Sí:** objetos planos con tipos en lugar de clases. Encajan con un estado en refs mutado por `step`.
- **Sí:** `rng` inyectable en el estado. Permite partidas reproducibles para depurar y para tests futuros.
- **Sí:** `rng` obligatorio en `createState`; `rocas-game.tsx` pasa `Math.random`. Así `core.ts` no usa aleatoriedad global (decidido durante la implementación).
- **Sí:** una pulsación de Espacio con la nave muerta se descarta. En la referencia quedaba pendiente y disparaba al reaparecer.
- **Sí:** reglas y valores de la referencia sin cambios. Decisión del usuario; el balance va en otro spec.
- **No:** vida extra por puntos. Cambio de balance, fuera de este spec.
- **No:** OVNIs. La referencia no los tiene; se ajusta el texto de la ficha en vez de añadir un enemigo.
- **Sí:** estética vectorial neón (cyan, amarillo, magenta) con glow. Encaja con la plataforma sin rehacer el dibujo.
- **No:** fiel blanco y negro, ni selector de skins / tema como CAÍDA. Sin preferencias no hay claves `av_rocas_*`.
- **Sí:** HUD de la plataforma con Vidas y Nivel; el canvas solo conserva el contador `3x`. Evita información duplicada.
- **Sí:** modal de la plataforma con `extra` = Nivel y Rocas destruidas, guardando con `saveScore()`. Una sola vía de guardado, la que migrará a Supabase.
- **No:** guardar en Supabase en este spec. Necesita tabla, RLS y auth; va en el spec de puntuaciones.
- **No:** mejor puntuación local en `av_rocas_best`. Duplicaría el ranking futuro.
- **Sí:** pantalla "¿JUGAMOS?", menú de pausa (Reanudar, Reiniciar, Ver controles) y pausa al perder el foco, como CAÍDA pero sin nivel inicial.
- **Sí:** campo lógico fijo 800×600 escalado por CSS. La física y la dificultad no dependen del tamaño de pantalla.
- **No:** canvas a pantalla completa.
- **No:** controles táctiles. Van en otro spec.

---

## Riesgos

| Riesgo                                                                                               | Mitigación                                                                                                                               |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Bucles `requestAnimationFrame` o listeners duplicados al navegar, con `<Activity>` o con Strict Mode | Estado del bucle en refs que no se reinician en la limpieza; todo efecto cancela el frame y quita listeners; criterio de salir y volver. |
| Al reanudar o al volver a la ruta, el primer `dt` es enorme y las rocas "saltan"                     | Reiniciar el último timestamp al reanudar y al montar; `dt` limitado a 50 ms.                                                            |
| Espacio activa el botón enfocado (JUGAR, PAUSA) en lugar de disparar                                 | `preventDefault` en las teclas del juego y `blur()` de los botones tras el clic.                                                         |
| `shadowBlur` en muchas partículas baja los FPS                                                       | Glow solo en nave, rocas y power-up; partículas y balas sin glow si hace falta.                                                          |
| El canvas 800×600 no cabe en pantallas bajas o estrechas                                             | Escalado CSS 4:3 con resolución interna fija; revisar a 1440 px y 390 px.                                                                |
| En móvil el juego se ve pero no es jugable                                                           | Documentado como fuera de alcance; controles táctiles en un spec futuro.                                                                 |
| El CSS del juego afecta a otras páginas                                                              | Todas las reglas de `rocas.css` cuelgan de `.rocas-root`.                                                                                |

---

## Lo que **no** está en este spec

- Puntuaciones en Supabase y ranking real.
- Enemigo OVNI.
- Vida extra o cambios de balance.
- Skins, tema claro u otras preferencias.
- Controles táctiles.
- Sonido.
- Otros juegos del catálogo.
- Tests automatizados.

Cada uno de esos, si llega, va en su propio spec.
