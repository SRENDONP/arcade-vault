# SPEC 02 — Páginas Inicio y Acerca de

> **Estado:** Implementado
> **Depende de:** SPEC 01
> **Fecha:** 2026-10-30
> **Objetivo:** Portar la landing (`home.jsx`) y la página Acerca de con contacto (`about.jsx`) de `references/home-about/` a `/` y `/acerca-de`, moviendo la Biblioteca a `/biblioteca`.

---

## Por qué existe este spec

La nueva referencia `references/home-about/` añade una landing como pantalla por defecto y una página "Acerca de" con formulario de contacto.
En ella la nav pasa a tener cuatro enlaces (Inicio, Biblioteca, Salón de la Fama, Acerca de) y la Biblioteca deja de ser la raíz.
Este spec lleva esas dos pantallas al App Router con la misma fidelidad visual y las mismas convenciones del MVP de SPEC 01.
La referencia visual obligatoria es `references/home-about/arcade-vault-standalone.html` (rutas por hash: `{"name":"home"}` y `{"name":"about"}`).

---

## Alcance

**Dentro:**

- `/` → Inicio (landing): hero con siluetas pixel flotantes, "¿POR QUÉ ARCADE VAULT?" (4 features), "JUEGOS DISPONIBLES AHORA" (6 mini-cards), franja de stats, "ACTIVIDAD EN VIVO" (ticker + top jugadores), "PRECIOS" (tarjeta + FAQ) y CTA final.
- `/acerca-de` → Acerca de: hero con misión, 3 highlights, divisor de píxeles animado y sección de contacto con formulario simulado.
- Mover la Biblioteca actual (hero "ARCADE VAULT", buscador, chips, grilla) de `/` a `/biblioteca` sin cambios visuales.
- Actualizar los enlaces que hoy llevan a la Biblioteca vía `/` para que apunten a `/biblioteca`.
- Nav con cuatro enlaces (Inicio, Biblioteca, Salón de la Fama, Acerca de) y panel móvil con cinco (más Iniciar Sesión / Cuenta).
- Portar a `app/globals.css` los bloques CSS `HOME PAGE`, `ABOUT PAGE`, `ACTIVITY` y `PRICING` de `references/home-about/styles.css`, más `.btn.press` y `@keyframes shake`.
- Animación de aparición `.reveal` al hacer scroll, igual que la referencia.
- Datos mock de la landing tipados en `lib/landing.ts`, con los textos 1:1 de la referencia.

**Fuera de alcance (para futuros specs):**

- El CSS del "gamepad" (`.gp`, `.dp`, `.ab`, `.gp-themer`, `.score-pop`) de `references/home-about/styles.css`. Irá con el spec que lo use.
- Envío real del formulario de contacto (backend, email, persistencia en `localStorage`).
- Validación de formato de correo más allá del `type="email"` nativo.
- Datos dinámicos en la landing (ticker en vivo, top jugadores reales, contador de juegos derivado de `GAMES`).
- Redirección de URLs antiguas (`/` ya no muestra la Biblioteca y no hay redirect).
- Metadatos (`title`, `description`) propios por página.
- Cambios en Detalle, Reproductor, Auth o Salón más allá de sus enlaces.
- Tests automatizados (no hay test runner configurado).

---

## Modelo de datos

```ts
// lib/landing.ts
import type { GameColor } from "@/lib/games"; // "cyan" | "magenta" | "yellow" | "green"

export type FeatureIconKind = "GAMEPAD" | "FREE" | "TROPHY" | "ROCKET";
export type Feature = { icon: FeatureIconKind; title: string; desc: string; color: GameColor };

export type HomeStat = { n: string; u: string; s: string };          // "12+", "JUEGOS", "Y CONTANDO"

export type TickerEntry = { player: string; game: string; score: number; ago: string; color: GameColor };
export type TopPlayer = { rank: number; player: string; score: number };

export type Faq = { q: string; a: string };

export type HighlightIconKind = "HEART" | "BROWSER" | "PLANT";
export type Highlight = { icon: HighlightIconKind; text: string; color: GameColor };

export const FEATURES: Feature[];          // 4 entradas de home.jsx
export const HOME_STATS: HomeStat[];       // 3 entradas
export const TICKER: TickerEntry[];        // 7 entradas ("NEONFOX", "Caída", 184220, "hace 2 min", "magenta"), ...
export const TOP_PLAYERS: TopPlayer[];     // 5 entradas
export const PRICING_PERKS: string[];      // 6 líneas "✔ ..."
export const FAQS: Faq[];                  // 3 entradas
export const HIGHLIGHTS: Highlight[];      // 3 entradas de about.jsx
```

```ts
// components/contact-form.tsx (estado local, no se persiste)
type ContactForm = { name: string; email: string; msg: string };
// sent: string | null  → nombre enviado; null muestra el formulario
// shake: boolean       → activa la clase .shake durante 400 ms
```

Convenciones:

- Los textos y valores son 1:1 con `home.jsx` y `about.jsx`, incluido "12+ JUEGOS" aunque `GAMES` tiene 8.
- Los mini-cards usan `GAMES.slice(0, 6)` de `lib/games.ts`.
- Los números se formatean con `toLocaleString("es-ES")`, como en SPEC 01.
- El formulario de contacto no escribe en `localStorage` ni en ningún otro almacenamiento.

---

## Plan de implementación

Usar la skill `/frontend-design` para el trabajo de UI (indicación de `CLAUDE.md`), tomando `references/home-about/` como referencia visual obligatoria.
Antes de tocar rutas, releer en `node_modules/next/dist/docs/` lo relativo a `cacheComponents` y `partialPrefetching`.

1. **Estilos.** Copiar a `app/globals.css`, en la misma capa que el resto de estilos portados, los bloques `HOME PAGE`, `ABOUT PAGE`, `ACTIVITY` y `PRICING` de `references/home-about/styles.css`, más `.btn.press` y `@keyframes shake`. No copiar el bloque `GAMEPAD`. Verificar: `npm run build` pasa y `/` se ve igual que antes.
2. **Mover la Biblioteca.** Crear `app/biblioteca/page.tsx` con el contenido actual de `app/page.tsx` (hero + `Library`). Cambiar a `/biblioteca` los enlaces "VOLVER AL VAULT" de `app/juegos/[id]/page.tsx`, `components/game-player.tsx` y `app/not-found.tsx`, "VOLVER A LA BIBLIOTECA" de `app/salon/page.tsx`, y los dos `router.push("/")` de `components/auth-form.tsx`. Verificar: `/biblioteca` muestra la grilla y el buscador funciona.
3. **Nav.** En `components/nav.tsx`: añadir las secciones `inicio` (solo `/`) y `acerca` (`/acerca-de`); `biblioteca` pasa a ser `/biblioteca` y `/juegos/*`. Enlaces de escritorio: Inicio, Biblioteca, Salón de la Fama, Acerca de. Panel móvil: esos cuatro más Iniciar Sesión / Cuenta. El logo apunta a `/`. Verificar: el enlace activo es correcto en `/`, `/biblioteca`, `/juegos/caida`, `/salon` y `/acerca-de`.
4. **Datos de la landing.** Crear `lib/landing.ts` con los tipos y constantes del modelo de datos. Verificar: `npm run build` pasa.
5. **Reveal.** Crear `components/reveal-observer.tsx` (`"use client"`, renderiza `null`). Al montar observa todos los `.reveal` con `IntersectionObserver` (`threshold: 0.12`), les añade `.in` al entrar en viewport, deja de observarlos y desconecta en el cleanup. Verificar: se monta sin errores de hidratación.
6. **Inicio — hero y features.** Crear `components/floating-silhouettes.tsx` (8 SVG decorativos con `aria-hidden`) y `components/feature-icon.tsx`. Reemplazar `app/page.tsx` por la landing: `<div className="home fade-in">`, hero, sección `// 01` y `<RevealObserver />`. Los botones de navegación son `<Link className="btn ...">`: "▶ EXPLORAR JUEGOS" → `/biblioteca`, "✦ CREAR CUENTA" → `/auth`. Verificar: `/` muestra el hero y las 4 features aparecen al hacer scroll.
7. **Inicio — juegos, stats y actividad.** Crear `components/mini-card.tsx` (un `<Link>` a `/juegos/[id]`). Añadir las secciones `// 02` (6 mini-cards y "VER TODOS LOS JUEGOS →" → `/biblioteca`), stats y `// 03` (ticker y top jugadores; "VER SALÓN →" es un `<Link className="lb-link">` a `/salon`). Verificar: clic en un mini-card abre su detalle.
8. **Inicio — precios y CTA final.** Añadir la sección `// 04` (tarjeta de precio y FAQ) y `home-final`. "EMPEZAR GRATIS →" → `/auth`; "INSERTAR MONEDA →" → `/biblioteca`. Verificar: los tres botones navegan a su destino.
9. **Acerca de.** Crear `components/highlight-icon.tsx`, `components/contact-form.tsx` (`"use client"`) y `app/acerca-de/page.tsx` (hero, highlights, divisor de 24 píxeles, contacto y `<RevealObserver />`). Al enviar con algún campo vacío (tras `trim`) se aplica `.shake` durante 400 ms y no se envía. Con los tres campos llenos se muestra la terminal "VAULT-OS // TERMINAL" con `GRACIAS, {NOMBRE EN MAYÚSCULAS}.`. "ENVIAR OTRO MENSAJE" vacía el formulario y lo vuelve a mostrar. Verificar: ambos casos a mano.
10. **Estilos inline.** Sustituir los `style={{...}}` estáticos de la referencia por utilidades Tailwind (`mt-6 text-center`, `w-full`, `mt-[18px]`). Se mantienen inline solo los valores calculados en runtime (`transitionDelay`, `animationDelay`, `width` de `.tp-fill`), como en SPEC 01. Verificar: `npm run lint` y `npm run build` pasan.

---

## Criterios de aceptación

- [x] `npm run lint` termina sin errores.
- [x] `npm run build` termina sin errores y lista `/`, `/biblioteca` y `/acerca-de` como estáticas.
- [x] `/` muestra el hero "EL ARCADE / CLÁSICO ESTÁ / DE VUELTA" con 8 siluetas flotantes.
- [x] "▶ EXPLORAR JUEGOS" navega a `/biblioteca`; "✦ CREAR CUENTA" navega a `/auth`.
- [x] Al hacer scroll, cada sección `.reveal` de `/` pasa a visible (recibe la clase `in`).
- [x] La sección `// 02` muestra 6 mini-cards (los 6 primeros de `GAMES`) y cada uno navega a `/juegos/[id]`.
- [x] "VER TODOS LOS JUEGOS →" e "INSERTAR MONEDA →" navegan a `/biblioteca`.
- [x] La franja de stats muestra "12+", "MILES" y "GLOBAL".
- [x] El ticker muestra 7 filas y el top jugadores 5, con #01–#03 resaltados.
- [x] "VER SALÓN →" navega a `/salon`.
- [x] La tarjeta de precios muestra "$0 / SIEMPRE", 6 ventajas y el sello "FREE PLAY"; "EMPEZAR GRATIS →" navega a `/auth`.
- [x] `/biblioteca` muestra el hero "ARCADE VAULT", el buscador, los chips y las 8 tarjetas, como antes estaba en `/`.
- [x] "VOLVER AL VAULT" (Detalle, Reproductor y 404) y "VOLVER A LA BIBLIOTECA" (Salón) navegan a `/biblioteca`.
- [x] Enviar el formulario de Auth y "JUGAR COMO INVITADO" navegan a `/biblioteca`.
- [x] La nav de escritorio muestra Inicio, Biblioteca, Salón de la Fama y Acerca de, en ese orden.
- [x] "Inicio" está activo solo en `/`; "Biblioteca" en `/biblioteca`, `/juegos/[id]` y `/juegos/[id]/jugar`; "Acerca de" en `/acerca-de`.
- [x] Con un viewport de 375 px el panel móvil muestra Inicio, Biblioteca, Salón de la Fama, Acerca de e Iniciar Sesión.
- [x] El logo de la nav navega a `/`.
- [x] `/acerca-de` muestra "ACERCA DE ARCADE VAULT", la misión, 3 highlights y el divisor de 24 píxeles.
- [x] Enviar el formulario de contacto con un campo vacío aplica la clase `shake` y no muestra la terminal.
- [x] Enviar con nombre "px_kai", correo y mensaje muestra la terminal con "GRACIAS, PX_KAI.".
- [x] "ENVIAR OTRO MENSAJE" vuelve a mostrar el formulario con los tres campos vacíos.
- [x] Enviar el formulario de contacto no crea ni modifica ninguna clave de `localStorage`.
- [x] `app/globals.css` no contiene las clases `.gp`, `.dp-hub` ni `.gp-themer`.
- [x] La consola del navegador no muestra errores de hidratación en `/`, `/biblioteca` ni `/acerca-de`.
- [x] Comparación con Playwright contra `arcade-vault-standalone.html` (hash `home` frente a `/`, `about` frente a `/acerca-de`) a 1440 px y 390 px, con todos los `.reveal` activados y animaciones congeladas: mismo alto y ancho de página, mismos rectángulos de elementos (±0,5 px) y mismos estilos computados. Solo se admiten diferencias de rasterizado de Press Start 2P.

---

## Decisiones

- **Sí:** Inicio en `/` y Biblioteca en `/biblioteca`. Es la pantalla por defecto de la referencia.
- **No:** landing en `/inicio` dejando la Biblioteca en la raíz. Se aleja de la referencia.
- **Sí:** Acerca de en `/acerca-de`. Literal al texto del enlace.
- **No:** `/acerca` ni `/about`.
- **Sí:** formulario de contacto solo simulado (shake + terminal de éxito), como la referencia.
- **No:** guardar mensajes en `localStorage`. No aporta al MVP visual.
- **Sí:** textos y datos de marketing 1:1 de la referencia, incluido "12+ JUEGOS".
- **No:** derivar contadores o ticker de `GAMES`. Diverge visualmente; irá con datos reales en otro spec.
- **Sí:** datos mock en `lib/landing.ts` tipado, como `lib/games.ts`.
- **No:** arrays inline en los componentes como la referencia.
- **Sí:** `.reveal` igual que la referencia, con un componente cliente que añade `.in`.
- **No:** mantener visible el contenido sin JS. Exige CSS distinto al de la referencia.
- **Sí:** portar solo los bloques CSS que usan Inicio y Acerca de.
- **No:** portar el CSS del gamepad sin usarlo.
- **Sí:** CTAs como `<Link className="btn ...">` en vez de `<button onClick>`. Mismo criterio que la tarjeta de juego en SPEC 01.
- **Sí:** las páginas `/` y `/acerca-de` son componentes de servidor; solo `RevealObserver` y `ContactForm` son cliente.
- **Sí:** "VOLVER AL VAULT" y los destinos de Auth pasan a `/biblioteca`. En la referencia esos botones llevan a la Biblioteca.
- **No:** redirect de `/` a `/biblioteca` ni de rutas antiguas. La raíz ahora es la landing.
- **Sí:** se mantiene el `title` global "Arcade Vault · Portal Retro", igual que la referencia.
- **Sí:** este spec sustituye los criterios de SPEC 01 que asumían la Biblioteca en `/`.

Decisiones tomadas durante la implementación:

- **Sí:** renombrar los `@keyframes` `pulse` y `bounce` de la plantilla a `av-pulse` y `av-bounce` en `app/globals.css`. Tailwind v4 emite sus propios `pulse` (opacidad) y `bounce` (-25 %) cuando el CSS usa esos nombres, y ganaban a los de la plantilla en `.btn.pulse` y en la flecha de "DESLIZA".
- **Sí:** el renombrado también corrige "▶ JUGAR AHORA" del Detalle, que usaba `.btn.pulse` con el mismo fallo desde SPEC 01.
- **No:** `@theme { --animate-*: initial; }`. Quita las variables `--animate-*`, pero Tailwind seguía emitiendo los `@keyframes` (verificado en el CSS generado).
- **Sí:** `text-center` en los `<Link>` "VER SALÓN →" y "EMPEZAR GRATIS →". En la referencia son `<button>`, que centran el texto por defecto; a 390 px su texto ocupa dos líneas y quedaba alineado a la izquierda.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Sin JS (o si falla la hidratación) las secciones `.reveal` quedan invisibles | Aceptado en el MVP; es el comportamiento de la referencia. |
| `RevealObserver` solo busca `.reveal` al montar | Cada página monta su propio `RevealObserver`; ninguna sección `.reveal` se añade después del montaje. |
| Enlaces a `/` olvidados que esperaban la Biblioteca | El paso 2 lista todos los sitios encontrados con `grep`; repetir `grep -rn 'href="/"'` antes de cerrar. |
| `home-hero` usa `min-height: calc(100vh - 60px)` y la comparación depende del alto del viewport | Comparar siempre con el mismo viewport en ambas páginas (1440×900 y 390×844). |
| Rasterizado distinto de Press Start 2P entre Google Fonts y `next/font` | Diferencia conocida y aceptada en la verificación de SPEC 01. |
| `.hero-scroll` usa `bottom: -20px` y puede crear scroll horizontal o solaparse en móvil | Heredado 1:1 de la referencia; se verifica en la comparación a 390 px. |

---

## Lo que **no** está en este spec

- CSS y componentes del gamepad.
- Envío real o persistencia del formulario de contacto.
- Datos en vivo en la landing.
- Redirecciones de URLs antiguas.
- Metadatos por página.
- Tests automatizados.

Cada uno de esos, si llega, va en su propio spec.
