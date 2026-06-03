# Mod Ledger UI

React + TypeScript + Vite single-page app for SWGOH mod inventory and
filtering. Part of [The Astrogator's Table](../) workspace.

## Tech stack

- **Node 24** (pinned via `.nvmrc` and `engines`)
- **React 19.2** + **react-dom 19.2**
- **React Router 7** (declarative `<Routes>` / `<Route>` API)
- **Vite 8** + `@vitejs/plugin-react` 6
- **TypeScript 6**
- **ESLint 10** + `typescript-eslint` 8
- **`astrogators-shared-ui` ^0.6.0** — shared `AuthProvider`, API client,
  ally-code helpers, components

## Features

### Mod inventory
- Ally-code selection (saved codes from the backend, or add new)
- Responsive mod grid (5 columns down to 1 on mobile)
- Mod card with primary stat, sprite, level/tier/pips, secondary stats with
  efficiency, and character/calibration/lock state
- Sliding filter panel: sets, slots, tiers, rarity, primaries, characters, lock
- Sorting by character, set, slot, level, rarity, tier, or speed
- Mod detail modal with secondary-roll efficiency breakdown and, when an
  evaluation is active, a plain-language verdict explanation

### Evaluations
Player-authored rules that classify each mod as `SELL`, `UPGRADE`,
`PASS_RULES`, or `UNCONFIGURED`. `PASS_RULES` mods are bucketed downstream
into Slice / Maxed actions. Stored in localStorage today; backend
persistence is deferred.

- Catalog page at **`/evaluations`** — list of saved evaluations, with
  selector for the active one
- Rule builder at **`/evaluations/new`** and **`/evaluations/:id/edit`** —
  define scoring rules (each with required/complementary secondaries), set
  quality thresholds, and master roll targets per stat
- Detail page at **`/evaluations/:id`** — per-mod breakdown, drilldown by
  action stage (Level / Slice / Maxed / Pre-Eval) with scoring-rule grouping
- Two-stage gate model: rule-match (Stage 1) then absolute-quality gate
  (Stage 2). See `CLAUDE.md` for the engine internals.
- Slicing advice: each slice-candidate mod gets a 5-band quality rating
  (Slice For Sure → Consider → Average → Consider Selling → Sell) derived from
  its **own** quality %, shown as a colour-tinted % on the card with a legend.
  Per-mod — no cross-mod comparison, so a lone mod still gets a real verdict.

### Design system
Chamfered Card layout system comes from `astrogators-shared-ui` (Card
component with `chamfered` / `chamferSize` props). No local fork.

## Where this fits

The app is mounted under **`/mod-ledger/`** and served from a single origin
together with the rest of the Astrogator's Table products. The workspace
nginx (lives at the workspace root, not in this submodule) is the front door
for both dev (`http://localhost/`) and prod (`https://astrotable.dynv6.net/`)
and dumb-proxies each prefix to its backend or frontend.

It consumes:

- **`mod-ledger`** backend — player mod listing
- **`astrogators-table`** backend — authentication
- **`astrogators-shared-ui`** — auth context and shared UI

It owns no persistent state. Auth tokens and ally-code selection live in
browser storage (handled by shared-ui); mod data is fetched per request.

## Development

### Prerequisites

- Node **24** (`nvm use` picks it up from `.nvmrc`)
- npm
- The workspace nginx and the two backends running locally — without them,
  `VITE_*_URL` endpoints will not respond. See the workspace `README.md`.

### Setup

```bash
nvm use
cp .env.example .env
npm install
npm run dev
```

Dev server runs on **port 5174** but you should hit it through the workspace
nginx at `http://localhost/mod-ledger/` so auth state and API calls stay on
one origin.

### Scripts

| Command            | What it does                              |
|--------------------|-------------------------------------------|
| `npm run dev`      | Vite dev server on `:5174`                |
| `npm run build`    | Type-check + production build to `./dist` |
| `npm run preview`  | Serve the built `./dist`                  |
| `npm run type-check` | TypeScript check, no emit               |
| `npm run lint`     | ESLint                                    |

### Docker

```bash
docker compose -f docker/docker-compose.yml --env-file .env up -d --build
```

Runs with `network_mode: host` and listens on `localhost:4174`. The workspace
nginx proxies `/mod-ledger/` to that port. **Never** join another compose
project's network.

## Configuration

`.env` lives at the submodule root and is gitignored — only `.env.example`
is committed. Vite **inlines `VITE_*` values at build time**, so changing
`.env` requires a rebuild (the Docker build wires them in via `--build-arg`).

| Variable                      | Dev                                | Prod                                              |
|-------------------------------|------------------------------------|---------------------------------------------------|
| `VITE_MOD_LEDGER_URL`         | `http://localhost/mod-ledger`      | `https://astrotable.dynv6.net/mod-ledger`         |
| `VITE_ASTROGATORS_TABLE_URL`  | `http://localhost/astrogators-table` | `https://astrotable.dynv6.net/astrogators-table` |

Both must point through the workspace nginx — never direct-port (e.g.
`http://localhost:8001/...`). Direct ports are a different origin from `:80`,
which breaks shared `localStorage` auth state and forces CORS.

## Project structure

```
src/
├── main.tsx                      # Entry; AuthProvider + Router
├── App.tsx                       # Routes and protected wrappers
├── contexts/
│   ├── ModContext.tsx            # Mod data + fetch state
│   ├── FilterContext.tsx         # Filter / sort state
│   └── defaultFilters.ts
├── components/
│   ├── layout/Layout.tsx         # TopBar + Footer
│   ├── filter/FilterPanel.tsx    # Sliding sidebar
│   └── mod/
│       ├── ModCard.tsx
│       ├── ModGrid.tsx
│       ├── ModDetailModal.tsx
│       ├── ModSprite.tsx
│       ├── PipIndicator.tsx
│       ├── InventoryOverview.tsx   # disposition counts / bucket filter
│       ├── SliceLegend.tsx         # key for the 5-band slicing advice
│       └── SecondaryStatColumn.tsx
├── pages/
│   ├── AllyCodeSelectionPage.tsx
│   ├── ModGridPage.tsx
│   ├── EvaluationsPage.tsx       # evaluations catalog
│   ├── EvaluationDetailPage.tsx  # per-evaluation breakdown
│   └── RuleBuilderPage.tsx       # create / edit an evaluation
├── services/
│   ├── modLedgerApi.ts
│   ├── gameDataApi.ts
│   └── evaluationStorage.ts      # localStorage CRUD for evaluations
├── types/
│   └── evaluation.ts             # Evaluation, Variant, Verdict types
└── utils/
    ├── modFilters.ts
    ├── modSorting.ts
    ├── modScorer.ts              # per-mod absolute_quality scorer
    ├── modDisposition.ts         # action buckets + per-mod quality bands
    ├── scoringConstants.ts
    ├── evaluationEngine.ts       # rule + quality gate engine (see CLAUDE.md)
    ├── verdictExplain.ts         # plain-language verdict prose for the UI
    └── modSpriteConfig.ts
```

## API integration

- **Auth** — `astrogators-shared-ui` `AuthProvider` against
  `VITE_ASTROGATORS_TABLE_URL`. Do not add a second auth context or bespoke
  JWT handling.
- **Mod data** — `services/modLedgerApi.ts` against `VITE_MOD_LEDGER_URL`.

If shared-ui is missing something, extend it there and cut a new release —
do not reimplement here.

## Conventions

- **Routes are declarative.** `<Routes>` / `<Route>` / `<Navigate>`. The data
  router APIs (`createBrowserRouter`, loaders, actions) are not used.
- **Mount path stays in sync.** Vite's `base` is `/mod-ledger/` and
  `BrowserRouter` uses `basename="/mod-ledger"`. Change both together.
- **CSS via `@import`** in `src/index.css`, not side-effect ES imports
  (TS 6 `noUncheckedSideEffectImports`).

## Adding dependencies

`npm install` only — commit both `package.json` and `package-lock.json`, and
rebuild the Docker image. If the dep would also help `astrogators-hub`, add
it to `astrogators-shared-ui` and publish a new version instead.
