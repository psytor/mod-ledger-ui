# Evaluations — working notes

Living doc. Update as decisions land. Not exhaustive.

## Concept

User-authored rulesets that score/judge mods. Engine runs in the frontend.
"Evaluate" is a manual action (expensive). Verdicts attach to mods in the grid.

## Surfaces

- **Selector + Evaluate button** — above the filters row on `ModGridPage`.
- **`/evaluations`** — catalog: browse + search. Read-only for non-owners.
- **`/evaluations/:id`** — read-only detail.
- **`/evaluations/:id/edit`** — builder. Owner-only; non-owners redirect to `/:id`.
- **`/evaluations/new`** — builder, create.

## Data shape (locked now, survives to server unchanged)

```ts
type Evaluation = {
  id: string;                       // uuid
  ownerUserId: number | null;       // matches astrogators-table users.id (Integer); null = local/unauth
  isPublic: boolean;                // unused in phase 1, field exists
  name: string;
  description: string;
  rules: Rule[];                    // engine-defined; grows per builder step
  createdAt: number;
  updatedAt: number;
};
```

Verdict shape: TBD on first rule step. Minimum guess: `{ label, reason?, score?, color? }`.

## Phase plan

| Phase | Scope | Storage |
|---|---|---|
| **1 — now** | Engine skeleton, types, storage layer, selector dropdown, catalog page, detail page, builder shell, one working rule type end-to-end | localStorage |
| 2 | Grow builder + engine, one criterion type at a time | localStorage |
| 3 | mod-ledger backend: `evaluations` table, CRUD endpoints, auth-aware storage swap, first-login migration of local records | Postgres (rules as JSONB) |
| 4 | Public sharing UI, fork, moderation/reporting | Postgres |

## Deferred decisions (revisit when phase needs them)

- **Verdict visual on `ModCard`** — badge / border tint / text? Decide when first rule produces a verdict.
- **Active-id change behavior** — clear verdicts on switch (current default) or keep stale ones visible?
- **Re-evaluation triggers** — only manual? Auto on mod refetch?
- **Ruleset versioning** — if a public ruleset is edited, what do existing "users" of it see? Snapshot vs live reference.
- **Cross-ally-code behavior** — verdicts are per-mod-id; switching ally code clears the verdict map.
- **Performance** — engine over thousands of mods. If it ever lags, chunk + yield.
- **Determinism** — engine must be pure: same mod + same ruleset → same verdict. No `Math.random`, no `Date.now`.
- **Seed evaluations** — ship 1–2 default rulesets so unauth/new users have something to try.

## Backend (phase 3 sketch — not built)

mod-ledger gets an `evaluations` table. `owner_user_id INTEGER` with no FK
(different DB; trust JWT `sub`). `rules JSONB` so engine can evolve without
migrations. Cross-service user lookup over HTTP if/when needed.
