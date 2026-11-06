# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault is an online platform for playing games and competing for the highest score. The project is currently a fresh Create Next App scaffold; the README (in Spanish) is the source for product intent.

Development follows **Spec Driven Design** using the `/spec` and `/spec-impl` skills from [Klerith/fernando-skills](https://github.com/Klerith/fernando-skills) (install with `npx skills@latest add Klerith/fernando-skills`). Write a spec before implementing a feature, then implement against it.

## Commands

- `npm run dev` — dev server (Turbopack) at http://localhost:3000
- `npm run build` — production build (also type-checks)
- `npm run start` — serve the production build
- `npm run lint` — ESLint (flat config, `eslint-config-next` core-web-vitals + typescript)
- `npm run supabase:check` — verifies the Supabase URL + publishable key in `.env.local` against the remote project (`[OK]` / `[ERR]`, exit code 0 / 1)

No test runner is configured yet.

## Stack and non-default configuration

- **Next.js 16.4 (App Router, `app/` directory) + React 19.3 + TypeScript (strict)**. APIs differ from older Next.js — check `node_modules/next/dist/docs/` (`01-app/`, `03-architecture/`) before using framework APIs.
- `next.config.ts` enables options that change rendering/data semantics:
  - `cacheComponents: true` — Cache Components model; caching is opt-in via `"use cache"` and dynamic data must be wrapped in `<Suspense>`. Read the docs before writing data fetching.
  - `partialPrefetching: true` — `<Link>` prefetches only the route's App Shell (static + URL-independent cached content); use `<Link prefetch={true}>` to prefetch URL-specific content. See `02-guides/adopting-partial-prefetching.md`.
  - `experimental.agentFeedback: true` — this is why `next dev` rewrites the block in `AGENTS.md`; commit `AGENTS.md` changes rather than reverting them.
- **Tailwind CSS v4** is wired through a Turbopack loader (`@tailwindcss/turbopack` rule for `*.css` in `next.config.ts`), not PostCSS — there is no `postcss.config` or `tailwind.config`. Theme tokens live in `app/globals.css` under `@theme inline`.
- Route prop types use Next's generated global helpers (e.g. `LayoutProps<"/">`, `PageProps<...>`) rather than hand-written prop interfaces.
- Import alias `@/*` maps to the repo root.
- **Supabase** (project `ehzxppntfcaqiobqmuub`, also reachable through the Supabase MCP) via `@supabase/ssr`. Env: `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…`; no secret/service_role key in the app).
  - `lib/supabase/client.ts` — `createClient()` for Client Components.
  - `lib/supabase/server.ts` — `await createClient()` for Server Components, Server Actions and Route Handlers. It reads `cookies()`, so a Server Component using it must sit inside `<Suspense>`, and it must never be called inside a plain `"use cache"` scope (pass values in, or use `"use cache: private"`).
  - `lib/supabase/database.types.ts` — generated types (`Database`); never edit by hand.
  - Migrations workflow: write the SQL first as `supabase/migrations/YYYYMMDDHHMMSS_name.sql`, apply it with the MCP `apply_migration` using the same name, confirm with `list_migrations`, then regenerate `database.types.ts` with `generate_typescript_types`. `apply_migration` records its own timestamp, so rename the file to the version `list_migrations` reports. No Supabase CLI or local stack.
  - Leaderboard: one `public.scores` table for every game (`game_id`, `name`, `score`, `created_at`). The only write path is the RPC `submit_score` (security definer; direct INSERT/UPDATE/DELETE is revoked from `anon`/`authenticated`). Reads go through `top_scores` (best mark per name) and `player_best`. Rules shared with the SQL live in `lib/scores.ts`; server reads in `lib/scores-server.ts` (`getTopScores`, request-time inside `<Suspense>`).

## Games (`games/`)

- One folder per playable game: `games/<id>/`, where `<id>` is the game's `id` in `lib/games.ts`. First one: `games/caida/`.
- Register the playable component in `games/index.ts` (`PLAYABLE` / `getPlayable`). `app/juegos/[id]/jugar/page.tsx` renders `getPlayable(id) ?? GamePlayer`; games without an entry keep the simulated `components/game-player.tsx`.
- `core.ts` holds the game's pure logic: no React, DOM, `window` or `localStorage`.
- `localStorage` keys of a game use the prefix `av_<id>_` (e.g. `av_caida_skin`). A run in progress is not persisted.
- Game styles live in `games/<id>/<id>.css`, imported from the game component, with every rule scoped under the game's root class (e.g. `.caida-root`).
- Game over goes through the shared `components/game-over-modal.tsx`, which saves with the Server Action `submitScore()` (`app/juegos/actions.ts`) — the single score path. Only games registered in `PLAYABLE` are ranked (`isRanked`); pass `ranked` to the modal (`true` for real games, `false` for the simulator).
- With `cacheComponents`, leaving a route keeps it in a hidden `<Activity>`: React state survives, effects unmount and remount. Keep loop state in refs that are not reset on effect cleanup, and cancel `requestAnimationFrame` / listeners in every cleanup.

## Skills

Use /frontend-design for all user interface design work.

Use /nuevo-juego to add a playable game (from a `references/` folder or from scratch): it writes the game's spec and carries the fixed integration contract (`.claude/skills/nuevo-juego/integracion.md`) and scaffolds derived from `games/rocas/`.
