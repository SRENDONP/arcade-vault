# SPEC 04 — Base técnica de Supabase

> **Estado:** Aprobado  
> **Depende de:** SPEC 03
> **Fecha:** 2026-11-02
> **Objetivo:** Integrar Supabase en la app Next.js con clientes tipados de servidor y navegador (`@supabase/ssr`), variables de entorno, carpeta de migraciones versionada y un script que verifique la conexión, sin crear tablas ni cambiar la UI.

---

## Por qué existe este spec

El proyecto Supabase (`ehzxppntfcaqiobqmuub`) ya está creado y conectado al MCP, pero la base de datos está vacía (sin tablas ni migraciones) y la app no tiene ninguna dependencia de Supabase.
Hoy la sesión y las puntuaciones están simuladas en `localStorage` (`lib/session.ts`), y el Salón de la Fama usa `seededScores`.
Antes de llevar datos reales a Supabase hace falta una base común: clientes, configuración, tipos y un flujo de migraciones. Este spec solo prepara esa base. Las puntuaciones y la autenticación irán en specs propios.

---

## Alcance

**Dentro:**

- Dependencias `@supabase/supabase-js` y `@supabase/ssr` en `dependencies`.
- Variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (clave moderna `sb_publishable_…`) en `.env.local` y documentadas en `.env.example`.
- `lib/supabase/server.ts`: `createClient()` asíncrono con `createServerClient` de `@supabase/ssr` y `cookies()` de `next/headers`.
- `lib/supabase/client.ts`: `createClient()` con `createBrowserClient` de `@supabase/ssr`.
- `lib/supabase/database.types.ts`: tipos generados con el MCP (`generate_typescript_types`). Los dos clientes se tipan con `Database`.
- Carpeta `supabase/migrations/` versionada en git (vacía, con `.gitkeep`). Será el sitio de los `.sql` que se apliquen con el MCP (`apply_migration`).
- Script `scripts/supabase-check.mjs` y comando `npm run supabase:check`, que verifican URL y clave contra el proyecto remoto.
- Actualizar `CLAUDE.md` (sección Commands y una nota de flujo de migraciones).

**Fuera de alcance (para futuros specs):**

- Tablas, migraciones con contenido y políticas RLS.
- Puntuaciones en Supabase (tabla `scores`, Server Action de guardado, ranking real en el Salón de la Fama).
- Supabase Auth o sustituir la sesión simulada de `/auth`.
- `proxy.ts` (antes `middleware`) para refrescar la sesión. Sin auth no tiene uso.
- Clave secreta o `service_role` y cliente admin.
- Mover el catálogo `lib/games.ts` a una tabla.
- Supabase CLI, Docker o stack local.
- Rutas de salud públicas (`/api/health`) o tablas de prueba.
- Cambios visuales o de comportamiento en cualquier página.
- Tests automatizados (no hay test runner configurado).

---

## Modelo de datos

Este spec no introduce datos de negocio. Solo añade configuración y los tipos generados del esquema (hoy vacío).

```bash
# .env.example (commiteado, sin valores reales). Se añaden al final, tras las variables de Resend.
# Supabase → Project Settings → API. Usar la clave "publishable" (sb_publishable_…), no la anon legacy.
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

```ts
// lib/supabase/database.types.ts: generado, no se edita a mano
export type Database = {
  public: {
    Tables: {};
    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  }; /* … */
};
```

```ts
// lib/supabase/server.ts (solo servidor: Server Components, Server Actions, Route Handlers)
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
export async function createClient(): Promise<SupabaseClient<Database>>;
// cookies: { getAll, setAll }. setAll va en try/catch porque desde un Server Component no se pueden escribir cookies.
```

```ts
// lib/supabase/client.ts ("use client" no hace falta: es un módulo, lo importan componentes cliente)
export function createClient(): SupabaseClient<Database>;
```

```text
supabase/
  migrations/
    .gitkeep        # futuros archivos: YYYYMMDDHHMMSS_nombre.sql
scripts/
  supabase-check.mjs
```

Convenciones:

- Las variables de Supabase solo se leen en `lib/supabase/server.ts`, `lib/supabase/client.ts` y `scripts/supabase-check.mjs`.
- `SUPABASE_DB_PSWD` se queda en `.env.local` como apunte personal. No entra en `.env.example` y ningún archivo del repo la lee.
- Si falta una variable, `createClient()` lanza un `Error` con el nombre de la variable que falta, nunca con su valor.
- Cada migración futura se escribe primero como archivo en `supabase/migrations/` y se aplica con `apply_migration` del MCP usando el mismo nombre. Después se regenera `database.types.ts`.
- `npm run supabase:check` usa `node --env-file=.env.local` (Node 22) y no carga `@next/env`.

---

## Plan de implementación

Antes de escribir los clientes, leer `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md` y `authentication-with-cache-components.md` (sección sobre `cookies()` con Cache Components). También conviene revisar la guía de `@supabase/ssr` para Next.js con `search_docs` del MCP.

1. **Dependencias y entorno.** Ejecutar `npm install @supabase/supabase-js @supabase/ssr`. Añadir `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` a `.env.example` (vacías, con el comentario) y a `.env.local` (valores de `get_project_url` y `get_publishable_keys`, clave `default` de tipo `publishable`). Verificar: `npm run build` pasa y `git status` no muestra `.env.local`.
2. **Tipos.** Generar `lib/supabase/database.types.ts` con `generate_typescript_types`. Verificar: `npm run build` pasa.
3. **Cliente de navegador.** Crear `lib/supabase/client.ts` con `createBrowserClient<Database>(url, key)` y validación de variables. Verificar: `npm run build` pasa.
4. **Cliente de servidor.** Crear `lib/supabase/server.ts` con `createServerClient<Database>`, `await cookies()`, `getAll` y `setAll` dentro de `try/catch`. Añadir un comentario indicando que quien lo use desde un Server Component debe estar dentro de `<Suspense>` (Cache Components) y no puede llamarse dentro de `"use cache"`. Verificar: `npm run build` pasa y las rutas mantienen su tipo (estáticas o dinámicas) igual que antes.
5. **Carpeta de migraciones.** Crear `supabase/migrations/.gitkeep`. Verificar: `git status` muestra el archivo.
6. **Script de verificación.** Crear `scripts/supabase-check.mjs`. El script:
   - Lee las dos variables y, si falta alguna, imprime `[ERR] Falta <NOMBRE>` y sale con código 1.
   - Hace `fetch` a `${URL}/auth/v1/settings` con la cabecera `apikey: <KEY>`.
   - Con HTTP 200 imprime `[OK] Supabase conectado: <host>` y sale con 0.
   - Con cualquier otra respuesta imprime `[ERR] HTTP <status>` y sale con 1. Un error de red imprime `[ERR] <mensaje>` y sale con 1.
   - Nunca imprime la clave.

   Añadir a `package.json` el script `"supabase:check": "node --env-file=.env.local scripts/supabase-check.mjs"`. Verificar: el comando imprime `[OK]` y sale con 0.

7. **Documentación.** En `CLAUDE.md`: añadir `npm run supabase:check` a Commands y una entrada en "Stack and non-default configuration" con los clientes de `lib/supabase/`, el flujo de migraciones (archivo en `supabase/migrations/` → `apply_migration` → regenerar tipos) y la regla de `<Suspense>` para el cliente de servidor. Verificar: `npm run lint` y `npm run build` pasan.

---

## Criterios de aceptación

- [x] `npm run lint` termina sin errores.
- [x] `npm run build` termina sin errores y la tabla de rutas muestra el mismo tipo (estática o dinámica) para cada ruta que antes de este spec.
- [x] `package.json` incluye `@supabase/supabase-js` y `@supabase/ssr` en `dependencies` y el script `supabase:check`.
- [x] `.env.example` contiene `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` vacías y no contiene `SUPABASE_DB_PSWD`.
- [x] `.env.local` no está trackeado (`git ls-files .env.local` no devuelve nada).
- [x] `npm run supabase:check` imprime `[OK] Supabase conectado: ehzxppntfcaqiobqmuub.supabase.co` y sale con código 0.
- [x] Con `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` alterada, `npm run supabase:check` imprime `[ERR] HTTP 401` y sale con código distinto de 0.
- [x] Con la variable de la clave eliminada, `npm run supabase:check` imprime `[ERR] Falta NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y sale con código distinto de 0.
- [x] La salida de `npm run supabase:check` nunca contiene el valor de la clave.
- [x] `lib/supabase/server.ts` y `lib/supabase/client.ts` exportan `createClient` tipado con `Database`.
- [x] `lib/supabase/database.types.ts` existe y exporta `Database`.
- [ ] `supabase/migrations/` está en git.
- [x] `grep -rn "SUPABASE" app components lib scripts` solo encuentra `lib/supabase/server.ts`, `lib/supabase/client.ts` y `scripts/supabase-check.mjs`.
- [x] `grep -rn "SUPABASE_DB_PSWD" app components lib scripts` no devuelve resultados.
- [x] Ninguna página ni componente existente importa `@/lib/supabase/*` (`grep -rn "lib/supabase" app components` vacío).
- [x] `CLAUDE.md` documenta `npm run supabase:check` y el flujo de migraciones.
- [x] La consola del navegador no muestra errores nuevos en `/`, `/biblioteca`, `/salon` ni `/acerca-de`.

---

## Decisiones

- **Sí:** solo la base técnica. Decisión cerrada por el usuario; puntuaciones y auth van en specs propios.
- **No:** base + puntuaciones o base + auth en el mismo spec. Mezcla infraestructura con producto y toca demasiadas áreas a la vez.
- **Sí:** `@supabase/ssr` con cliente de servidor y de navegador. Es el patrón oficial para App Router y deja lista la sesión por cookies para cuando llegue la auth.
- **No:** `proxy.ts` de refresco de sesión. Sin auth sería código muerto; entra con el spec de auth.
- **Sí:** clave publishable (`sb_publishable_…`). Supabase la recomienda y se puede rotar de forma independiente.
- **No:** anon key legacy (JWT). Supabase la está retirando.
- **No:** clave secreta o `service_role`. Hoy no tiene uso y es la de mayor riesgo si se filtra.
- **Sí:** verificación con `npm run supabase:check` contra `/auth/v1/settings`. Comprueba URL y clave sin crear tablas ni exponer rutas.
- **No:** ruta `/api/health`. Sería visible en producción sin aportar nada a los usuarios.
- **No:** tabla `healthcheck`. Deja en la BD un objeto sin uso de negocio.
- **Sí:** migraciones versionadas en `supabase/migrations/` y aplicadas con el MCP. El historial queda en git y no hace falta CLI ni Docker.
- **No:** Supabase CLI como devDependency. Requiere login y Docker para el stack local.
- **No:** migraciones solo en remoto. Se pierde el historial en git.
- **Sí:** tipos generados en `lib/supabase/database.types.ts` desde ahora. Los clientes nacen tipados y cada migración regenera el archivo.
- **Sí:** `SUPABASE_DB_PSWD` fuera del código y de `.env.example`. Ni la app ni el MCP la necesitan.
- **Sí:** `node --env-file=.env.local` en el script. Node 22 ya lo trae; no hace falta `dotenv` ni `@next/env`.

Decisiones ya tomadas para el futuro spec de puntuaciones (no se implementan aquí):

- **Sí:** jugador identificado por nombre libre (texto de la sesión simulada) hasta que exista auth real.
- **Sí:** escritura en Supabase mediante Server Action con validación en servidor, mismo patrón que SPEC 03. El navegador no inserta directamente.
- **Sí:** el catálogo sigue en `lib/games.ts`. `game_id` es texto validado contra `GAMES`, sin tabla `games`.

---

## Riesgos

| Riesgo                                                                                      | Mitigación                                                                                                                     |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Usar el cliente de servidor fuera de `<Suspense>` con `cacheComponents` rompe el build      | Comentario en `lib/supabase/server.ts` y nota en `CLAUDE.md`. En este spec ninguna página lo usa todavía.                      |
| Llamar a `createClient()` de servidor dentro de `"use cache"` lanza error (lee `cookies()`) | Mismo comentario: leer fuera y pasar valores, o usar `"use cache: private"`.                                                   |
| Las variables `NEXT_PUBLIC_` quedan congeladas en el bundle al hacer build                  | Es esperado: la URL y la clave publishable son públicas por diseño. La protección de datos irá en RLS en cada spec con tablas. |
| `/auth/v1/settings` cambia de comportamiento o deja de exigir `apikey`                      | El criterio con la clave alterada (`HTTP 401`) detecta si el check deja de validar la clave.                                   |
| Desfase entre `supabase/migrations/` y lo aplicado en remoto                                | Convención: siempre archivo primero, mismo nombre en `apply_migration`, y comprobar con `list_migrations`.                     |
| `database.types.ts` desactualizado tras una migración                                       | Paso obligatorio de regenerar tipos documentado en `CLAUDE.md`.                                                                |

---

## Lo que **no** está en este spec

- Tablas, RLS y migraciones con contenido.
- Puntuaciones y ranking real.
- Supabase Auth y `proxy.ts`.
- Clave secreta y cliente admin.
- Catálogo de juegos en base de datos.
- Supabase CLI y stack local.
- Tests automatizados.

Cada uno de esos, si llega, va en su propio spec.
