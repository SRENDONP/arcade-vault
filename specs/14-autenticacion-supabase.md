# SPEC 14 — Autenticación real con Supabase (email, Google y GitHub)

> **Estado:** Implementado
> **Depende de:** SPEC 01, SPEC 04, SPEC 07
> **Fecha:** 2026-11-15
> **Objetivo:** Sustituir la sesión simulada de `localStorage` por Supabase Auth, con registro e inicio de sesión por email y contraseña, Google y GitHub, recuperación de contraseña, un perfil con alias único y la página `/cuenta`.

---

## Por qué existe este spec

Hoy `/auth` (`components/auth-form.tsx`) acepta cualquier dato y guarda solo un nombre en `localStorage` (`av_user`, `lib/session.ts`). Ese nombre es el que se prellena en el modal de fin de partida y se envía con `submitScore`. Los botones de Google y GitHub no hacen nada.
SPEC 04 dejó los clientes `@supabase/ssr` listos y aplazó a este spec la auth y `proxy.ts`. SPEC 07 aceptó que dos personas con el mismo nombre comparten marca «hasta que llegue la auth».
Este spec trae la identidad real y el alias del jugador. **No** cambia todavía cómo se guardan las puntuaciones: ligar `scores` a `user_id`, borrar el histórico anónimo e impedir que el invitado guarde es SPEC 15.

---

## Alcance

**Dentro:**

- **Métodos de acceso:** email + contraseña (con confirmación de correo obligatoria), Google y GitHub, todos con Supabase Auth y flujo PKCE de `@supabase/ssr`.
- **Configuración manual** (la hace el usuario; el MCP no puede crear apps OAuth ni activar providers): app OAuth de GitHub, cliente OAuth de Google, providers activados, Site URL, Redirect URLs, «Confirm email» activo y longitud mínima de contraseña 8. Checklist en el paso 1.
- **Migración `profiles`:** tabla `public.profiles` (1 fila por usuario, `alias` nullable y único), trigger que crea la fila al registrarse, backfill de usuarios existentes y RLS (cada usuario lee y cambia solo su fila; solo la columna `alias` es editable).
- **Módulo puro `lib/auth.ts`:** reglas del alias (reutiliza `NAME_PATTERN`, `normalizeName` y `DEFAULT_NAME` de `lib/scores.ts`), sugerencia de alias desde los metadatos del proveedor, validación de email y contraseña, saneado de `next` y traducción de errores de Supabase a mensajes en español.
- **`proxy.ts`** en la raíz + `lib/supabase/proxy.ts` (`updateSession`): refresca la sesión en cada petición y protege rutas:
  - `/cuenta` y `/auth/alias` sin sesión → `/auth?next=<ruta>`.
  - `/auth` y `/auth/recuperar` con sesión → `next` (saneado) o `/cuenta`.
  - `/auth/nueva-contrasena` sin sesión → `/auth/recuperar`.
- **Route Handler `app/auth/callback/route.ts`:** canjea el `code` (OAuth, confirmación de email y recuperación) con `exchangeCodeForSession` y redirige a `next`; si el perfil no tiene alias, a `/auth/alias?next=<next>`. Errores → `/auth?error=callback`.
- **Sesión en el cliente:** `components/session-provider.tsx` deja de leer `localStorage` y pasa a ser un store externo alimentado por `onAuthStateChange` del cliente de navegador más la fila de `profiles`. `useSession()` devuelve `{ user, status, refresh, logout }`.
- **Pantallas:**
  - `/auth` — pestañas INICIAR SESIÓN / CREAR CUENTA con email y contraseña reales, botones GOOGLE y GITHUB funcionales, enlace «¿OLVIDASTE TU CONTRASEÑA?», estado «REVISA TU CORREO» tras registrarse, mensaje de error de `?error=` y «JUGAR COMO INVITADO».
  - `/auth/recuperar` — pide el email y envía el enlace de recuperación.
  - `/auth/nueva-contrasena` — fija la nueva contraseña (sesión de recuperación).
  - `/auth/alias` — elige el alias, prellenado con la sugerencia del proveedor.
  - `/cuenta` — correo, proveedores vinculados, cambiar alias y cerrar sesión.
- **Nav:** con sesión, el botón muestra el alias (o «JUGADOR» si no tiene) y abre un menú con «CUENTA» (o «ELEGIR ALIAS») y «CERRAR SESIÓN». En el panel móvil, «Cuenta» y «Cerrar sesión».
- **Consumidores del nombre** (comportamiento interino hasta SPEC 15): el modal de fin de partida prellena el input con el alias (editable como hoy; sin sesión o sin alias, `INVITADO`); los seis juegos y `GamePlayer` muestran el alias en el stat «Jugador»; `HallYouRow` usa el alias y no se muestra sin alias.
- Eliminar el mock: `lib/session.ts` (`USER_KEY`, `readUserRaw`, `parseUser`, `writeUser`) y la acción `login`. El store borra la clave heredada `av_user` una vez al arrancar.
- Regenerar `lib/supabase/database.types.ts` y actualizar `CLAUDE.md`.

**Fuera de alcance:**

- **SPEC 15:** `scores.user_id`, `submit_score` con `auth.uid()` y el alias del perfil, borrar las puntuaciones anónimas existentes, invitado que juega pero no guarda, modal con alias fijo.
- SMTP propio (p. ej. Resend como SMTP de Supabase) y plantillas de correo personalizadas. Se usan las de Supabase.
- Otros proveedores (Discord, Apple…), enlace mágico, OTP por SMS y 2FA/MFA.
- Vincular o desvincular proveedores desde `/cuenta` (`linkIdentity`/`unlinkIdentity`); solo se listan.
- Cambiar el email o la contraseña desde `/cuenta` (la contraseña se cambia con el flujo de recuperación).
- Borrar la cuenta desde la UI.
- Avatar, bio u otros campos de perfil; perfil público de otros jugadores.
- Captcha / protección antibots en el registro.
- URLs de producción en la configuración de Supabase (se añaden cuando haya despliegue).
- Tests automatizados (no hay test runner).

---

## Modelo de datos

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_profiles.sql (resumen; el archivo final lleva la versión que reporte list_migrations)
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  alias      text unique
             check (alias ~ '^[A-Z0-9Ñ_ .-]{1,10}$'     -- igual que NAME_PATTERN
                    and alias = upper(btrim(alias))     -- ya normalizado
                    and alias <> 'INVITADO'),           -- DEFAULT_NAME reservado
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "profiles: read own"   on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke all on public.profiles from anon;
revoke insert, update, delete on public.profiles from authenticated;
grant update (alias) on public.profiles to authenticated;   -- solo el alias es editable

-- updated_at automático
function public.profiles_touch() returns trigger  -- before update: new.updated_at := now()

-- Fila de perfil al crear el usuario (alias NULL). security definer, set search_path = ''.
function public.handle_new_user() returns trigger -- insert into public.profiles (id) values (new.id)
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
-- revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Backfill: insert into public.profiles (id) select id from auth.users on conflict do nothing;
```

```ts
// lib/auth.ts (puro: sin React, sin Supabase, sin window)
export const PASSWORD_MIN = 8;
export const AUTH_ROUTES = {
  signIn: "/auth",
  callback: "/auth/callback",
  recover: "/auth/recuperar",
  newPassword: "/auth/nueva-contrasena",
  alias: "/auth/alias",
  account: "/cuenta",
} as const;
export const PROTECTED_PATHS = ["/cuenta", "/auth/alias"] as const;

export type AliasError = "empty" | "pattern" | "reserved";
export function validateAlias(
  raw: string,
): { alias: string } | { error: AliasError }; // normalizeName + NAME_PATTERN + ≠ DEFAULT_NAME
export function suggestAlias(meta: Record<string, unknown> | undefined): string;
// user_name → preferred_username → full_name → name → "": normalizeName, sin tildes salvo Ñ,
// caracteres fuera del patrón eliminados, recortado a NAME_MAX; "" si no queda nada válido.
export function validateEmail(raw: string): string | null; // trim + lower; null si no tiene forma de email
export function validatePassword(raw: string): boolean; // length >= PASSWORD_MIN
export function safeNext(
  raw: string | null | undefined,
  fallback?: string,
): string;
// solo rutas internas: empieza por "/" y no por "//" ni "/\"; si no, fallback ("/biblioteca")
export function authErrorMessage(code: string | undefined): string;
// invalid_credentials → "EMAIL O CONTRASEÑA INCORRECTOS"; email_not_confirmed → "CONFIRMA TU CORREO ANTES DE ENTRAR";
// weak_password → "CONTRASEÑA DEMASIADO DÉBIL"; over_email_send_rate_limit → "DEMASIADOS CORREOS · PRUEBA MÁS TARDE";
// same_password → "LA CONTRASEÑA ES IGUAL A LA ANTERIOR"; 23505 → "ESE ALIAS YA ESTÁ EN USO";
// callback → "NO SE PUDO COMPLETAR EL ACCESO"; resto → "ALGO FALLÓ · INTÉNTALO DE NUEVO"
```

```ts
// components/session-provider.tsx (Client Component)
export type SessionUser = {
  id: string;
  email: string | null;
  alias: string | null; // null = aún no lo ha elegido
  providers: string[]; // app_metadata.providers: "email" | "google" | "github"
  meta: Record<string, unknown>; // user_metadata, para suggestAlias
};
export type SessionStatus = "loading" | "signed-out" | "signed-in";
export function useSession(): {
  user: SessionUser | null;
  status: SessionStatus;
  refresh: () => Promise<void>; // vuelve a leer el perfil (tras guardar el alias)
  logout: () => Promise<void>; // supabase.auth.signOut() + router.refresh()
};
```

```ts
// lib/supabase/proxy.ts
export async function updateSession(
  request: NextRequest,
): Promise<NextResponse>;
// crea el cliente de servidor sobre request/response cookies, llama a auth.getClaims()
// y aplica las redirecciones de PROTECTED_PATHS / AUTH_ROUTES.
```

Convenciones:

- El alias sigue las mismas reglas que el nombre del ranking (SPEC 07): 1–10 caracteres, `A-Z 0-9 Ñ _ espacio . -`, normalizado con `normalizeName`. Así SPEC 15 puede escribirlo en `scores.name` sin conversión.
- Las operaciones de auth (`signInWithPassword`, `signUp`, `signInWithOAuth`, `resetPasswordForEmail`, `updateUser`, `signOut`) y la actualización del alias se hacen con el cliente de navegador (`lib/supabase/client.ts`); el store se entera por `onAuthStateChange`. El servidor solo lee la sesión (proxy, callback).
- Todas las URL de retorno (`redirectTo`, `emailRedirectTo`) apuntan a `${location.origin}/auth/callback?next=<next>`.
- El servidor y la hidratación renderizan siempre `status: "loading"` / `user: null` (snapshot de servidor), como hoy; el usuario aparece tras hidratar.

---

## Plan de implementación

Antes de empezar, leer en `node_modules/next/dist/docs/`: `01-app/03-api-reference/03-file-conventions/proxy.md`, `01-app/02-guides/authentication.md`, `authentication-with-cache-components.md` y `redirecting.md`, y la reference de Route Handlers (`route.md`). Revisar con `search_docs` del MCP de Supabase: «Server-Side Auth for Next.js», «Login with Google», «Login with GitHub», «PKCE flow» y «Managing user data» (trigger de perfiles). Usar `/frontend-design` para las pantallas nuevas y el menú del nav.

1. **Configuración manual (usuario).** El spec-impl se para aquí y muestra este checklist; se sigue cuando el usuario confirme:
   - Supabase → Authentication → URL Configuration: Site URL `http://localhost:3000`; Redirect URLs `http://localhost:3000/auth/callback**`.
   - Authentication → Providers → Email: «Confirm email» activo; Password min length 8.
   - GitHub → Settings → Developer settings → OAuth Apps → New: Homepage `http://localhost:3000`, Callback `https://ehzxppntfcaqiobqmuub.supabase.co/auth/v1/callback`. Copiar Client ID y Secret al provider GitHub de Supabase y activarlo.
   - Google Cloud → APIs & Services → Credentials → OAuth client ID (Web): origen `http://localhost:3000`, redirect `https://ehzxppntfcaqiobqmuub.supabase.co/auth/v1/callback`; pantalla de consentimiento con scopes `email`, `profile`, `openid`. Copiar Client ID y Secret al provider Google de Supabase y activarlo.
     Verificar: `npm run supabase:check` da `[OK]` y `GET /auth/v1/settings` devuelve `external.google: true`, `external.github: true`, `mailer_autoconfirm: false`.
2. **Migración `profiles`.** Escribir `supabase/migrations/<ts>_profiles.sql` (tabla, RLS, grants, `profiles_touch`, `handle_new_user`, trigger y backfill). Aplicar con `apply_migration` (nombre `profiles`), confirmar con `list_migrations` y renombrar el archivo a esa versión. Verificar con `execute_sql`: cada usuario de `auth.users` tiene fila; `update profiles set alias = 'invitado'` y `'ABCDEFGHIJK'` fallan por el CHECK; `get_advisors` (security) no muestra avisos nuevos.
3. **Tipos.** Regenerar `lib/supabase/database.types.ts` con `generate_typescript_types`. Verificar: `npm run build` pasa.
4. **Módulo puro.** Crear `lib/auth.ts` con todo lo de «Modelo de datos». Verificar: `npm run build` pasa.
5. **Proxy.** Crear `lib/supabase/proxy.ts` (`updateSession`) y `proxy.ts` en la raíz con un `matcher` que excluya `_next/static`, `_next/image`, `favicon.ico` y archivos con extensión. Actualizar el comentario de `setAll` en `lib/supabase/server.ts` (ya hay proxy que refresca). Verificar: `/cuenta` sin sesión redirige a `/auth?next=%2Fcuenta`; el resto de rutas responde igual que antes y `npm run build` pasa.
6. **Callback.** Crear `app/auth/callback/route.ts` (GET): lee `code`, `next` (con `safeNext`) y `error`; canjea la sesión; si el perfil no tiene alias y `next` no es `/auth/nueva-contrasena`, redirige a `/auth/alias?next=<next>`. Verificar: `/auth/callback` sin `code` redirige a `/auth?error=callback`.
7. **Store de sesión.** Reescribir `components/session-provider.tsx` sobre Supabase (`useSyncExternalStore`, snapshot de servidor `null`, `onAuthStateChange` + lectura de `profiles`, borrado único de `av_user`). Borrar `lib/session.ts`. Actualizar consumidores: `nav.tsx`, `game-over-modal.tsx` (`nameInput ?? user?.alias ?? DEFAULT_NAME`), `game-player.tsx`, `hall-you-row.tsx` y los seis `games/*/<id>-game.tsx` (`user?.alias ?? DEFAULT_NAME`). Mientras el formulario no cambie, todo el mundo es invitado. Verificar: `npm run lint` y `npm run build` pasan; jugar CAÍDA como invitado y guardar como `INVITADO` funciona igual que antes.
8. **`/auth` real.** Reescribir `components/auth-form.tsx`:
   - INICIAR SESIÓN: email + contraseña → `signInWithPassword`; al entrar, a `/auth/alias?next=` si no hay alias, si no a `next`.
   - CREAR CUENTA: email + contraseña + repetir contraseña → `signUp` con `emailRedirectTo` al callback; después, estado «REVISA TU CORREO · TE ENVIAMOS UN ENLACE A <email>» con botón «VOLVER». El mismo mensaje sale si el email ya existe (Supabase no lo revela).
   - Se elimina el campo «Usuario»: el alias se elige después.
   - GOOGLE / GITHUB → `signInWithOAuth({ provider, options: { redirectTo } })`; el botón pulsado muestra «CONECTANDO…» y ambos se deshabilitan.
   - Estados: botón principal «ENTRANDO…» / «CREANDO…» deshabilitado durante el envío; errores con `authErrorMessage` bajo el formulario (`role="alert"`); validación local antes de enviar (email válido, contraseña ≥ 8, contraseñas iguales).
   - Lee `?next=` y `?error=` con `useSearchParams` dentro de `<Suspense>` en `app/auth/page.tsx`.
     Verificar: registro por email → correo → enlace → `/auth/alias`; login con Google y con GitHub → `/auth/alias` la primera vez; contraseña incorrecta → «EMAIL O CONTRASEÑA INCORRECTOS».
9. **Recuperación.** `app/auth/recuperar/page.tsx` (email → `resetPasswordForEmail` con `redirectTo` al callback y `next=/auth/nueva-contrasena`; siempre muestra «SI EXISTE UNA CUENTA, TE LLEGARÁ UN ENLACE») y `app/auth/nueva-contrasena/page.tsx` (contraseña + repetir → `updateUser({ password })` → «CONTRASEÑA ACTUALIZADA» y enlace a `/biblioteca`). Componentes en `components/auth-recover-form.tsx` y `components/auth-new-password-form.tsx`. Verificar: el flujo completo cambia la contraseña y la anterior deja de servir.
10. **Alias.** `app/auth/alias/page.tsx` + `components/alias-form.tsx`: input prellenado con `suggestAlias(user.meta)`, contador `n/10`, validación con `validateAlias`, `update profiles set alias` con el cliente de navegador, `refresh()` y redirección a `next`. Errores: «ALIAS VACÍO», «SOLO A-Z, 0-9, Ñ, _ . - Y ESPACIO», «ESE ALIAS ESTÁ RESERVADO», «ESE ALIAS YA ESTÁ EN USO» (código `23505`). Verificar: dos cuentas no pueden tener el mismo alias; tras guardarlo el nav muestra el alias.
11. **Cuenta y nav.** `app/cuenta/page.tsx` + `components/account-view.tsx`: correo, proveedores vinculados (EMAIL / GOOGLE / GITHUB), alias con el mismo `alias-form` en modo edición, botón «CERRAR SESIÓN». Sin alias, enlace a `/auth/alias`. En `components/nav.tsx`, menú desplegable del botón de usuario (cierra con Esc, clic fuera y al navegar; objetivos ≥ `--tap-min` en móvil) y entradas «Cuenta» / «Cerrar sesión» en el panel móvil. Estilos junto al bloque `.auth-card` de `app/globals.css`. Verificar a 360×740, 390×844 y 1440×900.
12. **Documentación.** En `CLAUDE.md`: quitar «mock session» y describir Supabase Auth (providers, `proxy.ts`, callback, `profiles`, alias, rutas protegidas), añadir la migración `profiles` y la fila de SPEC 14 en la tabla de specs. Verificar: `npm run lint` y `npm run build` pasan.

---

## Criterios de aceptación

- [x] `npm run lint` y `npm run build` terminan sin errores, y el build no muestra errores de `cookies()` / `searchParams` fuera de `<Suspense>`.
- [x] `list_migrations` muestra `profiles` y su archivo está en `supabase/migrations/` con la misma versión.
- [x] `database.types.ts` incluye la tabla `profiles`.
- [x] Cada usuario de `auth.users` tiene una fila en `profiles`; un usuario nuevo la recibe al registrarse con `alias` NULL.
- [x] Con la clave publishable y sin sesión, `select` e `update` sobre `profiles` (REST) no devuelven filas ni modifican nada.
- [x] Un usuario autenticado no puede leer ni modificar la fila de otro usuario, ni cambiar `id` o `created_at` de la suya.
- [x] `alias` = `INVITADO`, de 11 caracteres, con minúsculas o con caracteres fuera del patrón es rechazado por la base de datos.
- [ ] Registro con email: muestra «REVISA TU CORREO», llega el correo, el enlace lleva a `/auth/alias` con sesión iniciada.
- [ ] Iniciar sesión antes de confirmar el correo muestra «CONFIRMA TU CORREO ANTES DE ENTRAR».
- [x] Login con Google y con GitHub crea la sesión y, la primera vez, lleva a `/auth/alias` con un alias sugerido desde el nombre del proveedor.
- [x] Credenciales incorrectas muestran «EMAIL O CONTRASEÑA INCORRECTOS»; contraseña < 8 o contraseñas distintas se rechazan sin llamar a Supabase.
- [ ] Recuperar contraseña: el enlace lleva a `/auth/nueva-contrasena`, la nueva contraseña funciona y la anterior no.
- [x] Dos cuentas no pueden guardar el mismo alias: la segunda ve «ESE ALIAS YA ESTÁ EN USO».
- [x] `/cuenta` y `/auth/alias` sin sesión redirigen a `/auth?next=…`; tras entrar se vuelve a esa ruta.
- [ ] `/auth` con sesión redirige a `/cuenta` (o a `next`).
- [x] `?next=https://evil.example` o `?next=//evil.example` acaba en `/biblioteca`, nunca fuera del sitio.
- [x] `/auth/callback` sin `code` o con un `code` inválido redirige a `/auth?error=callback` y se ve «NO SE PUDO COMPLETAR EL ACCESO».
- [ ] La sesión sobrevive a recargar la página y a cerrar y abrir el navegador; «CERRAR SESIÓN» la elimina en el nav, en `/cuenta` y en el servidor (`/cuenta` vuelve a redirigir).
- [x] Con sesión y alias, el nav muestra el alias y su menú abre «CUENTA» y «CERRAR SESIÓN»; se cierra con Esc y con clic fuera.
- [x] `/cuenta` muestra el correo, los proveedores vinculados y permite cambiar el alias.
- [ ] El modal de fin de partida prellena el alias con sesión e `INVITADO` sin sesión; el stat «Jugador» de los seis juegos muestra el alias.
- [ ] `HallYouRow` muestra la mejor marca del alias y no aparece sin alias.
- [x] `grep -rn "av_user\|readUserRaw\|parseUser\|writeUser\|lib/session" app components lib games` solo devuelve la constante `LEGACY_USER_KEY` de `components/session-provider.tsx` (borrado único de la clave heredada).
- [ ] Las pantallas de auth y `/cuenta` se ven bien a 360×740, 390×844 y 1440×900, con objetivos táctiles ≥ 44 px en móvil.
- [ ] La consola del navegador no muestra errores nuevos en `/`, `/auth`, `/cuenta`, `/biblioteca`, `/juegos/caida/jugar` ni `/salon`.

---

## Decisiones

- **Sí:** dividir en dos specs. SPEC 14 trae identidad, sesión y alias; SPEC 15 liga las puntuaciones a la cuenta. Cada PR se prueba por separado y SPEC 14 no toca el ranking.
- **Sí:** email + contraseña además de Google y GitHub. Conserva las pestañas que ya existen y no obliga a tener cuenta en un proveedor.
- **No:** enlace mágico. Añade otro flujo de correo con el SMTP limitado de Supabase.
- **Sí:** confirmación de correo obligatoria (default de Supabase). Evita cuentas con correos ajenos.
- **Sí:** alias propio en `profiles`, único y con las reglas de `NAME_PATTERN`. El ranking muestra un nombre elegido, corto y sin colisiones, y SPEC 15 lo escribe en `scores.name` tal cual.
- **No:** usar el nombre del proveedor como nombre del ranking. No se elige, colisiona y puede no caber en 10 caracteres. Solo se usa como sugerencia.
- **Sí:** trigger `handle_new_user` que crea el perfil con alias NULL. Toda cuenta tiene fila desde el primer momento y «sin alias» es un estado explícito.
- **Sí:** solo la columna `alias` es editable (`grant update (alias)`), con unicidad y CHECK en la base de datos. El cliente de navegador puede actualizarla sin Server Action y la BD es la última barrera.
- **Sí:** `profiles` legible solo por su dueño. Nadie necesita leer perfiles ajenos todavía; SPEC 15 decide si el ranking los une.
- **Sí:** operaciones de auth desde el cliente de navegador. `onAuthStateChange` mantiene el store al día sin recargar, y el servidor ve las cookies en la siguiente petición.
- **No:** Server Actions para login/registro. El store del cliente no se enteraría del cambio de sesión sin un refresco manual.
- **Sí:** un solo Route Handler `/auth/callback` para OAuth, confirmación y recuperación (PKCE con `code`). Un único punto que canjea sesiones y decide si hace falta alias.
- **Sí:** `proxy.ts` refresca la sesión y protege solo `/cuenta` y `/auth/alias`. Jugar, el catálogo y el Salón siguen públicos.
- **No:** forzar el alias en toda la app desde el proxy. Haría una consulta a `profiles` en cada petición; el alias se pide tras el login y en `/cuenta`.
- **Sí:** `/auth` con sesión redirige a `/cuenta` o a `next`. No tiene sentido mostrar el formulario a quien ya entró.
- **Sí:** `safeNext` solo acepta rutas internas. Evita redirecciones abiertas desde `?next=`.
- **Sí:** mensajes neutros en registro y recuperación («REVISA TU CORREO», «SI EXISTE UNA CUENTA…»). No revelan qué correos están registrados.
- **Sí:** el modal prellena el alias pero sigue siendo editable, y el invitado sigue guardando como hoy. Es el comportamiento interino; el cambio real del guardado es SPEC 15.
- **Sí:** se mantiene la firma `useSession()` con `user` en lugar de crear un hook nuevo; `user.name` pasa a ser `user.alias` y se actualizan todos los consumidores.
- **Sí:** configuración de providers manual con checklist. El MCP de Supabase no crea apps OAuth ni activa providers.
- **No:** SMTP propio ni plantillas de correo en este spec. Se puede reutilizar Resend como SMTP en un spec aparte si el límite de envíos molesta.
- **Sí:** número de spec 14, después de `13-juego-ranaria.md`.

---

## Riesgos

| Riesgo                                                                                                         | Mitigación                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El SMTP por defecto de Supabase tiene un límite muy bajo de correos por hora                                   | Mensaje «DEMASIADOS CORREOS · PRUEBA MÁS TARDE» (`over_email_send_rate_limit`). Para probar, reutilizar cuentas o confirmar usuarios con SQL. SMTP propio: spec aparte. |
| PKCE: el enlace de confirmación/recuperación abierto en otro navegador no tiene el `code_verifier` y falla     | El callback redirige a `/auth?error=callback` con un mensaje claro; en confirmación el correo ya queda verificado y basta con iniciar sesión.                           |
| Mismo email con contraseña y con Google: Supabase vincula identidades solo si el correo está verificado        | Aceptado (comportamiento de Supabase). `/cuenta` lista los proveedores vinculados para que se vea qué pasó.                                                             |
| Hidratación: el usuario del store no existe en el servidor                                                     | Snapshot de servidor `null` y `status: "loading"`, igual que el patrón actual; ningún Server Component depende del alias.                                               |
| `proxy.ts` mal configurado afecta a todas las rutas (o a los assets)                                           | `matcher` que excluye estáticos; criterio de aceptación de consola limpia en las rutas principales.                                                                     |
| Trigger en `auth.users` con `security definer` y `search_path` abierto                                         | `set search_path = ''`, nombres cualificados, `revoke execute` a `public`/`anon`/`authenticated` y revisión con `get_advisors`.                                         |
| Si el trigger falla, el registro entero falla                                                                  | El trigger solo inserta el `id`, sin reglas que puedan fallar. Probarlo en el paso 2 con un usuario de prueba y borrarlo después.                                       |
| Redirect URLs o Site URL incompletas rompen OAuth y los correos                                                | Paso 1 con checklist y verificación contra `/auth/v1/settings` antes de escribir código.                                                                                |
| Durante SPEC 14 el ranking sigue siendo suplantable (el invitado o cualquiera puede escribir el alias de otro) | Aceptado hasta SPEC 15, que hace el guardado dependiente de `auth.uid()`.                                                                                               |

---

## Lo que **no** está en este spec

- Puntuaciones ligadas a la cuenta, borrado del histórico anónimo e invitados sin guardar (SPEC 15).
- SMTP propio y plantillas de correo.
- Otros proveedores, enlace mágico, SMS y 2FA.
- Vincular/desvincular proveedores, cambiar email o contraseña desde `/cuenta`, borrar la cuenta.
- Avatar, bio y perfiles públicos.
- Captcha y protección antibots.
- Configuración de producción.
- Tests automatizados.

Cada uno de esos, si llega, va en su propio spec.
