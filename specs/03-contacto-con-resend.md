# SPEC 03 — Envío real del formulario de contacto con Resend

> **Estado:** Aprobado
> **Depende de:** SPEC 02
> **Fecha:** 2026-10-31
> **Objetivo:** Hacer que el formulario de contacto de `/acerca-de` envíe un correo real al equipo mediante Resend desde una Server Action, manteniendo la terminal de éxito de la referencia y añadiendo estados de envío y de error.

---

## Por qué existe este spec

SPEC 02 portó el formulario de contacto de `references/home-about/about.jsx` solo simulado y dejó fuera de alcance el envío real.
La referencia visual sigue siendo `references/home-about/` (formulario, shake y terminal "VAULT-OS // TERMINAL").
La referencia no define qué pasa mientras se envía ni cuando el envío falla; este spec fija esos dos estados con el mismo lenguaje visual de la terminal.

---

## Alcance

**Dentro:**

- Dependencia `resend` (SDK oficial) en `package.json`.
- Server Action `sendContactMessage` en `app/acerca-de/actions.ts` que valida los datos y envía un correo al equipo con Resend.
- Un único correo por mensaje: aviso al buzón del equipo (`CONTACT_TO_EMAIL`) con `replyTo` igual al correo del jugador.
- Plantilla del correo como función pura en `lib/contact-email.ts`: HTML inline con estética arcade básica y versión en texto plano.
- Validación compartida cliente/servidor en `lib/contact.ts`: campos no vacíos tras `trim`, formato de correo con regex simple y longitudes máximas.
- Honeypot: campo oculto `website`; si llega relleno, el servidor responde éxito sin enviar.
- Configuración por variables de entorno: `RESEND_API_KEY`, `CONTACT_FROM_EMAIL`, `CONTACT_TO_EMAIL` en `.env.local`, más `.env.example` commiteado.
- Estado pendiente: botón deshabilitado con el texto `▶  TRANSMITIENDO…`.
- Estado de error: terminal VAULT-OS con líneas `[ERR]` y botón `REINTENTAR` que vuelve al formulario conservando los datos.
- Estado de éxito: la terminal existente de SPEC 02, mostrada solo cuando Resend confirma el envío.

**Fuera de alcance (para futuros specs):**

- Correo de confirmación al jugador (requiere dominio verificado en Resend).
- React Email u otra librería de plantillas.
- Rate limiting por IP, CAPTCHA o cualquier anti-spam más allá del honeypot.
- Persistencia de los mensajes (base de datos, `localStorage`, logs de negocio).
- Verificación de dominio propio en Resend y configuración DNS.
- Route Handler `/api/contact` o cualquier API pública.
- Librerías de validación (zod, valibot).
- Cambios visuales en el resto de `/acerca-de` o en otras páginas.
- Tests automatizados (no hay test runner configurado).

---

## Modelo de datos

```ts
// lib/contact.ts — compartido por ContactForm y la Server Action (sin "use server" ni "use client")
export type ContactInput = { name: string; email: string; msg: string };

export const CONTACT_LIMITS = { name: 80, email: 254, msg: 2000 } as const;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Devuelve los datos con trim aplicado, o null si algún campo es inválido.
export function validateContact(input: ContactInput): ContactInput | null;
```

```ts
// app/acerca-de/actions.ts ("use server")
export type ContactResult =
  | { status: "idle" }               // estado inicial de useActionState
  | { status: "sent"; name: string } // Resend respondió OK (o honeypot relleno)
  | { status: "invalid" }            // la validación del servidor falló → shake en cliente
  | { status: "error" };             // falta configuración o Resend devolvió error

export async function sendContactMessage(prev: ContactResult, formData: FormData): Promise<ContactResult>;
// Campos de FormData: "name", "email", "msg", "website" (honeypot)
```

```ts
// lib/contact-email.ts
export function contactEmail(input: ContactInput): { subject: string; html: string; text: string };
// subject: "[ARCADE VAULT] Nuevo mensaje de {name}"
```

```bash
# .env.example (commiteado, sin valores reales)
RESEND_API_KEY=
CONTACT_FROM_EMAIL="Arcade Vault <onboarding@resend.dev>"
CONTACT_TO_EMAIL=
```

Convenciones:

- `.env*` ya está en `.gitignore`; `.env.example` se añade con una excepción `!.env.example`.
- Las variables de entorno solo se leen en `app/acerca-de/actions.ts`; nunca llevan prefijo `NEXT_PUBLIC_`.
- Todo texto del usuario se escapa (`& < > " '`) antes de insertarlo en el HTML del correo.
- El HTML usa solo estilos inline y tablas; colores de `app/globals.css` (`--cyan`, `--magenta`, `--green`) escritos como hex literales.
- Los errores de Resend se registran con `console.error` en el servidor sin incluir el mensaje del jugador; al cliente solo llega `{ status: "error" }`.

---

## Plan de implementación

Usar la skill `/frontend-design` para el trabajo de UI (indicación de `CLAUDE.md`), tomando `references/home-about/` como referencia visual obligatoria.
Antes de escribir la Server Action, leer `node_modules/next/dist/docs/01-app/02-guides/server-actions.md`, `forms.md` y `environment-variables.md`.

1. **Dependencia y configuración.** `npm install resend`. Crear `.env.example` con las tres variables y añadir `!.env.example` a `.gitignore`. Verificar: `npm run build` pasa y `git status` muestra `.env.example` pero no `.env.local`.
2. **Validación compartida.** Crear `lib/contact.ts` con `ContactInput`, `CONTACT_LIMITS`, `EMAIL_RE` y `validateContact`. Verificar: `npm run build` pasa.
3. **Plantilla del correo.** Crear `lib/contact-email.ts` con `contactEmail` (asunto, HTML escapado y texto plano con nombre, correo y mensaje). Verificar: `npm run build` pasa.
4. **Server Action.** Crear `app/acerca-de/actions.ts` (`"use server"`) con `ContactResult` y `sendContactMessage`. Orden: honeypot relleno → `{ status: "sent" }` sin enviar; `validateContact` falla → `{ status: "invalid" }`; falta alguna variable de entorno → `console.error` y `{ status: "error" }`; `resend.emails.send({ from, to, replyTo, subject, html, text })` con `error` → `{ status: "error" }`; OK → `{ status: "sent", name }`. Verificar: `npm run build` pasa y `/acerca-de` sigue listada como estática.
5. **Formulario conectado.** En `components/contact-form.tsx`: usar `useActionState(sendContactMessage, { status: "idle" })`. Mantener los inputs controlados y añadir `name` a cada uno. El `onSubmit` valida con `validateContact`; si falla aplica `.shake` 400 ms y no envía; si pasa, llama a la action con el `FormData` dentro de `startTransition`. Con `isPending` el botón queda `disabled` y muestra `▶  TRANSMITIENDO…`. Un resultado `invalid` también aplica `.shake`. Un resultado `sent` muestra la terminal de éxito actual con el nombre devuelto. Verificar: envío real llega al buzón de `CONTACT_TO_EMAIL`.
6. **Honeypot.** Añadir al formulario un campo `website` oculto visualmente y para lectores de pantalla (`aria-hidden`, `tabIndex={-1}`, `autoComplete="off"`, fuera de pantalla con utilidades Tailwind). Verificar: rellenarlo desde DevTools y enviar muestra éxito y no llega correo.
7. **Terminal de error.** Con resultado `error`, mostrar la terminal VAULT-OS con: la línea de prompt de la terminal de éxito, `[OK] Conectando con servidor…`, `[ERR] Transmisión interrumpida.` y la línea final `> TRANSMISIÓN FALLIDA. INTÉNTALO DE NUEVO EN UNOS MINUTOS.` con caret. Botón `REINTENTAR` (`btn ghost`) vuelve al formulario con los datos intactos. Añadir a `app/globals.css`, junto a `.term-body .success`, la clase `.term-body .error` (color `var(--magenta)` y `text-shadow` equivalente). Verificar: con `RESEND_API_KEY` inválida se ve la terminal de error y `REINTENTAR` conserva los tres campos.
8. **Volver al formulario.** `ENVIAR OTRO MENSAJE` vacía los campos y vuelve al formulario; `REINTENTAR` vuelve sin vaciarlos. Ambos ocultan la terminal aunque el último resultado de `useActionState` siga siendo `sent` o `error` (estado local de vista en el cliente). Verificar: `npm run lint` y `npm run build` pasan.

---

## Criterios de aceptación

- [ ] `npm run lint` termina sin errores.
- [ ] `npm run build` termina sin errores y lista `/acerca-de` como estática.
- [ ] `package.json` incluye `resend` en `dependencies`.
- [ ] `.env.example` existe en git con `RESEND_API_KEY`, `CONTACT_FROM_EMAIL` y `CONTACT_TO_EMAIL`; `.env.local` no está trackeado.
- [ ] `grep -rn "RESEND_API_KEY" app components lib` solo encuentra `app/acerca-de/actions.ts`.
- [ ] El bundle de cliente (`.next/static`) no contiene el valor de `RESEND_API_KEY`.
- [ ] Enviar con nombre "px_kai", un correo válido y un mensaje hace llegar un correo a `CONTACT_TO_EMAIL` con asunto "[ARCADE VAULT] Nuevo mensaje de px_kai".
- [ ] Responder a ese correo desde el cliente de correo usa como destinatario el correo introducido en el formulario.
- [ ] Ese envío muestra la terminal con "GRACIAS, PX_KAI.".
- [ ] Un mensaje con `<b>hola</b>` aparece en el correo como texto literal, no en negrita.
- [ ] Mientras la action está pendiente el botón muestra "▶  TRANSMITIENDO…" y tiene el atributo `disabled`.
- [ ] Hacer doble clic rápido en "▶  ENVIAR MENSAJE" envía un solo correo.
- [ ] Enviar con un campo vacío aplica la clase `shake`, no llama a la action (sin petición POST en la pestaña Network) y no muestra ninguna terminal.
- [ ] Enviar con correo "jugador@vault" (sin TLD) aplica `shake` y no envía.
- [ ] Llamar a la action con un mensaje de 2001 caracteres (saltando la validación del cliente) devuelve `{ status: "invalid" }` y no envía.
- [ ] Con el campo `website` relleno, el envío muestra la terminal de éxito y no llega ningún correo.
- [ ] El campo `website` no es visible, no recibe foco con Tab y no aparece en el árbol de accesibilidad.
- [ ] Con `RESEND_API_KEY` vacía o inválida, el envío muestra la terminal de error con "TRANSMISIÓN FALLIDA" en color magenta.
- [ ] "REINTENTAR" vuelve al formulario con nombre, correo y mensaje intactos.
- [ ] "ENVIAR OTRO MENSAJE" vuelve al formulario con los tres campos vacíos.
- [ ] Enviar el formulario no crea ni modifica ninguna clave de `localStorage`.
- [ ] La consola del navegador no muestra errores de hidratación en `/acerca-de`.
- [ ] El formulario en reposo y la terminal de éxito se ven igual que antes de este spec (comparación con Playwright a 1440 px y 390 px contra `arcade-vault-standalone.html`, hash `about`).

---

## Decisiones

- **Sí:** Resend con su SDK oficial `resend`. Decisión cerrada por el usuario.
- **Sí:** un solo correo de aviso al equipo con `replyTo` al jugador. Funciona con el remitente de pruebas `onboarding@resend.dev`.
- **No:** correo de confirmación al jugador. Exige dominio verificado; va en otro spec.
- **Sí:** plantilla HTML inline más texto plano generada por una función pura. Sin dependencias extra.
- **No:** React Email. Demasiadas dependencias para una única plantilla.
- **No:** solo texto plano. Pierde la estética arcade sin ahorrar casi nada.
- **Sí:** Server Action con `useActionState`. Idiomático en App Router y la API key nunca llega al cliente.
- **No:** Route Handler `/api/contact`. No hay otros consumidores.
- **Sí:** terminal de error con `[ERR]` y `REINTENTAR` que conserva los datos. Mantiene el lenguaje visual de la terminal de éxito.
- **No:** mensaje inline sobre el botón. Rompe la simetría con el estado de éxito.
- **Sí:** tres variables de entorno (`RESEND_API_KEY`, `CONTACT_FROM_EMAIL`, `CONTACT_TO_EMAIL`). Permite pasar de `onboarding@resend.dev` a un dominio propio sin tocar código.
- **No:** remitente y destinatario fijos en código.
- **Sí:** botón deshabilitado con "TRANSMITIENDO…" y terminal de éxito solo tras la respuesta real. La terminal nunca miente.
- **No:** terminal animada antes de la respuesta. Mostraría `[OK]` sobre un envío que puede fallar.
- **Sí:** validación en servidor de vacíos, formato y longitudes (80 / 254 / 2000) con código propio compartido en `lib/contact.ts`.
- **No:** zod u otra librería de validación. Tres campos no la justifican.
- **Sí:** honeypot `website` que responde éxito falso. Cero dependencias y sin cambio visual; el bot no aprende que fue detectado.
- **No:** rate limiting en memoria. Poco fiable en serverless; merece su propio spec.
- **Sí:** configuración ausente → terminal de error y `console.error` en servidor. El build no depende de tener la key.
- **Sí:** asunto "[ARCADE VAULT] Nuevo mensaje de {name}". Facilita filtrar en el buzón del equipo.
- **Sí:** este spec sustituye la decisión de SPEC 02 "formulario de contacto solo simulado".

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Con `onboarding@resend.dev` Resend solo entrega al correo dueño de la cuenta | `CONTACT_TO_EMAIL` debe ser ese correo hasta verificar un dominio; documentado en `.env.example`. |
| Inyección de HTML en el correo con el texto del jugador | Escape de `& < > " '` en `lib/contact-email.ts`; criterio de aceptación con `<b>hola</b>`. |
| Inyección de cabeceras vía nombre en el asunto | El SDK envía JSON a la API de Resend, no cabeceras SMTP crudas; además se eliminan saltos de línea del nombre en el asunto. |
| Spam automatizado agota la cuota gratuita de Resend | Honeypot en este spec; rate limiting o CAPTCHA en uno futuro. |
| Fuga de `RESEND_API_KEY` al cliente | Solo se lee en el archivo `"use server"`; criterio de aceptación con `grep` y revisión de `.next/static`. |
| Las Server Actions se pueden invocar directamente saltando el cliente | El servidor revalida todo con `validateContact`; el cliente solo valida por UX. |
| Usar la action rompe el prerender estático de `/acerca-de` bajo `cacheComponents` | Criterio de aceptación: `npm run build` sigue listando `/acerca-de` como estática. |

---

## Lo que **no** está en este spec

- Correo de confirmación al jugador.
- React Email u otras librerías de plantillas.
- Rate limiting, CAPTCHA o anti-spam más allá del honeypot.
- Persistencia de los mensajes.
- Dominio propio verificado en Resend.
- API pública de contacto.
- Tests automatizados.

Cada uno de esos, si llega, va en su propio spec.
