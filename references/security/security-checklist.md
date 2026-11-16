## Checklist de seguridad básico

Estado final tras SPEC 16 (`specs/16-medidas-de-seguridad-basicas.md`), 2026-11-16.

- [x] **RLS** habilitado en `profiles` y `scores` — **hecho.** Ya estaba activo desde SPEC 14 / 15; verificado con `pg_class.relrowsecurity = true` en las dos. Las tablas nuevas de `public` nacen con RLS por el event trigger `ensure_rls` de Supabase (probado con una tabla creada y deshecha en la misma transacción).
- [x] **Minimum password length** — mínimo 8 caracteres — **hecho.** Configurado en SPEC 14 (Auth → Providers → Email); lo aplica el servidor, no solo `validatePassword`. Verificación: un signup por REST con 7 caracteres debe responder `422 weak_password`.
- [x] **Leaked password protection** (aviso `auth_leaked_password_protection`) — **aceptado.** Necesita el plan Pro de Supabase y el proyecto está en Free. Se activará cuando el proyecto pase a Pro (spec propio).
- [x] **Max signup rate** — **hecho.** Rate limit «Sign-ups and sign-ins» = **30 cada 5 minutos por IP** (Auth → Rate Limits), sin CAPTCHA (va en otro spec). Captura del dashboard en el PR de SPEC 16.
- [x] **Headers de seguridad en Next.js** — **hecho.** `headers()` en `next.config.ts` con `source: "/(.*)"`; verificado con `curl -sI` en `/`, `/biblioteca`, `/juegos/caida/jugar`, `/auth/callback` (307) y un asset de `/_next/static/`:

```ts
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// En la config de Next.js:
async headers() {
  return [{ source: "/(.*)", headers: securityHeaders }];
},
```

Content-Security-Policy queda fuera: necesita nonces en `proxy.ts` y su propio spec.

## Por el lado de Supabase (linter de seguridad)

Avisos de `get_advisors` (security) antes de SPEC 16 (6) y su estado final (quedan 4, todos aceptados):

| Aviso                                                | Función                                         | Estado final                                                                                                                                                                                |
| ---------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `anon_security_definer_function_executable`          | `public.rls_auto_enable()`                      | **Resuelto.** Migración `20261116014629_revoke_rls_auto_enable`: `revoke execute ... from public, anon, authenticated`. Es la función del event trigger `ensure_rls`, que sigue funcionando. |
| `authenticated_security_definer_function_executable` | `public.rls_auto_enable()`                      | **Resuelto** (misma migración).                                                                                                                                                             |
| `anon_security_definer_function_executable`          | `public.top_scores(p_game_id, p_limit)`         | **Aceptado.** Diseño de SPEC 15: el ranking es público y la función solo devuelve `rank, name, score, created_at` (nunca `user_id` ni email); `profiles` sigue cerrado a `anon`.            |
| `authenticated_security_definer_function_executable` | `public.top_scores(p_game_id, p_limit)`         | **Aceptado** (mismo motivo).                                                                                                                                                                |
| `authenticated_security_definer_function_executable` | `public.submit_score(p_game_id, p_score)`       | **Aceptado.** Única vía de escritura en `scores` (INSERT/UPDATE/DELETE directos revocados); el jugador sale de `auth.uid()` y valida juego, puntuación y alias.                              |
| `auth_leaked_password_protection`                    | Auth                                            | **Aceptado.** Necesita el plan Pro; el proyecto está en Free.                                                                                                                               |

No se mueven `top_scores` / `submit_score` a un esquema privado: silenciaría el linter pero añade una capa sin reducir lo que se expone. Si aparece cualquier aviso nuevo en `get_advisors`, es un problema real.
