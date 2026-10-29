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
