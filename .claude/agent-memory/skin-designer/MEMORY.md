# Memoria de skin-designer

Diseñador de skins de Arcade Vault. Estado por juego en [auditoria.md](auditoria.md) — léelo siempre antes de auditar o implementar.

## Estándar acordado con el usuario (2026-11-08)

- Mínimo 3 skins por juego jugable: `clasico` (por defecto, el look actual), `neon` y `retro`.
- Los skins extra existentes se conservan (CAÍDA: `pastel`, `pixel`; su `retro` actual se mantiene y se añade `clasico` como default).
- Cada skin debe verse bien en modo oscuro. El modo claro solo existe en CAÍDA y no se exige en el resto.
- Aplica a los juegos de `PLAYABLE` y a los futuros (contrato de `/nuevo-juego`, §7).

## Estado general

- 2026-11-08, primera auditoría: CAÍDA `parcial` (falta `clasico`); ROCAS, BLOQUE BUSTER y SERPENTINA `no cumple` (sin skins).
- 2026-11-08: ROCAS `cumple` (implementado a petición del usuario, saltándose el orden). Pendientes: caida → serpentina → bloque-buster.
- Ojo en juegos con teclas mantenidas (`pressedRef` leído por el bucle, p. ej. ROCAS): la guardia del `<select>` va antes de `pressed.add`, no después de las fases como en CAÍDA; si no, ↑ en el selector propulsa.
- Registro público del estado en `references/game-with-themes.md` (actualizar tras cada auditoría/implementación).

## Preferencias del usuario

- (ninguna registrada todavía)
