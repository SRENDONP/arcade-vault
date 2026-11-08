# Contrato de integración de un juego en Arcade Vault

Reglas fijadas por SPEC 05 (CAÍDA), SPEC 06 (ROCAS) y SPEC 07 (leaderboard en Supabase). Todo juego real las cumple. Si un spec necesita romper alguna, lo dice en **Decisiones** con su motivo.

Implementación canónica: `games/rocas/` (canvas + `core`/`render` separados). Para juegos por casillas, preferencias o panel lateral: `games/caida/`.

---

## 1. Archivos

```text
games/
  index.ts              # + <id>: <Pascal>Game en PLAYABLE
  <id>/
    core.ts             # lógica pura
    render.ts           # dibujo en canvas a partir del estado (opcional si el dibujo es trivial)
    <id>-game.tsx       # "use client": canvas, bucle, entrada, HUD, inicio, pausa, fin
    <id>.css            # estilos bajo .<id>-root
    skins.ts            # skins clasico / neon / retro (obligatorio, ver §7)
    prefs.ts            # preferencias en localStorage; como mínimo av_<id>_skin (ver games/caida/prefs.ts)
lib/games.ts            # entrada del catálogo (existente o nueva)
app/globals.css         # solo si el juego es nuevo: clase cover-<algo>
```

- `<id>` = `id` en `lib/games.ts`, kebab-case, `^[a-z0-9-]{1,32}$` (lo exige el CHECK de `scores.game_id`).
- No se toca `app/juegos/[id]/jugar/page.tsx`: ya renderiza `getPlayable(id) ?? GamePlayer`.
- No se toca `references/` (solo lectura).

## 2. `core.ts` — lógica pura

- Sin `react`, `window`, `document`, `performance`, `localStorage` ni `Math.random`.
- Aleatoriedad por `s.rng`, inyectada en `createState(rng)`; el componente pasa `Math.random`.
- Objetos planos tipados (no clases). `step(s, dt, input)` **muta** el estado.
- Unidades: px/s y segundos; origen arriba a la izquierda. `dt` ya viene limitado a `MAX_DT` (0.05).
- Juegos por ticks (caída de piezas, serpiente): acumulador de tiempo dentro de `step`, no `setInterval`.
- `EngineState` del motor (`"playing" | "gameover"`, más los que haga falta, p. ej. `"dead"`) ≠ `Phase` de la UI. `gameover` lleva la UI a `over`.
- `score` siempre **entero** y acotado a 0..99 999 999 (`MAX_SCORE` de `lib/scores.ts`).
- Con referencia: mismas reglas y valores. Diferencias justificadas (p. ej. descartar una pulsación pendiente al morir) van en Decisiones.
- Constantes exportadas en mayúsculas (`W`, `H`, `START_LIVES`, `MAX_DT`, puntos…).

## 3. `<id>-game.tsx` — componente

Firma: `export function <Pascal>Game({ game }: PlayableProps)`.

### Estado

- `Phase = "start" | "playing" | "paused" | "over"` y `PauseView = "main" | "controls"` en `useState`, con copia en `phaseRef` / `pauseViewRef` para los listeners.
- El estado del motor vive en `engineRef` (nunca en `useState`). `setStats` solo cuando cambia algo del HUD (`sameStats`), nunca en cada frame.
- La partida en curso no se persiste.

### Bucle

- `requestAnimationFrame` en un efecto que depende de `phase`; corre en `playing` (y en `over` solo si hay animación final).
- `last = performance.now()` al arrancar el efecto: al reanudar o volver a la ruta no hay salto de `dt`.
- Cada limpieza cancela el frame.

### `<Activity>` de cacheComponents

Salir con SALIR oculta la ruta pero conserva el estado de React; los efectos se desmontan y se vuelven a montar.

- Efecto de desmontaje: si la fase es `playing`, pasa a `paused` (vuelves y está en pausa).
- En `paused` se repinta el último frame al montar (el canvas puede venir vacío).
- Los refs del bucle no se reinician en las limpiezas.
- Criterio de aceptación: salir y volver no duplica bucles ni listeners.

### Teclado y foco

- Un único efecto registra `keydown`, `keyup`, `visibilitychange` y `blur`, y los quita en la limpieza.
- `preventDefault` en las teclas del juego (flechas, Espacio…) para que la página no haga scroll.
- `pressedRef` (teclas mantenidas) + `suppressedRef`: al empezar o reanudar, las teclas que sigan pulsadas se ignoran hasta soltarlas.
- Acciones de una vez por pulsación (disparar, rotar, hard drop): flag en ref consumido en el siguiente frame, ignorando `ev.repeat`.
- `start`: Enter / NumpadEnter empieza. `paused`: el juego no recibe teclas; ↑ ↓ recorren los botones; P / Esc reanudan (Esc en "Ver controles" vuelve al menú). `over`: el teclado es del modal.
- P / Esc en `playing` abren la pausa. Perder el foco (`blur`, pestaña oculta) abre la pausa y vacía `pressedRef`.
- Los botones hacen `blur()` tras el clic para que Espacio no los vuelva a pulsar.
- Foco inicial: JUGAR en `start`, REANUDAR en la pausa, VOLVER en "Ver controles".

### UI (textos exactos)

- Raíz: `<div className="<id>-root av-player fade-in">`.
- HUD `.player-hud` con `.hud-stat`: **Jugador** (`user?.name ?? "INVITADO"` de `useSession()`), **Puntuación** (`toLocaleString("es-ES")`) y los del spec (Vidas con `♥`, Nivel con dos dígitos `pad2`…). Botones `.hud-actions`: `PAUSA`/`REANUDAR` (`btn yellow`), `FIN` (`btn magenta`), ambos deshabilitados fuera de partida, y `SALIR` (`<Link href={`/juegos/${game.id}`} className="btn ghost">`).
- Marco `.crt` > `.crt-screen` con el `<canvas>` (resolución interna fija, `role="img"`, `aria-label`) y los overlays; `.crt-bottom` con `SEÑAL OK`, `{game.title} · CRT-83 · 60 HZ` y un dato.
- Overlay de inicio: `¿JUGAMOS?`, botón `JUGAR` (`btn lg pulse`), pista `o pulsa Enter`.
- Pausa: título `PAUSA`; `REANUDAR`, `REINICIAR`, `VER CONTROLES`; vista de controles con `VOLVER`.
- Lista de controles visible bajo el CRT y dentro de la pausa.
- La marca del juego original (Tetris, Asteroids, Arkanoid…) no aparece en ningún texto visible.

## 4. Fin de partida y ranking (Supabase)

```tsx
{
  phase === "over" && (
    <GameOverModal
      game={game}
      score={stats.score}
      ranked // obligatorio: los juegos reales pasan true
      extra={[{ label: "Nivel", value: pad2(stats.level) }]}
      onRestart={startRun}
    />
  );
}
```

- Se llega a `over` por el `gameover` del motor o por el botón FIN (que fija `s.state = "gameover"` con la puntuación actual).
- `components/game-over-modal.tsx` llama a la Server Action `submitScore()` (`app/juegos/actions.ts`), la **única** vía de escritura. Esta valida con `isRanked` y `validateScore` y llama a la RPC `submit_score` (security definer). Nunca escribas en `scores` desde el juego ni llames a la RPC directamente.
- `isRanked(id)` es `id in PLAYABLE`: registrar el juego en `games/index.ts` es lo que lo hace puntuar.
- La ficha `/juegos/<id>` (leaderboard + "Mejor global") y el Salón `/salon?juego=<id>` ya leen `top_scores` / `player_best` por `game_id`: no hay que tocarlos.
- **Sin migración**: `public.scores` es una tabla para todos los juegos. `extra` solo se muestra, no se guarda.
- Nada de récords locales (`av_<id>_best`, top 5 propio): duplicaría el ranking.

## 5. Estilos

- `games/<id>/<id>.css`, importado como `import "./<id>.css";` en el componente. Todas las reglas bajo `.<id>-root` (o clases con prefijo `<id>-`).
- Reutiliza las clases de la plataforma (`av-player`, `player-hud`, `hud-stat`, `btn`, `crt`, `crt-screen`, `crt-bottom`, `pixel`) y los tokens (`--cyan`, `--magenta`, `--yellow`, `--ink`, `--ink-dim`, `--pixel`, `--mono`).
- Canvas con resolución interna fija, escalado por CSS manteniendo proporción; el marco se estrecha con `100svh` para caber en pantallas bajas.
- Revisar a 1440 px y 390 px sin scroll horizontal del área del juego.
- Glow (`shadowBlur`) solo en los elementos principales, por rendimiento.

## 6. Preferencias (la del skin siempre; el resto solo si el spec las pide)

- Claves `av_<id>_*`, todo acceso en `try/catch` (ver `games/caida/prefs.ts`).
- Render inicial con valores por defecto; `readPrefs()` solo en `useEffect` (sin desajuste de hidratación).
- Valores inválidos → por defecto. Con `localStorage` bloqueado el juego se juega igual.

## 7. Skins (obligatorio)

Todo juego jugable trae al menos tres skins. El estándar completo y su auditoría los lleva el agente `skin-designer` (`.claude/agents/skin-designer.md`); patrón de código en `games/caida/`.

- `games/<id>/skins.ts`: `SkinName` con `"clasico" | "neon" | "retro"` (+ extras), `DEFAULT_SKIN = "clasico"`, `SKINS` con `label` (`Clásico`, `Neón`, `Retro`) y una paleta tipada con todos los colores del juego; `isSkinName` y `getSkin`.
  - **clásico**: la paleta neón de la plataforma (el aspecto por defecto del juego).
  - **neón**: fondo negro, colores saturados, contorno + `shadowBlur`.
  - **retro**: paleta limitada de 8 bits, sin glow, bordes duros/pixelados.
- `render.ts` recibe el skin (`drawFrame(ctx, state, skin)`); no hay constante `COLOR` fija.
- Preferencia `av_<id>_skin` (ver §6), leída con `useSyncExternalStore` como en `caida-game.tsx`; `data-skin` en el root; selector `<select>` fuera del menú de pausa que hace `blur()` al cambiar, y las teclas del juego se ignoran mientras el foco está en él.
- CSS por `.<id>-root[data-skin="…"]`.
- **Modo oscuro**: fondo oscuro en los tres skins; contraste ≥ 3:1 de cada elemento contra el fondo y ≥ 4.5:1 en textos.
- Los skins no cambian `core.ts` ni la puntuación.

## 8. Checklist de verificación

Build y código:

- [ ] `npm run lint` y `npm run build` sin errores; `/juegos/[id]/jugar` conserva el mismo tipo de ruta en la tabla del build.
- [ ] `grep -nE "react|window|document|performance|localStorage|Math\.random" games/<id>/core.ts` no devuelve usos.
- [ ] `games/index.ts` tiene la entrada `<id>`.

Navegador (`npm run dev`, Playwright o Chrome MCP):

- [ ] `/juegos/<id>/jugar` muestra `¿JUGAMOS?`; JUGAR o Enter empiezan.
- [ ] Las teclas del juego no hacen scroll; mantener la tecla de acción solo la ejecuta una vez.
- [ ] P, Esc y PAUSA congelan el juego; las teclas mantenidas al reanudar se ignoran hasta soltarlas; cambiar de pestaña pausa.
- [ ] REINICIAR, VER CONTROLES / VOLVER, FIN y JUGAR DE NUEVO funcionan.
- [ ] SALIR durante la partida y volver: en pausa, sin bucles ni listeners duplicados.
- [ ] Sin errores ni avisos de hidratación en consola.
- [ ] 1440 px y 390 px: el canvas cabe y mantiene la proporción.
- [ ] El selector cambia entre Clásico, Neón y Retro (Clásico por defecto), el skin persiste al recargar (`av_<id>_skin`) y los tres se leen bien en oscuro (§7).

Ranking (Supabase MCP):

- [ ] Guardar desde el modal con un nombre de prueba (p. ej. `TEST`) muestra `GUARDANDO…` y luego `PUESTO #N` con el top 10.
- [ ] `execute_sql`: `select game_id, name, score from public.scores where game_id = '<id>' order by created_at desc limit 5;` muestra la fila.
- [ ] Recargar `/juegos/<id>` y `/salon?juego=<id>` muestra la marca.
- [ ] Borrar las filas de prueba **tras confirmarlo con el usuario**: `delete from public.scores where game_id = '<id>' and name = 'TEST';`
- [ ] `/juegos/caida/jugar`, `/juegos/rocas/jugar` y un juego simulado siguen igual (el simulado con "MODO DEMO").

Cierre:

- [ ] Si el juego es nuevo en el catálogo: aparece en `/biblioteca` con su portada.
- [ ] `CLAUDE.md` solo se toca si el juego introduce una convención nueva.
