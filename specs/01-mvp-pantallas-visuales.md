# SPEC 01 — MVP visual de Arcade Vault

> **Estado:** Aprobado
> **Depende de:** —
> **Fecha:** 2026-10-29
> **Objetivo:** Portar las cinco pantallas de `references/templates/` (Biblioteca, Detalle, Reproductor, Auth y Salón de la Fama) a rutas reales del App Router con datos mock y sin juegos jugables.

---

## Por qué existe este spec

La plantilla de referencia es un SPA con React UMD + Babel en el navegador que enruta con `location.hash`.
El proyecto ya tiene portados los estilos 1:1 en `app/globals.css` (commit `e553a67`), pero `app/page.tsx` sigue siendo el scaffold de Create Next App.
Este spec convierte la plantilla en una app Next.js 16 real, con URLs compartibles, manteniendo la fidelidad visual.

---

## Alcance

**Dentro:**

- Cinco pantallas como rutas del App Router:
  - `/` → Biblioteca (hero, buscador, chips de categoría, grilla de tarjetas, estado "NO HAY RESULTADOS").
  - `/juegos/[id]` → Detalle (portada, tags, descripción, stat-strip, acciones, leaderboard de 10 filas).
  - `/juegos/[id]/jugar` → Reproductor con demo simulada (HUD, CRT decorativo, pausa, fin, modal de fin de juego).
  - `/auth` → Acceso (pestañas INICIAR SESIÓN / CREAR CUENTA, invitado, botones sociales decorativos).
  - `/salon` → Salón de la Fama (pestañas por juego vía `?juego=id`, podio, tabla, fila "TU MEJOR MARCA").
- Página 404 retro (`app/not-found.tsx`) para ids de juego inexistentes y rutas desconocidas.
- Layout compartido: fondo (`.av-bg`, `.av-noise`), navegación con menú móvil, `<main className="av-main">` y footer.
- Sesión mock en `localStorage` (clave `av_user`) y guardado de puntuaciones en `localStorage` (clave `av_scores`).
- Datos mock tipados en TypeScript (8 juegos, categorías, generador determinista de rankings).
- Prerender de los 8 juegos con `generateStaticParams`.

**Fuera de alcance (para futuros specs):**

- Implementar cualquier juego real (canvas, input de teclado/táctil, lógica de juego).
- Backend, base de datos o API de puntuaciones.
- Autenticación real, validación de formularios, OAuth con Google/GitHub.
- Mostrar en los rankings las puntuaciones guardadas en `av_scores` (los rankings siguen siendo mock).
- Sistema de créditos funcional (el contador `CRÉDITOS · 03` es fijo).
- Menú desplegable de usuario en la nav.
- Migrar las clases de `globals.css` a utilidades Tailwind.
- Tests automatizados (no hay test runner configurado).

---

## Modelo de datos

```ts
// lib/games.ts
export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type GameColor = "cyan" | "magenta" | "yellow" | "green";

export type Game = {
  id: string;          // slug usado en la URL: "bloque-buster", "caida", ...
  title: string;       // "BLOQUE BUSTER"
  short: string;       // descripción corta de la tarjeta
  long: string;        // descripción del detalle
  cat: GameCategory;
  cover: string;       // clase CSS de portada: "cover-bricks", "cover-tetro", ...
  color: GameColor;    // decide la variante del botón JUGAR
  best: number;        // mejor puntuación global mock
  plays: string;       // "12.4K"
};

export const GAMES: Game[];                                   // los 8 juegos de data.jsx, mismos valores
export const CATS = ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"] as const;
export function getGame(id: string): Game | undefined;

export type ScoreRow = { rank: number; name: string; score: number; date: string }; // date "DD/MM/2026"
export function seededScores(seed: number, count?: number): ScoreRow[];             // mismo algoritmo que data.jsx
```

```ts
// lib/session.ts
export type User = { name: string };                // nombre en mayúsculas, máx. 10 caracteres
export type SavedScore = { game: string; score: number; name: string; at: number }; // at = Date.now()

export const USER_KEY = "av_user";                  // JSON de User | ausente
export const SCORES_KEY = "av_scores";              // JSON de SavedScore[]
```

Convenciones:

- Las semillas de ranking se mantienen como en la plantilla: detalle `id.length * 17 + 3` (10 filas), salón `id.length * 23 + 7` (12 filas).
- Los números se formatean con `toLocaleString("es-ES")`.
- Todo acceso a `localStorage` va envuelto en `try/catch` y solo ocurre en el cliente.
- Las claves no llevan versión para conservar compatibilidad con la plantilla.

---

## Plan de implementación

Usar la skill `/frontend-design` para el trabajo de UI (indicación de `CLAUDE.md`), tomando `references/templates/` como referencia visual obligatoria.
Antes de escribir rutas, leer en `node_modules/next/dist/docs/` lo relativo a `cacheComponents`, `searchParams`, `generateStaticParams` y `not-found`.

1. **Datos mock.** Crear `lib/games.ts` con los tipos, `GAMES`, `CATS`, `getGame` y `seededScores` portados de `data.jsx`. Verificar: `npm run build` pasa.
2. **Sesión.** Crear `lib/session.ts` (tipos, claves, helpers de lectura/escritura con `try/catch`) y `components/session-provider.tsx` (`"use client"`, contexto con `user`, `login(user)`, `logout()`, `saveScore(entry)`; lee `av_user` tras montar). Verificar: build pasa.
3. **Layout.** Crear `components/nav.tsx` (cliente: `usePathname` para el enlace activo, panel móvil, botón de sesión) y `components/footer.tsx`. Modificar `app/layout.tsx` para envolver con `SessionProvider` y renderizar nav, `<main className="av-main">` y footer. Reemplazar `app/page.tsx` por un placeholder mínimo. Verificar: `npm run dev` muestra nav y footer con estilo retro.
4. **Biblioteca.** Crear `components/game-card.tsx` (cliente, efecto tilt, `<Link>` al detalle) y `components/library.tsx` (cliente, buscador + chips + estado vacío). `app/page.tsx` renderiza hero + `Library`. Verificar: filtrar por "caí" deja solo CAÍDA; chip SHOOTER deja INVASORES y ROCAS.
5. **Detalle.** Crear `components/leaderboard.tsx` y `app/juegos/[id]/page.tsx` con `generateStaticParams` y `notFound()` si `getGame` devuelve `undefined`. Verificar: `/juegos/caida` muestra 10 filas con top1–top3 resaltados.
6. **404.** Crear `app/not-found.tsx` con estética arcade y enlace "VOLVER AL VAULT". Verificar: `/juegos/no-existe` y `/cualquier-cosa` la muestran.
7. **Reproductor.** Crear `components/game-player.tsx` (cliente: puntuación que sube cada 220 ms, subida de nivel, PAUSA/REANUDAR, FIN, SALIR, modal con guardar puntuación vía `saveScore`, JUGAR DE NUEVO, VOLVER AL VAULT) y `app/juegos/[id]/jugar/page.tsx` con `generateStaticParams` y `notFound()`. Verificar: FIN abre el modal y GUARDAR añade una entrada a `av_scores`.
8. **Auth.** Crear `components/auth-form.tsx` (cliente) y `app/auth/page.tsx`. Enviar el formulario llama `login({ name: (usuario || "PLAYER1").toUpperCase().slice(0, 10) })` y navega a `/`. "JUGAR COMO INVITADO" llama `logout()` y navega a `/`. Verificar: tras entrar, la nav muestra `NOMBRE ▾`; pulsarlo cierra sesión.
9. **Salón de la Fama.** Crear `components/hall-of-fame.tsx` y `app/salon/page.tsx`. Las pestañas son `<Link href="/salon?juego=id">`; el contenido que lee `searchParams` va dentro de `<Suspense>`. Un `juego` ausente o inválido usa `GAMES[0].id`. La fila "TU MEJOR MARCA" es un componente cliente que solo aparece con sesión. Verificar: `/salon?juego=rocas` marca la pestaña ROCAS y el podio cambia.
10. **Limpieza de estilos inline.** Sustituir los `style={{...}}` heredados de la plantilla por utilidades Tailwind basadas en los tokens de `@theme inline` (`text-ink-faint`, `font-pixel`, ...) sin cambiar el resultado visual. Verificar: `npm run lint` y `npm run build` pasan.

---

## Criterios de aceptación

- [ ] `npm run lint` termina sin errores.
- [ ] `npm run build` termina sin errores y lista `/juegos/[id]` y `/juegos/[id]/jugar` con los 8 ids prerenderizados.
- [ ] `/` muestra el hero "ARCADE VAULT" y 8 tarjetas.
- [ ] Escribir "serp" en el buscador deja solo la tarjeta SERPENTINA.
- [ ] El chip PUZZLE deja solo CAÍDA; el chip TODOS restaura las 8.
- [ ] Una búsqueda sin coincidencias muestra "NO HAY RESULTADOS".
- [ ] Hacer clic en una tarjeta o en su botón JUGAR navega a `/juegos/[id]`.
- [ ] `/juegos/bloque-buster` muestra título, tags, stat-strip y un leaderboard de 10 filas.
- [ ] "▶ JUGAR AHORA" navega a `/juegos/[id]/jugar`; "VOLVER AL VAULT" navega a `/`.
- [ ] `/juegos/no-existe` y `/juegos/no-existe/jugar` muestran la 404 retro.
- [ ] En el reproductor la puntuación aumenta sola; PAUSA la detiene y muestra "EN PAUSA"; REANUDAR la continúa.
- [ ] FIN abre el modal "FIN DEL JUEGO" con la puntuación final.
- [ ] GUARDAR PUNTUACIÓN añade `{ game, score, name, at }` al array de `localStorage["av_scores"]` y muestra "▸ PUNTUACIÓN GUARDADA_".
- [ ] El campo de iniciales fuerza mayúsculas y un máximo de 10 caracteres.
- [ ] JUGAR DE NUEVO reinicia puntuación a 0, vidas a 3 y nivel a 01.
- [ ] En `/auth` la pestaña CREAR CUENTA muestra el campo de correo; INICIAR SESIÓN lo oculta.
- [ ] Enviar el formulario guarda `localStorage["av_user"]` y la nav muestra el nombre en mayúsculas.
- [ ] Recargar la página mantiene la sesión visible en la nav.
- [ ] Pulsar el botón de usuario en la nav borra `av_user` y vuelve a mostrar "Iniciar Sesión".
- [ ] Los botones GOOGLE y GITHUB no navegan ni cambian estado.
- [ ] `/salon` sin parámetro muestra BLOQUE BUSTER activo; `/salon?juego=caida` muestra CAÍDA activo.
- [ ] `/salon?juego=invalido` muestra BLOQUE BUSTER activo sin error.
- [ ] Con sesión, el salón muestra la fila "TU MEJOR MARCA EN {TÍTULO}"; sin sesión no aparece.
- [ ] El enlace "Biblioteca" de la nav está activo en `/`, `/juegos/[id]` y `/juegos/[id]/jugar`; "Salón de la Fama" en `/salon`.
- [ ] Con un viewport de 375 px el botón ≡ abre el panel móvil y elegir un enlace lo cierra.
- [ ] La consola del navegador no muestra errores de hidratación en ninguna de las cinco rutas.
- [ ] Ninguna página contiene ya contenido del scaffold de Create Next App.

---

## Decisiones

- **Sí:** rutas reales del App Router (`/`, `/juegos/[id]`, `/juegos/[id]/jugar`, `/auth`, `/salon`). URLs compartibles y aprovechan prefetch.
- **No:** SPA con estado en `location.hash` como la plantilla. Desaprovecha Next y rompe el botón atrás.
- **Sí:** reproductor con demo simulada (puntuación automática, pausa, modal). Permite revisar todos los estados visuales sin juego real.
- **No:** reproductor estático. Dejaría el modal de fin de juego sin forma natural de verse.
- **Sí:** sesión mock en `localStorage["av_user"]`. Hace visibles los estados con y sin sesión.
- **No:** autenticación real. Requiere backend; va en otro spec.
- **Sí:** guardar puntuaciones en `localStorage["av_scores"]` sin leerlas en los rankings. Mantiene el MVP visual simple.
- **No:** mezclar puntuaciones guardadas con los rankings mock. Merece su propio spec.
- **Sí:** reusar las clases ya portadas en `app/globals.css`. Garantiza fidelidad visual 1:1.
- **No:** reescribir los estilos en utilidades Tailwind. Mucho trabajo y riesgo de desviación.
- **Sí:** Tailwind solo para sustituir los `style={{}}` inline de la plantilla.
- **Sí:** pestaña del salón en `?juego=id`. Enlazable y sobrevive a recargas.
- **No:** pestaña en `useState`. Se pierde al recargar.
- **Sí:** `notFound()` con `app/not-found.tsx` retro para ids inexistentes.
- **No:** redirigir a `/` o usar la 404 por defecto. Oculta el error o rompe la estética.
- **Sí:** `generateStaticParams` para los 8 juegos. Los datos son estáticos.
- **Sí:** `components/` y `lib/` en la raíz con imports `@/`.
- **No:** carpetas privadas dentro de `app/`.
- **Sí:** elementos decorativos fijos: `CRÉDITOS · 03`, botones GOOGLE/GITHUB sin acción, fila "TU MEJOR MARCA" con datos inventados y footer `v2.6.0`.
- **Sí:** el botón de usuario de la nav cierra sesión directamente, como la plantilla.
- **No:** dropdown de usuario. Diseño nuevo que no está en la plantilla.
- **Sí:** claves de `localStorage` sin versión. Compatibles con la plantilla; se versionarán si el esquema cambia.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Errores de hidratación al leer `localStorage` durante el render | `SessionProvider` lee `av_user` solo tras montar; el servidor y el primer render cliente muestran el estado sin sesión. |
| Parpadeo "Iniciar Sesión" → nombre al cargar con sesión | Aceptado en el MVP; es el coste de no usar cookies. |
| `cacheComponents` exige `<Suspense>` al leer `searchParams` | El contenido del salón que depende de `?juego=` va dentro de `<Suspense>` con un fallback simple. |
| `localStorage` deshabilitado (modo privado, cuota) | Todos los accesos en `try/catch`; la app funciona sin persistir. |
| APIs de Next 16 distintas a las conocidas | Leer `node_modules/next/dist/docs/` antes de cada paso que use APIs del framework. |
| El intervalo del reproductor sigue corriendo al salir | Limpiar el `setInterval` en el cleanup del `useEffect`. |

---

## Lo que **no** está en este spec

- Juegos jugables reales.
- Backend, API o base de datos.
- Autenticación real y OAuth.
- Rankings que incluyan las puntuaciones guardadas.
- Créditos funcionales.
- Dropdown de usuario.
- Migración de estilos a Tailwind.
- Tests automatizados.

Cada uno de esos, si llega, va en su propio spec.
