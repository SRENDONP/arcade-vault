# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault is an online platform for playing games and competing for the highest score. The README (in Spanish) is the source for product intent; UI copy is in Spanish.

Development follows **Spec Driven Design**: write a spec in `specs/NN-name.md` with `/spec`, get it approved, then implement it with `/spec-impl` (skills from [Klerith/fernando-skills](https://github.com/Klerith/fernando-skills), pinned in `skills-lock.json`). Each spec ships on its own branch `spec-NN-<name>` and is merged through a PR. Specs so far:

| #   | Spec                        | What it delivered                                               |
| --- | --------------------------- | --------------------------------------------------------------- |
| 01  | `01-mvp-pantallas-visuales` | Visual MVP: catalog, detail, player, hall of fame, auth screens |
| 02  | `02-inicio-y-acerca-de`     | Landing (`/`) and About (`/acerca-de`)                          |
| 03  | `03-contacto-con-resend`    | Contact form that emails through Resend                         |
| 04  | `04-base-tecnica-supabase`  | Typed Supabase clients, env vars, `supabase:check`              |
| 05  | `05-juego-caida`            | CAÍDA (falling blocks), first real game, with skins/prefs       |
| 06  | `06-juego-rocas`            | ROCAS (asteroids-style, canvas)                                 |
| 07  | `07-leaderboard-supabase`   | Real leaderboard in Supabase (`scores` + RPCs)                  |
| 08  | `08-juego-bloque-buster`    | BLOQUE BUSTER (brick breaker)                                   |
| 09  | `09-juego-serpentina`       | SERPENTINA (snake)                                              |

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
- **Tailwind CSS v4** is wired through a Turbopack loader (`@tailwindcss/turbopack` rule for `*.css` in `next.config.ts`), not PostCSS — there is no `postcss.config` or `tailwind.config`. Theme tokens live in `app/globals.css` under `@theme inline`.
- Route prop types use Next's generated global helpers (e.g. `LayoutProps<"/">`, `PageProps<"/salon">`) rather than hand-written prop interfaces.
- Import alias `@/*` maps to the repo root.
- **Prettier + ESLint** run automatically on every file Claude writes/edits (PostToolUse hook `.claude/hooks/format-and-lint.mjs`, configured in `.claude/settings.json`). Remaining lint errors are fed back and must be fixed. `references/` is ignored by both.

## App structure

Routes (`app/`):

- `/` — landing (data in `lib/landing.ts`)
- `/acerca-de` — about + contact form (`components/contact-form.tsx` → Server Action `sendContactMessage` in `app/acerca-de/actions.ts`)
- `/biblioteca` — game catalog (`components/library.tsx`, `game-card.tsx`)
- `/juegos/[id]` — game detail with its top-10 leaderboard see `references\juegos-implementados.md`
- `/juegos/[id]/jugar` — player: `getPlayable(id) ?? GamePlayer`
- `/salon?juego=<id>` — hall of fame per game (`components/hall-of-fame.tsx`, plus `hall-you-row.tsx` for the signed-in player's best)
- `/auth` — sign in / sign up (`components/auth-form.tsx`)

Shared modules (`lib/`):

- `games.ts` — the catalog (`GAMES`, `getGame`). Ids: `bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `rocas`, `ranaria`, `duelo-pixel`.
- `session.ts` + `components/session-provider.tsx` — **mock session** in `localStorage` (`av_user`, just a name). There is no real auth yet; the name is what gets sent with scores.
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
- Migrations workflow: write the SQL first as `supabase/migrations/YYYYMMDDHHMMSS_name.sql`, apply it with the MCP `apply_migration` using the same name, confirm with `list_migrations`, then regenerate `database.types.ts` with `generate_typescript_types`. `apply_migration` records its own timestamp, so rename the file to the version `list_migrations` reports. No Supabase CLI or local stack. Current migration: `20261105002904_scores.sql`.
- Leaderboard: one `public.scores` table for every game (`game_id`, `name`, `score`, `created_at`). The only write path is the RPC `submit_score` (security definer; direct INSERT/UPDATE/DELETE is revoked from `anon`/`authenticated`). Reads go through `top_scores` (best mark per name) and `player_best`. Rules shared with the SQL (`TOP_LIMIT`, `MAX_SCORE`, `NAME_PATTERN`, `normalizeName`, …) live in `lib/scores.ts`; server reads in `lib/scores-server.ts` (`getTopScores`, wrapped in `React.cache`, request-time inside `<Suspense>`). `player_best` is called from the client in `hall-you-row.tsx`.

## Games (`games/`)

Playable today: **CAÍDA** (`caida`), **ROCAS** (`rocas`), **BLOQUE BUSTER** (`bloque-buster`), **SERPENTINA** (`serpentina`). The rest of the catalog (`gloton`, `invasores`, `ranaria`, `duelo-pixel`) still uses the simulator.

- One folder per playable game: `games/<id>/`, where `<id>` is the game's `id` in `lib/games.ts`. Typical files: `core.ts` (logic), `render.ts` (canvas drawing), `<id>-game.tsx` (component), `<id>.css`, and optionally `prefs.ts` / `skins.ts`.
- Register the playable component in `games/index.ts` (`PLAYABLE` / `getPlayable`). `app/juegos/[id]/jugar/page.tsx` renders `getPlayable(id) ?? GamePlayer`; games without an entry keep the simulated `components/game-player.tsx`.
- `core.ts` holds the game's pure logic: no React, DOM, `window` or `localStorage`.
- `localStorage` keys of a game use the prefix `av_<id>_` (e.g. `av_caida_skin`). A run in progress is not persisted.
- Game styles live in `games/<id>/<id>.css`, imported from the game component, with every rule scoped under the game's root class (e.g. `.caida-root`).
- Game over goes through the shared `components/game-over-modal.tsx`, which saves with the Server Action `submitScore()` (`app/juegos/actions.ts`) — the single score path. Only games registered in `PLAYABLE` are ranked (`isRanked`); pass `ranked` to the modal (`true` for real games, `false` for the simulator).
- With `cacheComponents`, leaving a route keeps it in a hidden `<Activity>`: React state survives, effects unmount and remount. Keep loop state in refs that are not reset on effect cleanup, and cancel `requestAnimationFrame` / listeners in every cleanup.

`references/` holds the source material games and screens are ported from (`arkanoid`, `asteroids`, `claude-tetris`, `snake`, `home-about`, `templates`). It is read-only input: not compiled, linted or formatted, and nothing in `app/` imports from it.

## Skills

Project skills live in `.claude/skills/`:

- `/spec` and `/spec-impl` — write a spec, then implement against it (see Project).
- `/frontend-design` — use for all user interface design work.
- `/nuevo-juego` — use to add a playable game (from a `references/` folder or from scratch): it writes the game's spec and carries the fixed integration contract (`.claude/skills/nuevo-juego/integracion.md`), a spec template and scaffolds derived from `games/rocas/`.

## MCP servers

- **Supabase** (`.mcp.json`, enabled in `.claude/settings.local.json`) — scoped to project `ehzxppntfcaqiobqmuub`. Use it for migrations, `list_tables`, `execute_sql`, type generation, logs and advisors.
- **Playwright** / **Claude in Chrome** — drive the running dev server to verify screens and games (Playwright output in `.playwright-mcp/` is gitignored).
