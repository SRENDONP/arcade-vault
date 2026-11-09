# SPEC 11 — Diseño responsive para móviles

> **Estado:** Implementado
> **Depende de:** SPEC 01, SPEC 02, SPEC 05, SPEC 06, SPEC 08, SPEC 09, SPEC 10
> **Fecha:** 2026-11-08
> **Objetivo:** Que todas las pantallas de Arcade Vault, incluidos los cinco juegos jugables, se vean completas y sin scroll horizontal desde 360 px de ancho, y que el reproductor quede preparado para los futuros controles táctiles, de igual manera debe poderse ver desde el laptop, como esta ahora que funciona bien en laptop.

---

## Por qué existe este spec

Un próximo spec añadirá controles táctiles a los juegos. Antes, la aplicación tiene que verse bien en un móvil.
Una auditoría con Playwright a 360×740 (2026-11-08) encontró estos problemas:

- **Scroll horizontal en todas las rutas.** El documento mide 396 px en un viewport de 345 px. En la nav (< 840 px), el botón «Iniciar Sesión» se parte en dos líneas y empuja la hamburguesa (`.btn.ghost`, x 346→396) fuera de la pantalla, así que en móvil no se puede navegar. Al desplazar la página hacia la derecha se ve el panel lateral cerrado.
- **Inicio:** `.activity-card` se sale por la derecha (x 32→372).
- **Salón:** la columna de fecha de `.hall-table` (`.dt`, x 265→355) se sale. El podio en una columna queda en el orden 02 → 01 → 03, con el campeón en medio.
- **Detalle:** `.detail-cover` toca el borde (x 16→354).
- **Reproductor:** el canvas empieza en torno a y = 330, por debajo de la nav y del HUD, y ningún juego cabe en el viewport sin hacer scroll. En CAÍDA el CRT se estira a 1449 px de alto y la pieza siguiente (`caida-next`) queda en y ≈ 855.
- **Objetivos táctiles:** entre 1 y 9 controles por pantalla miden menos de 40 px (chips de filtro, pestañas del salón, botones del HUD).

DUELO PIXEL (SPEC 10) entra en este spec. Por eso este spec se implementa desde `main` después de mergear SPEC 10.

---

## Alcance

**Dentro:**

- **Ancho mínimo de 360 px.** Ninguna ruta tiene scroll horizontal ni contenido recortado a 360 px. Se verifica a 360×740, 390×844, 844×390 (móvil horizontal), 768×1024 y 1440×900.
- **Nav móvil (< 840 px):** en la barra solo quedan el logo y la hamburguesa. El botón de auth (`.auth-btn`) se oculta en la barra, porque el panel lateral ya ofrece Iniciar Sesión / Cuenta. El panel cerrado no genera scroll horizontal ni se ve al desplazar la página.
- **Desbordamientos de contenido:**
  - `/`: `.activity-card` y las filas del ticker caben a 360 px.
  - `/salon`: `.hall-table` cabe a 360 px. Por debajo de 520 px se oculta la columna de fecha (`.dt`) y se reparten las columnas restantes. El podio en una columna muestra el orden 01 → 02 → 03.
  - `/juegos/[id]`: `.detail-cover` y la cabecera del detalle respetan el margen lateral de 16 px.
  - `/biblioteca`, `/acerca-de`, `/auth` y `/404`: sin desbordamientos, con margen lateral de 16 px.
- **Objetivos táctiles de 44×44 px como mínimo** por debajo de 840 px: `.btn`, `.chip`, las pestañas del salón, los enlaces del panel móvil, la hamburguesa, los selects de skin y los botones del HUD. Se consigue con `min-height`/`min-width` o padding, sin agrandar la tipografía pixel.
- **Reproductor (`/juegos/[id]/jugar`) en los cinco juegos jugables** (CAÍDA, ROCAS, BLOQUE BUSTER, SERPENTINA, DUELO PIXEL) y en el simulador (`components/game-player.tsx`):
  - **Vertical (`max-width: 840px` y `orientation: portrait`):** HUD compacto en dos filas. La fila 1 tiene la puntuación y las estadísticas clave del juego. La fila 2 tiene los botones (PAUSA / FIN / SALIR), que reparten el ancho. Se ocultan la etiqueta «JUGADOR» y los textos secundarios de `.crt-bottom` (queda el LED). El canvas mantiene su proporción y su altura se limita al alto disponible.
  - **Horizontal (`max-height: 500px` y `orientation: landscape`):** el HUD pasa a una columna lateral a la izquierda del CRT. El canvas usa el alto disponible.
  - **Encaje en una pantalla:** tras hacer scroll hasta el HUD, el HUD y el canvas completo caben a la vez en el viewport (`100dvh`), en vertical y en horizontal. La nav del sitio se mantiene.
  - **CAÍDA:** el CRT deja de estirarse a todo el alto. La pieza siguiente y las estadísticas laterales se colocan junto al tablero o en una franja compacta, siempre visibles junto al tablero.
  - **Preparación táctil:** el alto disponible para el canvas se calcula con una variable CSS `--player-reserve` (por defecto `0px`) que el spec táctil podrá subir para hacer sitio a los controles. No se ve ningún hueco vacío.
- **Aviso táctil:** en dispositivos con `(pointer: coarse)` y sin `(any-pointer: fine)`, el overlay inicial de cada juego jugable muestra la línea «Controles táctiles próximamente · necesitas un teclado». El botón JUGAR sigue activo. El aviso es solo CSS (una clase compartida `.touch-notice` en `app/globals.css`, oculta por defecto), sin detección en JS.
- **Overlays y modal:** los overlays de los juegos (inicio, pausa, nivel superado) y `components/game-over-modal.tsx` caben a 360×740 y a 844×390 sin recortes. El modal hace scroll interno si no cabe.
- **Meta viewport:** se exporta `viewport` desde `app/layout.tsx` con `width: "device-width"`, `initialScale: 1` y `viewportFit: "cover"`. No se bloquea el zoom.

**Fuera de alcance (para futuros specs):**

- Controles táctiles de cualquier tipo (d-pad, botones virtuales, gestos, swipe, arrastre en canvas). Van en su propio spec.
- Ocultar la nav del sitio o usar pantalla completa (Fullscreen API) en el reproductor.
- Bloquear la orientación o mostrar avisos de «gira el móvil».
- Cambios en la lógica de los juegos (`games/<id>/core.ts`), en sus reglas o en la resolución lógica de los canvas.
- Rediseño visual: los colores, las tipografías, las skins y el estilo neón se mantienen; solo cambian el layout y los tamaños.
- Soporte por debajo de 360 px.
- PWA, manifest, iconos de instalación o modo offline.
- Juegos aún simulados (`gloton`, `invasores`, `ranaria`) más allá de que el simulador se vea bien.

---

## Modelo de datos

Este spec no introduce estructuras de datos, claves de `localStorage` ni cambios en Supabase.
Solo añade estos tokens de layout en `app/globals.css`:

```css
:root {
  --player-reserve: 0px; /* alto reservado bajo el CRT; el spec táctil lo sube */
  --tap-min: 44px; /* tamaño mínimo de un objetivo táctil */
}
```

Puntos de corte, reutilizando los que ya existen:

- `840px`: nav móvil, objetivos táctiles y HUD compacto del reproductor.
- `720px` / `520px`: tablas y rejillas de contenido (salón, ticker, features).
- `(orientation: landscape) and (max-height: 500px)`: reproductor en móvil horizontal.
- `(pointer: coarse) and (not (any-pointer: fine))`: aviso táctil.

---

## Plan de implementación

1. **Viewport y nav.** Exportar `viewport` en `app/layout.tsx`. En `app/globals.css`, ocultar `.av-nav .auth-btn` por debajo de 840 px y evitar que el panel cerrado genere scroll (`visibility: hidden` cuando no está `.open`, más `overflow-x: clip` en `body`). Comprobar a 360 px que la hamburguesa está visible y abre el panel.
2. **Tokens y objetivos táctiles.** Añadir `--tap-min` y `--player-reserve`. Aplicar el mínimo de 44 px a `.btn`, `.chip`, las pestañas del salón, los enlaces del panel y la hamburguesa por debajo de 840 px.
3. **Páginas de contenido.** Corregir `.activity-card`/ticker (`/`), `.detail-cover` (`/juegos/[id]`), la tabla y el orden del podio (`/salon`, `components/hall-of-fame.tsx` solo si el orden no se puede resolver con CSS `order`), y revisar `/biblioteca`, `/acerca-de`, `/auth` y `not-found`. Verificar a 360 px que no hay scroll horizontal.
4. **Reproductor base.** En `app/globals.css`, layout compartido de `.av-player`, `.player-hud`, `.crt` y `.crt-bottom` para vertical (HUD en dos filas) y horizontal (HUD en columna lateral), con el alto del canvas limitado por `100dvh`, la nav, el HUD y `--player-reserve`. Aplicarlo al simulador `components/game-player.tsx`.
5. **ROCAS y DUELO PIXEL** (canvas horizontales): ajustar `games/rocas/rocas.css` y `games/duelo-pixel/duelo-pixel.css` (y su JSX solo si hace falta reagrupar el HUD) para que encajen en una pantalla en ambas orientaciones.
6. **SERPENTINA y BLOQUE BUSTER** (canvas cuadrado y vertical): ajustar `games/serpentina/serpentina.css` y `games/bloque-buster/bloque-buster.css` igual que en el paso 5.
7. **CAÍDA.** Rehacer el layout móvil en `games/caida/caida.css` (y `caida-game.tsx` si hace falta mover el panel lateral): CRT sin estirarse, pieza siguiente y estadísticas visibles junto al tablero.
8. **Aviso táctil.** Añadir `.touch-notice` en `app/globals.css` y la línea en el overlay inicial de los cinco juegos.
9. **Overlays y modal.** Ajustar los overlays de los juegos y `.modal` (`components/game-over-modal.tsx`) para 360×740 y 844×390, con scroll interno en el modal.
10. **Documentación.** Añadir SPEC 11 a la tabla de `CLAUDE.md` y la regla «layout móvil: HUD compacto, `--player-reserve`, `.touch-notice`» a la sección Games, para que los juegos nuevos la cumplan. Si `/nuevo-juego` tiene scaffolds de CSS (`.claude/skills/nuevo-juego/`), incluir el bloque móvil en ellos.

Cada paso deja la app compilando (`npm run build`) y sin errores de `npm run lint`.

---

## Criterios de aceptación

- [x] A 360×740, en `/`, `/acerca-de`, `/biblioteca`, `/juegos/caida`, `/salon?juego=caida`, `/auth`, una ruta inexistente y las seis rutas `/jugar` (cinco juegos + `gloton`), `document.documentElement.scrollWidth` es igual a `clientWidth`.
- [x] A 360×740, la hamburguesa de la nav está dentro del viewport, abre el panel y el panel contiene Iniciar Sesión (o Cuenta con sesión).
- [x] A 360×740 no se ve el botón «Iniciar Sesión» en la barra; a 1440×900 sí.
- [x] Con el panel cerrado no se ve ninguna parte del panel en ningún punto del scroll.
- [x] A 360×740, en `/salon?juego=caida`, el primer bloque del podio es el 01 y la tabla no tiene columnas cortadas.
- [x] A 360×740, todo `.btn`, `.chip`, pestaña del salón, enlace del panel, hamburguesa y select de skin visible mide al menos 44 px de alto y de ancho.
- [x] En cada uno de los cinco juegos, a 360×740 y a 390×844, tras hacer scroll hasta el HUD, el HUD y el canvas completo caben a la vez en el viewport.
- [x] En cada uno de los cinco juegos, a 844×390, el HUD está a un lado del CRT y el canvas completo cabe en el alto del viewport.
- [x] En CAÍDA, a 360×740, la pieza siguiente es visible a la vez que el tablero completo.
- [x] El canvas de cada juego conserva su proporción (ancho/alto mostrado = ancho/alto lógico ±1 %).
- [x] Cambiar `--player-reserve` a `120px` en DevTools reduce el canvas para dejar ese hueco, sin scroll horizontal ni HUD cortado.
- [x] Con emulación táctil (Playwright `hasTouch` + `isMobile`), el overlay inicial de cada juego muestra «Controles táctiles próximamente · necesitas un teclado»; en escritorio con ratón no aparece.
- [x] El botón JUGAR sigue funcionando con la emulación táctil activa.
- [x] A 360×740 y a 844×390, el modal de fin de partida muestra el campo de nombre y el botón de guardar (con scroll interno si hace falta).
- [x] A 1440×900 todas las rutas se ven igual que antes del spec (comparación visual con capturas previas).
- [x] Ningún archivo `games/<id>/core.ts` cambia.
- [x] `npm run lint` y `npm run build` terminan sin errores.

---

## Decisiones

- **Sí:** ancho mínimo de 360 px. Cubre casi todos los móviles actuales; 320 px obligaría a recortar más la tipografía pixel a cambio de muy pocos dispositivos.
- **No:** 375 px como mínimo. Dejaría recortes en muchos Android de 360 px.
- **Sí:** vertical y horizontal en el reproductor. Los juegos anchos (ROCAS, DUELO PIXEL) se juegan mejor en horizontal y los controles táctiles necesitarán las dos.
- **No:** aviso de «gira el móvil» ni bloqueo de orientación. Añade fricción y el layout ya se adapta.
- **Sí:** aviso táctil discreto, solo con CSS (`pointer: coarse` sin `any-pointer: fine`). Avisa sin JS, sin parpadeo en hidratación y sin bloquear a quien tenga teclado Bluetooth.
- **No:** desactivar JUGAR en táctil. Ocultaría los juegos hasta el spec táctil sin necesidad.
- **Sí:** `--player-reserve` en lugar de una zona vacía visible. El spec táctil solo tendrá que subir el valor, y hasta entonces no hay huecos sin uso.
- **Sí:** mover auth al panel lateral en móvil. El panel ya lo ofrece, y la barra queda con logo + hamburguesa.
- **No:** icono de usuario compacto en la barra. Duplica la entrada del panel y compite por espacio con la hamburguesa.
- **Sí:** objetivos táctiles de 44×44 px (WCAG 2.5.5 / Apple HIG). Deja la base lista para los controles táctiles.
- **Sí:** HUD compacto en dos filas en vertical y en columna lateral en horizontal. Es lo que permite que canvas y HUD quepan en una pantalla.
- **No:** ocultar la nav del sitio en `/jugar`. Se valoró y se pospone; el encaje se mide tras hacer scroll hasta el HUD.
- **Sí:** reutilizar los puntos de corte existentes (840, 720, 520 px) en lugar de introducir una escala nueva.
- **Sí:** depende de SPEC 10. DUELO PIXEL entra en el alcance y se implementa desde `main` después de su merge.
- **Sí (en la implementación):** la nav móvil y los objetivos de 44 px también se aplican en `(orientation: landscape) and (max-height: 500px)`. A 844×390 se mostraba la nav de escritorio y desbordaba la página.
- **Sí (en la implementación):** en móvil horizontal la nav deja de ser fija (sticky). Sigue en la página, pero al hacer scroll hasta el juego todo el alto queda para el HUD y el CRT.
- **Sí (en la implementación):** en CAÍDA en horizontal, el panel lateral pasa a dos columnas (Siguiente | Skin, Tema), para que su alto no supere al del tablero cuando `--player-reserve` lo encoge.

---

## Riesgos

| Riesgo                                                                                                               | Mitigación                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `100dvh` cambia al aparecer o esconderse la barra del navegador móvil y el canvas "salta"                            | Usar `dvh` solo para el límite máximo del canvas y verificar en emulación de iPhone y Android.                 |
| Agrandar `.btn`/`.chip` a 44 px descuadra layouts de escritorio                                                      | La regla solo aplica por debajo de 840 px; criterio de comparación visual a 1440×900.                          |
| Los componentes de juego miden el canvas en pantalla para el ratón (BLOQUE BUSTER) y fallan al cambiar el tamaño CSS | La conversión ya usa `getBoundingClientRect`; probar el ratón en BLOQUE BUSTER a 1440 y 768 px tras el cambio. |
| `<Activity>` conserva la ruta oculta y un cambio de orientación mientras está oculta deja tamaños obsoletos          | El tamaño es solo CSS (sin medir en JS), así que se recalcula al volver a mostrarse.                           |
| `any-pointer: fine` da falsos positivos en tablets con stylus o ratón                                                | Es aceptable: el aviso es informativo y JUGAR siempre funciona.                                                |

---

## Lo que **no** está en este spec

- Controles táctiles (d-pad, botones virtuales, gestos, swipe).
- Pantalla completa u ocultar la nav al jugar.
- Bloqueo de orientación o aviso de girar el dispositivo.
- Cambios en `core.ts`, reglas o resolución lógica de los juegos.
- Rediseño visual, skins nuevas o cambios de paleta.
- Soporte por debajo de 360 px.
- PWA, manifest o modo offline.

Cada uno de esos, si llega, va en su propio spec.
