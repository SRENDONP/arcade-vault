# SPEC 07 — Leaderboard real en Supabase

> **Estado:** Implementado
> **Depende de:** SPEC 04, SPEC 05
> **Fecha:** 2026-11-04
> **Objetivo:** Guardar en Supabase las puntuaciones (juego, nombre, puntuación y fecha) de los juegos reales y mostrar el top 10 por juego, con la mejor marca de cada nombre, en la ficha, en el Salón de la Fama y en el modal de fin de partida.

---

## Por qué existe este spec

Hoy `saveScore()` de la sesión guarda las partidas en `localStorage` (`av_scores`) y nadie las lee.
La ficha `/juegos/[id]` y el Salón `/salon` muestran rankings inventados con `seededScores`.
SPEC 04 dejó la base de Supabase lista y anticipó tres decisiones: nombre libre como identidad, escritura por Server Action y `game_id` como texto sin tabla `games`.
Este spec crea la primera tabla real y conecta las tres vistas de ranking.

---

## Alcance

**Dentro:**

- Migración `supabase/migrations/20261105002904_scores.sql` con la tabla `public.scores`, RLS y tres funciones SQL: `top_scores`, `player_best` y `submit_score`.
- Una sola tabla para todos los juegos, distinguidos por `game_id`.
- La escritura solo es posible a través de la función `submit_score` (security definer). El INSERT directo a la tabla queda bloqueado para `anon` y `authenticated`.
- Lectura pública (`SELECT`) de la tabla y de las funciones `top_scores` y `player_best`.
- El top 10 muestra la mejor marca de cada nombre: cada nombre aparece una sola vez.
- Orden: puntuación descendente. Si hay empate, gana la marca más antigua.
- Módulo puro `lib/scores.ts`: tipos, constantes, normalización y validación del nombre y la puntuación, y formato de fecha.
- Módulo de servidor `lib/scores-server.ts`: `getTopScores(gameId)`, que llama a la RPC `top_scores` con el cliente de servidor.
- Server Action `app/juegos/actions.ts` → `submitScore()`, que valida, llama a la RPC `submit_score` y devuelve el puesto y el top 10.
- `games/index.ts` exporta `isRanked(id)`: un juego guarda en Supabase solo si tiene entrada en `PLAYABLE`.
- Ficha `/juegos/[id]`: el lateral `Leaderboard` muestra el top 10 real y la estadística "Mejor global" muestra el #1 real.
- Salón `/salon`: podio (top 3) y tabla (top 10) reales. La fila "TU MEJOR MARCA" usa el puesto y la mejor marca reales del nombre de la sesión.
- Modal de fin de partida: guardado en Supabase con estados de envío, error y reintento. Tras guardar muestra el puesto y el top 10 con la fila del jugador resaltada.
- Juegos simulados (`GamePlayer`): su modal no permite guardar y lo explica. Su ficha y su Salón muestran el estado vacío.
- Eliminar el guardado en `localStorage`: `appendScore`, `SCORES_KEY` y `SavedScore` de `lib/session.ts`, y `saveScore` del contexto de sesión.
- Eliminar `seededScores` y `PLAYERS` de `lib/games.ts`. `ScoreRow` se mueve a `lib/scores.ts`.
- Regenerar `lib/supabase/database.types.ts`.
- Actualizar `CLAUDE.md` (la ruta única de guardado pasa a ser `submitScore`).

**Fuera de alcance (para futuros specs):**

- Supabase Auth y la identidad real del jugador. Dos personas con el mismo nombre comparten la marca.
- Antitrampas (firmar partidas, validar la puntuación contra la partida jugada) y rate limiting.
- Moderación de nombres (palabras ofensivas) y borrado de puntuaciones desde la UI.
- Guardar datos extra de la partida (líneas, combo, nivel).
- Rankings por periodo (semanal, mensual) o paginación más allá del top 10.
- Actualización en tiempo real (Supabase Realtime).
- Cambiar `best` y `plays` de las tarjetas de la biblioteca (`components/game-card.tsx`). Siguen siendo datos del catálogo.
- Implementar el juego ROCAS. Si SPEC 06 se fusiona, ROCAS entra en el ranking solo por estar en `PLAYABLE`.
- Mover el catálogo `lib/games.ts` a una tabla.
- Tests automatizados (no hay test runner configurado).

---

## Modelo de datos

```sql
-- supabase/migrations/20261105002904_scores.sql (resumen; el archivo completo se escribe en la implementación)
create table public.scores (
  id         bigint generated always as identity primary key,
  game_id    text        not null check (game_id ~ '^[a-z0-9-]{1,32}$'),
  name       text        not null check (name ~ '^[A-Z0-9Ñ_ .-]{1,10}$'),
  score      integer     not null check (score between 0 and 99999999),
  created_at timestamptz not null default now()
);
create index scores_game_rank_idx on public.scores (game_id, score desc, created_at asc);

alter table public.scores enable row level security;
create policy "scores are public" on public.scores for select to anon, authenticated using (true);
-- Sin políticas de INSERT/UPDATE/DELETE. Además: revoke insert, update, delete on public.scores from anon, authenticated.

-- Top N de un juego: la mejor marca de cada nombre, ordenada por score desc y created_at asc.
-- language sql, stable, security invoker. p_limit se acota a 1..50.
function public.top_scores(p_game_id text, p_limit integer default 10)
  returns table (rank integer, name text, score integer, created_at timestamptz);

-- Puesto y mejor marca de un nombre en un juego (mismo criterio que top_scores). 0 filas si no tiene marcas.
function public.player_best(p_game_id text, p_name text)
  returns table (rank integer, score integer, created_at timestamptz);

-- Única vía de escritura. security definer, set search_path = ''.
-- Normaliza el nombre (trim + upper), valida y lanza excepción si algo no cumple.
-- Inserta la fila y devuelve el resultado de player_best para ese nombre.
function public.submit_score(p_game_id text, p_name text, p_score integer)
  returns table (rank integer, score integer, created_at timestamptz);
-- revoke execute on function public.submit_score from public; grant execute to anon, authenticated.
```

```ts
// lib/scores.ts (puro: sin React, sin Supabase)
export const TOP_LIMIT = 10;
export const MAX_SCORE = 99_999_999;
export const NAME_MAX = 10;
export const NAME_PATTERN = /^[A-Z0-9Ñ_ .-]{1,10}$/; // igual que el CHECK de la tabla
export const DEFAULT_NAME = "INVITADO";

export type ScoreRow = {
  rank: number;
  name: string;
  score: number;
  date: string;
}; // date: "dd/mm/aaaa"
export type PlayerBest = { rank: number; score: number; date: string };

export function normalizeName(raw: string): string; // trim + toUpperCase
export function validateScore(input: {
  name: string;
  score: number;
}): { name: string; score: number } | null; // entero 0..MAX_SCORE y nombre que cumple NAME_PATTERN
export function formatScoreDate(iso: string): string; // "dd/mm/aaaa" en UTC
```

```ts
// lib/scores-server.ts (solo servidor; usa lib/supabase/server.ts, así que su llamador va dentro de <Suspense>)
export async function getTopScores(gameId: string): Promise<ScoreRow[] | null>; // null = error de Supabase
```

```ts
// app/juegos/actions.ts
"use server";
export type SubmitScoreResult =
  | { status: "saved"; best: PlayerBest; isNewBest: boolean; top: ScoreRow[] }
  | { status: "invalid" } // juego no clasificado, nombre o puntuación fuera de rango
  | { status: "error" }; // fallo de Supabase
export async function submitScore(input: {
  gameId: string;
  name: string;
  score: number;
}): Promise<SubmitScoreResult>;
// isNewBest: la puntuación enviada es igual a best.score.
```

```ts
// games/index.ts (añadido)
export function isRanked(id: string): boolean; // id in PLAYABLE
```

```ts
// components/game-over-modal.tsx (props)
export type GameOverModalProps = {
  game: Game;
  score: number;
  ranked: boolean; // obligatoria: CAÍDA pasa true y GamePlayer pasa false
  extra?: { label: string; value: string }[];
  onRestart: () => void;
};
```

Convenciones:

- El nombre se normaliza igual en cliente, Server Action y SQL: `trim` + mayúsculas, de 1 a 10 caracteres, solo `A-Z`, `0-9`, `Ñ`, `_`, espacio, `.` y `-`.
- Un nombre vacío en el modal se envía como `INVITADO`.
- La fecha visible es la de la mejor marca, formateada `dd/mm/aaaa` en UTC.
- Las lecturas no usan `"use cache"`: se resuelven por petición dentro de `<Suspense>`, así el ranking siempre está al día tras guardar.
- `HallYouRow` es Client Component (el nombre vive en `localStorage`) y lee `player_best` con el cliente de navegador `lib/supabase/client.ts`.

---

## Plan de implementación

Antes de empezar, leer en `node_modules/next/dist/docs/` la guía de Server Actions (`01-app/`) y la de Cache Components sobre `cookies()` dentro de `<Suspense>`. Revisar con `search_docs` del MCP las funciones `security definer` y RLS de Supabase.

1. **Migración.** Escribir `supabase/migrations/20261105002904_scores.sql` con la tabla, el índice, RLS, la política de SELECT, los `revoke`/`grant` y las tres funciones. Aplicarla con `apply_migration` (nombre `scores`) y confirmar con `list_migrations`. Verificar con `execute_sql`: `submit_score('caida','TEST',100)` devuelve puesto 1; un `insert` directo como `anon` falla; `get_advisors` (security) no muestra avisos nuevos salvo `anon_security_definer_function_executable` / `authenticated_security_definer_function_executable` sobre `submit_score`, que es esperado (ver Riesgos). Borrar la fila de prueba. El archivo lleva la versión que registra `apply_migration` (`20261105002904`), para que local y remoto coincidan.
2. **Tipos.** Regenerar `lib/supabase/database.types.ts` con `generate_typescript_types`. Verificar: `npm run build` pasa.
3. **Módulo puro.** Crear `lib/scores.ts` con constantes, `ScoreRow`, `PlayerBest`, `normalizeName`, `validateScore` y `formatScoreDate`. Mover `ScoreRow` desde `lib/games.ts` y actualizar los imports. Verificar: `npm run build` pasa.
4. **Lectura en servidor.** Crear `lib/scores-server.ts` con `getTopScores(gameId)`. Devuelve `null` y escribe `console.error("[scores] …")` si Supabase falla. Verificar: `npm run build` pasa.
5. **`isRanked` y Server Action.** Añadir `isRanked` en `games/index.ts`. Crear `app/juegos/actions.ts` con `submitScore`: valida con `isRanked` y `validateScore`, llama a la RPC `submit_score` y después a `getTopScores`. Verificar: `npm run build` pasa.
6. **Componente `Leaderboard`.** Cambiar `components/leaderboard.tsx` para recibir `rows: ScoreRow[] | null` y un `highlight?: string` (nombre a resaltar). Estados: `null` → "RANKING NO DISPONIBLE"; `[]` → "AÚN NO HAY PUNTUACIONES". La key de cada fila pasa a ser `rank`. Verificar: `npm run build` pasa.
7. **Ficha.** En `app/juegos/[id]/page.tsx`, sacar el leaderboard a un Server Component async `GameLeaderboard` dentro de su propio `<Suspense>` con fallback "CARGANDO RANKING…". "Mejor global" se lee del mismo resultado: el #1 real o "—" si no hay datos. Si hace falta, va en su propio `<Suspense>`. El resto de la ficha sigue saliendo de `generateStaticParams`. Verificar: `/juegos/caida` muestra "AÚN NO HAY PUNTUACIONES" y `npm run build` mantiene la ruta como antes (prerender parcial).
8. **Salón.** `components/hall-of-fame.tsx` pasa a ser async y usa `getTopScores`. Los huecos del podio sin marca muestran "—". Con 0 filas se ve el estado vacío y con `null` el de error. `HallYouRow` recibe `gameId` y consulta `player_best` desde el navegador. Si el nombre no tiene marca, la fila no se muestra. Verificar: `/salon?juego=caida` se ve vacío sin errores en consola.
9. **Modal.** En `components/game-over-modal.tsx`, añadir la prop `ranked` y llamar a `submitScore` con `useTransition`. Estados:
   - Con `ranked: false`: no hay input ni botón de guardar. Se ve "▸ MODO DEMO · ESTA PARTIDA NO PUNTÚA".
   - Enviando: el botón dice "GUARDANDO…" y está deshabilitado.
   - `invalid`: "NOMBRE NO VÁLIDO" y el botón sigue activo.
   - `error`: "NO SE PUDO GUARDAR · REINTENTAR" y el botón sigue activo.
   - `saved`: "▸ PUNTUACIÓN GUARDADA · PUESTO #N". Si `isNewBest` es falso, se añade "· TU MEJOR: X". Debajo va un `Leaderboard` compacto con el top 10 y la fila del jugador resaltada.

   Pasar `ranked` desde `games/caida/caida-game.tsx` (`true`) y `components/game-player.tsx` (`false`). Verificar: guardar una partida de CAÍDA muestra el puesto y la fila aparece en la ficha y en el Salón.

10. **Limpieza de `localStorage` y datos sembrados.** Quitar `appendScore`, `SCORES_KEY` y `SavedScore` de `lib/session.ts` y `saveScore` de `components/session-provider.tsx`. Quitar `seededScores` y `PLAYERS` de `lib/games.ts`. Verificar: `npm run lint` y `npm run build` pasan.
11. **Documentación.** En `CLAUDE.md`, cambiar la línea de Games: el fin de partida guarda con `submitScore` (`app/juegos/actions.ts`) y solo los juegos de `PLAYABLE` puntúan. Añadir una nota breve sobre la tabla `scores` y la RPC `submit_score` como única vía de escritura. Borrar las filas de prueba de `scores`. Verificar: `npm run lint` y `npm run build` pasan.

---

## Criterios de aceptación

- [x] `npm run lint` y `npm run build` terminan sin errores.
- [x] `list_migrations` muestra la migración `scores` y el archivo `supabase/migrations/20261105002904_scores.sql` está en git.
- [x] `lib/supabase/database.types.ts` incluye la tabla `scores` y las funciones `top_scores`, `player_best` y `submit_score`.
- [x] Un `insert` directo en `public.scores` con la clave publishable (REST) devuelve error de permisos.
- [x] `submit_score` con un nombre de 11 caracteres, con un carácter fuera del patrón, con `-1` o con `100000000` lanza error y no inserta.
- [ ] `submitScore` con `gameId: "serpentina"` (sin entrada en `PLAYABLE`) devuelve `{ status: "invalid" }` y no inserta.
- [x] Guardar dos partidas de CAÍDA con el mismo nombre (500 y 300) deja ese nombre una sola vez en el top 10, con 500.
- [x] Con dos nombres empatados a la misma puntuación, aparece antes el que guardó primero.
- [ ] Con 12 nombres distintos guardados en CAÍDA, la ficha y el Salón muestran exactamente 10 filas, ordenadas de mayor a menor.
- [x] Cada fila muestra puesto, nombre, puntuación y fecha `dd/mm/aaaa`.
- [x] Tras guardar desde el modal, recargar `/juegos/caida` muestra la nueva marca sin esperar a ninguna caché.
- [x] El modal de CAÍDA muestra "GUARDANDO…" durante el envío y después "PUESTO #N" y el top 10 con la fila del jugador resaltada.
- [x] Guardar una puntuación menor que la mejor marca del nombre muestra "TU MEJOR: X" en el modal.
- [x] Con la red cortada (DevTools offline), el modal muestra "NO SE PUDO GUARDAR · REINTENTAR" y al reintentar con red guarda.
- [x] El modal de un juego simulado (p. ej. `/juegos/serpentina/jugar`) no tiene input ni botón de guardar y muestra "MODO DEMO".
- [x] Un juego sin puntuaciones muestra "AÚN NO HAY PUNTUACIONES" en la ficha y en el Salón, y "—" en "Mejor global" y en los huecos del podio.
- [x] Con una sesión cuyo nombre tiene marca, el Salón muestra "TU MEJOR MARCA" con su puesto y puntuación reales. Sin marca, la fila no aparece.
- [x] `grep -rn "seededScores\|appendScore\|SCORES_KEY\|saveScore" app components lib games` no devuelve resultados.
- [x] `npm run build` mantiene `/juegos/[id]` con prerender parcial (el ranking en streaming) y no aparecen errores de `cookies()` fuera de `<Suspense>`.
- [ ] La consola del navegador no muestra errores nuevos en `/`, `/biblioteca`, `/juegos/caida`, `/juegos/caida/jugar` ni `/salon`.

---

## Decisiones

- **Sí:** una sola tabla `scores` con `game_id`. Todos los juegos guardan lo mismo (nombre, puntuación, fecha) y se añaden juegos sin migraciones.
- **No:** una tabla por juego. Duplica esquema, políticas y funciones con cada juego nuevo.
- **Sí:** `game_id` como texto con formato validado en SQL y pertenencia validada en la Server Action con `isRanked`. Decisión de SPEC 04: el catálogo sigue en `lib/games.ts`.
- **Sí:** top 10 con la mejor marca de cada nombre. Un solo jugador no puede llenar el ranking.
- **No:** top 10 de partidas sueltas.
- **Sí:** empate resuelto a favor de la marca más antigua. Es el criterio clásico de arcade y es determinista.
- **Sí:** se guardan todas las partidas y la mejor marca se calcula en `top_scores`. Conserva el historial para futuros rankings por periodo.
- **No:** upsert de una fila por nombre. Pierde el historial.
- **Sí:** escritura solo mediante la RPC `submit_score` (security definer) con validación en SQL y en la Server Action. Sin clave secreta, es la única forma de que la clave publishable no permita inserts arbitrarios en la tabla.
- **No:** política RLS de INSERT abierta con CHECKs. Cualquiera podría insertar por REST sin pasar por la función.
- **No:** clave secreta / cliente admin. Contradice SPEC 04.
- **Sí:** solo puntúan los juegos con entrada en `PLAYABLE`. El simulador sube la puntuación sola y llenaría el ranking de datos falsos.
- **Sí:** los juegos simulados leen Supabase como los demás y muestran el estado vacío. Es un solo comportamiento para todas las fichas.
- **No:** mantener `seededScores` para los simulados.
- **Sí:** eliminar `av_scores` de `localStorage`. CLAUDE.md ya preveía que Supabase sustituiría esa ruta y el dato local no se leía en ningún sitio.
- **Sí:** lecturas por petición dentro de `<Suspense>`, sin `"use cache"`. El ranking siempre está al día tras guardar y el cliente de servidor (que lee `cookies()`) no puede usarse en `"use cache"`.
- **No:** `"use cache"` + `cacheTag` + `updateTag`. Exigiría un cliente sin cookies solo para lecturas y la invalidación desde la acción; se puede añadir si el tráfico lo pide.
- **Sí:** la ficha separa el leaderboard en su propio `<Suspense>`. La información del juego sigue prerenderizada y solo el ranking llega en streaming.
- **Sí:** la Server Action devuelve el puesto y el top 10 en la misma respuesta. El modal no necesita otra petición.
- **Sí:** `HallYouRow` consulta `player_best` desde el navegador. El nombre de la sesión solo existe en el cliente.
- **Sí:** "Mejor global" de la ficha pasa a ser el #1 real. `best` y `plays` de las tarjetas de la biblioteca siguen siendo datos del catálogo.
- **Sí:** prop `ranked` obligatoria en el modal. Un juego nuevo (p. ej. ROCAS) que olvide pasarla rompe el build en lugar de guardar o no guardar en silencio.
- **Sí:** fecha formateada en UTC. Evita diferencias entre servidor y cliente; una marca hecha cerca de medianoche puede mostrar el día siguiente.
- **Sí:** número de spec 07, después de SPEC 06 (`06-juego-rocas.md`).

---

## Riesgos

| Riesgo                                                                                                 | Mitigación                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Cualquiera puede llamar a `submit_score` por REST con la clave publishable y una puntuación inventada  | Aceptado hasta que haya auth y antitrampas (fuera de alcance). Los límites de la función acotan el daño; las filas se pueden borrar con el MCP. |
| `get_advisors` avisa de que `anon` y `authenticated` pueden ejecutar `submit_score` (security definer) | Aceptado: es el diseño (única vía de escritura sin clave secreta). La función fija `search_path = ''` y valida todos los argumentos.            |
| Llamar a `submit_score` por REST con un `game_id` inexistente pero bien formado                        | Esas filas nunca se muestran porque solo se leen ids del catálogo. Se pueden limpiar con SQL.                                                   |
| `security definer` sin `search_path` fijo permite secuestrar objetos                                   | `set search_path = ''` y nombres totalmente cualificados (`public.scores`). Revisar con `get_advisors`.                                         |
| Leer `cookies()` fuera de `<Suspense>` rompe el build con Cache Components                             | `GameLeaderboard` y `HallOfFame` siempre dentro de `<Suspense>`. Criterio de build específico.                                                  |
| Importar `games/index.ts` (que referencia componentes cliente) desde la Server Action                  | `isRanked` solo consulta las claves de `PLAYABLE`. Si el build se queja, se extrae la lista de ids a un módulo sin componentes.                 |
| Nombres iguales de personas distintas comparten marca                                                  | Aceptado: es la identidad de nombre libre decidida en SPEC 04 hasta que llegue la auth.                                                         |
| `database.types.ts` desactualizado tras la migración                                                   | Paso 2 obligatorio, antes de escribir código que use las RPC.                                                                                   |

---

## Lo que **no** está en este spec

- Supabase Auth e identidad real del jugador.
- Antitrampas, rate limiting y moderación de nombres.
- Datos extra de la partida (líneas, combo, nivel).
- Rankings por periodo, paginación y tiempo real.
- Cambios en `best` y `plays` de las tarjetas de la biblioteca.
- El juego ROCAS (SPEC 06).
- Tests automatizados.

Cada uno de esos, si llega, va en su propio spec.
