# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Idioma

Responde siempre en español: en la conversación, en los informes de subagentes y al ejecutar skills. El código y los identificadores siguen las convenciones del repo.

## Project

Arcade Vault is an online platform for playing games and competing for the highest score. The README (in Spanish) is the source for product intent; UI copy is in Spanish.

Development follows **Spec Driven Design**: write a spec in `specs/NN-name.md` with `/spec`, get it approved, then implement it with `/spec-impl` (skills from [Klerith/fernando-skills](https://github.com/Klerith/fernando-skills), pinned in `skills-lock.json`; games use the local `/spec-impl-game`). Each spec ships on its own branch `spec-NN-<name>` and is merged through a PR. Specs so far:

| #   | Spec                                  | What it delivered                                                                      |
| --- | ------------------------------------- | -------------------------------------------------------------------------------------- |
| 01  | `01-mvp-pantallas-visuales`           | Visual MVP: catalog, detail, player, hall of fame, auth screens                        |
| 02  | `02-inicio-y-acerca-de`               | Landing (`/`) and About (`/acerca-de`)                                                 |
| 03  | `03-contacto-con-resend`              | Contact form that emails through Resend                                                |
| 04  | `04-base-tecnica-supabase`            | Typed Supabase clients, env vars, `supabase:check`                                     |
| 05  | `05-juego-caida`                      | CAÍDA (falling blocks), first real game, with skins/prefs                              |
| 06  | `06-juego-rocas`                      | ROCAS (asteroids-style, canvas)                                                        |
| 07  | `07-leaderboard-supabase`             | Real leaderboard in Supabase (`scores` + RPCs)                                         |
| 08  | `08-juego-bloque-buster`              | BLOQUE BUSTER (brick breaker)                                                          |
| 09  | `09-juego-serpentina`                 | SERPENTINA (snake)                                                                     |
| 10  | `10-juego-duelo-pixel`                | DUELO PIXEL (paddles vs a ladder of 5 CPU rivals)                                      |
| 11  | `11-diseno-responsive-movil`          | Responsive from 360 px: mobile nav, 44 px targets, mobile player                       |
| 12  | `12-controles-tactiles`               | Touch controls (`TouchControls`: D-pad, A, B, pause) in all five games                 |
| 13  | `13-juego-ranaria`                    | RANARIA (crossing road and river), sixth real game                                     |
| 14  | `14-autenticacion-supabase`           | Supabase Auth (email, Google, GitHub), `profiles` alias, `/cuenta`                     |
| 15  | `15-puntuaciones-ligadas-a-la-cuenta` | Scores tied to the account (`user_id`), ranking shows the current alias                |
| 16  | `16-medidas-de-seguridad-basicas`     | Security headers, `rls_auto_enable` off the API, Auth limits, accepted linter warnings |

## Commands

- `npm run dev` — dev server (Turbopack) at http://localhost:3000
- `npm run build` — production build (also type-checks)
- `npm run start` — serve the production build
- `npm run lint` — ESLint (flat config, `eslint-config-next` core-web-vitals + typescript)
- `npm run supabase:check` — verifies the Supabase URL + publishable key in `.env.local` against the remote project (`[OK]` / `[ERR]`, exit code 0 / 1)

No test runner is configured yet. Verify UI changes in the running app (Playwright MCP / Claude in Chrome).

## Stack and non-default configuration

- **Next.js 16.4 (App Router, `app/` directory) + React 19.3 + TypeScript (strict)**. APIs differ from older Next.js — check `node_modules/next/dist/docs/` (`01-app/`, `03-architecture/`) before using framework APIs.
- `next.config.ts` enables options that change rendering/data semantics:
  - `cacheComponents: true` — Cache Components model; caching is opt-in via `"use cache"` and dynamic data (including `searchParams`, `cookies()`) must be wrapped in `<Suspense>`. Read the docs before writing data fetching.
  - `partialPrefetching: true` — `<Link>` prefetches only the route's App Shell (static + URL-independent cached content); use `<Link prefetch={true}>` to prefetch URL-specific content. See `02-guides/adopting-partial-prefetching.md`.
  - `experimental.agentFeedback: true` — this is why `next dev` rewrites the block in `AGENTS.md`; commit `AGENTS.md` changes rather than reverting them.
  - `headers()` (SPEC 16) — five security headers on every route (`source: "/(.*)"`, so also redirects, `/auth/callback` and `_next/static`): `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security: max-age=63072000; includeSubDomains` (no `preload`; ignored on `http://localhost`) and `Permissions-Policy: camera=(), microphone=(), geolocation=()` (`fullscreen` / `gamepad` left open for the games). There is no Content-Security-Policy yet: it needs nonces in `proxy.ts` and its own spec.
- **Tailwind CSS v4** is wired through a Turbopack loader (`@tailwindcss/turbopack` rule for `*.css` in `next.config.ts`), not PostCSS — there is no `postcss.config` or `tailwind.config`. Theme tokens live in `app/globals.css` under `@theme inline`.
- Route prop types use Next's generated global helpers (e.g. `LayoutProps<"/">`, `PageProps<"/salon">`) rather than hand-written prop interfaces.
- Import alias `@/*` maps to the repo root.
- **Prettier + ESLint** run automatically on every file Claude writes/edits (PostToolUse hook `.claude/hooks/format-and-lint.mjs`, configured in `.claude/settings.json`). Remaining lint errors are fed back and must be fixed. `references/` is ignored by both.

## App structure

Routes (`app/`):

- `/` — landing (data in `lib/landing.ts`)
- `/acerca-de` — about + contact form (`components/contact-form.tsx` → Server Action `sendContactMessage` in `app/acerca-de/actions.ts`)
- `/biblioteca` — game catalog (`components/library.tsx`, `game-card.tsx`)
- `/juegos/[id]` — game detail with its top-10 leaderboard (per-game summary in `references/juegos-implementados.md`)
- `/juegos/[id]/jugar` — player: `getPlayable(id) ?? GamePlayer`
- `/salon?juego=<id>` — hall of fame per game (`components/hall-of-fame.tsx`, plus `hall-you-row.tsx` for the signed-in player's best)
- `/auth` — sign in / sign up with email + password, Google or GitHub (`components/auth-form.tsx`); reads `?next=` and `?error=`
- `/auth/callback` — Route Handler: single return point of OAuth, email confirmation and password recovery (PKCE `code` → session); sends to `next`, or to `/auth/alias` when the profile has no alias
- `/auth/recuperar` / `/auth/nueva-contrasena` — request the recovery link / set the new password (`auth-recover-form.tsx`, `auth-new-password-form.tsx`)
- `/auth/alias` — choose the alias after the first sign in (`alias-setup.tsx` → `alias-form.tsx`)
- `/cuenta` — player card: email, linked providers, change alias, sign out (`components/account-view.tsx`)

Shared modules (`lib/`):

- `games.ts` — the catalog (`GAMES`, `getGame`). Ids: `bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `rocas`, `ranaria`, `duelo-pixel`.
- `auth.ts` — pure auth rules (SPEC 14): `AUTH_ROUTES`, `PROTECTED_PATHS`, `validateAlias` (same rules as `NAME_PATTERN`, `INVITADO` reserved), `suggestAlias` (from provider metadata), `validateEmail`, `validatePassword` (≥ `PASSWORD_MIN` 8), `safeNext` (internal paths only, fallback `/biblioteca`), `aliasPath` (never nests `/auth/alias?next=`), `authErrorMessage`.
- `components/session-provider.tsx` — the session store: Supabase Auth via the browser client's `onAuthStateChange` + the player's row in `profiles`. `useSession()` → `{ user, status, refresh, logout }`, `user` = `{ id, email, alias, providers, meta }` (`alias` null until chosen). Server and hydration render `status: "loading"`. Games show `user?.alias ?? DEFAULT_NAME`; only a signed-in player with an alias can save a score (SPEC 15).
- `contact.ts` (validation shared by client and Server Action) and `contact-email.ts` (email template).
- `scores.ts` / `scores-server.ts` — see Supabase below.

## Integrations

### Resend (contact form)

`sendContactMessage` validates with `validateContact`, has a honeypot field (`website`), and sends with `resend`. Env: `RESEND_API_KEY`, `CONTACT_FROM_EMAIL`, `CONTACT_TO_EMAIL` (see `.env.example`). With `onboarding@resend.dev` as sender, Resend only delivers to the account's own email.

### Supabase

Project `ehzxppntfcaqiobqmuub`, via `@supabase/ssr`. Env: `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…`; no secret/service_role key in the app).

- `lib/supabase/client.ts` — `createClient()` for Client Components.
- `lib/supabase/server.ts` — `await createClient()` for Server Components, Server Actions and Route Handlers. It reads `cookies()`, so a Server Component using it must sit inside `<Suspense>`, and it must never be called inside a plain `"use cache"` scope (pass values in, or use `"use cache: private"`).
- `lib/supabase/database.types.ts` — generated types (`Database`); never edit by hand.
- Migrations workflow: write the SQL first as `supabase/migrations/YYYYMMDDHHMMSS_name.sql`, apply it with the MCP `apply_migration` using the same name, confirm with `list_migrations`, then regenerate `database.types.ts` with `generate_typescript_types`. `apply_migration` records its own timestamp, so rename the file to the version `list_migrations` reports. No Supabase CLI or local stack. Migrations: `20261105002904_scores.sql`, `20261115190741_profiles.sql`, `20261116010327_scores_user.sql`, `20261116014629_revoke_rls_auto_enable.sql`. Supabase's default privileges grant `EXECUTE` on every new function in `public` to `anon` and `authenticated`, so each migration revokes it explicitly where it is not wanted.
- Auth (SPEC 14, SPEC 16): providers email (confirmation required, min password 8, enforced by the server: a 7-character signup by REST must get `422 weak_password`), Google and GitHub, rate limit «Sign-ups and sign-ins» 30 per 5 min per IP (Auth → Rate Limits), all configured by hand in the Supabase dashboard (Site URL `http://localhost:3000`, Redirect URL `http://localhost:3000/auth/callback**`; the OAuth apps call back to `https://ehzxppntfcaqiobqmuub.supabase.co/auth/v1/callback`). Sign in / up, OAuth, recovery, `updateUser` and sign out run with the browser client; the server only reads the session. Same email on two providers ends up as one user with linked identities.
- `proxy.ts` (root) → `lib/supabase/proxy.ts` `updateSession`: refreshes the session on every page request (`getClaims()`), `/cuenta` and `/auth/alias` without session → `/auth?next=…`, `/auth` and `/auth/recuperar` with session → `next` or `/cuenta`, `/auth/nueva-contrasena` without session → `/auth/recuperar`. Its matcher skips `_next/*` and files with an extension.
- `public.profiles`: one row per auth user, created with `alias` NULL by the trigger `on_auth_user_created` (`handle_new_user`, security definer). `alias` is UNIQUE + CHECK (`NAME_PATTERN`, already uppercased, not `INVITADO`). RLS: each user selects and updates only their own row, and only the `alias` column is updatable (`grant update (alias)`); `anon` has no access. A taken alias fails with `23505`.
- Leaderboard (SPEC 15, migration `scores_user`): one `public.scores` table for every game (`game_id`, `user_id`, `score`, `created_at`), one row per saved run; `user_id` references `profiles (id)` `on delete cascade`. There is no name column: the ranking always shows the player's current `profiles.alias`, so changing the alias renames every mark. The only write path is the RPC `submit_score(p_game_id, p_score)` (security definer, `authenticated` only; the player is `auth.uid()`; errors `42501` no session, `22004` no alias, `22023` invalid input; direct INSERT/UPDATE/DELETE is revoked from `anon`/`authenticated`). Reads: `top_scores` (security definer, best mark per `user_id` joined with the current alias, profiles without alias left out, returns only `rank, name, score, created_at`, never `user_id` or email) and `my_best(p_game_id)` (security invoker, `authenticated` only, the session user's rank and best). Rules shared with the SQL (`TOP_LIMIT`, `MAX_SCORE`, `NAME_PATTERN`, `normalizeName`, …) live in `lib/scores.ts`; server reads in `lib/scores-server.ts` (`getTopScores`, wrapped in `React.cache`, request-time inside `<Suspense>`). `my_best` is called from the client in `hall-you-row.tsx`.
- RLS is on in `profiles` and `scores`, and Supabase's event trigger `ensure_rls` (function `public.rls_auto_enable()`, security definer, not ours) turns it on for every new table in `public`. SPEC 16 revoked `EXECUTE` on `rls_auto_enable()` from `public`, `anon` and `authenticated` (event triggers do not check it). Security linter (`get_advisors`): exactly four warnings are accepted on purpose — do not "fix" them: `top_scores` executable by `anon` and by `authenticated` and `submit_score` by `authenticated` (security definer is the SPEC 15 design: `top_scores` only returns `rank, name, score, created_at` and `submit_score` takes the player from `auth.uid()`; a private schema or a public view would add a layer without exposing less), and `auth_leaked_password_protection` (needs the Pro plan; the project is on Free). Any new warning is a real issue. Record of the checks in `references/security/security-checklist.md`.

## Games (`games/`)

Playable today: **CAÍDA** (`caida`), **ROCAS** (`rocas`), **BLOQUE BUSTER** (`bloque-buster`), **SERPENTINA** (`serpentina`), **DUELO PIXEL** (`duelo-pixel`), **RANARIA** (`ranaria`). The rest of the catalog (`gloton`, `invasores`) still uses the simulator.

- One folder per playable game: `games/<id>/`, where `<id>` is the game's `id` in `lib/games.ts`. Typical files: `core.ts` (logic), `render.ts` (canvas drawing), `<id>-game.tsx` (component), `<id>.css`, `skins.ts` + `prefs.ts` (CAÍDA has no `render.ts`: it draws from the component).
- Every playable game ships at least three skins — `clasico` (default), `neon`, `retro` — each readable on a dark background, with the choice stored in `av_<id>_skin` (contract §7 in `.claude/skills/nuevo-juego/integracion.md`; pattern in `games/caida/`). The `skin-designer` agent audits and implements this.
- Register the playable component in `games/index.ts` (`PLAYABLE` / `getPlayable`). `app/juegos/[id]/jugar/page.tsx` renders `getPlayable(id) ?? GamePlayer`; games without an entry keep the simulated `components/game-player.tsx`.
- `core.ts` holds the game's pure logic: no React, DOM, `window` or `localStorage`.
- `localStorage` keys of a game use the prefix `av_<id>_` (e.g. `av_caida_skin`). A run in progress is not persisted.
- Game styles live in `games/<id>/<id>.css`, imported from the game component, with every rule scoped under the game's root class (e.g. `.caida-root`).
- **Mobile layout (SPEC 11).** The player's mobile layout is shared, in the unlayered block at the end of `app/globals.css`: in portrait (≤ 840 px) the HUD is compact in two rows (stats / buttons, the «Jugador» stat hidden); in short landscape (`max-height: 500px`) the HUD becomes a column left of the CRT and the nav stops being sticky. The CRT width comes from the available height, `(100dvh − --player-chrome − --player-reserve) × --crt-ar + frame`, so HUD and canvas fit on one screen. A game only declares `--crt-ar` (its W/H, default 4:3) on `.<id>-root`, keeps its desktop `.crt` max-width, and adds a mobile block with the same media query for its own tweaks (select at `--tap-min`, overlay sizes); it must not redefine HUD, CRT padding or `.crt-bottom` on mobile. `--player-reserve` (default `0px`) is the room reserved under the CRT (the touch strip on touch devices, see below); `--tap-min` (44 px) is the minimum touch target below 840 px. Verify at 360×740, 390×844, 844×390, 768×1024 and 1440×900.
- **Touch controls (SPEC 12).** Every playable game renders `components/touch-controls.tsx` (`<TouchControls>`) as a direct child of `.av-player`, right after `.crt`, always mounted. It knows no game: it writes a mutable `TouchInput` (`lib/touch-input.ts`: `createTouchInput`, `releaseAll`, `TouchButton` = `up|down|left|right|a|b`) and calls `onPress({ button, repeated })` / `onRelease(button)`; it never imports from `games/`.
  - The game creates the input with `const [touch] = useState(createTouchInput)` (stable object, survives `<Activity>`; a `useRef` read in render fails the `react-hooks/refs` lint) and passes `active={phase === "playing"}`, `paused={phase === "paused"}`, `pauseEnabled={inRun}`, `onPauseToggle={phase === "paused" ? resume : pause}` (the same `pause()` / `resume()` as the HUD button and P / Esc — no second pause), plus `disabled` for unused buttons (dimmed, `aria-disabled`) and optional `repeat: { delay, interval }` per button.
  - Held actions are read in the loop OR-ed with the keyboard (`held(KEYS) || touch.state.left`, add `touch` to the loop effect deps); one-shot actions go in `onPress` ignoring `ev.repeated`, like `!ev.repeat`. Mapping: CAÍDA ← → ↓ repeat (170/50 ms) move / soft drop, ↑ and A rotate, B hard drop; ROCAS ← → turn, ↑ or B thrust, A fire; BLOQUE BUSTER ← → paddle, A/B launch; SERPENTINA D-pad turns (A/B disabled); DUELO PIXEL ↑ ↓ paddle, A plasma (B disabled); RANARIA D-pad one jump per tap (A/B disabled).
  - D-pad is one zone that follows the finger (8 directions, 25 % dead zone, geometry measured on each `pointerdown`); every control tracks its own `pointerId` from its `pointerdown`; move / up / cancel are listened on `window` (no `setPointerCapture` / `lostpointercapture`: on iOS Safari moving the implicit capture fires `lostpointercapture` and released the control on the same tap). A non-passive `touchstart`/`touchmove`/`touchend` `preventDefault` on the root stops iOS scroll / zoom / selection, so the pause button confirms on `pointerup` and its `onClick` only handles the keyboard (`detail === 0`). Everything is released on window `blur`, hidden page, `active={false}` and unmount.
  - Shown only by CSS under `@media (pointer: coarse) and (not (any-pointer: fine))` (block «Controles táctiles (SPEC 12)» at the end of `app/globals.css`); on desktop it is `display: none` and reserves nothing. Portrait: a strip under the CRT (D-pad left, pause centred on top, A/B right) and `--player-reserve` becomes `--touch-strip-h` + bottom safe area. Short landscape: `.touch-controls` is `display: contents`, `.av-player` gets three columns (HUD + D-pad | CRT | pause + A/B) and `--player-reserve` is the bottom safe area. Tokens `--touch-btn` (56 px, shrinks to ≥ 48 px on narrow / short screens) and `--touch-strip-h`; safe areas via `--sai-left/right/bottom`. No control may overlap `.crt-screen`. There is no `.touch-notice` any more.
- Game over goes through the shared `components/game-over-modal.tsx`, which saves with the Server Action `submitScore({ gameId, score })` (`app/juegos/actions.ts`) — the single score path; the server takes the player from the session cookies. The modal shows one save state per session situation: loading, signed out (link to `/auth?next=/juegos/<id>/jugar`), no alias (`AliasForm mode="inline"`), or the fixed alias + «GUARDAR PUNTUACIÓN». Only games registered in `PLAYABLE` are ranked (`isRanked`); pass `ranked` to the modal (`true` for real games, `false` for the simulator).
- With `cacheComponents`, leaving a route keeps it in a hidden `<Activity>`: React state survives, effects unmount and remount. Keep loop state in refs that are not reset on effect cleanup, and cancel `requestAnimationFrame` / listeners in every cleanup.

`references/` holds the source material games and screens are ported from (`arkanoid`, `asteroids`, `claude-tetris`, `snake`, `home-about`, `templates`). It is read-only input: not compiled, linted or formatted, and nothing in `app/` imports from it. Never edit or write files inside those folders — `.claude/settings.json` denies `Edit` there (not `Write`, so the rule is on you); only the `.md` files at the root of `references/` (`game-suggestion-todo.md`, `game-with-themes.md`, `juegos-implementados.md`) are writable. `arkanoid` and `claude-tetris` are independent git repos registered as submodules (`.gitmodules`, `ignore = dirty`); after cloning run `git submodule update --init`.

## Claude Code tooling

Everything below is project-level (`.claude/`, `.mcp.json`) unless noted. Read the linked file before using an agent or skill; this section is only an index.

### Agents (`.claude/agents/`)

Invoke with the Agent tool (`subagent_type: "<name>"`). All three use `model: inherit` and `memory: project`, with their memory committed in `.claude/agent-memory/<name>/`. Subagents cannot ask the user, so the main session relays questions with `AskUserQuestion`.

| Agent           | What it does                                                                                                                                                                    | Definition                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `game-planner`  | Picks the next game: proposes 1–3 candidates with a recommendation. No code or specs; keeps `references/game-suggestion-todo.md` in sync.                                       | `.claude/agents/game-planner.md`  |
| `game-jam`      | Given a theme, designs ≥ 2 original games and writes draft specs in `specs/game-jam/<tema>/` (Mode A: sketches + questions → Mode B: specs). No code.                           | `.claude/agents/game-jam.md`      |
| `skin-designer` | Audits (default) or implements (`implementa <id>`) the Clásico / Neón / Retro skins of a playable game in `games/<id>/`; keeps `references/game-with-themes.md`. Never commits. | `.claude/agents/skin-designer.md` |

Typical flows: new game `game-planner` → `/nuevo-juego` → `/spec-impl-game`; game jam `game-jam` → move the chosen draft to `specs/NN-juego-<id>.md` (status `Aprobado`) → `/spec-impl-game`; skins `skin-designer` audit → `implementa <id>` → PR on `skins-<id>`. Weekly jams land on branches `game-jam-YYYY-MM-DD`.

### Skills (`.claude/skills/`)

| Skill                           | What it does                                                                                                           | Origin                                       |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `/spec`                         | Writes a spec section by section, asking first. User-invoked only.                                                     | Klerith/fernando-skills (`skills-lock.json`) |
| `/spec-impl <NN-name>`          | Implements an approved spec on branch `spec-NN-<name>`, step by step with diff pauses. User-invoked only.              | Klerith/fernando-skills (`skills-lock.json`) |
| `/spec-impl-game <NN-juego-id>` | `/spec-impl` for a game, then runs `skin-designer` and integrates `<TouchControls>`. Never commits. User-invoked only. | Local                                        |
| `/nuevo-juego <id> [ref]`       | Writes a new game's spec; carries the integration contract (`integracion.md`), `spec-template.md` and `scaffold/`.     | Local                                        |
| `/frontend-design`              | Visual design guidance; use for all UI work.                                                                           | anthropics/skills (`skills-lock.json`)       |

Do not edit the pinned skills (`spec`, `spec-impl`, `frontend-design`); `.agents/skills/frontend-design/` is the copy installed by the skills CLI.

### MCP servers

| Server               | Where it is configured                                                                           | Used for                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| **Supabase**         | `.mcp.json` (HTTP, `project_ref=ehzxppntfcaqiobqmuub`), enabled in `.claude/settings.local.json` | Migrations, `list_tables`, `execute_sql`, `generate_typescript_types`, logs, advisors                                |
| **Playwright**       | User level (not in the repo)                                                                     | Verify screens and games in the dev server; `skin-designer` depends on it. Output in `.playwright-mcp/` (gitignored) |
| **Claude in Chrome** | Browser extension                                                                                | Alternative to Playwright for manual checks in the real browser                                                      |

### Settings and hooks

- `.claude/settings.json` — denies `Edit` on the `references/` subfolders and runs the PostToolUse hook `.claude/hooks/format-and-lint.mjs` (Prettier + ESLint) after every `Write` / `Edit` / `MultiEdit`.
- `.claude/settings.local.json` — enables the `supabase` server from `.mcp.json`.
