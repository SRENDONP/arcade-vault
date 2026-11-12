# Juegos con temas (skins)

Última actualización: 2026-11-11

Estándar: todo juego jugable tiene **Clásico** (por defecto, el look actual), **Neón** y **Retro**, legibles en modo oscuro (fondo con luminancia ≤ 0.05, elementos ≥ 3:1, textos ≥ 4.5:1).

| Juego         | id              | Clásico | Neón | Retro | Extras                | Default | Oscuro OK                  | Estado    | Última revisión |
| ------------- | --------------- | ------- | ---- | ----- | --------------------- | ------- | -------------------------- | --------- | --------------- |
| CAÍDA         | `caida`         | ✅      | ✅   | ✅    | `pastel`, `pixel`     | `clasico` | sí (peor 4.36 neón; claro 3.61) | cumple    | 2026-11-08      |
| ROCAS         | `rocas`         | ✅      | ✅   | ✅    | —                     | `clasico` | sí (peor 5.15, powerUp clásico) | cumple    | 2026-11-08      |
| BLOQUE BUSTER | `bloque-buster` | ✅      | ✅   | ✅    | —                     | `clasico` | sí (peor 3.45, gris dañado clásico) | cumple    | 2026-11-08      |
| SERPENTINA    | `serpentina`    | ✅      | ✅   | ✅    | —                     | `clasico` | sí (peor 3.49, cola neón)  | cumple    | 2026-11-08      |
| DUELO PIXEL   | `duelo-pixel`   | ✅      | ✅   | ✅    | —                     | `clasico` | sí (peor 4.14, meterOff clásico; retro meterOff subido a #7a7a96) | cumple    | 2026-11-08      |
| RANARIA       | `ranaria`       | ✅      | ✅   | ✅    | —                     | `clasico` | sí (peor 3.05, rana muerta retro en hierba; rana sobre nenúfar clásico 2.43 decorativa) | cumple    | 2026-11-11      |

## Pendientes

Ninguno: los seis juegos de `PLAYABLE` cumplen el estándar (RANARIA llega con sus skins en la fase 5 de la SPEC 13, aún sin commit en `spec-13-juego-ranaria`). Los juegos que se añadan a `PLAYABLE` entran aquí hasta tener sus tres skins.

## Historial

- 2026-11-08 — caida: auditado
- 2026-11-08 — rocas: auditado
- 2026-11-08 — bloque-buster: auditado
- 2026-11-08 — serpentina: auditado
- 2026-11-08 — rocas: implementado (skins clasico, neon, retro)
- 2026-11-08 — caida: implementado (skins clasico [nuevo, defecto], neon [label Neón], retro; extras pastel y pixel conservados; fantasma con contorno ≥ 3:1; paleta clara para clasico/retro)
- 2026-11-08 — serpentina: implementado (skins clasico, neon, retro)
- 2026-11-08 — bloque-buster: implementado (skins clasico, neon, retro; clásico con techo, "+3", gris dañado y rojo corregidos)
- 2026-11-08 — duelo-pixel: auditado (llega con clasico, neon y retro de la SPEC 10; todos los contrastes pasan)
- 2026-11-11 — ranaria: implementado (skins clasico, neon, retro; retro pixelado por reducción + cuantización a la paleta)
