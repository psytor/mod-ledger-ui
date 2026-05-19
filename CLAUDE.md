# CLAUDE.md — mod-ledger-ui

Guide for Claude Code when working inside this submodule.

## Scope rule (read first)

This is a **submodule**. Everything you change must stay inside
`mod-ledger-ui/`. Do not edit, read as authoritative, or make assumptions
based on sibling submodules (`astrogators-table`, `astrogators-hub`,
`mod-ledger`, `astrogators-shared-ui`, `nightwatcher`) or the parent
`astro-table/` workspace root. If a task seems to require changes outside
this folder, stop and ask first.

The submodule boundary exists to contain AI blast radius: one session working
here must not ripple into sibling services.

## What this service is

React 19 + Vite 8 + TypeScript 6 single-page app. It is the **mod inventory
UI** for the Astrogator's Table ecosystem — fetches a player's mods, displays
them in a filterable/sortable grid, and shows per-mod detail.

It consumes:

- **`astrogators-shared-ui`** (npm package, `^0.6.0`) — shared components,
  `AuthProvider`, API client, auth/ally-code storage helpers
- **`mod-ledger`** backend — player mod listing endpoint. URL comes from
  `VITE_MOD_LEDGER_URL` at build time
- **`astrogators-table`** backend — authentication endpoints. URL comes from
  `VITE_ASTROGATORS_TABLE_URL` at build time

It does not own persistent state. All state lives in the backends or browser
storage (handled by shared-ui).

## Single-origin rule (read before touching URLs)

`mod-ledger-ui`, the hub, and both backends are served from **one origin**
in both dev and prod — `http://localhost/` in dev, `https://astrotable.dynv6.net/`
in prod. The workspace nginx reverse proxy (at the workspace root, not in
this submodule) fronts every request and dumb-proxies each prefix to the
right backend or frontend.

**Every `VITE_*_URL` must point through that proxy.** Never direct-port
(e.g. `http://localhost:8001/...`) — that breaks auth-state sharing
(localStorage is scoped per origin, and `:8001` is a different origin from
`:80`), forces CORS, and turns the cross-app "back to hub" link into a
cross-origin redirect that looks like a logged-out state.

## Stack

- Node **24** (pinned via `.nvmrc` and `engines`)
- npm (lockfile committed)
- React **19.2**, react-dom **19.2**
- React Router **7** (declarative `<Routes>` / `<Route>` API — data APIs not used)
- Vite **8**, `@vitejs/plugin-react` **6**
- TypeScript **6**
- ESLint **10**, `typescript-eslint` **8**

## Common commands

```bash
# Make sure Node 24 is active
nvm use

# Install / update deps
npm install
npm install <pkg>
npm install -D <pkg>

# Run the dev server (hot reload, port 5174, served under /mod-ledger/)
npm run dev

# Production build (outputs to ./dist)
npm run build

# Preview the production build locally
npm run preview

# Type-check without emitting
npm run type-check

# Lint
npm run lint

# Build + run in Docker
docker compose -f docker/docker-compose.yml --env-file .env up -d --build
```

## Mod level domain fact (read before touching evaluation)

In SWGOH, **mod levels are only `1, 3, 6, 9, 12, 15`**. Intermediate levels
(2, 4, 5, 7, 8, 10, 11, 13, 14) **do not exist** — Capital Games removed them
from the game. A real mod can never be observed at any of those levels.

When reading `src/utils/evaluationEngine.ts`, the `MILESTONES` array is the
**full set of valid mod levels**, not a subset of `1..15`. Do not describe
mods as "between milestones" or "mid-leveling at L2/L4/L5/..." — those
states do not occur.

**Pre-eval threshold.** A 5-dot mod is only evaluable once all 4 secondaries
are revealed. The reveal point depends on tier (see `FIRST_EVAL_LEVEL` in
`evaluationEngine.ts`):

| Tier | Color | First eval level |
|---|---|---|
| 1 | Grey   | L12 |
| 2 | Green  | L9  |
| 3 | Blue   | L6  |
| 4 | Purple | L3  |
| 5 | Gold   | L1  |

Below this level the engine returns `verdict='UPGRADE'` with no
`winning_variant_id` so the UI labels the mod "Level to L_X for evaluation"
instead of judging on partial data. 6-dot mods are always evaluable.

## How evaluations work

The Evaluations feature classifies each mod against a player-authored rule
set. The engine lives in `src/utils/evaluationEngine.ts`; pages
(`EvaluationsPage`, `EvaluationDetailPage`, `RuleBuilderPage`) wrap it.

### Two-stage gate

A mod runs through two passes in sequence:

1. **Stage 1 — rule match** (`runVariantChain`, called by `evaluateMod`):
   for each variant in the active evaluation, check how many of the
   variant's **required** secondaries the mod actually hits. Variant
   "passes" if `requiredCount >= threshold`.
2. **Stage 2 — quality gate** (`applyQualityGates`, post-pass): for any mod
   still classified `UPGRADE` after stage 1, compare `absolute_quality`
   against `QUALITY_RAMP[level]`. If below, the verdict flips to `SELL`.

`QUALITY_RAMP` is intentionally **only** defined for levels in the ramp:

| Level | Threshold |
|-------|-----------|
| 1     | 30        |
| 3     | 35        |
| 6     | 40        |
| 9     | 45        |
| 12    | 50        |

L15 is deliberately absent — the engine routes L15 mods to `PASS_RULES`
(handed to Slice/Deploy decisioning) instead of running them through the
quality gate. See `evaluationEngine.ts` around the L15 branch.

### Variant tiebreaking

When multiple variants match a mod, the winner is selected by this exact
priority (`evaluationEngine.ts` ~line 282-291):

1. Higher `requiredCount` wins
2. Then higher `absolute_quality` wins
3. Then earlier insertion order wins

There is no separate "complementary count" tiebreaker — earlier design
notes mentioned one, but the shipped engine does not implement it.

### Storage

Evaluations are persisted to **localStorage** via
`src/services/evaluationStorage.ts`. Backend integration (storing
evaluations in `mod-ledger`) is deferred — when it lands, the storage
layer is the single seam that needs to change. UI code reads/writes
through `evaluationStorage`, not localStorage directly.

### When extending the engine

- A new gate type goes in `evaluationEngine.ts` and runs either inline
  in `runVariantChain` (per-variant stage 1) or as a new post-pass
  beside `applyQualityGates` (global stage 2+).
- Verdict strings (`KEEP` / `UPGRADE` / `SELL` / `PASS_RULES`) are part
  of the storage format — adding a new one means a migration in
  `evaluationStorage`.
- Per-character overrides are out of scope (see the workspace memory
  rule: mod-ledger is general inventory analysis, never per-character).

## Critical rules

**Vite build-time env var inlining.** Any value used in the bundle must come
through an `import.meta.env.VITE_*` variable. Changing `.env` requires a
rebuild — Vite bakes the value into the JS at build time, not at runtime. The
Docker build takes them via `--build-arg` (wired up in `docker-compose.yml`).

**Never introduce Docker network coupling to other compose projects.** This
service runs with `network_mode: host` and listens on `localhost:4174`.
The workspace nginx at `../nginx/` is the single front door — it's what the
browser actually talks to, and it proxies this UI at `/mod-ledger/` and the
backends at their prefixes. Never suggest `networks: external: true` or
joining another compose's network.

**Auth + API access goes through `astrogators-shared-ui`.** Do not add a
second API client, a second auth context, or bespoke JWT handling. If the
shared lib is missing something, extend it there and cut a new shared-ui
release — do not reimplement.

**Routes are declarative.** This app uses `<Routes>` / `<Route>` /
`<Navigate>` from `react-router-dom@7`, not the data-router APIs
(`createBrowserRouter`, loaders, actions). If you need loaders/actions, raise
it as a deliberate architecture change.

**App is mounted under `/mod-ledger/` in production.** Vite's `base` is set
to `/mod-ledger/` and `BrowserRouter` uses `basename="/mod-ledger"`. Keep
these in sync — if the mount path changes, both must change together.

## Configuration

`.env` at the repo root is loaded automatically by Vite. **`.env` is
gitignored** — only `.env.example` is committed. When adding a new setting,
update both `.env.example` and any consumer (`main.tsx`, services, pages)
together.

Current vars:

- `VITE_MOD_LEDGER_URL` — full URL including the mod-ledger backend's
  `SERVICE_PREFIX`, routed through the workspace nginx. Dev:
  `http://localhost/mod-ledger`. Prod:
  `https://astrotable.dynv6.net/mod-ledger`.
- `VITE_ASTROGATORS_TABLE_URL` — full URL including the astrogators-table
  backend's `SERVICE_PREFIX`, also proxied. Dev:
  `http://localhost/astrogators-table`. Prod:
  `https://astrotable.dynv6.net/astrogators-table`.

## When adding dependencies

Use `npm install` (not yarn/pnpm). Commit both `package.json` and
`package-lock.json`. Rebuild the Docker image after dependency changes.

If the dep is shared logic that would benefit `astrogators-hub` too, consider
adding it to `astrogators-shared-ui` and publishing a new version instead.

## Gotchas

- **React 19 strict types** — some third-party components with loose
  `@types/react@18` typings may throw TS errors under React 19. Check the dep
  has published a React-19-compatible type update before adopting.
- **`astrogators-shared-ui` peer range is `^18 || ^19`** — safe to use under
  React 19. If you change React major again, update the peer range in
  shared-ui first and publish a new version.
- **CSS is imported via `@import` in `src/index.css`**, not as a side-effect
  ES import. That keeps it out of TS 6's `noUncheckedSideEffectImports` path.
