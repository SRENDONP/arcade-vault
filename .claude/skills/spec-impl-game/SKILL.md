---
name: spec-impl-game
description: Implementa el spec aprobado de un juego (specs/NN-juego-<id>.md) con el mismo flujo que /spec-impl (validar estado Aprobado, rama spec-NN-<slug>, plan paso a paso con pausas) y, al terminar, lanza el agente skin-designer sobre el juego y después implementa sus controles táctiles móviles (SPEC 12).
disable-model-invocation: true
argument-hint: <NN-juego-id>
allowed-tools: Read, Glob, Grep, Edit, Write, AskUserQuestion, Agent, Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(git log:*), Bash(git diff:*), Bash(git stash:*), Bash(cat:*), Bash(ls:*), Bash(grep:*), Bash(npm run lint:*), Bash(npm run build:*)
---

# /spec-impl-game — Implementar un juego: spec → skins → controles táctiles

## Contexto de la sesión

Estado del repositorio:
!`git status --short`

Rama actual:
!`git branch --show-current`

Specs disponibles:
!`ls specs/ 2>/dev/null || echo "No existe la carpeta specs/"`

Configuración de ramas:
!`cat specs/.spec-config.yml 2>/dev/null || echo "AutoCreateBranch: true (por defecto, sin archivo de config)"`

Juegos jugables registrados:
!`grep -n "" games/index.ts 2>/dev/null | head -40`

---

## Instrucciones

Este comando **reutiliza `/spec-impl`** y le añade dos fases al final. Sigue las fases en orden estricto y **no avances si la anterior no terminó bien**. Todo el flujo se conversa en español.

El argumento recibido es: `$ARGUMENTS`

---

### Fases 1–4 — Igual que `/spec-impl`

1. Lee **completo** `.claude/skills/spec-impl/SKILL.md` (es la fuente de verdad; no lo copies ni lo modifiques: está fijado en `skills-lock.json`).
2. Ejecuta sus **Fases 1, 2, 3 y 4 exactamente como están escritas**, con `$ARGUMENTS` como argumento: localizar el spec, validar que el estado significa «Aprobado» (si no, el mismo mensaje de bloqueo, sin alternativas), comprobar el árbol de trabajo, crear o retomar la rama `spec-NN-slug` según `AutoCreateBranch`, mostrar objetivo / alcance / plan / criterios y pedir confirmación antes del Paso 1. Usa el contexto de sesión de arriba en lugar del suyo.
3. Las reglas de la Fase 4 valen para **todo** este comando, incluidas las Fases 5 y 6: nunca hacer commit automático, implementar lo que dice el spec, parar ante ambigüedades con 2–3 opciones, no meter nada fuera de alcance, pausar tras cada paso para revisar el diff.

**Comprobación adicional tras la Fase 2:** este comando es solo para juegos. Obtén el `<id>` del juego (el id de `lib/games.ts` que el spec usa en `games/<id>/`; normalmente el slug `juego-<id>`). Si el spec no es de un juego jugable, detente y sugiere usar `/spec-impl`.

**Al terminar el último paso del plan** no muestres todavía el cierre de `/spec-impl`. Di:

```
✅ Plan del spec implementado.

Siguen dos fases de este comando:
  5. Skins — lanzar el agente skin-designer sobre <id>
  6. Controles táctiles móviles (SPEC 12)

¿Lanzo el skin-designer?
```

y espera confirmación.

---

### Fase 5 — Skins con el agente `skin-designer`

1. Lanza el agente con la herramienta Agent, `subagent_type: "skin-designer"`, en primer plano. Prompt (rellena los valores):

   ```
   implementa <id>

   Contexto: acabamos de implementar specs/<NN-juego-id>.md en la rama
   <rama activa>. El juego ya está registrado en PLAYABLE. Si el plan del
   spec ya creó skins.ts / prefs.ts / selector, audítalos y completa o
   ajusta lo que falte para cumplir el estándar (Clásico por defecto, Neón,
   Retro, contraste en oscuro) en vez de rehacerlos. No toques core.ts, no
   cambies de rama y no hagas commits. Responde en español con tu formato
   de informe de implementación.
   ```

2. Cuando termine, resume su informe al usuario: archivos modificados, paletas y peor contraste por skin, resultado de lint/build y de la verificación en navegador, y **lo que no pudo verificar** (dilo tal cual, sin darlo por bueno).
3. Comprueba tú mismo: `git diff --stat` (que solo tocó `games/<id>/`, su memoria y `references/game-with-themes.md`) y `git diff --stat games/<id>/core.ts` vacío. Si tocó algo fuera de eso, señálalo.
4. Pausa: `Fase 5 completada. ¿Revisas el diff de los skins y sigo con los controles táctiles?` Espera confirmación. Si el usuario pide ajustes de skins, reenvíaselos al mismo agente con SendMessage (no lances uno nuevo).

---

### Fase 6 — Controles táctiles móviles (SPEC 12)

1. **Lee primero** (no asumas): la subsección «Controles táctiles (SPEC 12)» de `.claude/skills/nuevo-juego/integracion.md` §3, el bloque «Touch controls (SPEC 12)» de `CLAUDE.md`, `components/touch-controls.tsx`, `lib/touch-input.ts` y un juego de referencia ya integrado con el mismo tipo de mando (p. ej. `games/rocas/rocas-game.tsx` o `games/serpentina/serpentina-game.tsx`).
2. **Mapeo:** toma la tabla de mapeo táctil (↑ ↓ ← → A B) del spec. Si el spec no la trae o es ambigua, **detente** y propón 2–3 mapeos concretos con `AskUserQuestion` (indicando para cada botón si es _mantener_, _un toque_ o _repite_ y qué botones quedan `disabled`). No improvises.
3. **Estado actual:** `grep -n "TouchControls\|createTouchInput" games/<id>/<id>-game.tsx`. Si el plan del spec ya lo integró, revisa que cumpla el contrato y el mapeo y corrige solo lo que falte; dilo explícitamente.
4. **Implementa** en `games/<id>/<id>-game.tsx` (y `<id>.css` solo si el juego necesita ajustes propios):
   - `const [touch] = useState(createTouchInput)`; `<TouchControls>` como hijo directo de `.av-player`, justo después de `.crt`, siempre montado.
   - Props: `input={touch}`, `active={phase === "playing"}`, `paused={phase === "paused"}`, `pauseEnabled={inRun}`, `onPauseToggle={phase === "paused" ? resume : pause}`, más `disabled` y `repeat` según el mapeo.
   - _Mantener_: el bucle lee `held(KEYS) || touch.state.<botón>` y `touch` entra en las dependencias del efecto del bucle. _Un toque_: en `onPress`, `if (phaseRef.current !== "playing" || ev.repeated) return;` y la misma acción que la tecla. _Repite_: `repeat={{ … }}` y la acción en cada `onPress`.
   - Nada de `core.ts`, ni de `components/touch-controls.tsx` / `lib/touch-input.ts` / `app/globals.css` (son compartidos; si hace falta cambiarlos, es otro spec). No redefinas HUD, padding del CRT ni `.crt-bottom` en móvil.
5. **Verifica:**
   - `npm run lint` y `npm run build` sin errores.
   - Navegador (dev server en http://localhost:3000; lánzalo en segundo plano si no corre) con emulación táctil (`hasTouch` + `isMobile`) a 390×844, 360×740 y 844×390: se ven D-pad, A, B y pausa sin tapar `.crt-screen`; cada fila del mapeo funciona; los botones sin uso se ven atenuados; la pausa táctil abre y cierra el menú y está deshabilitada en el inicio y en el modal. A 1440×900 sin táctil no aparecen. Sin errores ni avisos de hidratación en consola.
   - Si no puedes emular táctil o el navegador no está disponible, dilo en el informe en vez de darlo por verificado.
6. Muestra archivos tocados y resultado de la verificación, y pausa: `Fase 6 completada. ¿Revisas el diff?`
7. Propón (sin aplicarlo sin permiso) añadir el mapeo del juego a la línea «Mapping:» del bloque Touch controls de `CLAUDE.md` y el juego a la tabla de specs, si el spec no lo hizo ya.

---

### Cierre

```
✅ Juego <id> implementado: plan del spec + skins + controles táctiles.

Siguiente paso: verificar los criterios de aceptación del spec uno a uno
(y el checklist §8 de .claude/skills/nuevo-juego/integracion.md).
Si todos pasan, cambia el estado del spec a "Implementado" y haz el commit
final antes de abrir el PR de la rama spec-NN-slug.
```

No hagas commit: lo decide el usuario.

---

## Resumen del comportamiento esperado

```
/spec-impl-game 13-juego-gloton

  Fases 1–4 →  las de /spec-impl: spec Aprobado → rama spec-13-juego-gloton
               → resumen → plan paso a paso con pausas
  Fase 5    →  Agent skin-designer «implementa gloton» → resumen + revisión
  Fase 6    →  TouchControls con el mapeo del spec → lint/build + emulación táctil
  Cierre    →  recordar criterios de aceptación, estado Implementado y commit manual

/spec-impl-game 13-juego-gloton  (estado: Borrador)

  Fase 2    →  ❌ mismo bloqueo que /spec-impl; no crea rama, no toca código,
               no lanza el agente
```
