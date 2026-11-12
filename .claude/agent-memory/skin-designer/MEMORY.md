# Memoria de skin-designer

Diseñador de skins de Arcade Vault. Estado por juego en [auditoria.md](auditoria.md) — léelo siempre antes de auditar o implementar.

## Estándar acordado con el usuario (2026-11-08)

- Mínimo 3 skins por juego jugable: `clasico` (por defecto, el look actual), `neon` y `retro`.
- Los skins extra existentes se conservan (CAÍDA: `pastel`, `pixel`; su `retro` actual se mantiene y se añade `clasico` como default).
- Cada skin debe verse bien en modo oscuro. El modo claro solo existe en CAÍDA y no se exige en el resto.
- Aplica a los juegos de `PLAYABLE` y a los futuros (contrato de `/nuevo-juego`, §7).

## Estado general

- 2026-11-08, primera auditoría: CAÍDA `parcial` (falta `clasico`); ROCAS, BLOQUE BUSTER y SERPENTINA `no cumple` (sin skins).
- 2026-11-08: los cinco de `PLAYABLE` (rocas, caida, serpentina, bloque-buster, duelo-pixel) `cumple`. duelo-pixel llegó con skins de su spec (solo auditado).
- 2026-11-11: ranaria `cumple` (fase 5 de SPEC 13). Seis juegos, nada pendiente.
- Retro con formas rotadas/curvas (ranaria): mejor pixelar la escena entera (lienzo auxiliar → reducción nearest → cuantizar a la paleta → ampliar) que rasterizar forma a forma.
- Capturas en pausa con `backdrop-filter` salen espejadas en Playwright: es artefacto de captura, no del canvas.
- Ojo en juegos con teclas mantenidas (`pressedRef` leído por el bucle, p. ej. ROCAS): la guardia del `<select>` va antes de `pressed.add`, no después de las fases como en CAÍDA; si no, ↑ en el selector propulsa.
- Registro público del estado en `references/game-with-themes.md` (actualizar tras cada auditoría/implementación).
- `npx prettier --write games/<id>` reescribe el fin de línea de `core.ts`: formatea solo los archivos tocados o restaura `core.ts` con `git checkout`.
- Estilo `outline`: las marcas sobre formas translúcidas (ojos, cruz) van del color de la forma, no del fondo.
- CAÍDA: `sessionPrefs` manda sobre `localStorage` hasta recargar; para probar un skin vía `localStorage`, recarga.
- Distinguir colores entre sí: además de ratio de luminancia, uso ΔE (CIE76) ≥ ~30; rojo y magenta con ratio 1.0 pueden ser distinguibles por tono.
- `references/` (y submódulos como `references/arkanoid/`) es intocable salvo `references/game-with-themes.md`.
- Capturas de Playwright solo dentro del repo (`.playwright-mcp/`), no en el scratchpad.
- Navegador compartido entre agentes: la página puede cambiar entre llamadas; agrupa teclas en un solo `evaluate` y comprueba la URL tras cada captura.

## Preferencias del usuario

- (ninguna registrada todavía)
