# SPEC 12 — Controles táctiles en los juegos

> **Estado:** Implementado
> **Depende de:** SPEC 05, SPEC 06, SPEC 08, SPEC 09, SPEC 10, SPEC 11
> **Fecha:** 2026-11-08
> **Objetivo:** Que los cinco juegos jugables se puedan jugar en un móvil táctil con un componente reutilizable `TouchControls` (D-pad, botones A y B y pausa), que solo aparece en dispositivos táctiles y no tapa el canvas.

---

## Por qué existe este spec

SPEC 11 dejó el reproductor listo para móvil, pero los juegos solo responden al teclado.
En un táctil el overlay inicial muestra «Controles táctiles próximamente · necesitas un teclado».
SPEC 11 también dejó preparados `--player-reserve` (alto reservado bajo el CRT, hoy `0px`) y `--tap-min`.
Este spec usa esa reserva y sustituye el aviso por controles reales.

Cada juego tiene hoy su propio manejador de teclado en `games/<id>/<id>-game.tsx`, con su `pause()` / `resume()`.
El componente nuevo no conoce ningún juego: publica un estado de input y eventos, y cada juego los traduce a sus propias acciones.

---

## Alcance

**Dentro:**

- **Componente `TouchControls`** en `components/touch-controls.tsx` (Client Component), reutilizable por cualquier juego:
  - **D-pad** a la izquierda: una sola zona con las flechas ↑ ↓ ← →. Sigue al dedo: deslizar cambia de flecha sin levantar. Tiene 8 direcciones: una diagonal activa dos flechas a la vez (p. ej. ← + ↑). Zona muerta central del 25 % del radio, donde no hay ninguna flecha activa.
  - **Botones A y B** a la derecha, cada uno con su propio puntero.
  - **Botón de pausa** centrado arriba de la franja de controles (en horizontal, arriba de la columna de A/B). Muestra «❚❚» en partida y «▶» en pausa.
  - **Multitouch:** cada control sigue su propio `pointerId`. D-pad + A + B pueden estar activos a la vez.
  - **Eventos de puntero:** `pointerdown`, `pointermove` (solo D-pad), `pointerup`, `pointercancel` y `lostpointercapture`, con `setPointerCapture` en el `pointerdown`. Nada de `touchstart`/`mouse*`.
  - **Sin gestos del navegador:** `touch-action: none`, `user-select: none`, `-webkit-user-select: none`, `-webkit-touch-callout: none` y `preventDefault` en `contextmenu` sobre la capa de controles.
  - **Feedback visual** al pulsar: el control activo se ilumina (glow neón, fondo más claro y `transform: scale(0.94)`). En el D-pad se ilumina cada flecha activa.
  - **Tamaño mínimo de 48×48 px** por botón y por flecha del D-pad (D-pad total de al menos 3 × 48 px de lado).
  - **Repetición genérica opcional** por botón (`repeat: { delay, interval }`): mientras el botón sigue pulsado, reemite `onPress` con `repeated: true`.
  - **Botones sin uso:** un botón que el juego declara deshabilitado se ve atenuado (opacidad 0,35), no emite eventos y tiene `aria-disabled="true"`. El layout no cambia entre juegos.
  - **Liberación segura:** al perder el foco la ventana (`blur`), al ocultarse la página (`visibilitychange`), al desmontarse o al pasar `active={false}`, todos los controles se sueltan y se emite `onRelease` de cada uno que estuviera pulsado.
- **Estado de input** en `lib/touch-input.ts` (sin React ni DOM): tipos, `createTouchInput()` y helpers para leer y resetear el estado.
- **Visibilidad solo táctil, por CSS:** la capa de controles se muestra con `@media (pointer: coarse) and (not (any-pointer: fine))`, la misma condición que `.touch-notice` de SPEC 11. En escritorio con ratón no se renderiza visualmente (`display: none`) y no reserva espacio.
- **Layout sin tapar el canvas** (bloque compartido en `app/globals.css`, junto al de SPEC 11):
  - **Vertical (≤ 840 px, `portrait`):** franja bajo el CRT, con D-pad a la izquierda, A/B a la derecha y pausa centrada arriba. Dentro de la media query táctil, `--player-reserve` pasa a la altura de la franja, así el CRT se encoge y HUD + CRT + controles caben en `100dvh`.
  - **Horizontal (`max-height: 500px`, `landscape`):** dos columnas que flanquean el CRT. Izquierda: HUD compacto arriba y D-pad abajo. Derecha: pausa arriba y A/B abajo. El ancho del CRT se calcula con el ancho que dejan las dos columnas.
  - **Safe areas:** padding con `env(safe-area-inset-left/right/bottom)` en la franja y en las columnas (el `viewportFit: "cover"` ya lo exporta `app/layout.tsx`).
  - Ningún control se superpone a `.crt-screen` (el canvas) en ninguna de las cinco resoluciones de verificación.
- **Tema visual:** tokens existentes (`--bg-2`, `--line`, `--cyan`, `--magenta`, `--ink`, `--pixel`). D-pad y pausa en cian; A en magenta y B en amarillo, con las letras en `--pixel`. Mismo estilo de borde y glow que `.btn` / `.crt`. Las skins de cada juego no cambian los controles.
- **Integración en los cinco juegos** (`games/<id>/<id>-game.tsx`), con este mapeo:

  | Juego         | ↑                    | ↓                    | ← / →                 | A                   | B                     |
  | ------------- | -------------------- | -------------------- | --------------------- | ------------------- | --------------------- |
  | CAÍDA         | rotar (un toque)     | caída suave (repite) | mover (repite)        | rotar (un toque)    | caída dura (un toque) |
  | ROCAS         | empuje (mantener)    | — (sin efecto)       | girar (mantener)      | disparar (un toque) | empuje (mantener)     |
  | BLOQUE BUSTER | — (sin efecto)       | — (sin efecto)       | mover pala (mantener) | lanzar (un toque)   | lanzar (un toque)     |
  | SERPENTINA    | dirección (un toque) | dirección (un toque) | dirección (un toque)  | sin uso (atenuado)  | sin uso (atenuado)    |
  | DUELO PIXEL   | paleta (mantener)    | paleta (mantener)    | — (sin efecto)        | plasma (un toque)   | sin uso (atenuado)    |
  - «Un toque» = una acción por `onPress` no repetido (igual que `!ev.repeat` con el teclado).
  - «Mantener» = el juego lee el estado (`input.state`) en su bucle, igual que hoy lee `pressedRef`.
  - «Repite» = el juego pasa `repeat: { delay: 170, interval: 50 }` para ese control y actúa en cada `onPress`.
  - En SERPENTINA, una diagonal emite el `onPress` de la flecha nueva y el juego usa la última dirección pulsada.
  - El input táctil se combina con el teclado (OR): conectar un teclado Bluetooth sigue funcionando igual.

- **Pausa con la lógica existente:** el botón de pausa llama a las mismas funciones `pause()` / `resume()` de cada juego que el botón PAUSA del HUD y las teclas P / Esc. No hay una segunda implementación de pausa.
- **Estados:** `TouchControls` se renderiza siempre en el reproductor del juego (para que el layout no salte). Fuera de `playing` (en `start`, `paused` salvo el botón de pausa, y `over`) los controles de juego están inactivos (`active={false}`). El botón de pausa está habilitado en `playing` y `paused`, y deshabilitado en `start` y `over`.
- **Aviso táctil retirado:** se elimina `<p className="touch-notice">…</p>` de los cinco juegos y la regla `.touch-notice` de `app/globals.css`.
- **Documentación:** SPEC 12 en la tabla de `CLAUDE.md` y la regla «controles táctiles» en la sección Games. Los scaffolds de `/nuevo-juego` (`.claude/skills/nuevo-juego/`) incluyen `TouchControls` y su mapeo en el contrato de integración, en lugar del aviso.

**Fuera de alcance (para futuros specs):**

- Gestos (swipe, arrastre sobre el canvas, tocar el canvas para disparar).
- Vibración háptica (`navigator.vibrate`).
- Interruptor manual para forzar u ocultar los controles, o su persistencia en `localStorage`.
- Reasignar botones, cambiar tamaño u opacidad de los controles por el usuario.
- Mandos físicos (Gamepad API).
- Controles táctiles en el simulador (`components/game-player.tsx`) o en los juegos aún simulados (`gloton`, `invasores`, `ranaria`).
- Empezar la partida con A (se sigue tocando JUGAR) o navegar los menús de pausa con el D-pad (sus botones ya son táctiles).
- Cambios en `games/<id>/core.ts`, en las reglas o en la resolución lógica de los canvas.
- Pantalla completa, ocultar la nav o bloquear la orientación.

---

## Modelo de datos

No hay claves de `localStorage` ni cambios en Supabase.
Tipos nuevos en `lib/touch-input.ts`:

```ts
export type TouchButton = "up" | "down" | "left" | "right" | "a" | "b";

/** Estado actual: true mientras el control está pulsado. */
export type TouchInputState = Record<TouchButton, boolean>;

export type TouchRepeat = { delay: number; interval: number }; // ms

export type TouchPressEvent = { button: TouchButton; repeated: boolean };

export type TouchInput = {
  state: TouchInputState; // objeto mutable, lo leen los bucles de juego
};

export function createTouchInput(): TouchInput; // todo a false
export function releaseAll(input: TouchInput): TouchButton[]; // devuelve los que estaban pulsados
```

Props de `components/touch-controls.tsx`:

```ts
type TouchControlsProps = {
  input: TouchInput; // el juego lo crea con useState(createTouchInput)
  active: boolean; // false → suelta todo y no emite eventos
  disabled?: Partial<Record<TouchButton, boolean>>; // atenuados (p. ej. { a: true, b: true })
  repeat?: Partial<Record<TouchButton, TouchRepeat>>;
  onPress?: (ev: TouchPressEvent) => void;
  onRelease?: (button: TouchButton) => void;
  paused: boolean; // icono del botón de pausa
  pauseEnabled: boolean;
  onPauseToggle: () => void; // el juego pasa paused ? resume : pause
};
```

Convenciones:

- `TouchControls` escribe `input.state` y luego llama a `onPress` / `onRelease`. Nunca importa nada de `games/`.
- La geometría del D-pad se mide con `getBoundingClientRect` en cada `pointerdown` (sin cachear tamaños, por `<Activity>` y los cambios de orientación).
- El input táctil vive en un `useState(createTouchInput)` del juego: objeto mutable y estable que no se resetea en el cleanup de efectos (regla de `<Activity>` de `CLAUDE.md`). No es un `useRef` porque se pasa como prop en el render y la regla de lint `react-hooks/refs` no permite leer `ref.current` ahí.

Tokens CSS nuevos (en `app/globals.css`):

```css
:root {
  --touch-btn: 56px; /* lado de A, B y cada flecha del D-pad (mínimo 48px) */
  --touch-strip-h: calc(
    3 * var(--touch-btn) + 24px
  ); /* alto de la franja vertical */
}
```

---

## Plan de implementación

1. **Estado de input.** Crear `lib/touch-input.ts` con los tipos, `createTouchInput()` y `releaseAll()`. La app compila sin usarlo.
2. **Componente base.** Crear `components/touch-controls.tsx` con A, B y pausa: `pointerdown/up/cancel`, `setPointerCapture`, `lostpointercapture`, multitouch por `pointerId`, `disabled`, `active`, liberación en `blur`/`visibilitychange`/desmontaje y repetición opcional.
3. **D-pad.** Añadir el D-pad de una zona: ángulo y distancia desde el centro → flechas activas (8 direcciones, zona muerta del 25 %), con `pointermove` emitiendo `onRelease` / `onPress` al cambiar de flecha.
4. **Estilos.** En `app/globals.css`: tokens `--touch-btn` y `--touch-strip-h`, estilo neón de los controles y su estado pulsado, `touch-action: none` y demás, la media query táctil, el layout de franja (vertical, subiendo `--player-reserve`) y el de columnas (horizontal), con safe areas. Quitar `.touch-notice`.
5. **SERPENTINA** (piloto, solo eventos de un toque): integrar `TouchControls`, mapear el D-pad a direcciones, A/B deshabilitados, pausa con `pause()`/`resume()`. Quitar su `.touch-notice`. Verificar con emulación táctil.
6. **DUELO PIXEL y BLOQUE BUSTER** (estado mantenido + un toque): leer `input.state` en el bucle junto a `pressedRef` y mapear A (y B en BLOQUE BUSTER) a plasma / lanzar. Quitar su `.touch-notice`.
7. **ROCAS:** girar y empujar por estado (↑ o B), disparar con A por `onPress`. Quitar su `.touch-notice`.
8. **CAÍDA:** `repeat` en ← → ↓, rotar con ↑/A y caída dura con B por `onPress`. Ajustar su layout móvil (`games/caida/caida.css`) si el panel lateral no cabe con la franja. Quitar su `.touch-notice`.
9. **Documentación.** Añadir SPEC 12 a `CLAUDE.md` (tabla y sección Games: `TouchControls`, mapeo por juego, `--player-reserve` táctil, sin `.touch-notice`) y actualizar `.claude/skills/nuevo-juego/` (contrato de integración y scaffolds).

Cada paso deja la app compilando (`npm run build`) y sin errores de `npm run lint`.

---

## Criterios de aceptación

- [x] En escritorio con ratón (1440×900), ningún juego muestra los controles táctiles y el reproductor se ve igual que antes del spec (comparación con capturas previas).
- [x] Con emulación táctil (Playwright `hasTouch` + `isMobile`) a 360×740, 390×844 y 844×390, los cinco juegos muestran D-pad, A, B y pausa.
- [x] En esas tres resoluciones táctiles, ningún control se superpone al rectángulo de `.crt-screen` (comparación de `getBoundingClientRect`).
- [x] En esas tres resoluciones táctiles, tras hacer scroll hasta el HUD, HUD, canvas completo y controles caben a la vez en el viewport, sin scroll horizontal (`scrollWidth === clientWidth`).
- [x] A 844×390 el D-pad está a la izquierda del CRT y A/B a la derecha.
- [x] Cada botón A, B, pausa y cada flecha del D-pad mide al menos 48×48 px.
- [x] La capa de controles tiene `touch-action: none` (comprobado con `getComputedStyle`), y un arrastre sobre el D-pad no hace scroll de la página.
- [x] Con `env(safe-area-inset-*)` simulado (p. ej. `--sai-bottom` / padding en DevTools o emulación de iPhone), los controles no quedan bajo el inset.
- [x] Al pulsar un control aparece su estado activo (clase o atributo `data-pressed`) y desaparece al soltar o con `pointercancel`.
- [x] En ROCAS, con dos punteros simultáneos (D-pad ← y A), la nave gira a la izquierda y dispara a la vez.
- [x] En el D-pad, deslizar el dedo de ← a ↑ sin levantar suelta ← y pulsa ↑; la diagonal arriba-izquierda activa ← y ↑.
- [x] En CAÍDA, mantener → mueve la pieza una vez al pulsar y luego repite cada 50 ms tras 170 ms.
- [x] Cada fila de la tabla de mapeo se cumple en su juego (verificado jugando con emulación táctil).
- [x] En SERPENTINA, A y B se ven atenuados y no hacen nada; en DUELO PIXEL, B se ve atenuado.
- [x] El botón de pausa abre el mismo menú de pausa que el botón PAUSA del HUD y, en pausa, lo cierra (reanuda).
- [x] El botón de pausa está deshabilitado en el overlay inicial y con el modal de fin de partida.
- [x] Soltar todos los dedos fuera del control (o un `pointercancel`) deja `input.state` todo a `false`; al pausar o al perder el foco, la nave/paleta deja de moverse.
- [x] Con teclado y emulación táctil a la vez, las teclas siguen funcionando como antes.
- [x] Ningún juego muestra «Controles táctiles próximamente · necesitas un teclado» y `.touch-notice` no existe en `app/globals.css`.
- [x] `components/touch-controls.tsx` y `lib/touch-input.ts` no importan nada de `games/`.
- [x] Ningún archivo `games/<id>/core.ts` cambia.
- [x] `npm run lint` y `npm run build` terminan sin errores.

---

## Decisiones

- **Sí:** los cinco juegos en este spec. El componente se valida con usos reales distintos (un toque, mantener, repetición) y el aviso táctil desaparece de una vez.
- **No:** un juego piloto y el resto en specs aparte. Dejaría la plataforma a medias en móvil.
- **Sí:** franja bajo el CRT en vertical y columnas laterales en horizontal. El canvas nunca queda tapado y se aprovecha `--player-reserve` de SPEC 11.
- **No:** controles semitransparentes sobre el canvas. Tapan parte del juego, que el requisito prohíbe.
- **Sí:** estado mutable (`input.state`) + eventos `onPress`/`onRelease`. Cubre los juegos que leen teclas mantenidas en el bucle y las acciones de un toque, sin acoplar el componente a ningún juego.
- **No:** simular `KeyboardEvent` sintéticos. Acoplaría el componente a las teclas de cada juego y la autorrepetición habría que fingirla.
- **No:** solo estado leído en cada frame. Obligaría a cada juego a detectar flancos para rotar o disparar.
- **Sí:** visibilidad solo con CSS (`pointer: coarse` sin `any-pointer: fine`). Igual que el aviso de SPEC 11: sin JS, sin parpadeo en la hidratación.
- **No:** interruptor manual ni detección en JS al primer toque. Se podrá añadir en otro spec si hace falta.
- **Sí:** mapeo de la tabla, con los botones sin uso atenuados. El layout es igual en todos los juegos y el jugador ve qué botones no hacen nada.
- **No:** ocultar los botones sin uso. El layout cambiaría entre juegos.
- **Sí:** pausa centrada arriba de la franja (arriba de A/B en horizontal), llamando a `pause()`/`resume()` del juego. Nunca tapa el canvas y no duplica la lógica de pausa.
- **No:** pausa sobre la esquina del CRT o fija en el viewport. Taparía el juego o la nav.
- **Sí:** D-pad de una zona, con deslizamiento y 8 direcciones. ROCAS necesita girar y empujar con un pulgar, y deslizar es más natural que levantar el dedo.
- **No:** cuatro botones independientes. Cambiar de dirección obliga a levantar el dedo.
- **Sí:** repetición genérica opcional en `TouchControls` (170 ms / 50 ms en CAÍDA). Sustituye la autorrepetición del teclado sin que cada juego programe temporizadores.
- **Sí:** 56 px por control (mínimo 48 px). Supera el mínimo pedido y el `--tap-min` de 44 px de SPEC 11.
- **Sí:** `TouchControls` siempre montado, con `active={false}` fuera de partida. Evita saltos de layout al empezar o terminar.
- **Sí:** retirar `.touch-notice`. Su texto deja de ser cierto.
- **No:** vibración háptica. Safari en iOS no soporta `navigator.vibrate`; el feedback es visual.
- **No:** gestos sobre el canvas. Van en otro spec si se quieren.

---

## Riesgos

| Riesgo                                                                                                       | Mitigación                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Un `pointerup` se pierde (el dedo sale de la pantalla, notificación del sistema) y un control queda «pegado» | `setPointerCapture` + `pointercancel` + `lostpointercapture`, y `releaseAll` en `blur`, `visibilitychange`, pausa y desmontaje. |
| En móvil horizontal (390 px de alto) HUD + D-pad no caben en la columna izquierda                            | HUD compacto en esa columna; si no cabe, los botones del HUD pasan a una fila de iconos. Criterio a 844×390.                    |
| Subir `--player-reserve` deja el canvas demasiado pequeño en CAÍDA (vertical)                                | Ajuste propio en `games/caida/caida.css` (paso 8); se verifica que tablero y pieza siguiente siguen visibles a 360×740.         |
| `any-pointer: fine` oculta los controles en tablets con stylus o ratón                                       | Aceptable: ese usuario tiene un puntero fino y puede usar teclado. Un interruptor manual queda para otro spec.                  |
| iOS Safari hace zoom con doble toque o muestra el menú contextual al mantener pulsado                        | `touch-action: none`, `-webkit-touch-callout: none`, `user-select: none` y `preventDefault` en `contextmenu` sobre la capa.     |
| `<Activity>` conserva el juego oculto con controles pulsados                                                 | El cleanup del efecto suelta todos los controles; el estado vive en un ref y vuelve todo a `false`.                             |
| La emulación táctil de Playwright no reproduce bien el multitouch                                            | Verificar el multitouch con `dispatchEvent` de `PointerEvent` con dos `pointerId` distintos y, si es posible, en un móvil real. |

---

## Lo que **no** está en este spec

- Gestos (swipe, arrastre o toques sobre el canvas).
- Vibración háptica.
- Interruptor manual, reasignación, tamaño u opacidad configurables de los controles.
- Gamepad API.
- Controles táctiles en el simulador o en los juegos aún simulados.
- Empezar partida o navegar menús con el D-pad / A.
- Cambios en `core.ts`, reglas o resolución lógica de los juegos.
- Pantalla completa, ocultar la nav o bloquear la orientación.

Cada uno de esos, si llega, va en su propio spec.
