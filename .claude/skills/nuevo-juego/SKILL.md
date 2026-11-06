---
name: nuevo-juego
description: Crea un juego jugable nuevo para Arcade Vault (desde una referencia en references/ o desde cero) con la misma integración que CAÍDA y ROCAS — carpeta games/<id>/, registro en PLAYABLE, HUD, pausa, modal de fin de partida y puntuación guardada en Supabase (tabla scores vía submitScore). Escribe primero el spec del juego y luego guía su implementación. Úsalo cuando el usuario quiera añadir, portar o hacer jugable un juego del catálogo.
argument-hint: "<id o nombre del juego> [ruta de referencia, p. ej. references/arkanoid]"
---

# /nuevo-juego — Juego nuevo integrado con el Vault

## Contexto de la sesión

Fecha de hoy (para la cabecera del spec, no la adivines):
!`date +%F`

Juegos reales que ya existen (`games/`):
!`ls games/`

Specs existentes:
!`ls specs/`

Referencias disponibles:
!`ls references/`

Estado del repo:
!`git status --short`

---

Este skill convierte una idea o una referencia en un juego jugable de la plataforma, **siguiendo Spec Driven Design**: primero el spec (`specs/NN-juego-<id>.md`), después la implementación contra ese spec. Lo que nunca cambia entre juegos es la **integración**: está fijada en [`integracion.md`](integracion.md) y no se negocia en cada spec.

Archivos de este skill (léelos cuando la fase lo pida, no antes):

- [`integracion.md`](integracion.md) — contrato obligatorio: archivos, registro, HUD, pausa, modal, ranking en Supabase, `<Activity>`, CSS. Es la fuente de verdad.
- [`spec-template.md`](spec-template.md) — esqueleto del spec de un juego (formato de SPEC 05/06).
- `scaffold/` — plantillas de `core.ts`, `render.ts`, `<id>-game.tsx` y `<id>.css` derivadas de ROCAS. Tienen extensión `.tpl` para que `tsc` y ESLint no las compilen.

Responde en el idioma del usuario (normalmente español). Los textos visibles del juego van en español.

## Fase 1 — Contexto

1. Lee `CLAUDE.md` y [`integracion.md`](integracion.md) completos.
2. Lee los dos specs de juego más recientes (`specs/05-juego-caida.md`, `specs/06-juego-rocas.md`) y `specs/07-leaderboard-supabase.md` para copiar tono, formato y nivel de detalle.
3. Identifica el juego:
   - **Entrada existente del catálogo** (`lib/games.ts`) que hoy usa el simulador: se reutiliza su `id`, `title`, `cover`, `color` y `cat`. Solo se ajusta `long` si las reglas reales no encajan con el texto.
   - **Juego nuevo**: hay que añadir una entrada a `GAMES` (id en kebab-case que cumpla `^[a-z0-9-]{1,32}$`, título en mayúsculas y en español) y una clase `cover-<algo>` en `app/globals.css` junto a las demás.
4. Identifica el origen:
   - **Con referencia** (`references/<carpeta>/` o una ruta que dé el usuario): lee **todo** el código de la referencia (README, CLAUDE.md, JS, CSS). Haz un inventario de reglas y valores numéricos exactos (velocidades, puntos, vidas, niveles, probabilidades, tamaños del canvas). Por defecto se portan **sin cambiar reglas ni valores**, como en SPEC 05 y 06.
   - **Desde cero**: diseña reglas originales dentro del género que describe el catálogo. No reproduzcas un juego comercial concreto (sus niveles, personajes, nombre o marca); toma solo las convenciones del género.
5. Lee `games/rocas/rocas-game.tsx` como implementación canónica de la integración (y `games/caida/` si el juego tiene preferencias, panel lateral o es por casillas).

## Fase 2 — Preguntas (no te la saltes)

Pregunta con `AskUserQuestion` lo que no puedas deducir de la referencia o del catálogo. Agrupa en una o dos rondas, con una opción recomendada primero. Temas habituales:

- **Reglas** (sobre todo si es desde cero): objetivo, cómo se pierde, vidas o no, niveles y cómo sube la dificultad.
- **Puntuación**: qué da puntos y cuántos. Siempre enteros entre 0 y 99 999 999 (límite de `scores`).
- **HUD**: Jugador y Puntuación son fijos; elige 1–2 más (Vidas, Nivel, Líneas, Tiempo…).
- **Modal de fin**: 1–3 datos `extra` (p. ej. Nivel, Rocas destruidas). No se guardan en Supabase (fuera de alcance de SPEC 07).
- **Controles** de teclado y si hay acción de un solo disparo por pulsación.
- **Campo lógico**: tamaño fijo del canvas (p. ej. 800×600, 300×600) y proporción.
- **Estética**: paleta neón de la plataforma (cyan, magenta, amarillo, verde) y color del catálogo.
- **Preferencias** en `localStorage` (skins, tema, nivel inicial): por defecto ninguna. Si las hay, claves `av_<id>_*`.
- **Fuera de alcance**: táctil, sonido, enemigos o modos extra. Por defecto todo fuera, como en specs anteriores.

No preguntes por la integración (HUD, pausa, modal, guardado, Supabase): está decidida en `integracion.md`.

## Fase 3 — Escribir el spec

1. Número: el siguiente libre en `specs/` (dos dígitos). Nombre: `specs/NN-juego-<id>.md`.
2. Rellena [`spec-template.md`](spec-template.md). Todo lo que diga `<…>` se sustituye; las secciones de integración ya vienen escritas y solo se adaptan los nombres.
3. Muestra un resumen al usuario (alcance, reglas clave, HUD, extra del modal, decisiones) y pide aprobación. Estado `Borrador` hasta que apruebe; entonces `Aprobado`.
4. No escribas código de juego en esta fase.

## Fase 4 — Implementación

Cuando el spec esté aprobado, dile al usuario que lo implemente con `/spec-impl NN-juego-<id>` (crea la rama `spec-NN-juego-<id>`, como las PR anteriores). Si pide que lo hagas tú en esta misma sesión, crea esa rama y sigue el plan del spec paso a paso, verificando cada paso.

Durante la implementación:

1. Copia los `scaffold/*.tpl` a `games/<id>/`, quitando `.tpl` y renombrando `game.tsx` → `<id>-game.tsx` y `game.css` → `<id>.css`. Sustituye `__id__` (id del catálogo), `__Pascal__` (id en PascalCase sin guiones: `duelo-pixel` → `DueloPixel`) y los `TODO`.
2. Usa `/frontend-design` para la UI (indicación de `CLAUDE.md`).
3. Registra el componente en `games/index.ts` (`PLAYABLE`). Eso solo ya activa el ranking: `isRanked(id)` pasa a `true`, la ficha y el Salón ya leen `top_scores` para ese id.
4. **No hace falta migración de Supabase**: la tabla `scores` es común a todos los juegos. Solo habría migración si el spec pide guardar datos nuevos, y eso va en su propio spec.
5. Recorre la checklist de verificación de `integracion.md` (build, lint, navegador y Supabase) antes de marcar los criterios del spec.
6. Al terminar, cambia el estado del spec a `Implementado`, marca los criterios cumplidos y anota en ellos lo que quede pendiente.
