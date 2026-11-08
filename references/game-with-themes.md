# Juegos con temas (skins)

Última actualización: 2026-11-08

Estándar: todo juego jugable tiene **Clásico** (por defecto, el look actual), **Neón** y **Retro**, legibles en modo oscuro (fondo con luminancia ≤ 0.05, elementos ≥ 3:1, textos ≥ 4.5:1).

| Juego         | id              | Clásico | Neón | Retro | Extras                | Default | Oscuro OK                  | Estado    | Última revisión |
| ------------- | --------------- | ------- | ---- | ----- | --------------------- | ------- | -------------------------- | --------- | --------------- |
| CAÍDA         | `caida`         | ❌      | ✅   | ✅    | `pastel`, `pixel`     | `retro` | parcial (fantasma 0.2)     | parcial   | 2026-11-08      |
| ROCAS         | `rocas`         | ✅      | ✅   | ✅    | —                     | `clasico` | sí (peor 5.15, powerUp clásico) | cumple    | 2026-11-08      |
| BLOQUE BUSTER | `bloque-buster` | ❌      | ❌   | ❌    | —                     | —       | parcial (techo, "+3")      | no cumple | 2026-11-08      |
| SERPENTINA    | `serpentina`    | ❌      | ❌   | ❌    | —                     | —       | sí (paleta fija actual)    | no cumple | 2026-11-08      |

## Pendientes

1. **CAÍDA** (`caida`) — añadir `clasico` (colores de `PIECE_DEFS` con bisel plano) y hacerlo `DEFAULT_SKIN`; renombrar la etiqueta `Neon` → `Neón`; el fantasma (alpha 0.2) queda en 1.1–1.7:1 en todos los skins (subir alpha o dibujarlo en contorno); `clasico` y `retro` no son legibles con `data-theme="light"` (O, SINGLE, I, J, L, S, Y < 3:1 sobre `#ffffff`). Respetar `av_caida_skin` ya guardado.
2. **SERPENTINA** (`serpentina`) — crear `skins.ts` (paleta = `COLOR` actual + `#ffd0e4` del brillo de comida), `prefs.ts` (`av_serpentina_skin`), selector en `.serpentina-skin-row`, `data-skin`, CSS por skin y guardia de teclado.
3. **BLOQUE BUSTER** (`bloque-buster`) — crear `skins.ts` con `COLOR` + `BRICK_COLOR` + blanco de destello/texto; ampliar `prefs.ts` (hoy solo `av_bloque-buster_muted`) con `av_bloque-buster_skin`; selector, `data-skin`, CSS y guardia; corregir texto "+3" (blanco sobre naranja 2.39:1) y techo (2.56:1); separar mejor ladrillo `magenta` y `red` (1.08:1 entre sí).

## Historial

- 2026-11-08 — caida: auditado
- 2026-11-08 — rocas: auditado
- 2026-11-08 — bloque-buster: auditado
- 2026-11-08 — serpentina: auditado
- 2026-11-08 — rocas: implementado (skins clasico, neon, retro)
