# SPEC 16 — Medidas de seguridad básicas

> **Estado:** Aprobado
> **Depende de:** SPEC 07, SPEC 14, SPEC 15
> **Fecha:** 2026-11-15
> **Objetivo:** Cerrar el checklist de `references/security/security-checklist.md`: cabeceras de seguridad en Next.js, `rls_auto_enable` fuera de la API y la configuración de Auth verificada, dejando documentados los avisos del linter de Supabase que se aceptan.

---

## Por qué existe este spec

Con SPEC 14 y 15 la app tiene cuentas reales y un ranking ligado a ellas. El checklist de seguridad y el linter de Supabase (`get_advisors`, 2026-11-16) señalan seis avisos y cinco tareas. Al revisar el estado real:

- **RLS** ya está activo en `profiles` y `scores` (`pg_class.relrowsecurity = true` en las dos). Solo hay que dejarlo verificado.
- **`public.rls_auto_enable()`** no viene de nuestras migraciones. Es la función `security definer` del event trigger `ensure_rls` que creó Supabase (activa RLS en cada tabla nueva de `public`). Devuelve `event_trigger`, así que llamarla por `/rest/v1/rpc/rls_auto_enable` falla igualmente, pero `anon` y `authenticated` tienen `EXECUTE` y el linter lo marca dos veces. Postgres no comprueba `EXECUTE` al disparar un event trigger, así que se puede revocar sin romper nada.
- **`top_scores`** (`anon` + `authenticated`) y **`submit_score`** (`authenticated`) son `security definer` a propósito (SPEC 15). `profiles` solo lo lee su dueño y `submit_score` es la única vía de escritura. Esos tres avisos se aceptan.
- **Leaked password protection** necesita el plan Pro de Supabase y el proyecto está en Free. Se acepta el aviso.
- **Contraseña mínima de 8** ya se configuró en SPEC 14. **Límite de signups por IP** y **cabeceras de seguridad** están sin hacer o sin verificar.

---

## Alcance

**Dentro:**

- **Migración `revoke_rls_auto_enable`:** revoca `EXECUTE` de `public.rls_auto_enable()` a `public`, `anon` y `authenticated`. El event trigger `ensure_rls` sigue activo.
- **Cabeceras de seguridad en `next.config.ts`**, con `headers()` y `source: "/(.*)"` (todas las rutas, incluidos `/auth/callback` y `_next/*`):
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains` (sin `preload`)
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- **Configuración de Auth en el dashboard de Supabase** (a mano; el MCP no la expone), verificada y documentada:
  - Contraseña mínima: 8 (Auth → Providers → Email). Ya está; se comprueba.
  - Rate limit «Sign-ups and sign-ins» por IP: **30 cada 5 minutos** (Auth → Rate Limits).
- **Verificación de RLS** en `profiles` y `scores` con `execute_sql`, sin cambios.
- **Avisos aceptados**, documentados en el checklist y en `CLAUDE.md`: los tres de `security definer` (`top_scores` ×2, `submit_score`) y `auth_leaked_password_protection`.
- **`references/security/security-checklist.md`:** marcar cada casilla con su estado final (hecho / aceptado + motivo) y commitearlo con el spec.
- **`CLAUDE.md`:** cabeceras en «Stack and non-default configuration», migración y avisos aceptados en la sección Supabase, fila de SPEC 16 en la tabla de specs.

**Fuera de alcance (para specs futuros):**

- Content-Security-Policy (con nonce vía `proxy.ts`): afecta al render con `cacheComponents`, a los scripts inline de Next, a Supabase y a los avatares OAuth.
- CAPTCHA (Turnstile / hCaptcha) en `/auth`.
- Leaked password protection (cuando el proyecto pase a Pro).
- Reglas de contraseña más estrictas que ≥ 8 (letras + números, etc.).
- Mover las funciones `security definer` a un esquema privado para silenciar el linter.
- Anti-trampas en `submit_score` y límite de envíos de puntuaciones.
- `poweredByHeader`, `X-XSS-Protection`, COOP/COEP y otras cabeceras no listadas.
- Rate limit del formulario de contacto (Resend).
- Tests automatizados (no hay test runner).

---

## Modelo de datos

No se introducen tablas, columnas ni funciones nuevas. Solo cambian privilegios:

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_revoke_rls_auto_enable.sql
-- (el archivo final lleva la versión que reporte list_migrations)

-- rls_auto_enable() is the security definer function behind Supabase's
-- `ensure_rls` event trigger (enables RLS on every new table in public).
-- It returns event_trigger, so it is never meant to be called through the
-- API. Event triggers do not check EXECUTE, so revoking it keeps the
-- trigger working and removes it from /rest/v1/rpc.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
```

Cabeceras (`next.config.ts`):

```ts
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// dentro de nextConfig
async headers() {
  return [{ source: "/(.*)", headers: securityHeaders }];
},
```

`database.types.ts` no cambia (no cambia ninguna firma), así que no hace falta regenerarlo.

---

## Plan de implementación

Antes de empezar, leer `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/headers.md` y revisar con `search_docs` del MCP de Supabase «Database linter» (lints 0028 / 0029) y «Rate limits» de Auth.

1. **Estado inicial.** Con `get_advisors` (security) anotar los avisos actuales (deben ser los 6 del checklist). Con `execute_sql`:
   - `relrowsecurity` es `true` en `public.profiles` y `public.scores`.
   - `has_function_privilege('anon', 'public.rls_auto_enable()', 'execute')` devuelve `true` (el problema existe).
   - El event trigger `ensure_rls` existe y está habilitado (`pg_event_trigger.evtenabled <> 'D'`).

   Verificar: los tres resultados quedan anotados para el PR.

2. **Migración `revoke_rls_auto_enable`.** Escribir el SQL de «Modelo de datos», aplicarlo con `apply_migration` (nombre `revoke_rls_auto_enable`), confirmar con `list_migrations` y renombrar el archivo a esa versión. Verificar con `execute_sql`:
   - `has_function_privilege` devuelve `false` para `anon` y `authenticated`.
   - `ensure_rls` sigue habilitado. Prueba: dentro de una transacción con `rollback`, `create table public._rls_probe (id int)` y comprobar que `relrowsecurity` es `true`.
   - `get_advisors` ya no muestra los dos avisos de `rls_auto_enable`.
3. **Cabeceras.** Añadir `securityHeaders` y `headers()` a `next.config.ts`. Verificar con `npm run dev` y `curl -sI`:
   - `/`, `/biblioteca`, `/juegos/caida/jugar`, `/auth/callback` (redirección) y un archivo de `/_next/static/…` devuelven las cinco cabeceras.
   - La app funciona igual: navegación, login con email y OAuth (vuelta por `/auth/callback`), un juego hasta guardar puntuación, formulario de contacto.
   - La consola del navegador no muestra errores nuevos (p. ej. por `Permissions-Policy`).
4. **Auth en el dashboard.** Comprobar a mano la contraseña mínima de 8 y fijar el rate limit de sign-ups/sign-ins a 30 por 5 min por IP. Verificar:
   - `POST /auth/v1/signup` por REST con la clave publishable y una contraseña de 7 caracteres responde `422` (`weak_password`) sin crear usuario.
   - El valor del rate limit queda anotado en el PR (captura del dashboard).
5. **Documentación.** Actualizar `references/security/security-checklist.md` (casillas marcadas, avisos aceptados con su motivo, fecha) y `CLAUDE.md` (cabeceras en «Stack…», migración `revoke_rls_auto_enable` en la lista, avisos aceptados en Supabase, fila de SPEC 16). Verificar: `npm run lint` y `npm run build` pasan, y `get_advisors` (security) muestra exactamente los cuatro avisos aceptados.

---

## Criterios de aceptación

- [x] `npm run lint` y `npm run build` terminan sin errores.
- [x] `list_migrations` muestra `revoke_rls_auto_enable` y su archivo está en `supabase/migrations/` con la misma versión.
- [x] `relrowsecurity` es `true` en `public.profiles` y `public.scores`.
- [x] `has_function_privilege('anon' | 'authenticated', 'public.rls_auto_enable()', 'execute')` devuelve `false`.
- [x] Una tabla nueva en `public` (prueba con `rollback`) nace con RLS activo: `ensure_rls` sigue funcionando.
- [x] `get_advisors` (security) muestra solo cuatro avisos: `top_scores` (anon), `top_scores` (authenticated), `submit_score` (authenticated) y `auth_leaked_password_protection`.
- [x] `curl -sI` a `/`, `/juegos/caida/jugar`, `/auth/callback` y un asset de `/_next/static/` devuelve `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Strict-Transport-Security` y `Permissions-Policy` con los valores del spec.
- [ ] Un signup por REST con una contraseña de 7 caracteres es rechazado con `422`. _(pendiente: verificación manual)_
- [ ] El rate limit de sign-ups/sign-ins en el dashboard es 30 por 5 min. _(pendiente: verificación manual)_
- [ ] El login con email, Google y GitHub, guardar una puntuación y el formulario de contacto siguen funcionando con las cabeceras nuevas. _(pendiente: verificación manual)_
- [ ] La consola del navegador no muestra errores nuevos en `/`, `/auth`, `/juegos/caida/jugar` ni `/acerca-de`. _(verificado en `/`, `/acerca-de` y `/juegos/caida/jugar`; pendiente `/auth` sin sesión)_
- [x] `references/security/security-checklist.md` tiene cada casilla marcada como hecha o aceptada (con motivo) y está commiteado.
- [x] `CLAUDE.md` documenta las cabeceras, la migración, los avisos aceptados y la fila de SPEC 16.

---

## Decisiones

- **Sí:** aceptar los avisos `security definer` de `top_scores` y `submit_score`. Son el diseño de SPEC 15: `top_scores` solo devuelve `rank, name, score, created_at` y `submit_score` toma al jugador de `auth.uid()`.
- **No:** mover la lógica a un esquema privado con envoltorios `security invoker` en `public`. Silencia el linter, pero añade una capa y otra migración sin reducir lo que se expone.
- **No:** `top_scores` como `security invoker` sobre una vista pública de alias. El linter avisa igual por la vista (`security_definer_view`) y abre `profiles` a otra ruta de lectura.
- **Sí:** revocar `EXECUTE` de `rls_auto_enable()` en lugar de borrarla o cambiarla a `security invoker`. El event trigger necesita los privilegios del dueño para activar RLS en tablas nuevas y lo queremos conservar.
- **Sí:** aceptar `auth_leaked_password_protection`. Necesita el plan Pro y el proyecto está en Free.
- **No:** reforzar `validatePassword` en el cliente para compensarlo. Una regla solo en el cliente se salta llamando a la API de Auth; la longitud mínima la aplica el servidor.
- **Sí:** rate limit de 30 sign-ups/sign-ins por 5 min por IP, sin CAPTCHA. Frena bots básicos sin molestar en pruebas desde la misma red; el CAPTCHA necesita widget y claves y va aparte.
- **Sí:** cinco cabeceras: las tres del checklist más HSTS y `Permissions-Policy`. Ninguna toca el render ni las redirecciones.
- **Sí:** HSTS sin `preload`. Entrar en la lista de precarga es difícil de deshacer y todavía no hay dominio propio. Los navegadores ignoran HSTS en `http://localhost`.
- **Sí:** `Permissions-Policy` solo con `camera`, `microphone` y `geolocation`. La app no usa ninguna de las tres; `fullscreen` y `gamepad` no se restringen porque los juegos podrían usarlos.
- **No:** CSP en este spec. Con `cacheComponents` y los scripts inline de Next necesita nonces en `proxy.ts` y pruebas de cada integración; va en su propio spec.
- **Sí:** cabeceras en todas las rutas (`/(.*)`). Ningún asset se embebe en iframes ajenos y el matcher es más simple.
- **Sí:** configuración de Auth a mano en el dashboard, documentada y verificada por REST. El MCP de Supabase no expone la configuración de Auth, igual que en SPEC 14.
- **Sí:** commitear `references/security/security-checklist.md` con su estado final. Es la fuente del spec y queda como registro de lo aceptado.

---

## Riesgos

| Riesgo                                                                                         | Mitigación                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| La migración no tiene permiso para revocar en `rls_auto_enable()` (su dueño es de Supabase)    | El paso 1 comprueba el dueño con `pg_proc.proowner`. Si `apply_migration` falla, se anota y el aviso pasa a la lista de aceptados en lugar de forzar un cambio de dueño. |
| Revocar `EXECUTE` rompe el event trigger y las tablas nuevas nacen sin RLS                     | Prueba con `create table` dentro de una transacción con `rollback` (paso 2). Si falla, se vuelve a dar `EXECUTE` y se acepta el aviso.                                   |
| Las funciones nuevas reciben `EXECUTE` para `anon` por los privilegios por defecto de Supabase | Ya se tiene en cuenta en SPEC 15 (revoke explícito en cada función). El spec no lo cambia; queda anotado en `CLAUDE.md`.                                                 |
| `X-Frame-Options: DENY` o `Permissions-Policy` rompen algo (OAuth, modal, juegos)              | OAuth es por redirección, no por iframe. El paso 3 prueba login, juego, guardado y contacto con las cabeceras puestas.                                                   |
| HSTS en un dominio de producción futuro obliga a HTTPS durante dos años                        | Es lo que se busca; sin `preload` y sin efecto en `localhost`. Si hiciera falta volver atrás, se publica `max-age=0`.                                                    |
| El rate limit de 30 por IP bloquea a varios jugadores detrás de la misma red (NAT)             | Aceptado para el tamaño actual; el valor se puede subir en el dashboard sin desplegar.                                                                                   |
| Los avisos aceptados se olvidan y alguien los «arregla» rompiendo el ranking                   | Se documentan con su motivo en el checklist y en `CLAUDE.md`.                                                                                                            |

---

## Lo que **no** está en este spec

- Content-Security-Policy.
- CAPTCHA en `/auth`.
- Leaked password protection (plan Pro).
- Reglas de contraseña más estrictas.
- Esquema privado para las funciones `security definer`.
- Anti-trampas y límite de envíos de puntuaciones.
- Rate limit del formulario de contacto.
- Otras cabeceras (`poweredByHeader`, COOP/COEP…).
- Tests automatizados.

Cada uno de esos, si llega, va en su propio spec.
