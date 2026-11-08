# SPEC NN — Juego real: ASEDIO (diseño original del género defensa radial)

> **Estado:** Borrador
> **Depende de:** SPEC 05, SPEC 06, SPEC 07
> **Fecha:** 2026-11-07
> **Objetivo:** Hacer jugable `/juegos/asedio/jugar` con un juego original del género defensa radial, alojado en `games/asedio/`, con el HUD, la pausa y el modal de fin de partida de la plataforma, y su puntuación en el ranking de Supabase.

---

## Por qué existe este spec

El catálogo no tiene este juego. Nace de la jam "Invasores" (`specs/game-jam/invasores/`), que aquí interpreta la invasión como un asedio: los invasores llegan en espiral desde todos los lados hacia un planeta que defiendes desde su órbita.
Tiene dos giros propios:

- **El cañón orbita el planeta** en lugar de girar sobre sí mismo. Siempre dispara hacia fuera, y para cubrir un flanco hay que desplazarse hasta él.
- **Tiro lejano y pulso:** derribar invasores lejos del planeta vale el doble, y las bajas cargan un pulso que limpia todo lo que esté cerca.

SPEC 05 y 06 fijaron la convención `games/<id>/` y el registro `games/index.ts`; SPEC 07 conectó el modal a Supabase. Al registrar `asedio` en `PLAYABLE`, el juego entra en el ranking sin migraciones.
El nombre visible es "ASEDIO"; ningún nombre de un juego comercial aparece en la UI.

---

## Alcance

**Dentro:**

- Carpeta `games/asedio/` y entrada `asedio: AsedioGame` en `PLAYABLE` de `games/index.ts`.
- Entrada nueva `asedio` en `GAMES` de `lib/games.ts`, tras `rocas`:
  - `title`: "ASEDIO"
  - `short`: "Defiende el planeta desde su órbita."
  - `long`: "Los invasores llegan en espiral desde todos los flancos. Orbita el planeta con tu cañón, derríbalos lejos para doblar los puntos y desata el pulso cuando se acerquen demasiado. Cada oleada superada repara un poco la corteza… y trae enemigos más rápidos."
  - `cat`: `"SHOOTER"`
  - `cover`: `"cover-asedio"`
  - `color`: `"cyan"`
  - `best`: `0`
  - `plays`: `"0"`
- Clase `cover-asedio` en `app/globals.css`, junto a las demás `cover-*`:
  - fondo `radial-gradient(circle at 50% 50%, #001a2a, #0a0a18)`;
  - en `::after`, un círculo cyan central de 22 px, una órbita fina punteada y 5–6 puntos verdes, magenta y amarillos alrededor (con `radial-gradient`);
  - `drop-shadow` cyan.
- Lógica pura en `games/asedio/core.ts`, con reglas originales:
  - **Campo lógico:** 600×600 px con centro en (300, 300). No es toroidal: lo que sale del campo desaparece.
  - **Planeta:** círculo de radio 40 (`PLANET_R`) en el centro. Integridad entera de 0 a 100, que empieza en 100.
  - **Cañón:** está en la órbita de radio 60 (`ORBIT_R`), en el ángulo `angle` (radianes; 0 = derecha; crece en sentido horario porque y apunta hacia abajo). Empieza en `−π/2` (arriba).
    - ← o A lo mueven en sentido antihorario (`angle −= 3 × dt`).
    - → o D, en sentido horario (`angle += 3 × dt`), con `ORBIT_SPEED = 3` rad/s.
  - **Disparo:** Espacio dispara una bala por pulsación hacia fuera del planeta, en la dirección `angle`.
    - Sale a radio 72 y viaja a 480 px/s (`BULLET_SPEED`). Es un círculo de radio 3.
    - Hasta 4 balas a la vez (`MAX_BULLETS`) y 0,18 s de espera (`FIRE_COOLDOWN`). Las pulsaciones que no cumplen se descartan.
    - La bala desaparece al salir del campo.
  - **Invasores:** se mueven en coordenadas polares `(r, phi)` respecto al centro.
    - Aparecen a `r = 440`, fuera del campo visible, con `phi` al azar (`s.rng`) y el sentido de giro al azar (±1).
    - En cada `step`, `r −= radial × m(wave) × dt` y `phi += spinSign × spin × m(wave) × dt`, con `m(wave) = min(1,6; 1 + 0,06 × (wave − 1))`.

    | Tipo      | Radio | Golpes | `radial` (px/s) | `spin` (rad/s) | Puntos | Daño al planeta |
    | --------- | ----- | ------ | --------------- | -------------- | ------ | --------------- |
    | Dardo     | 10    | 1      | 45              | 0,5            | 15     | 10              |
    | Coraza    | 14    | 2      | 30              | 0,3            | 40     | 20              |
    | Sembrador | 16    | 1      | 35              | 0,4            | 60     | 20              |

  - **Acierto:** una bala toca a un invasor si la distancia entre centros es ≤ radio del invasor + 3. La bala desaparece y el invasor pierde 1 golpe.
    - Si llega a 0, muere y suma `points × (r > 220 ? 2 : 1)`, el **tiro lejano** (`FAR_R = 220`, `FAR_MULT = 2`).
    - Cuentan `kills += 1` y `pulseKills += 1`.
    - Un Sembrador derribado por bala se parte en 2 Dardos a su mismo `r`, en `phi ± 0,15` rad, con sentidos de giro opuestos.
  - **Impacto en el planeta:** si `r − radio ≤ 40`, el invasor desaparece sin puntos y la integridad baja su daño (mínimo 0). El planeta destella 0,3 s. Con integridad 0 → `gameover`.
  - **Los invasores no chocan con el cañón:** cruzan la órbita sin efecto.
  - **Pulso:**
    - Empieza con 1 carga (`START_PULSES`), con un máximo de 2 (`MAX_PULSES`).
    - Cada 20 bajas por bala (`PULSE_EVERY`; `pulseKills` vuelve a 0) se gana 1 carga si hay menos de 2.
    - X (una vez por pulsación) con cargas: destruye todos los invasores con `r ≤ 160` (`PULSE_R`) y suma sus puntos sin tiro lejano. Los Sembradores no se parten.
    - Cuenta `kills` pero no `pulseKills`, resta 1 carga y suma 1 a `pulsesUsed`.
    - Sin cargas, X no hace nada.
  - **Oleadas:**
    - Cada oleada dura 30 s de partida (`WAVE_TIME`), y empieza en la 1.
    - Aparece un invasor cada `spawnInterval(wave) = max(0,45; 1,6 × 0,88^(wave − 1))` s.
    - El tipo se elige con `s.rng` según la oleada:
      - Oleada 1: solo Dardos.
      - Oleada 2: Dardo 80 %, Coraza 20 %.
      - Desde la 3: Dardo 60 %, Coraza 25 %, Sembrador 15 %.
    - Al cumplirse los 30 s:
      - suma `10 × integrity × wave` (`WAVE_BONUS`);
      - repara +10 de integridad (`REPAIR`, máximo 100);
      - sube `wave`;
      - muestra "OLEADA NN" en el canvas durante 1,5 s (`BANNER_TIME`), solo como aviso visual.
    - Los invasores en pantalla siguen ahí y la aparición no se detiene.
  - **Fin:** integridad 0. No hay vidas.
  - Contadores para el HUD y el modal: `integrity`, `wave`, `kills`, `pulsesUsed`.
  - Puntuación entera, acotada a `MAX_SCORE` (99 999 999).
  - `dt` limitado a 50 ms (`MAX_DT = 0.05`).
  - `s.time` (segundos de partida) para las animaciones. `core.ts` no usa `performance`.
- Dibujo en `games/asedio/render.ts`, neón vectorial con glow solo en lo principal:
  - Fondo oscuro con unas 60 estrellas fijas tenues (`--ink-faint`), generadas en `createState` con `s.rng`.
  - Círculo fino a `r = 220` muy tenue, que marca la zona de tiro lejano.
  - Órbita del cañón punteada tenue.
  - Planeta: círculo cyan (`--cyan`) con glow y dos líneas de latitud. Su color pasa a amarillo (`--yellow`) con integridad ≤ 50 y a magenta (`--magenta`) con ≤ 25, sin dibujar el número. Destella en blanco al recibir un impacto.
  - Cañón: triángulo amarillo apuntando hacia fuera con glow.
  - Balas amarillas.
  - Invasores:
    - Dardo: punta de flecha verde (`--green`) orientada hacia el planeta.
    - Coraza: cuadrado magenta girado 45°, con el contorno atenuado tras el primer golpe.
    - Sembrador: círculo amarillo con tres puntos internos.
  - Pulso: anillo cyan que se expande de 40 a 160 px en 0,4 s y se apaga.
  - Cargas del pulso: 2 pequeños rombos cyan bajo el planeta, encendidos según las cargas.
  - "+2×" breve sobre cada tiro lejano; "OLEADA NN" centrado mientras dura el aviso.
  - El canvas no dibuja puntuación, integridad numérica ni oleada en el marcador: van en el HUD.
- Client Component `games/asedio/asedio-game.tsx`:
  - HUD de la plataforma: Jugador, Puntuación, Integridad (`NN %`) y Oleada (dos dígitos, `pad2`), y botones PAUSA / FIN / SALIR.
  - Marco CRT con `<canvas>` de 600×600, escalado por CSS en proporción 1:1.
  - Lista de controles visible bajo el canvas.
  - Bucle `requestAnimationFrame` con el estado del juego en refs.
  - Teclado:
    - ← → o A D orbitan (teclas mantenidas).
    - Espacio dispara y X lanza el pulso (flags de una vez por pulsación, ignorando `ev.repeat`).
    - P / Esc pausa.
    - `preventDefault` en las flechas y en Espacio.
- Pantalla de inicio "¿JUGAMOS?" con JUGAR (también Enter).
- Menú de pausa (P / Esc o PAUSA): Reanudar, Reiniciar y Ver controles / Volver.
  - Con el menú abierto el juego no recibe teclas, y las que sigan pulsadas al reanudar se ignoran hasta soltarlas.
  - Perder el foco con partida en curso abre la pausa.
- Fin de partida con `GameOverModal` (`ranked`) y `onRestart` que empieza una partida nueva. Se llega con integridad 0 o con el botón FIN. `extra`:
  - Oleada: la alcanzada, con dos dígitos.
  - Eliminados: `kills`.
  - Pulsos usados: `pulsesUsed`.
- Guardado en Supabase por la vía existente (`submitScore` → `submit_score`). El ranking aparece en `/juegos/asedio` y `/salon?juego=asedio`.
- Estilos en `games/asedio/asedio.css`, con todas las reglas bajo `.asedio-root`.

**Fuera de alcance (para futuros specs):**

- Mejoras de la nave, potenciadores o tienda entre oleadas.
- Jefes de oleada y enemigos que disparan.
- Controles táctiles o gestos en móvil, y apuntar con el ratón.
- Sonido y música.
- Preferencias en `localStorage`.
- Guardar en Supabase la oleada, los eliminados o los pulsos.
- Otros juegos del catálogo (INVASORES y COLMENA tienen sus propios specs en esta jam).
- Tests automatizados (no hay test runner configurado).

---

## Modelo de datos

```text
games/
  index.ts            # + asedio: AsedioGame
  asedio/
    core.ts           # lógica pura, sin DOM, React ni localStorage
    render.ts         # dibujo en canvas a partir de AsedioState
    asedio-game.tsx   # "use client": canvas, bucle, entrada, HUD, inicio, pausa, fin
    asedio.css        # estilos del área del juego, bajo .asedio-root
lib/games.ts          # + entrada asedio
app/globals.css       # + .cover-asedio
```

```ts
// games/asedio/core.ts
export const W = 600;
export const H = 600;
export const CX = 300;
export const CY = 300;
export const MAX_DT = 0.05;

export const PLANET_R = 40;
export const START_INTEGRITY = 100;
export const ORBIT_R = 60;
export const ORBIT_SPEED = 3; // rad/s
export const START_ANGLE = -Math.PI / 2;

export const MUZZLE_R = 72;
export const BULLET_SPEED = 480; // px/s
export const BULLET_R = 3;
export const MAX_BULLETS = 4;
export const FIRE_COOLDOWN = 0.18; // s

export const SPAWN_R = 440;
export const FAR_R = 220;
export const FAR_MULT = 2;
export const SPLIT_DPHI = 0.15; // rad

export const ENEMIES = {
  dardo: { radius: 10, hp: 1, radial: 45, spin: 0.5, points: 15, damage: 10 },
  coraza: { radius: 14, hp: 2, radial: 30, spin: 0.3, points: 40, damage: 20 },
  sembrador: {
    radius: 16,
    hp: 1,
    radial: 35,
    spin: 0.4,
    points: 60,
    damage: 20,
  },
} as const;

export const SPEED_STEP = 0.06; // por oleada
export const MAX_SPEED_MULT = 1.6;
export const BASE_SPAWN = 1.6; // s
export const SPAWN_DECAY = 0.88;
export const MIN_SPAWN = 0.45; // s
export const WAVE_TIME = 30; // s
export const WAVE_BONUS = 10; // × integridad × oleada
export const REPAIR = 10;
export const BANNER_TIME = 1.5; // s

export const START_PULSES = 1;
export const MAX_PULSES = 2;
export const PULSE_EVERY = 20; // bajas por bala
export const PULSE_R = 160;
export const PULSE_FX = 0.4; // s, solo dibujo
export const HIT_FLASH = 0.3; // s, solo dibujo
export const STAR_COUNT = 60;

export type Kind = keyof typeof ENEMIES;
export type EngineState = "playing" | "gameover";
export type Vec = { x: number; y: number };

export type Enemy = {
  kind: Kind;
  r: number;
  phi: number;
  spinSign: 1 | -1;
  hp: number;
};
export type Bullet = { x: number; y: number; vx: number; vy: number };

export type AsedioState = {
  angle: number; // rad del cañón
  cooldown: number;
  bullets: Bullet[];
  enemies: Enemy[];
  integrity: number; // 0..100 entero
  wave: number;
  waveTime: number; // s dentro de la oleada
  spawnTimer: number;
  pulses: number;
  pulseKills: number;
  pulsesUsed: number;
  kills: number;
  pulseFx: number; // s restantes del anillo
  hitFlash: number; // s restantes del destello
  banner: number; // s restantes de "OLEADA NN"
  floaters: { x: number; y: number; ttl: number }[]; // "+2×", solo dibujo
  stars: Vec[];
  score: number;
  time: number; // s de partida
  state: EngineState;
  rng: () => number; // inyectable; la UI pasa Math.random
};

export type AsedioInput = {
  ccw: boolean; // ← / A mantenida
  cw: boolean; // → / D mantenida
  fire: boolean; // una vez por pulsación
  pulse: boolean; // una vez por pulsación
};

export function speedMult(wave: number): number;
export function spawnInterval(wave: number): number;
export function pickKind(wave: number, roll: number): Kind; // roll en [0, 1)
export function enemyPos(e: Enemy): Vec;
export function createState(rng: () => number): AsedioState;
export function step(s: AsedioState, dt: number, input: AsedioInput): void; // muta s
```

```ts
// games/asedio/render.ts
export function drawFrame(ctx: CanvasRenderingContext2D, s: AsedioState): void; // usa s.time
```

```ts
// games/asedio/asedio-game.tsx — estado visible en React; el del bucle en refs
type Phase = "start" | "playing" | "paused" | "over";
type PauseView = "main" | "controls";
type RunStats = {
  score: number;
  integrity: number;
  wave: number;
  kills: number;
  pulsesUsed: number;
};
```

Convenciones (las de SPEC 05/06, detalladas en `.claude/skills/nuevo-juego/integracion.md`):

- `core.ts` no importa React ni usa `window`, `document`, `performance`, `localStorage` ni `Math.random` (`Math.PI`, `Math.cos`, `Math.sin` sí).
- Coordenadas con origen arriba a la izquierda; velocidades en px/s y rad/s; tiempos en segundos.
- `EngineState` es del motor; `Phase` es de la UI. `gameover` lleva la UI a `over`.
- La partida en curso no se persiste. Este juego no crea claves `av_asedio_*`.
- `setState` solo cuando cambian los datos del HUD o la fase.

---

## Plan de implementación

Seguir `.claude/skills/nuevo-juego/integracion.md` y partir de `.claude/skills/nuevo-juego/scaffold/`. Usar `/frontend-design` para la UI y la portada, con `games/rocas/` como referencia de integración (canvas, balas y colisiones circulares).

1. **Catálogo.** Añadir la entrada `asedio` en `lib/games.ts` y la clase `cover-asedio` en `app/globals.css`. Verificar: `/biblioteca` muestra ASEDIO con su portada en el filtro SHOOTER y `/juegos/asedio` muestra su ficha.
2. **Lógica pura.** Crear `games/asedio/core.ts` desde `scaffold/core.ts.tpl` con los tipos, constantes y reglas del modelo de datos: órbita, balas, espirales, impactos, pulso y oleadas. Verificar: `npm run build` pasa.
3. **Dibujo.** Crear `games/asedio/render.ts` con `drawFrame`. Verificar: `npm run build` pasa.
4. **Componente jugable.** Crear `games/asedio/asedio-game.tsx` desde `scaffold/game.tsx.tpl`, con HUD, CRT, canvas, bucle y teclado. Registrar `asedio: AsedioGame` en `games/index.ts`. Verificar: `/juegos/asedio/jugar` arranca una partida jugable con teclado.
5. **Inicio, pausa y fin.** Overlay "¿JUGAMOS?", menú de pausa, pausa por foco y `GameOverModal` con `ranked` y `extra`. Verificar: todos los botones del menú y del modal funcionan.
6. **Estilos.** Crear `games/asedio/asedio.css` desde `scaffold/game.css.tpl`. Revisar a 1440 px y 390 px. Verificar: el canvas cabe sin scroll horizontal.
7. **Ranking y cierre.** Guardar una partida de prueba, comprobarla con `execute_sql` y en la ficha y el Salón, y borrar las filas de prueba tras confirmarlo con el usuario. Verificar: `npm run lint` y `npm run build` pasan.

---

## Criterios de aceptación

- [ ] `npm run lint` termina sin errores.
- [ ] `npm run build` termina sin errores y `/juegos/[id]/jugar` mantiene el mismo tipo de ruta.
- [ ] Existen `games/asedio/{core.ts,render.ts,asedio-game.tsx,asedio.css}` y `games/index.ts` tiene la entrada `asedio`.
- [ ] `games/asedio/core.ts` no importa `react` ni usa `window`, `document`, `performance`, `localStorage` ni `Math.random`.
- [ ] `/biblioteca` muestra ASEDIO (SHOOTER, cyan) con la portada `cover-asedio`, y `/juegos/asedio` muestra su ficha.
- [ ] `/juegos/asedio/jugar` muestra "¿JUGAMOS?"; JUGAR o Enter empiezan la partida.
- [ ] El canvas tiene `width=600` y `height=600` y mantiene la proporción 1:1 a 1440 px y 390 px sin scroll horizontal.
- [ ] Al empezar, el planeta está en el centro con integridad 100 %, el cañón arriba de la órbita, 1 carga de pulso encendida y la oleada 01.
- [ ] ← / A mueven el cañón en sentido antihorario y → / D en horario, siempre sobre la órbita y apuntando hacia fuera.
- [ ] Mantener Espacio dispara una sola bala; nunca hay más de 4 en pantalla.
- [ ] En la oleada 1 solo llegan Dardos en espiral desde fuera del campo; derribar uno suma 15, o 30 si estaba más allá del círculo de tiro lejano.
- [ ] Las Corazas aguantan 2 golpes y suman 40 (80 lejos); un Sembrador derribado por bala suma 60 (120 lejos) y se parte en 2 Dardos.
- [ ] Un invasor que llega al planeta resta 10 (Dardo) o 20 (Coraza, Sembrador) de integridad, y el planeta cambia de color al bajar de 50 y de 25.
- [ ] Cada 20 bajas por bala se gana una carga de pulso (máximo 2); X destruye todo lo que esté a 160 px o menos del centro y gasta una carga.
- [ ] Cada 30 s aparece "OLEADA NN", se suma `10 × integridad × oleada` y la integridad sube 10 (máximo 100); la siguiente oleada trae invasores más frecuentes y rápidos.
- [ ] Con integridad 0 termina la partida.
- [ ] Pulsar las teclas del juego no hace scroll de la página.
- [ ] El HUD muestra Jugador, Puntuación, Integridad y Oleada; el canvas no los duplica.
- [ ] P, Esc y el botón PAUSA abren el menú de pausa y el juego se congela, incluido el reloj de la oleada.
- [ ] Con el menú abierto las teclas no afectan al juego; al reanudar con una tecla pulsada, no actúa hasta soltarla.
- [ ] "Ver controles" muestra la lista y "Volver" regresa al menú.
- [ ] "Reiniciar" empieza una partida nueva con puntuación 0.
- [ ] Cambiar a otra pestaña durante la partida la deja en pausa.
- [ ] El fin de partida abre "FIN DEL JUEGO" con la puntuación final, Oleada, Eliminados y Pulsos usados.
- [ ] El botón FIN termina la partida y abre el mismo modal con la puntuación actual.
- [ ] "GUARDAR PUNTUACIÓN" muestra "GUARDANDO…" y después "PUESTO #N" con el top 10 y la fila del jugador resaltada.
- [ ] La fila guardada está en `public.scores` con `game_id = 'asedio'` y aparece en `/juegos/asedio` y `/salon?juego=asedio` tras recargar.
- [ ] "JUGAR DE NUEVO" empieza una partida nueva con puntuación 0.
- [ ] El juego no escribe claves `av_asedio_*`.
- [ ] Salir con SALIR durante una partida y volver la deja en pausa, sin bucles ni listeners duplicados.
- [ ] `/juegos/caida/jugar`, `/juegos/rocas/jugar` y el resto de juegos jugables siguen igual, y un juego simulado sigue mostrando "MODO DEMO".
- [ ] La consola no muestra errores ni avisos de hidratación en `/juegos/asedio/jugar`.
- [ ] Ningún nombre de un juego comercial aparece en los textos visibles.

---

## Decisiones

- **Sí:** entrada nueva `asedio` en el catálogo (SHOOTER, cyan, `cover-asedio`), con `best: 0` y `plays: "0"`. Es un juego nuevo y no se inventan estadísticas.
- **Sí:** diseño original del género, implementado en TypeScript + React con `<canvas>`, con `core.ts` puro separado de `render.ts`.
- **No:** iframe ni JS vanilla montado vía refs.
- **Sí:** `rng` inyectable en el estado. Partidas reproducibles para depurar.
- **Sí:** el juego forma parte de la jam junto a INVASORES y COLMENA. Decisión del usuario.
- **Sí:** el cañón orbita el planeta a radio fijo y dispara hacia fuera. Es el giro que lo distingue de ROCAS: no hay inercia ni nave libre, y cubrir un flanco cuesta desplazarse.
- **Sí:** los invasores no chocan con el cañón. Así la única amenaza es el planeta y se evitan muertes confusas al cruzar la órbita.
- **Sí:** tiro lejano ×2 más allá de 220 px. Premia anticiparse y diferencia a los buenos jugadores en el ranking.
- **Sí:** el pulso no cuenta para recargar el pulso ni parte Sembradores. Evita bucles de cargas gratis.
- **Sí:** oleadas por tiempo (30 s) en lugar de por bajas. La presión crece aunque el jugador se esconda, y la partida dura entre 3 y 8 minutos según la habilidad.
- **Sí:** el bonus de oleada depende de la integridad. Recompensa defender bien, no solo sobrevivir.
- **Sí:** HUD con Integridad y Oleada; modal con `extra` = Oleada, Eliminados y Pulsos usados.
- **Sí:** modal de la plataforma con `ranked`; guarda con `submitScore`, la única vía de escritura.
- **No:** migración de Supabase. `scores` es común a todos los juegos; los datos de `extra` no se guardan.
- **No:** récords locales del juego. Duplicaría el ranking.
- **Sí:** campo lógico fijo 600×600 escalado por CSS. La dificultad no depende de la pantalla.
- **No:** controles táctiles ni ratón. Van en otro spec.

---

## Riesgos

| Riesgo                                                               | Mitigación                                                                                                      |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Bucles o listeners duplicados al navegar (`<Activity>`, Strict Mode) | Estado del bucle en refs; toda limpieza cancela el frame y quita listeners; criterio de salir y volver.         |
| Salto de `dt` al reanudar o volver a la ruta                         | Reiniciar el último timestamp al arrancar el bucle; `dt` limitado a 50 ms.                                      |
| Espacio activa el botón enfocado                                     | `preventDefault` en las teclas del juego y `blur()` de los botones tras el clic.                                |
| Puntuación no entera o fuera de rango y el guardado falla            | Puntos e integridad enteros en `core.ts`; `validateScore` y la RPC rechazan el resto.                           |
| El canvas no cabe en pantallas bajas o estrechas                     | Escalado CSS con resolución fija; revisar a 1440 px y 390 px.                                                   |
| El CSS del juego afecta a otras páginas                              | Todas las reglas bajo `.asedio-root`.                                                                           |
| Tercer SHOOTER del catálogo y sensación parecida a ROCAS             | Órbita fija sin inercia, defensa de un objetivo y tiro lejano; si se elige, implementarlo después de INVASORES. |
| Un invasor que entra por el lado opuesto es imposible de alcanzar    | A 3 rad/s media vuelta cuesta ~1 s y un Dardo tarda ~8 s en cruzar de 440 a 50; el pulso cubre los descuidos.   |
| Demasiados invasores en oleadas altas y caída de rendimiento         | La aparición tiene un mínimo de 0,45 s; glow solo en planeta, cañón y pulso.                                    |

---

## Lo que **no** está en este spec

- Mejoras, potenciadores y jefes.
- Enemigos que disparan.
- Controles táctiles y ratón.
- Sonido.
- Preferencias en `localStorage`.
- Datos extra de la partida en Supabase.
- Tests automatizados.

Cada uno de esos, si llega, va en su propio spec.
