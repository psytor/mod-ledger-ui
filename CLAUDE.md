# CLAUDE.md — mod-ledger-ui

Guide for Claude Code when working inside this submodule.

## Documentation currency (update when you edit docs)

**Docs current as of:** commit `a1bbad5` plus earlier work. The latest commit
(`a1bbad5`) **consolidated the mod filters into one system** (see "Filters" and
"Top-of-page readout" below): the former Sell-Pile / Unconfigured **view modes**
— and their `FilterMode` switch plus the duplicate `sellPileSets` /
`sellPileSlots` facet state — were **removed**, because they were duplicates of
the **Sell** and **Unconfigured** disposition chips that already lived in
`InventoryReadout`. There is now a single `ModFilters` state with one shared set
of facets; `FilterPanel` always shows them (no mode tabs); `ModGridPage` always
renders the flat grid, and the **Unconfigured disposition keeps its dedicated
grouped-by-set "configure rules" view** (rendered when
`filters.bucket === 'unconfigured'`, with the readout still above it). The two
Clear buttons were **unified** — the readout's Clear and the panel's both call the
canonical `clearFilters`, which now appears whenever ANY filter is active and
**preserves Sort/Group** (display prefs, not filters). `InventoryReadout` gained a
removable **"Active filters"** chip row so the panel-driven
set/slot/tier/rarity/primary/character/lock filters are visible — and individually
removable — in one place. Deleted helpers: `applySellPileFilters` /
`getSellPileOptions` / `applyUnconfiguredFilters`.

Earlier work, commit `af53571` plus the commit after it: the latter (a) revived the
card tooltips that were silently dead (`pointer-events: none` on the verdict badge
+ quality chip → `auto` + `cursor: help`), and (b) added `explainQualityScore` in
`verdictExplain.ts` + a "What the score means:" block in `ModDetailModal` that
spells out what the 0-100 score is and that roll-quality is separate from
rule-match (see "Verdict labels & explanations"). `af53571` itself fixed the
quality-band model so nothing implies "50 = average" anymore AND wired a
player-facing priority/action vocabulary through every band surface. `curveScore`
scores a single roll 50 when it lands on the target YOU set, so a mod's
`absolute_quality` of 50 means "the rolls met your targets — push it forward",
above 50 means "the rolls beat your targets", below 50 "the rolls fell short". 50
is the **target**, not an average roll. The five **even** 20-point bands
(`QUALITY_BAND_BOUNDARIES = [20, 40, 60, 80]`) now carry a **label / priority /
action** triple in `QUALITY_BAND_INFO`: **Elite·Top Priority / Strong·High
Priority / On Target·Priority / Weak·Low Priority / Poor·Skip** — the target band
("On Target", 40-60) is **"Priority"**, a full yes (NOT "medium"); above it stacks
Top/High Priority, below falls off to Low/Skip. The label is the card chip;
priority + action surface in the card tooltip, the `InventoryReadout` legend +
bar tooltips, and a "Slicing advice" line in `ModDetailModal`. Internal band ids +
CSS classes are `perfect` / `nearly-perfect` / `on-target` / `under-target` /
`bad`; helpers are `qualityBandLabel` / `qualityBandPriority` / `qualityBandAction`.
The same commit also **drops the redundant `PASS` badge from the `ModCard`
top-right corner** — a Pass mod always shows its slice/maxed band chip, so the
badge added nothing (see "Verdict labels & explanations"). See "Slicing advice"
below. The prior change added a
`caveat` field to `verdictExplain` so a `SELL` verdict no longer reads as an
absolute "sell now": it explains the call is against the current scoring rules
(the mod may still suit a character wanting those secondaries together, or serve
as a ship-pilot mod), and softens further for 6-dot mods to acknowledge the
slicing investment (see "Verdict labels & explanations" below). The change before
that consolidated the three top-of-page strips (`InventoryOverview` +
`ResultsDistribution` + `SliceLegend`) into a single interactive
`InventoryReadout` console and added a `band` quality-band filter alongside
`bucket` (see "Top-of-page readout"); before that, the cohort/percentile slicing
bands were replaced with a per-mod 5-band quality scale, `cohortRanking.ts` was
renamed → `modDisposition.ts`, and the unused raw `score` was removed. Next
session: `git log a1bbad5..HEAD` for anything newer.

When you make a change that affects documented behaviour, update this line
to the commit you have brought the docs level with — so the next session
can `git log <hash>..HEAD` to see what is not yet documented.

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
   `applyQualityGates` takes the `evaluation` and `statDefs` so it can apply
   the **primary-aware threshold relief**: when the mod's primary stat is
   itself a Required stat, the game blocks that stat from rolling as a
   secondary, so the reachable Required pool is `required \ {primary}`. The
   raw threshold is discounted by `coverage × COVERAGE_DISCOUNT_K` (k=0.2,
   capping the relief at 20%), where coverage is how much of the reachable
   pool the mod actually hit. The same reachable-pool logic shapes the
   Stage 1 `threshold` in `checkSecondary`: the bar is
   `max(1, min(visibleCount - 1, reachableRequiredSize - 1))` — the `- 1` on
   the reachable pool only bites when the pool is tight (a 7-Required Defensive
   set stays capped at 3; a 4-Required Offensive set with the primary on a
   Required stat eases to 2). When `reachableRequiredSize` is **0** (the sole
   Required stat IS the primary — e.g. a Speed-primary mod in a Speed set whose
   only Required is Speed), there is nothing left to demand of the secondaries:
   the gate passes on the primary and the winner-picking tiebreakers decide the
   mod's direction.

`QUALITY_RAMP` is intentionally **only** defined for levels in the ramp:

| Level | Threshold |
|-------|-----------|
| 1     | 30        |
| 3     | 35        |
| 6     | 40        |
| 9     | 45        |
| 12    | 50        |

L15 is deliberately absent — the engine routes L15 mods to `PASS_RULES`
instead of running them through the quality gate. `PASS_RULES` mods are
then bucketed by `actionOf` in `modDisposition.ts` into the `slice` and
`maxed` actions (the latter is a 6-dot A-tier mod with no further upgrade).
See `evaluationEngine.ts` around the L15 branch.

### Variant tiebreaking

When multiple variants match a mod, the winner is selected by this exact
priority (`evaluationEngine.ts` ~line 282-291):

1. Higher `requiredCount` wins
2. Then higher `complementaryCount` wins — the **direction signal**. When the
   Required gate ties (e.g. a Speed-primary mod in a Speed set, where every
   variant requires only Speed and the primary satisfies it for all of them),
   the complementary spread routes the mod into its flavor (Offense / Defense /
   Tenacity / Potency). `absolute_quality` can't do this: it is normalized
   per-variant, so it measures roll quality, not which direction the mod fits.
3. Then higher `absolute_quality` wins
4. Then earlier insertion order wins

`scoreModForVariant` returns a single number — `absolute_quality` (0-100). The
old raw running total (`score`) was only ever consumed by the removed cohort
percentile, so it is no longer returned or stored on `VerdictResult`.

### Slicing advice (quality bands)

A `slice`-action mod's recommendation is decided **per-mod** from its own
`absolute_quality`, with **no cross-mod comparison**. The score answers one
question: **how close did the mod's rolls get to the targets YOU set?** In
`curveScore` a single roll scores exactly 50 when it lands on your target (0 at
nothing, 100 at a perfect max roll), so the mod's overall `absolute_quality`
reads: **50 = the rolls met your targets** (this mod already does what you want —
push it forward), **above 50 = the rolls beat your targets** (your best bets),
**below 50 = the rolls fell short**. **50 is the TARGET, not an average roll** —
do not reintroduce any "50 = average / bell centred at 50" framing anywhere.

`qualityBand` in `modDisposition.ts` splits 0-100 into five **even 20-point**
bands (`QUALITY_BAND_BOUNDARIES = [20, 40, 60, 80]` in `scoringConstants.ts`)
mapped to the game's own quality colours. The band that contains 50 is **On
Target** — a green light, never "Average". It is a fixed per-mod scale, **not** a
live cohort percentile.

Each band carries three pieces of copy in `QUALITY_BAND_INFO` (`modDisposition.ts`):
a one-word **label** (the card chip), a **priority**, and a plain-language
**action**. The target band is **"Priority"** — a full yes, the actual goal —
**not "medium"**; the bands above stack Top/High Priority on top of it (bonus past
target), and below it falls off to Low Priority / Skip. Do not demote the target
band to a middling tier.

| % range | Band id | Colour | Label (card) | Priority | What to do |
|---|---|---|---|---|---|
| 80–100 | `perfect` | Gold | Elite | Top Priority | Slice this first |
| 60–80 | `nearly-perfect` | Purple | Strong | High Priority | Slice soon |
| 40–60 | `on-target` | Blue | On Target | Priority | Already meets your bar — slice normally |
| 20–40 | `under-target` | Green | Weak | Low Priority | Slice only if you have spare materials |
| 0–20 | `bad` | Grey | Poor | Skip | Not worth your materials |

The label/priority/action come from `qualityBandLabel`, `qualityBandPriority`,
and `qualityBandAction`. Where each surfaces:

- **`ModCard` chip** — the one-word **label**, tinted by colour (slice mods only);
  the chip's `title` tooltip carries `priority — action`. A maxed (6d-A) mod gets a
  "Maxed" chip carrying the band word, and a maxed-specific tooltip (no slice
  instruction — it is already fully sliced). Level/sell mods rely on the verdict
  badge.
- **`InventoryReadout`** (the framed console at the top of the flat view) renders
  the key — each legend item shows colour + range + label + **priority**, with
  `priority — action` in its tooltip, and the distribution bar segments carry the
  same in their tooltips. See "Top-of-page readout" below.
- **`ModDetailModal`** — a "Slicing advice:" line in the Evaluation section shows
  `Priority (Label) — action` for slice mods (and a fully-sliced note for maxed).

Because the band is intrinsic to the mod, **filtering and sorting never change a
mod's band** — they only change what's shown and in what order, and a lone mod
still gets a real verdict.

### Top-of-page readout

`InventoryReadout` (`src/components/mod/InventoryReadout.tsx`) is the single
framed panel above the flat grid. It consolidates what used to be three separate
strips (`InventoryOverview` + `ResultsDistribution` + `SliceLegend`, all now
removed) into two interactive lenses, both computed from the **whole inventory**
(not the filtered view) so the counts stay a stable overview:

- **Disposition** — a count chip per `BucketFilter` (Sell / Level Up / Slice /
  For Pilots / Maxed / Unconfigured) plus an "All" chip. Clicking sets
  `filters.bucket` (`getBucketCounts`). These chips are also the view
  navigation that the removed Sell-Pile / Unconfigured *modes* used to be —
  picking **Unconfigured** swaps the grid for the grouped-by-set "configure
  rules" view (handled in `ModGridPage`).
- **Quality** — a segmented distribution bar over every *scored* mod
  (`getQualityBandCounts`; a finite `absolute_quality`), highest band on the
  left, plus an interactive legend doubling as the colour key. Clicking a
  segment or legend item sets `filters.band`.
- **Active filters** — a removable chip row (shown only when at least one
  panel-driven filter is on) summarising every set/slot/tier/rarity/primary/
  character/lock filter. Each chip removes just that one value; `bucket`/`band`
  are intentionally excluded (the two lenses already show their own active
  state). This makes the readout the single honest picture of everything
  narrowing the grid.

`bucket` and `band` are **independent** filters that stack (e.g. slice mods in
the gold band). The band filter lives in `ModFilters` and is applied in
`applyFlatFilters` (stale-guarded by `verdicts?.size`, same as `bucket`).

There is **one** Clear: a "Clear all filters" button (in the readout header and
the filter drawer) that calls the canonical `clearFilters`. It appears whenever
ANY filter is active and resets every filter (facets, lenses, cross-cutting)
while **preserving `groupBy` / `sortBy`** — those order what's shown, they don't
filter it.

`sortMods` orders by `absolute_quality`, breaking ties toward the
**more-advanced** mod via `advancementRank` (`rarity*10 + tier`: a 6-dot beats
any 5-dot, then higher tier wins) — the better slice bet.

> **History:** this replaced a cohort system that ranked each mod by *percentile
> within a `dots+tier+variant` peer group*, keyed on the raw `score`. It was
> removed because the deciding number was never shown, the peers were hidden by
> the active filter, and a single-mod cohort silently defaulted to "Keep" — so a
> perfect lone mod could never be flagged to slice.

### Filters (one system — no view modes)

All mod-inventory filtering is **one** `ModFilters` state (`FilterContext.tsx` +
`defaultFilters.ts`); there is no longer a `mode` / `FilterMode` view switch.
The fields:

- **Facets** (the filter drawer, `FilterPanel`): `flatSets`, `flatSlots`,
  `flatTiers`, `flatRarity`, `flatPrimaries`.
- **Lenses** (the readout, `InventoryReadout`): `bucket` (a `BucketFilter` — the
  five `ActionBucket`s plus the `for-pilot` overlay) and `band` (a `QualityBand`).
  Independent; both stack.
- **Display** (the drawer): `groupBy`, `sortBy` — these order what's shown, they
  are **not** filters, so `clearFilters` preserves them.
- **Cross-cutting** (the drawer): `locked`, `characters`.

`applyFlatFilters` (`modFilters.ts`) is the single apply path for the grid. The
`bucket` / `band` checks are **stale-guarded by `verdicts?.size`** — they only
engage once an evaluation has produced verdicts; the facet/cross-cutting checks
need no verdicts. `bucket === 'sell'` diverts assigned (pilot-pool) mods out, and
`bucket === 'for-pilot'` is an assignment overlay (no verdict needed). When
`bucket === 'unconfigured'`, `ModGridPage` renders the dedicated grouped-by-set
"configure rules" view instead of the normal grid.

> **History:** "Sell Pile" and "Unconfigured" were once separate *view modes*
> selected by mode tabs in the drawer, each with parallel filter state
> (`sellPileSets` / `sellPileSlots` duplicated the flat set/slot facets). They
> were folded into the **Sell** and **Unconfigured** disposition chips — which
> already did the same routing — so the duplication and the second navigation
> model are gone. Don't reintroduce a `mode` axis: a new "view" is a new
> `BucketFilter`/disposition, not a mode.

### Storage

`src/services/evaluationStorage.ts` is an **auth-aware async adapter**.
All UI code reads/writes through this single seam — never via
`localStorage` directly or `evaluationsApi` directly.

- **Logged out:** all reads/writes go to browser localStorage (the
  offline scratchpad).
- **Logged in:** all reads/writes go to the `mod-ledger` backend via
  `src/services/evaluationsApi.ts`. The backend is the single source of
  truth; localStorage leftovers from a prior logged-out session are
  treated as a separate pool to migrate, not as an alternate store to
  read from.

The auth boundary uses `getAccessToken()` from `astrogators-shared-ui`.
Methods are all async (`Promise<...>`), even for the localStorage path,
so callers don't branch on auth state.

**Migration prompt.** When the user logs in with localStorage records
present, `EvaluationsPage` renders the **non-dismissable**
`MigrationPromptDialog` forcing a choice: Import to my account (uploads
via `/evaluations/migrate` and clears local on success) or Discard
local evaluations (with a second confirmation). There is no "later"
escape — see the workspace memory rule
`no-silent-local-fallback-when-authed` for the rationale.

**Backend wire format vs frontend type.** The backend uses snake_case
and ISO datetimes (`owner_user_id`, `authored_by_user_id`, `created_at`);
the frontend type uses camelCase epoch ms (`ownerUserId`, `authoredBy`,
`createdAt`). The translation lives inside `evaluationsApi.ts`
(`fromWire` / `toWriteWire`); the rest of the app sees Evaluations in
the frontend shape only.

### Moderation (admin/mod)

`src/utils/permissions.ts` is the single source of truth for the
admin/mod check — `isAdmin`, `isMod`, `canModerate` (admin OR mod), all
plain functions taking `user: User | null` (not hooks; `EvaluationDetailPage`
and `RuleBuilderPage` already have `user` in scope from their own
`useAuth()` call). `role` is a required field on shared-ui's `User` type
as of 0.10.4 — do not reintroduce a local `UserWithRole` widening cast.

`canModerate` gates: the Publish button and Protocol edit/delete on
`EvaluationDetailPage`, opening a Protocol in `RuleBuilderPage`, and the
whole `/moderation` page (`ModerationPage.tsx`) — a browse view over every
Manifest across every owner (`GET /evaluations/admin/manifests`, mirrors
`listProtocols()`'s pattern in `evaluationsApi.ts`), with a Publish action
per card. Mods get full parity with admins here — mod-ledger has no
broader "delete any evaluation" admin power to withhold (see the backend's
`_can_modify` in `mod-ledger/src/api/v1/endpoints/evaluations.py`).

Manifest owner usernames render via shared-ui's `fetchUsernames` (batched
once per page load over the distinct `ownerUserId`s, not per-card) —
**this requires `astrogators-shared-ui` >= 0.11.0**, which has been built
and version-bumped in that submodule but not yet `npm publish`ed (that step
needs the user's interactive npm login). Until it's published and this
app's `astrogators-shared-ui` dependency is bumped + reinstalled,
`ModerationPage.tsx`'s `fetchUsernames` import will fail type-check
(`tsc -p tsconfig.app.json` — the batched `npm run type-check` via project
references has been seen to stale-cache and miss this; verify with the
direct `-p` form if in doubt).

### When extending the engine

- A new gate type goes in `evaluationEngine.ts` and runs either inline
  in `runVariantChain` (per-variant stage 1) or as a new post-pass
  beside `applyQualityGates` (global stage 2+).
- Verdict strings (`SELL` / `UPGRADE` / `PASS_RULES` / `UNCONFIGURED`) are
  part of the storage format — adding a new one means a migration in
  `evaluationStorage`.
- Per-character overrides are out of scope (see the workspace memory
  rule: mod-ledger is general inventory analysis, never per-character).

### Verdict labels & explanations

The four verdicts above are terse. `src/utils/verdictExplain.ts` turns any
`VerdictResult` into plain-language prose — `explainVerdict(v, mod?)` returns
`{ label, meaning, detail, nextStep, caveat? }`, and `verdictTooltip()` formats
that for a native `title` tooltip. It is presentation-only: it reads existing
verdict fields (`reason`, `all_results`, `winning_variant_name`,
`absolute_quality`) and never re-runs the engine. The optional second arg is an
`ExplainModContext` (`{ rarity }`) — used **only for tone**, never to re-derive
the verdict.

`caveat` is softening context shown beneath `nextStep`. Today only the **`SELL`**
verdict sets it: a sell call is a verdict against the *current* scoring rules,
not the mod itself — the mod may still suit a character that wants those
secondaries together, and any sell-rated mod makes a fine ship-pilot mod because
a ship draws power from a mod's **dots + level**, not its secondary stats (a real
game mechanic; see the EA/gaming-fans references). When `mod.rarity === 6` the
SELL copy is investment-aware: it leads with "you invested a lot to reach 6 dots,"
and `nextStep` softens from "Safe to sell for credits." to "Keep it for now, or
sell …". A 6-dot mod is a fully sliced mod, so the SELL is never about wasted
levels — the `meaning` line deliberately no longer claims it is "not worth
leveling further."

`verdictExplain.ts` also exports **`explainQualityScore(quality)`** →
`{ line, note }`: plain-language prose for the 0-100 `absolute_quality` score
itself (not a verdict). `line` states the score and whether the rolls met / beat
/ fell short of the targets (boundaries 40 / 60 align with the "On Target" band),
and reiterates **50 = on target, it scores roll quality not how many stats
matched**; `note` makes the distinction players trip on — **matching your rule
and rolling well are two different things** (a mod can hit every Required stat
and still score low if those rolls were weak). It renders in `ModDetailModal` as
a "What the score means:" block (purple-bordered, between the slicing-advice line
and the winning-rule row) whenever the engine produced a finite
`absolute_quality`. This exists to answer the exact "all 4 required are there, so
why only 40/100?" confusion.

It surfaces in two places:

- **`ModCard`** — the top-right verdict badge has a `title` tooltip
  (`verdictTooltip(verdict, { rarity })`); the tooltip appends `caveat`. **Both
  the verdict badge and the top-left quality chip set `pointer-events: auto`
  (+ `cursor: help`)** so their native `title` tooltips actually fire — they were
  `pointer-events: none` before, which silently killed every card tooltip. The
  tradeoff: a click landing exactly on a badge no longer opens the modal (the rest
  of the card still does). The badge
  is shown for **SELL / UPGRADE / UNCONFIGURED only** — `PASS_RULES` is
  intentionally **not** badged on the card, because a Pass mod always carries a
  slice/maxed band chip (top-left) that already conveys "keeper", making a "PASS"
  badge redundant. (`PASS` still appears in `ModDetailModal` and in the per-rule
  results table.)
- **`ModDetailModal`** — the Evaluation section shows the badge + `meaning`,
  an explanation block (`detail` + `Next step` + muted italic `caveat`), the
  winning scoring rule, and a per-rule breakdown table.

The engine only emits a `reason` string on failures; `verdictExplain`
synthesises the "why it passed" line for passing mods from `required_count`
/ `complementary_count`. Keep prose claims limited to what the engine
actually establishes — do not invent mod-lifecycle semantics.

> **Terminology:** user-facing UI calls a `Variant` a **"scoring rule"**.
> The `Variant` type name is kept internally; only visible text uses
> "scoring rule".

## Mod sprite rendering

`ModSprite.tsx` composites a mod's icon from two shared atlas PNGs in
`public/assets/sprites/` via CSS `background-position`-cropped `<div>`s —
no per-mod images, no `<img>` tags. Three stacked layers: **Main** (the
shape frame, untinted), **Inner** (tier-color-tinted via the
`.tintGrey/Green/Blue/Purple/Gold` CSS filters in `ModSprite.module.css`),
**set icon** (the mod-set bonus icon, also tinted, positioned per shape via
`SET_ICON_LAYOUT_CONFIG`).

**Render the set icon at its final pixel size in one step — never
upscale-then-transform-scale-down.** `renderSetIcon()` used to render the
icon oversized via `background-size` and then shrink the whole thing again
with a CSS `transform: scale()` — two lossy resizes stacked, which softens
the edges. Fixed by computing `background-size`/`background-position`
directly at the real target size, no transform. The artifact is subtle at
1x display density and clearly visible at ~2-3x (verified with a real
before/after pixel comparison at both) — don't judge a change here by a 1x
screenshot alone.

**Do not swap `MOD_SHAPE_SPRITES_*`'s `Inner` layer to a different atlas
source without checking it fits as tightly as the current one.** This was
tried once (rebuilding the coordinates from a newer atlas export) and
reverted: the newer atlas's equivalent "selected" sprite is a
selection-*glow* asset, deliberately sized to bloom past the chip's edge as
a UI highlight effect, not a tight border trace. Composited the same way as
the current tight-fitting `Inner` sprite, the tinted ring bled outside the
frame onto the background — wrong at a glance in the running app, but easy
to miss in a cropped/zoomed screenshot that happens to frame out the
overflow. If revisiting this, verify against an *uncropped* card render,
not just a magnified interior crop.

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
