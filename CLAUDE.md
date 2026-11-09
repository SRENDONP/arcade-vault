# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Idioma

Responde siempre en español: en la conversación, en los informes de subagentes y al ejecutar skills. El código y los identificadores siguen las convenciones del repo.

## Project

Arcade Vault is an online platform for playing games and competing for the highest score. The README (in Spanish) is the source for product intent; UI copy is in Spanish.

Development follows **Spec Driven Design**: write a spec in `specs/NN-name.md` with `/spec`, get it approved, then implement it with `/spec-impl` (skills from [Klerith/fernando-skills](https://github.com/Klerith/fernando-skills), pinned in `skills-lock.json`). Each spec ships on its own branch `spec-NN-<name>` and is merged through a PR. Specs so far:

| #   | Spec                         | What it delivered                                                      |
| --- | ---------------------------- | ---------------------------------------------------------------------- |
| 01  | `01-mvp-pantallas-visuales`  | Visual MVP: catalog, detail, player, hall of fame, auth screens        |
| 02  | `02-inicio-y-acerca-de`      | Landing (`/`) and About (`/acerca-de`)                                 |
| 03  | `03-contacto-con-resend`     | Contact form that emails through Resend                                |
| 04  | `04-base-tecnica-supabase`   | Typed Supabase clients, env vars, `supabase:check`                     |
| 05  | `05-juego-caida`             | CAÍDA (falling blocks), first real game, with skins/prefs              |
| 06  | `06-juego-rocas`             | ROCAS (asteroids-style, canvas)                                        |
| 07  | `07-leaderboard-supabase`    | Real leaderboard in Supabase (`scores` + RPCs)                         |
| 08  | `08-juego-bloque-buster`     | BLOQUE BUSTER (brick breaker)                                          |
| 09  | `09-juego-serpentina`        | SERPENTINA (snake)                                                     |
| 10  | `10-juego-duelo-pixel`       | DUELO PIXEL (paddles vs a ladder of 5 CPU rivals)                      |
| 11  | `11-diseno-responsive-movil` | Responsive from 360 px: mobile nav, 44 px targets, mobile player       |
| 12  | `12-controles-tactiles`      | Touch controls (`TouchControls`: D-pad, A, B, pause) in all five games |

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

Playable today: **CAÍDA** (`caida`), **ROCAS** (`rocas`), **BLOQUE BUSTER** (`bloque-buster`), **SERPENTINA** (`serpentina`), **DUELO PIXEL** (`duelo-pixel`). The rest of the catalog (`gloton`, `invasores`, `ranaria`) still uses the simulator.

- One folder per playable game: `games/<id>/`, where `<id>` is the game's `id` in `lib/games.ts`. Typical files: `core.ts` (logic), `render.ts` (canvas drawing), `<id>-game.tsx` (component), `<id>.css`, `skins.ts` + `prefs.ts`.
- Every playable game ships at least three skins — `clasico` (default), `neon`, `retro` — each readable on a dark background, with the choice stored in `av_<id>_skin` (contract §7 in `.claude/skills/nuevo-juego/integracion.md`; pattern in `games/caida/`). The `skin-designer` agent audits and implements this.
- Register the playable component in `games/index.ts` (`PLAYABLE` / `getPlayable`). `app/juegos/[id]/jugar/page.tsx` renders `getPlayable(id) ?? GamePlayer`; games without an entry keep the simulated `components/game-player.tsx`.
- `core.ts` holds the game's pure logic: no React, DOM, `window` or `localStorage`.
- `localStorage` keys of a game use the prefix `av_<id>_` (e.g. `av_caida_skin`). A run in progress is not persisted.
- Game styles live in `games/<id>/<id>.css`, imported from the game component, with every rule scoped under the game's root class (e.g. `.caida-root`).
- **Mobile layout (SPEC 11).** The player's mobile layout is shared, in the unlayered block at the end of `app/globals.css`: in portrait (≤ 840 px) the HUD is compact in two rows (stats / buttons, the «Jugador» stat hidden); in short landscape (`max-height: 500px`) the HUD becomes a column left of the CRT and the nav stops being sticky. The CRT width comes from the available height, `(100dvh − --player-chrome − --player-reserve) × --crt-ar + frame`, so HUD and canvas fit on one screen. A game only declares `--crt-ar` (its W/H, default 4:3) on `.<id>-root`, keeps its desktop `.crt` max-width, and adds a mobile block with the same media query for its own tweaks (select at `--tap-min`, overlay sizes); it must not redefine HUD, CRT padding or `.crt-bottom` on mobile. `--player-reserve` (default `0px`) is the room reserved under the CRT (the touch strip on touch devices, see below); `--tap-min` (44 px) is the minimum touch target below 840 px. Verify at 360×740, 390×844, 844×390, 768×1024 and 1440×900.
- **Touch controls (SPEC 12).** Every playable game renders `components/touch-controls.tsx` (`<TouchControls>`) as a direct child of `.av-player`, right after `.crt`, always mounted. It knows no game: it writes a mutable `TouchInput` (`lib/touch-input.ts`: `createTouchInput`, `releaseAll`, `TouchButton` = `up|down|left|right|a|b`) and calls `onPress({ button, repeated })` / `onRelease(button)`; it never imports from `games/`.
  - The game creates the input with `const [touch] = useState(createTouchInput)` (stable object, survives `<Activity>`; a `useRef` read in render fails the `react-hooks/refs` lint) and passes `active={phase === "playing"}`, `paused={phase === "paused"}`, `pauseEnabled={inRun}`, `onPauseToggle={phase === "paused" ? resume : pause}` (the same `pause()` / `resume()` as the HUD button and P / Esc — no second pause), plus `disabled` for unused buttons (dimmed, `aria-disabled`) and optional `repeat: { delay, interval }` per button.
  - Held actions are read in the loop OR-ed with the keyboard (`held(KEYS) || touch.state.left`, add `touch` to the loop effect deps); one-shot actions go in `onPress` ignoring `ev.repeated`, like `!ev.repeat`. Mapping: CAÍDA ← → ↓ repeat (170/50 ms) move / soft drop, ↑ and A rotate, B hard drop; ROCAS ← → turn, ↑ or B thrust, A fire; BLOQUE BUSTER ← → paddle, A/B launch; SERPENTINA D-pad turns (A/B disabled); DUELO PIXEL ↑ ↓ paddle, A plasma (B disabled).
  - D-pad is one zone that follows the finger (8 directions, 25 % dead zone, geometry measured on each `pointerdown`); every control tracks its own `pointerId` with `setPointerCapture` and releases on `pointerup` / `pointercancel` / `lostpointercapture`, window `blur`, hidden page, `active={false}` and unmount.
  - Shown only by CSS under `@media (pointer: coarse) and (not (any-pointer: fine))` (block «Controles táctiles (SPEC 12)» at the end of `app/globals.css`); on desktop it is `display: none` and reserves nothing. Portrait: a strip under the CRT (D-pad left, pause centred on top, A/B right) and `--player-reserve` becomes `--touch-strip-h` + bottom safe area. Short landscape: `.touch-controls` is `display: contents`, `.av-player` gets three columns (HUD + D-pad | CRT | pause + A/B) and `--player-reserve` is the bottom safe area. Tokens `--touch-btn` (56 px, shrinks to ≥ 48 px on narrow / short screens) and `--touch-strip-h`; safe areas via `--sai-left/right/bottom`. No control may overlap `.crt-screen`. There is no `.touch-notice` any more.
- Game over goes through the shared `components/game-over-modal.tsx`, which saves with the Server Action `submitScore()` (`app/juegos/actions.ts`) — the single score path. Only games registered in `PLAYABLE` are ranked (`isRanked`); pass `ranked` to the modal (`true` for real games, `false` for the simulator).
- With `cacheComponents`, leaving a route keeps it in a hidden `<Activity>`: React state survives, effects unmount and remount. Keep loop state in refs that are not reset on effect cleanup, and cancel `requestAnimationFrame` / listeners in every cleanup.

`references/` holds the source material games and screens are ported from (`arkanoid`, `asteroids`, `claude-tetris`, `snake`, `home-about`, `templates`). It is read-only input: not compiled, linted or formatted, and nothing in `app/` imports from it. Never edit files inside those folders — `.claude/settings.json` denies `Edit`/`Write` there; only the `.md` files at the root of `references/` (`game-suggestion-todo.md`, `game-with-themes.md`, `juegos-implementados.md`) are writable. `arkanoid` and `claude-tetris` are independent git repos registered as submodules (`.gitmodules`, `ignore = dirty`); after cloning run `git submodule update --init`.

## Agents

Project subagents live in `.claude/agents/` (one `.md` per agent, with frontmatter: `name`, `description`, `tools`, `model`, `memory`). Invoke them with the Agent tool using `subagent_type: "<name>"`, or just ask for the task their `description` covers.

- `game-planner` (`.claude/agents/game-planner.md`; tools `Read, Glob, Grep, Write, Edit`; `model: inherit`; `memory: project`) — plans and decides which game fits the platform next. It reads the catalog (`lib/games.ts`), `PLAYABLE` (`games/index.ts`), `references/` and the integration contract (`.claude/skills/nuevo-juego/integracion.md`), and proposes 1–3 candidates with a final recommendation. It does not write code or specs. It keeps a persistent memory of past suggestions (proposed / chosen / discarded / implemented) in `.claude/agent-memory/game-planner/` (`MEMORY.md` + `sugerencias.md`), committed to git, and keeps the checklist `references/game-suggestion-todo.md` in sync — the only file it may write outside its memory.
  - Flow for a new game: `game-planner` (pick the game) → `/nuevo-juego` (write its spec) → `/spec-impl` (implement it on `spec-NN-<name>`).
  - Use it when asked "qué juego sigue", for game ideas, or to review earlier suggestions.
- `game-jam` (`.claude/agents/game-jam.md`; tools `Read, Glob, Grep, Write, Edit`; `model: inherit`; `memory: project`) — given a theme, designs at least 2 original games that interpret it and writes full draft specs (same format as `specs/09-juego-serpentina.md`, built from `.claude/skills/nuevo-juego/spec-template.md`) in `specs/game-jam/<tema-slug>/`: a `README.md` (theme, comparison, recommendation) plus one `juego-<id>.md` per game. It only writes in `specs/game-jam/` and its memory `.claude/agent-memory/game-jam/` (`MEMORY.md` + `jams.md`, committed to git). It does not write code.
  - Two-step flow, because subagents cannot ask the user: **Mode A** (theme only) returns sketches + a questions block → the main session asks them with `AskUserQuestion` → **Mode B** (theme + answers) writes the folder. Then review; to ship one, move it to `specs/NN-juego-<id>.md` (next free number, status `Aprobado`) and run `/spec-impl NN-juego-<id>`.
  - Use it when the user gives a theme for a game jam or asks for games about a theme.
- `skin-designer` (`.claude/agents/skin-designer.md`; tools `Read, Glob, Grep, Write, Edit, Bash` + Playwright MCP; `model: inherit`; `memory: project`) — makes every game in `PLAYABLE` have at least the skins Clásico (default, the game's current look), Neón and Retro, each passing dark-background contrast (≥ 3:1 for game elements, ≥ 4.5:1 for text). **Audit mode** (default) reports per game what is missing without editing; **implementation mode** (`implementa <id>`, one game per run) writes `skins.ts`, `prefs.ts` (`av_<id>_skin`), the selector, `data-skin` CSS and a skin-aware `render.ts`, then runs lint/build and checks each skin in the browser. It only writes in `games/<id>/` (never `core.ts`) and its memory `.claude/agent-memory/skin-designer/` (`MEMORY.md` + `auditoria.md`, committed to git), and keeps the registry `references/game-with-themes.md` (which games already have the skins, pending list and history) — the only file it may write outside `games/` and its memory. It does not commit.
  - Flow: audit → `implementa <id>` → review in the browser → PR on branch `skins-<id>`.
  - Use it when asked to review, add or adjust skins or visual themes of the games.

## Skills

Project skills live in `.claude/skills/`:

- `/spec` and `/spec-impl` — write a spec, then implement against it (see Project).
- `/frontend-design` — use for all user interface design work.
- `/nuevo-juego` — use to add a playable game (from a `references/` folder or from scratch): it writes the game's spec and carries the fixed integration contract (`.claude/skills/nuevo-juego/integracion.md`), a spec template and scaffolds derived from `games/rocas/`.

## MCP servers

- **Supabase** (`.mcp.json`, enabled in `.claude/settings.local.json`) — scoped to project `ehzxppntfcaqiobqmuub`. Use it for migrations, `list_tables`, `execute_sql`, type generation, logs and advisors.
- **Playwright** / **Claude in Chrome** — drive the running dev server to verify screens and games (Playwright output in `.playwright-mcp/` is gitignored).
