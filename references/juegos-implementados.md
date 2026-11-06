# Juegos implementados en Arcade Vault

> Actualizado: 2026-11-06 (tras SPEC 09).
> Fuente: `games/index.ts` (registro `PLAYABLE`), `lib/games.ts` (catálogo) y los specs `specs/05`, `06`, `08` y `09`.

Hay **4 juegos jugables** de los 8 del catálogo. Todos están registrados en `PLAYABLE`, así que son _ranked_: al terminar, la puntuación se guarda en Supabase (`submitScore` → RPC `submit_score`, tabla `public.scores`) y aparece en `/juegos/<id>` y en `/salon?juego=<id>`.

## Resumen

| Juego         | Id              | Categoría | Color   | Spec | Origen                                 | Canvas  |
| ------------- | --------------- | --------- | ------- | ---- | -------------------------------------- | ------- |
| CAÍDA         | `caida`         | PUZZLE    | magenta | 05   | Port de `references/claude-tetris/`    | 300×600 |
| ROCAS         | `rocas`         | SHOOTER   | yellow  | 06   | Port de `references/asteroids/`        | 800×600 |
| BLOQUE BUSTER | `bloque-buster` | ARCADE    | cyan    | 08   | Port de `references/arkanoid/`         | 480×640 |
| SERPENTINA    | `serpentina`    | ARCADE    | green   | 09   | Diseño original (género serpiente)     | 576×576 |

Comunes a los cuatro: pantalla de inicio "¿JUGAMOS?" (JUGAR o Enter), HUD de la plataforma (Jugador, Puntuación, … y PAUSA / FIN / SALIR), menú de pausa con P / Esc (Reanudar, Reiniciar, Ver controles), pausa automática al perder el foco y fin de partida con `components/game-over-modal.tsx`.

---

## CAÍDA (`caida`)

Piezas que caen: encájalas y limpia líneas antes de llegar al techo.

- **Carpeta:** `games/caida/` — `core.ts`, `skins.ts`, `prefs.ts`, `caida-game.tsx`, `caida.css`.
- **Tablero:** 10×20.
- **Piezas:** 12 (7 estándar, 3 pentominós `PLUS` / `U` / `Y`, especiales `SINGLE` / `RING`), con pesos de aparición. Un Tetris da de premio una pieza `SINGLE`.
- **Puntuación:** líneas `[0, 100, 300, 500, 800] × nivel`, soft drop +1 por fila, hard drop +2 por celda. Combo y combo máximo.
- **Nivel:** sube cada 10 líneas. Nivel inicial elegible (1–10) en la pausa.
- **Extras:** pieza fantasma, vista de la siguiente, wall kicks, skins (Retro, Neon, Pastel, Pixel art) y tema claro/oscuro solo del área del juego.
- **Controles:** ← → mover · ↑ / X rotar · ↓ bajar · Espacio caída · P / Esc pausa.
- **HUD:** Jugador, Puntuación, Líneas, Nivel.
- **Modal (extra):** líneas y combo máximo.
- **localStorage:** `av_caida_skin`, `av_caida_theme`, `av_caida_start_level`.

## ROCAS (`rocas`)

Nave en gravedad cero que pulveriza asteroides.

- **Carpeta:** `games/rocas/` — `core.ts`, `render.ts`, `rocas-game.tsx`, `rocas.css`.
- **Campo:** 800×600 toroidal (los bordes se atraviesan).
- **Rocas:** tamaños 3/2/1 (radios 50/30/16), puntos 20/50/100. Se parten en dos del tamaño inferior.
- **Niveles:** 4 rocas grandes en el nivel 1; después `3 + nivel`.
- **Vidas:** 3. Al morir, reaparición en el centro con 3 s de invencibilidad.
- **Power-up "3x":** 15 % por roca destruida (garantizado a la 5.ª baja, máx. uno por nivel). Da 5 s de disparo triple.
- **Controles:** ← → rotar · ↑ propulsar · Espacio disparar · P / Esc pausa.
- **HUD:** Jugador, Puntuación, Vidas, Nivel.
- **Modal (extra):** nivel y rocas destruidas.
- **localStorage:** ninguno.

## BLOQUE BUSTER (`bloque-buster`)

Rompeladrillos: rebota la pelota y destruye tres muros de neón.

- **Carpeta:** `games/bloque-buster/` — `core.ts`, `render.ts`, `prefs.ts`, `bloque-buster-game.tsx`, `bloque-buster.css`. Sonidos en `public/games/bloque-buster/sounds/`.
- **Niveles:** 3 fijos. Velocidad de la pelota 300 / 345 / 390 px/s. Superar el nivel 3 es victoria.
- **Ladrillos:** gris blindado (2 golpes, 50), amarillo 120, rosa 110, magenta 100, rojo 90, verde 80, cian 70.
- **Vidas:** 3. Se pierde una cuando cae la última pelota.
- **Multibola:** 10 % por ladrillo roto de soltar una cápsula "+3" que añade 3 pelotas.
- **Sonido:** rebote y rotura, con botón SONIDO: SÍ / NO y tecla M.
- **Controles:** ← → o A D mover · ratón mueve la paleta · Espacio / clic lanzar o continuar · M silencio · P / Esc pausa.
- **HUD:** Jugador, Puntuación, Vidas, Nivel.
- **Modal (extra):** nivel, ladrillos rotos y resultado (VICTORIA / DERROTA).
- **localStorage:** `av_bloque-buster_muted`.

## SERPENTINA (`serpentina`)

Serpiente de luz que crece sin morder su propia cola.

- **Carpeta:** `games/serpentina/` — `core.ts`, `render.ts`, `serpentina-game.tsx`, `serpentina.css`.
- **Tablero:** 24×24 casillas. Muros mortales y autocolisión.
- **Inicio:** longitud 3, quieta hasta la primera dirección válida.
- **Velocidad:** un paso cada `max(0,06; 0,15 − 0,01 × (nivel − 1))` s (mínimo en el nivel 10).
- **Núcleo magenta:** +`10 × nivel` y crece 1. Nivel +1 cada 5 núcleos.
- **Núcleo dorado (bonus):** aparece con cada 5.º núcleo durante 5 s. +`50 × nivel`, no alarga.
- **Cola de giros:** hasta 2 direcciones pendientes.
- **Controles:** flechas o W A S D · P / Esc pausa.
- **HUD:** Jugador, Puntuación, Nivel, Longitud.
- **Modal (extra):** nivel, longitud y bonus atrapados.
- **localStorage:** ninguno.

---

## Aún con simulador

Usan `components/game-player.tsx` (la puntuación sube sola y no entra en el ranking):

| Juego       | Id            | Categoría |
| ----------- | ------------- | --------- |
| GLOTÓN      | `gloton`      | ARCADE    |
| INVASORES   | `invasores`   | SHOOTER   |
| RANARIA     | `ranaria`     | ARCADE    |
| DUELO PIXEL | `duelo-pixel` | VERSUS    |

Para hacer jugable uno de estos, usa la skill `/nuevo-juego`.
