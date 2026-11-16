# SPEC 15 — Puntuaciones ligadas a la cuenta

> **Estado:** Implementado
> **Depende de:** SPEC 07, SPEC 14
> **Fecha:** 2026-11-15
> **Objetivo:** Que solo un jugador con sesión y alias pueda guardar puntuaciones, ligadas a su `user_id` y mostradas en el ranking con su alias actual.

---

## Por qué existe este spec

Hoy `public.scores` guarda un `name` libre: cualquiera, con o sin sesión, puede escribir el alias de otro en el modal de fin de partida y quedarse con su marca. SPEC 07 lo aceptó «hasta que llegue la auth» y SPEC 14 trajo la identidad y el alias único en `profiles`, pero dejó el guardado igual a propósito.
Este spec cierra ese hueco: la puntuación pertenece a una cuenta, el nombre del ranking sale de `profiles.alias` y el invitado juega pero no guarda. El histórico anónimo se borra porque no se puede atribuir a nadie con garantías.

---

## Alcance

**Dentro:**

- **Migración `scores_user`:**
  - Borra todas las filas existentes de `public.scores`.
  - Quita la columna `name` y añade `user_id uuid not null` con FK a `public.profiles (id) on delete cascade`.
  - Rehace `top_scores` (agrupa por `user_id`, une `profiles.alias`, mismas columnas de salida).
  - Sustituye `player_best(text, text)` por `my_best(text)` (por `auth.uid()`).
  - Sustituye `submit_score(text, text, integer)` por `submit_score(text, integer)` (por `auth.uid()`, exige alias, solo `authenticated`).
- **Se sigue guardando una fila por partida.** El ranking calcula la mejor marca de cada jugador, como hoy.
- **Server Action `submitScore`** (`app/juegos/actions.ts`): recibe solo `{ gameId, score }` y devuelve dos estados nuevos, `signed-out` y `no-alias`.
- **`lib/scores.ts`:** `validateScore` valida solo la puntuación; `NAME_PATTERN`, `NAME_MAX`, `normalizeName` y `DEFAULT_NAME` se quedan (los usan `lib/auth.ts` y los juegos).
- **Modal de fin de partida** (`components/game-over-modal.tsx`), con un estado por situación de sesión:
  - Sesión cargando: botón «CARGANDO…» deshabilitado.
  - Sin sesión: aviso «INICIA SESIÓN PARA GUARDAR TU PUNTUACIÓN» y botón «INICIAR SESIÓN» a `/auth?next=/juegos/<id>/jugar`. Sin input.
  - Con sesión sin alias: formulario de alias dentro del modal (`AliasForm` en modo `inline`); al guardarlo aparece el estado siguiente sin perder la partida.
  - Con sesión y alias: el alias se muestra fijo (no editable) y el botón «GUARDAR PUNTUACIÓN».
  - Tras guardar: igual que hoy (puesto, «TU MEJOR», top 10 con la fila del alias resaltada).
- **`components/alias-form.tsx`:** nuevo modo `inline` con callback `onSaved`, sin navegación.
- **`components/hall-you-row.tsx`:** llama a `my_best` en lugar de `player_best`; sigue oculto sin sesión, sin alias o sin marcas.
- Regenerar `lib/supabase/database.types.ts` y actualizar `CLAUDE.md` (sección Supabase, comentario del session store y tabla de specs).

**Fuera de alcance (para specs futuros):**

- Sección «MIS MEJORES MARCAS» en `/cuenta`.
- Guardar la puntuación del invitado para enviarla tras iniciar sesión.
- Guardado automático al terminar la partida.
- Una sola fila por jugador y juego (upsert de la mejor marca).
- Anti-trampas: validar en servidor que la puntuación es alcanzable, firmar partidas o limitar envíos por minuto.
- Perfiles públicos de jugadores o enlaces desde el ranking.
- Cambios en el simulador (`components/game-player.tsx`): sigue con `ranked={false}`.
- Tests automatizados (no hay test runner).

---

## Modelo de datos

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_scores_user.sql (resumen; el archivo final lleva la versión que reporte list_migrations)

delete from public.scores;                                  -- histórico anónimo fuera

alter table public.scores drop column name;
alter table public.scores
  add column user_id uuid not null references public.profiles (id) on delete cascade;

drop index public.scores_game_rank_idx;
create index scores_game_user_idx on public.scores (game_id, user_id, score desc, created_at asc);

comment on table public.scores is 'One row per saved run of a signed-in player. The leaderboard keeps the best mark of each user_id and shows profiles.alias.';

-- Top N de un juego: mejor marca de cada user_id, con su alias ACTUAL.
-- security definer porque profiles solo es legible por su dueño; devuelve solo el alias.
-- Mismas columnas de salida que antes: (rank, name, score, created_at). Excluye perfiles sin alias.
function public.top_scores(p_game_id text, p_limit integer default 10)
  returns table (rank integer, name text, score integer, created_at timestamptz)
  -- stable, security definer, set search_path = ''; limit clamp 1..50 como hoy

-- Puesto y mejor marca del usuario de la sesión. Sin sesión o sin marcas: 0 filas.
drop function public.player_best(text, text);
function public.my_best(p_game_id text)
  returns table (rank integer, score integer, created_at timestamptz)
  -- stable, security invoker, set search_path = ''; mismo criterio de orden que top_scores

-- Única vía de escritura.
drop function public.submit_score(text, text, integer);
function public.submit_score(p_game_id text, p_score integer)
  returns table (rank integer, score integer, created_at timestamptz)
  -- volatile, security definer, set search_path = ''
  -- auth.uid() null            → raise 'not authenticated' errcode '42501'
  -- profiles.alias null         → raise 'alias required'    errcode '22004'
  -- game_id o score inválidos   → raise 'invalid …'         errcode '22023' (como hoy)
  -- insert (game_id, user_id, score) y devuelve my_best(p_game_id)

revoke execute on function public.top_scores(text, integer) from public;
revoke execute on function public.my_best(text) from public;
revoke execute on function public.submit_score(text, integer) from public;
grant execute on function public.top_scores(text, integer) to anon, authenticated;
grant execute on function public.my_best(text) to authenticated;
grant execute on function public.submit_score(text, integer) to authenticated;
-- La policy "scores are public" (select) y el revoke de insert/update/delete se mantienen.
```

```ts
// lib/scores.ts (cambia)
export function validateScore(score: number): number | null; // entero 0..MAX_SCORE
// Se mantienen: TOP_LIMIT, MAX_SCORE, NAME_MAX, NAME_PATTERN, DEFAULT_NAME,
// ScoreRow (name = alias), PlayerBest, normalizeName, formatScoreDate.
```

```ts
// app/juegos/actions.ts (cambia)
export type SubmitScoreResult =
  | {
      status: "saved";
      alias: string; // para resaltar la fila en el top 10
      best: PlayerBest;
      isNewBest: boolean;
      top: ScoreRow[];
    }
  | { status: "signed-out" } // sin sesión o sesión caducada (42501)
  | { status: "no-alias" } // con sesión pero sin alias (22004)
  | { status: "invalid" } // juego no rankeado o puntuación fuera de rango (22023)
  | { status: "error" }; // Supabase falló
export async function submitScore(input: {
  gameId: string;
  score: number;
}): Promise<SubmitScoreResult>;
```

```ts
// components/alias-form.tsx (nuevo modo)
type AliasFormProps =
  | { mode: "setup"; next: string }
  | { mode: "edit" }
  // Dentro del modal de fin de partida: guarda, llama a refresh() y después a onSaved; no navega.
  | { mode: "inline"; onSaved: (alias: string) => void };
```

Convenciones:

- `scores.user_id` referencia `profiles (id)`, no `auth.users`, para que `top_scores` pueda unir el alias. Borrar el usuario borra su perfil y, en cascada, sus marcas.
- El nombre del ranking es siempre `profiles.alias` en el momento de leer: cambiar el alias en `/cuenta` renombra todas sus marcas.
- Ningún RPC devuelve `user_id` ni el email.
- El `name` que devuelve `top_scores` conserva su nombre de columna, así `getTopScores`, `ScoreRow` y `Leaderboard` no cambian.
- El servidor sabe quién guarda por la sesión de las cookies (`lib/supabase/server.ts`); el navegador ya no envía ningún nombre.

---

## Plan de implementación

Antes de empezar, leer la reference de Server Actions en `node_modules/next/dist/docs/01-app/` y revisar con `search_docs` del MCP de Supabase «Database functions» (`security definer`) y «Row Level Security» (`auth.uid()` dentro de funciones). Usar `/frontend-design` para los estados nuevos del modal.

1. **Comprobar el estado.** Con `execute_sql`, contar las filas de `public.scores` y anotarlo en el resumen del PR (se van a borrar). Confirmar que `list_migrations` muestra `scores` y `profiles`. Verificar: el recuento queda anotado.
2. **Migración `scores_user`.** Escribir `supabase/migrations/<ts>_scores_user.sql` con todo lo de «Modelo de datos». Aplicarla con `apply_migration` (nombre `scores_user`), confirmar con `list_migrations` y renombrar el archivo a esa versión. Verificar con `execute_sql`:
   - `public.scores` está vacía y no tiene columna `name`.
   - `player_best` y `submit_score(text, text, integer)` ya no existen.
   - `get_advisors` (security) no muestra avisos nuevos.
3. **Tipos.** Regenerar `lib/supabase/database.types.ts` con `generate_typescript_types`. En este punto `npm run build` falla en `actions.ts` y `hall-you-row.tsx`; los pasos 4 y 5 lo arreglan.
4. **Lógica y Server Action.** Cambiar `validateScore` en `lib/scores.ts`. Reescribir `submitScore` en `app/juegos/actions.ts`:
   - Firma `{ gameId, score }`, llamada a `submit_score(p_game_id, p_score)`.
   - Mapeo de errores: `42501` → `signed-out`, `22004` → `no-alias`, `22023` → `invalid`, resto → `error`.
   - Lee el alias de la fila de `profiles` del usuario para devolverlo en `saved`.

   En `game-over-modal.tsx`, ajustar solo la llamada (sin `name`) y el `highlight` (`result.alias`) para que compile. Verificar: `npm run build` pasa salvo `hall-you-row.tsx`.

5. **HallYouRow.** Cambiar `player_best` por `my_best({ p_game_id })` y la clave de la consulta a `gameId|user.id`. Sigue oculto sin sesión, sin alias o sin marcas. Verificar: `npm run lint` y `npm run build` pasan.
6. **AliasForm inline.** Añadir el modo `inline` a `components/alias-form.tsx`: mismo input, contador y errores; al guardar llama a `refresh()` y a `onSaved(alias)`; no usa el router; estilos compactos que caben en `.modal`. Verificar: `/auth/alias` y `/cuenta` siguen funcionando igual.
7. **Modal de fin de partida.** Reescribir la zona de guardado de `components/game-over-modal.tsx` con los estados de «Alcance»:
   - Se elimina el input editable de iniciales.
   - Con alias: «JUGADOR: <ALIAS>» y «GUARDAR PUNTUACIÓN» («GUARDANDO…» durante el envío).
   - Resultado `signed-out` → estado sin sesión. Resultado `no-alias` → formulario de alias. `invalid` → «PUNTUACIÓN NO VÁLIDA». `error` → «NO SE PUDO GUARDAR · REINTENTAR».
   - Con `ranked={false}` sigue saliendo «MODO DEMO».

   Verificar en CAÍDA: sin sesión aparece el aviso y el enlace vuelve al juego tras entrar; con sesión sin alias se elige el alias en el modal y luego se guarda; con alias se guarda y la fila sale resaltada.

8. **Documentación.** En `CLAUDE.md`:
   - Sección Supabase: `scores.user_id`, `top_scores` con alias actual, `my_best`, `submit_score(game_id, score)` solo para `authenticated`, migración `scores_user`.
   - Quitar «until SPEC 15…» del párrafo del session store.
   - Añadir la fila de SPEC 15 a la tabla de specs.

   Verificar: `npm run lint` y `npm run build` pasan.

---

## Criterios de aceptación

- [x] `npm run lint` y `npm run build` terminan sin errores.
- [x] `list_migrations` muestra `scores_user` y su archivo está en `supabase/migrations/` con la misma versión.
- [x] `database.types.ts` muestra `scores.user_id`, `my_best` y `submit_score` con solo `p_game_id` y `p_score`; no aparecen `scores.name` ni `player_best`.
- [x] Tras la migración no queda ninguna puntuación anónima: toda fila de `scores` tiene `user_id`.
- [x] Con la clave publishable y sin sesión, `rpc/submit_score` (REST) es rechazado y no inserta nada.
- [x] Con sesión y sin alias, `submit_score` falla con `22004` y no inserta nada.
- [x] Un usuario autenticado no puede insertar, modificar ni borrar filas de `scores` directamente (REST), ni guardar a nombre de otro usuario.
- [x] `top_scores` devuelve como máximo una fila por jugador, con su alias, y nunca `user_id` ni email.
- [x] Al cambiar el alias en `/cuenta`, el Salón y el detalle del juego muestran el alias nuevo en sus marcas al recargar.
- [x] Sin sesión, el modal de fin de partida muestra «INICIA SESIÓN PARA GUARDAR TU PUNTUACIÓN», no tiene input de nombre, y «INICIAR SESIÓN» lleva a `/auth?next=/juegos/<id>/jugar`; tras entrar se vuelve al juego.
- [x] Con sesión sin alias, el modal permite elegir el alias; al aceptarlo se puede guardar la misma partida, y el nav muestra el alias.
- [x] Con sesión y alias, el modal muestra el alias sin poder editarlo; «GUARDAR PUNTUACIÓN» guarda y muestra el puesto y el top 10 con la fila propia resaltada.
- [x] Si la sesión caduca antes de guardar, el modal pasa al estado sin sesión en lugar de mostrar un error genérico.
- [x] `HallYouRow` muestra la mejor marca del usuario de la sesión y no aparece sin sesión.
- [x] El simulador (`gloton`, `invasores`) sigue mostrando «MODO DEMO · ESTA PARTIDA NO PUNTÚA».
- [x] `grep -rn "player_best\|p_name" app components lib games` no devuelve nada fuera de `database.types.ts`.
- [x] Los estados nuevos del modal se ven bien a 360×740, 390×844, 844×390 y 1440×900, con objetivos táctiles ≥ 44 px en móvil.
- [x] La consola del navegador no muestra errores nuevos en `/juegos/caida/jugar`, `/juegos/caida` ni `/salon?juego=caida`.

---

## Decisiones

- **Sí:** `scores.user_id` y quitar `scores.name`; el ranking une `profiles.alias` al leer. Cambiar el alias renombra todas las marcas y no hay duplicados ni copias desincronizadas.
- **No:** copiar el alias en `scores.name` al guardar. Las marcas antiguas quedarían con el nombre viejo.
- **No:** copia + trigger que reescribe `scores.name` al cambiar el alias. Más SQL para el mismo resultado visible que el join.
- **Sí:** FK a `profiles (id)` con `on delete cascade`. Permite el join y borrar una cuenta borra sus marcas.
- **Sí:** borrar todo el histórico anónimo. Cualquiera pudo escribir cualquier nombre, así que no se puede atribuir a nadie con garantías.
- **No:** asignar marcas anónimas a la cuenta con el mismo alias. Podría regalar marcas ajenas.
- **Sí:** `top_scores` como `security definer` que devuelve solo el alias. `profiles` sigue legible solo por su dueño y el ranking público no expone `user_id` ni email.
- **Sí:** `top_scores` conserva la columna `name` en su salida. `getTopScores`, `ScoreRow` y `Leaderboard` no cambian.
- **Sí:** `my_best(p_game_id)` por `auth.uid()` en lugar de `player_best(game, name)`. El jugador solo consulta su propia marca y ya no hace falta pasar un nombre.
- **Sí:** `submit_score(p_game_id, p_score)` sin nombre, solo para `authenticated`, con códigos de error distintos para sin sesión (`42501`) y sin alias (`22004`). El servidor decide quién guarda y el modal sabe qué estado mostrar.
- **Sí:** seguir guardando una fila por partida. Conserva el historial para futuras estadísticas y el criterio del ranking no cambia.
- **No:** una sola fila por jugador y juego (upsert). Pierde el historial.
- **Sí:** el invitado juega, pero el modal solo le ofrece iniciar sesión. La partida se pierde; es el precio de que el ranking sea fiable.
- **No:** guardar la puntuación del invitado en `sessionStorage` y enviarla tras el login. Más flujo y más facilidad para inventar marcas.
- **Sí:** con alias, botón «GUARDAR PUNTUACIÓN» y alias fijo. El jugador decide si guarda una partida mala.
- **No:** guardado automático al terminar.
- **Sí:** sin alias, elegirlo dentro del modal (`AliasForm` modo `inline`). La partida no se pierde por no haber pasado por `/auth/alias`.
- **No:** «MIS MEJORES MARCAS» en `/cuenta` en este spec. Va aparte para que este PR se limite al guardado y al ranking.
- **Sí:** número de spec 15, después de `14-autenticacion-supabase.md`, como ya anticipaba SPEC 14.

---

## Riesgos

| Riesgo                                                                                       | Mitigación                                                                                                                                                              |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El borrado del histórico es irreversible                                                     | Es una decisión tomada. El paso 1 anota el recuento de filas en el PR antes de aplicar la migración.                                                                    |
| `top_scores` con `security definer` podría exponer más de lo debido                          | Solo devuelve `rank`, `name` (alias), `score` y `created_at`; `set search_path = ''`, nombres cualificados y revisión con `get_advisors`.                               |
| La sesión caduca entre terminar la partida y pulsar «GUARDAR»                                | `submit_score` responde `42501` → estado `signed-out` en el modal con el enlace a `/auth`. `proxy.ts` refresca la sesión en cada navegación.                            |
| Se cambia la firma de `submit_score` y un cliente antiguo llama a la vieja                   | El navegador nunca llama al RPC: solo la Server Action, que se despliega a la vez. La función vieja se borra para que falle explícitamente.                             |
| Un perfil sin alias tendría marcas sin nombre en el ranking                                  | `submit_score` exige alias y `top_scores` excluye perfiles sin alias. Si alguien pone su alias a `NULL` por REST (el CHECK lo permite), sus marcas solo dejan de verse. |
| Las puntuaciones las sigue enviando el navegador: un usuario con sesión puede inventarse una | Aceptado. Ahora la marca queda ligada a su cuenta y se puede borrar. Anti-trampas va en otro spec.                                                                      |
| Pasos 3–5 dejan el build roto durante un momento                                             | Se hacen seguidos en el mismo commit si hace falta; el criterio es que `npm run build` pase al terminar el paso 5.                                                      |

---

## Lo que **no** está en este spec

- «MIS MEJORES MARCAS» en `/cuenta`.
- Guardar la partida del invitado para después del login.
- Guardado automático.
- Una sola fila por jugador y juego.
- Anti-trampas y límite de envíos.
- Perfiles públicos de jugadores.
- Cambios en el simulador.
- Tests automatizados.

Cada uno de esos, si llega, va en su propio spec.
