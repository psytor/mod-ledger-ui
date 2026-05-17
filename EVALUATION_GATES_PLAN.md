# Evaluation Gates — Redesign Plan

Status: **design locked, not yet implemented.** Built in conversation with the
project owner; this document captures the full design so implementation can
proceed in a fresh session without losing context.

Read `mod-ledger-ui/CLAUDE.md` first — it has the submodule scope rule and
domain facts (mod milestones are only `1, 3, 6, 9, 12, 15`; pre-eval
thresholds per tier).

---

## 1. Why we are doing this

Today the evaluation engine has **one gate** per 5-dot mod, fired at the
tier's `FIRST_EVAL_LEVEL` (Grey L12, Green L9, Blue L6, Purple L3, Gold L1 —
see `src/utils/evaluationEngine.ts:17-23`). Above that level, all "level"-action
mods land in a **single flat cohort keyed only by variant_id** (see
`src/utils/cohortRanking.ts:60-61`) and get ranked by `absolute_quality`.

Two problems with that:

1. **Cross-tier sample-size noise.** A Grey-L12 (just hit eval threshold, 4
   secondary rolls) and a Purple-L12 (~7 rolls) and a Gold-L15 (~8 rolls) all
   sit in the same Level cohort. Per-roll math (`absolute_quality`) is fair
   *on average* but small-sample mods (Grey just past threshold) have noisy
   estimates and get unfairly ranked.

2. **No intermediate-milestone gating.** Today, a Grey mod is treated as
   "Pre-Eval, level it to L12" all the way from L1–L11. We never ask at
   L6 or L9 whether continuing to level is worth the credits. The player
   either commits all the way to L12 or sells immediately — no graduated
   decision.

The owner's intuition (verbatim from the design conversation): "A mod is not
really valuable until it's level 15... a mod that doesn't meet the
requirements to level up and doesn't have the required secondaries is a
goodbye mod" — and: "if you start with 4 bad rolls on a grey mod, it's only
wasting materials."

So we replace one gate with a **chain of gates** — one per level milestone —
each making an independent push-or-sell decision.

---

## 2. The new model (locked)

Every 5-dot mod goes through a chain of milestone gates from its current
level up to L15. Each gate either **passes** (set `target_level` = next
milestone) or **fails** (verdict `SELL`).

### 2.1 Stage 1 — Rules-based gates (below scoring zone)

Used at milestones **before** all 4 secondaries are revealed (i.e. below the
tier's `FIRST_EVAL_LEVEL`).

Formula (already in `evaluationEngine.ts:130-132`, just applied at more
checkpoints):

```
visible    = number of secondaries currently revealed at this level
adjustment = 2 if the mod's primary stat is classified as Required in the
             variant, else 1
threshold  = max(1, visible − adjustment)   ← floor of 1 is new (see §6.3)
```

The mod passes the gate if its count of Required-classified visible
secondaries ≥ `threshold`. Otherwise SELL.

**Below L6 there is no gate** — just level to L6. (Owner: "For a grey mod not
at level 6 — We level to 6.")

### 2.2 Stage 2 — Quality gates (in scoring zone)

Used at milestones **at or above** the tier's `FIRST_EVAL_LEVEL`. All 4
secondaries are revealed; the question becomes "are the rolls good enough to
justify the credits for the next push?"

Compare the mod's `absolute_quality` (0-100, computed in
`src/utils/modScorer.ts:94`) against a milestone-specific threshold `Q`:

| Pushing to… | Q   |
|-------------|-----|
| L6          | 35  |
| L9          | 40  |
| L12         | 45  |
| L15         | 50  |

Linear-by-5 ramp. Rationale: the L15 push is the most expensive credit-wise
and the player should require their full target hit on average
(Q=50 corresponds to "rolls at slider target on average" — see §3.2). Earlier
pushes are slightly forgiving because the sample is smaller and noisier; a
mod with absolute_quality=37 might still grow into something good. But the
hard floor is 35: nothing below that ever earns credits.

A mod that **fails** a Stage 2 gate → verdict `SELL`. Pass → set
`target_level` = next milestone, verdict stays `UPGRADE`.

### 2.3 What each tier looks like end-to-end

| Tier   | Below L6      | L6 gate         | L9 gate         | L12 gate        | L15+      |
|--------|---------------|-----------------|-----------------|-----------------|-----------|
| Grey   | level to L6   | Stage 1 (2 vis) | Stage 1 (3 vis) | Stage 1 (4 vis) | Stage 2 push to L15 (Q=50) → Slice |
| Green  | level to L6   | Stage 1 (3 vis) | **Stage 2 enters** Q=40 push to L12 | Stage 2 Q=45 push to L15 | Slice |
| Blue   | level to L6   | **Stage 2 enters** Q=35 push to L9 | Stage 2 Q=40 push to L12 | Stage 2 Q=45 push to L15 | Slice |
| Purple | (no gate)     | Stage 2 Q=35 push to L9 | Stage 2 Q=40 push to L12 | Stage 2 Q=45 push to L15 | Slice |
| Gold   | (Stage 2 from L1) | Q=35 push to L9 | Q=40 push to L12 | Q=45 push to L15 | Slice |

Wait — Grey is special. Grey only enters scoring zone at L12. At L12, all 4
secondaries are revealed and Stage 1 gate has been passed; the player is
deciding whether to push to L15. That's a Stage 2 quality gate at Q=50 (since
"push to L15" is the only Stage 2 decision for Grey).

So for Grey: Stage 1 at L6 (need ≥1 req of 2 visible), Stage 1 at L9
(need ≥2 req of 3 visible), Stage 1 at L12 (need ≥3 req of 4 visible) AND
Stage 2 at L12 (absolute_quality ≥ 50 to push to L15). Both must pass at L12.

(Treat L12 Grey as: first run Stage 1 to verify required-count, then run
Stage 2 Q=50 to verify quality. If either fails → SELL.)

Purple at L3: same pattern. Stage 1 at L3 (need ≥3 req of 4 visible) AND
Stage 2 at L3 (Q=35 to push to L6). Both must pass.

Gold at L1: only Stage 2, since the rules-based check happens once at the
"scoring zone enters" moment.

Actually simpler rule: **at every milestone in scoring zone, both gates fire.**
Stage 1's rules check (since all 4 are visible, this is just the
existing engine's secondary check) AND Stage 2's quality check against the
appropriate Q.

---

## 3. Context the implementer needs

### 3.1 Mod level mechanics (SWGOH)

- Mod levels are **only 1, 3, 6, 9, 12, 15**. Intermediate levels (2, 4, 5,
  7, 8, 10, 11, 13, 14) **do not exist in the game**.
- 5-dot mods reveal secondaries on a tier-dependent schedule (see
  `FIRST_EVAL_LEVEL` table in `evaluationEngine.ts:17-23`).
- 6-dot mods always have all 4 secondaries visible and are evaluable at every
  level. **They are not affected by this redesign** — they keep the existing
  Slice / Deploy logic.
- Primary stat is fixed at mod creation. Square always has Offense%, Diamond
  always has Defense%, Circle always has Health% or Protection%. Arrow,
  Triangle, Cross have variable primaries.

### 3.2 What `absolute_quality` means

From `src/utils/modScorer.ts`. The score is per-roll normalized:

- Player sets a slider per (variant × stat) of "efficiency you'd be happy to
  hit." Slider value 1-99, stored as 0-1 float.
- The scoring curve (`curveScore`, lines 21-27) returns 50 points at a roll
  that hits target, 100 points at 100% efficiency, scales linearly between.
- Per-stat classification multiplier: Required = 1.0, Complementary = 0.4,
  Neutral = 0.1.
- `absolute_quality = (total / theoreticalMax) * 100` → 0-100 scale.

**Implication: `absolute_quality = 50` means "this mod's rolls hit the
player's slider target on average."** That is the natural breakeven, which
is why the L15 push gate is Q=50.

### 3.3 What the existing rule-engine formula already does

`src/utils/evaluationEngine.ts:96-144` — `checkSecondary`. It already
implements:

```ts
const minRequired = visibleCount - (adjusted ? 2 : 1);
```

Used once today (at FIRST_EVAL_LEVEL). The redesign **runs this same formula
at every milestone**, with one tiny tweak: add a `max(1, …)` floor so the
threshold never drops below 1 (owner's L6 caveat — without the floor, a
Grey-L6 with primary-on-required would have threshold=0 and auto-pass with no
required secondaries visible at all).

Variants with 5+ Required-classified stats: formula applies the same; the
edge cases just don't bite because the visible-count side stays small.
No special-case code needed.

---

## 4. Implementation plan

### 4.1 `src/utils/evaluationEngine.ts` — rewrite `evaluateMod`

Replace the current single-gate logic (lines 185-266) with the chain.

Skeleton:

```ts
export function evaluateMod(
  mod: ParsedMod,
  evaluation: Evaluation,
  statDefs: StatDefinition[]
): VerdictResult {
  // 1-4 dot legacy: unchanged, auto-sell.
  if (mod.rarity < 5) return { verdict: 'SELL', reason: '…' };

  // Config lookup: unchanged.
  const config = evaluation.mod_set_configs.find(c => c.set_id === mod.set_id);
  if (!config || config.variants.length === 0) return { verdict: 'UNCONFIGURED' };

  // 6-dot mods: keep existing logic (single evaluation, hand off to slice/deploy).
  if (mod.rarity === 6) {
    return existingSixDotEvaluation(mod, evaluation, statDefs);
  }

  // 5-dot mods: new gate-chain logic.
  // Below L6: just level, no gate.
  if (mod.level < 6) {
    return { verdict: 'UPGRADE', target_level: 6, reason: 'level to L6 before any judgment' };
  }

  // Primary check (variable-primary slots only): unchanged. Fail → SELL.
  // (Square/Diamond/Circle auto-pass; see SHAPES_FIXED_PRIMARY.)
  // Run against EVERY variant; if any variant accepts the primary, continue.

  // Run the gate chain on each variant, pick the winning variant.
  // For each variant:
  //   - Run Stage 1 gate (rules) at the current level using updated formula
  //     `max(1, visible - adjustment)`. Fail → that variant SELLs.
  //   - If at or above tier's FIRST_EVAL_LEVEL, also run Stage 2 gate
  //     using Q = QUALITY_RAMP[targetLevel]. Fail → that variant SELLs.
  //   - If both pass → that variant PASSES with target_level = next milestone.
  //
  // If no variant passes any chain: verdict SELL with the most informative
  //   failure reason across variants (e.g. "Grey L9 gate: only 1 of 3
  //   required visible (need ≥2)").
  // If any variant passes:
  //   - Tiebreak by complementary count then variant insertion order
  //     (same as today, lines 232-244).
  //   - Verdict UPGRADE with target_level, winning_variant_id,
  //     winning_variant_name, all_results.

  // L15 5-dot or 6-dot at any tier: existing slice/deploy handoff stays.
}
```

Add a constant block at the top of the file:

```ts
const QUALITY_RAMP: Record<number, number> = {
  6: 35,
  9: 40,
  12: 45,
  15: 50,
};

function nextMilestone(level: number): number { /* unchanged */ }
function isInScoringZone(rarity: number, tier: number, level: number): boolean {
  return level >= (FIRST_EVAL_LEVEL[tier] ?? 6);
}
```

Update `checkSecondary` (line 96) to apply the new floor:

```ts
const minRequired = Math.max(1, visibleCount - (adjusted ? 2 : 1));
```

Quality gate helper:

```ts
function checkQualityGate(
  absoluteQuality: number,
  targetLevel: number
): { pass: boolean; threshold: number } {
  const threshold = QUALITY_RAMP[targetLevel] ?? 50;
  return { pass: absoluteQuality >= threshold, threshold };
}
```

Note: `absolute_quality` is computed by `modScorer.ts` AFTER evaluateMod
runs (`scoreAll` is called separately and merges scores into verdicts). The
new flow needs scoring info during evaluation. Two ways to handle this:

- **(a) Compute score inline in evaluateMod.** Move/duplicate scoring logic
  so each variant's score is computable during gate-chain evaluation.
- **(b) Two-pass evaluation.** Run a "passes rules" pre-pass, then `scoreAll`
  (existing), then a "applies quality gates" post-pass that may flip
  UPGRADE → SELL based on score. Cleaner separation but adds a pass.

**Recommendation: (b).** Less risk of duplicating scoring logic. The
post-pass is simple: iterate verdicts, for each UPGRADE with target_level,
check `absolute_quality >= QUALITY_RAMP[target_level]`. If fail, swap to
SELL with reason like `"Q gate L${target_level}: absolute_quality
${score} < ${threshold}"`.

### 4.2 `src/utils/cohortRanking.ts` — simplify Level cohort

The Level cohort's relative ranking (Push / Keep / Consider-Selling bands)
becomes meaningless under the new model — every mod is judged individually
against absolute thresholds. So:

- Remove the `'level'` case from `cohortKey` (line 60-61) so Level mods get
  `cohortKey = null`.
- The band assignment in `actionOf` and downstream — Level mods should not
  appear in the ranked-bands UI. They just have a `target_level` for the
  player to act on.
- Slice and Deploy cohorts **stay as-is** (relative ranking by stage+variant
  for slice; variant only for deploy).

`ActionBand` type stays; just won't be applied to Level-action mods.

### 4.3 `src/utils/scoringConstants.ts` — review

The constants `LEVEL_PUSH_ABSOLUTE_THRESHOLD`, `LEVEL_SELL_ABSOLUTE_THRESHOLD`
are replaced by `QUALITY_RAMP` in `evaluationEngine.ts`. Either:

- Delete them and migrate any other callers, OR
- Leave them but mark unused (cleaner: delete; less risk: leave with a
  comment).

`PUSH_PERCENTILE_THRESHOLD`, `SELL_PERCENTILE_THRESHOLD`,
`PUSH_ABSOLUTE_FLOOR`, `SELL_ABSOLUTE_CEILING`,
`MIN_COHORT_SIZE_FOR_RANKING` — keep, still used by Slice cohort ranking.

### 4.4 UI — `src/components/mod/OverviewView.tsx` and `ActionSubTabs.tsx`

The per-stage drilldown currently groups Level / Slice / Deploy / Pre-Eval
mods under each stage section. With the new model:

- **Level action** mods need to be regroupable by `target_level` instead of
  by score-band. Group by `target_level` (e.g. "Push to L9: 12 mods", "Push
  to L12: 5 mods", "Push to L15: 3 mods") — these are direct to-do lists.
- **No ranked bands** for Level mods. Just the list.
- **Slice / Deploy** sections keep their existing percentile-banded display.
- **Pre-Eval** shrinks — now only mods at L1/L3 5-dot for tiers where L6 is
  the first gate. Most stages will have empty Pre-Eval sections.
- The "Consider Selling" relative band stops applying to Level mods. It may
  still apply to Slice mods (which keep cohort ranking).

The `InventoryOverview` component built earlier (the per-shape summary table)
**stays as-is** — its counts are computed off `actionOf(mod, verdict)` which
still returns the right action. The Sell Pile count will go up; the Level
count will drop or stay same depending on inventory.

### 4.5 Sell reasons (locked from owner)

Sell Pile entries get explicit per-gate reason strings:

- Stage 1 fail: `"Grey L9 gate: 1 of 3 visible are Required (need ≥2)"`
- Stage 2 fail: `"L12 quality gate: absolute_quality 38 < 45"`
- Primary fail: existing `"Primary stat mismatch"` (unchanged)
- Unconfigured / 1-4 dot: existing reasons (unchanged)

Surface these in the per-mod modal and Sell Pile filter view.

---

## 5. Files NOT to change

- `src/services/modLedgerApi.ts` — backend client, no changes needed.
- `src/services/gameDataApi.ts` — stat definitions, no changes.
- `src/services/evaluationStorage.ts` — local-storage layer, no changes.
- `src/utils/modScorer.ts` — scoring formula and slider math are correct;
  the design relies on `absolute_quality` being valid as-is.
- `src/utils/modSpriteConfig.ts` — sprite layout, no changes.
- `src/contexts/*.tsx` — state contexts unchanged.
- `astrogators-shared-ui` — no changes (per submodule rule).
- `mod-ledger` backend — no changes (per submodule rule).

If a task seems to require changes outside `mod-ledger-ui/`, **stop and ask**
per CLAUDE.md scope rule.

---

## 6. Edge cases the implementer must handle

### 6.1 Multi-variant evaluation

A variant config can declare multiple variants per mod set. Today the engine
runs each variant and picks the winning one. The new gate chain must do the
same — for each variant, run the chain at the mod's current level, pick the
variant whose chain passes. Tiebreak by complementary count then variant
insertion order (existing logic).

### 6.2 No variant passes

If every variant's chain ends in SELL, the engine returns verdict SELL with
the **most informative** reason — i.e. the variant that came closest. One
useful heuristic: pick the variant where the failing gate was at the highest
level (the mod got furthest in that variant's chain).

### 6.3 The floor-of-1 on Stage 1 threshold

Owner clarification: at L6, even when primary-on-required adjustment applies,
the threshold must be ≥1. Apply `Math.max(1, …)` to the threshold formula.
This means a Grey-L6 (2 visible) with primary-adjusted lands at threshold=1
instead of 0. Without the floor, such a mod would auto-pass with zero
required secondaries — owner explicitly rejected that.

### 6.4 Variants with zero Required stats

Existing engine auto-passes when `requiredStatIds.size === 0`
(`evaluationEngine.ts:123-125`). Keep this behavior — Stage 1 trivially
passes. Stage 2 still runs and may reject on quality alone.

### 6.5 Variants with 5+ Required stats

No special handling. Formula applies the same. Owner confirmed.

### 6.6 6-dot mods

Not affected by this redesign. Keep existing logic. They have all 4
secondaries visible at every level, so the gate-chain concept (which depends
on reveal schedule) doesn't apply. The current `PASS_RULES` → Slice / Deploy
flow stays.

### 6.7 1-4 dot legacy mods

Auto-SELL unchanged (`evaluationEngine.ts:191-196`).

---

## 7. Testing scenarios

Manual or unit-test scenarios to verify the implementation:

1. **Grey L6, 2 visible, both Required** → Stage 1 pass, target_level=9.
2. **Grey L6, 2 visible, 0 Required** → SELL with reason
   `"Grey L6 gate: 0 of 2 visible are Required (need ≥1)"`.
3. **Grey L6, 2 visible, 0 Required, but primary IS a Required stat
   (Square-Offense in offense variant)** → SELL (floor of 1 kicks in:
   `max(1, 2-2) = 1`, 0 < 1, fail).
4. **Grey L12, 4 visible, 3 Required, absolute_quality=60** → Stage 1 pass,
   Stage 2 Q=50 pass → UPGRADE target_level=15.
5. **Grey L12, 4 visible, 3 Required, absolute_quality=42** → Stage 1 pass,
   Stage 2 Q=50 FAIL → SELL.
6. **Blue L6, 4 visible, 3 Required, absolute_quality=37** → Stage 1 pass,
   Stage 2 Q=35 pass → UPGRADE target_level=9.
7. **Blue L9, 4 visible, 3 Required, absolute_quality=37** → Stage 1 pass,
   Stage 2 Q=40 FAIL → SELL.
8. **Gold L1, 4 visible, 4 Required, absolute_quality=70** → UPGRADE
   target_level=3.
   (Wait: Gold goes L1 → L3 → L6 → L9 → L12 → L15. But target_level should
   be the next *milestone*, not next valid level. Per existing
   `nextMilestone` helper, from L1 the next milestone is L3. So
   target_level=3.)
9. **Purple L3, 4 visible, 4 Required, absolute_quality=20** → Stage 1 pass,
   Stage 2 Q=35 FAIL → SELL.
10. **5-dot Grey L1** → UPGRADE target_level=6 with reason "level to L6
    before any judgment" (no Stage 1 or 2 yet).
11. **6-dot Gold L15** → existing Deploy flow (untouched).
12. **5-dot Gold L15 passing rules** → existing Slice flow (handoff after
    chain completes).

---

## 8. Open questions

None at design time. All locked with owner. The implementer can proceed
without further design clarification. If you find a genuinely undecided
fork mid-implementation, stop and ask before guessing.

---

## 9. Quick reference — the locked decisions

| Decision | Value |
|---|---|
| Threshold formula (Stage 1) | `max(1, visible − (primaryOnRequired ? 2 : 1))` |
| Floor on threshold | 1 |
| Quality ramp (Stage 2) | L6→35, L9→40, L12→45, L15→50 |
| First-gate level | L6 (universal — below L6 just level) |
| Failed gate outcome | SELL (no Hold) |
| Per-gate sell reasons | Yes, explicit |
| Slice / Deploy cohorts | Unchanged (still relative-ranked) |
| 6-dot mods | Unchanged |
| `absolute_quality` formula | Unchanged |
| Roll-target sliders | Unchanged (still the source of truth for "good") |
| Pre-Eval bucket | Shrinks; only contains L1/L3 5-dot mods that haven't reached L6 |

---

## 10. Submodule reminder

This change stays entirely inside `mod-ledger-ui/`. Do not edit the
`mod-ledger` backend, `astrogators-shared-ui`, or any sibling submodule. If
the implementation seems to require touching them, **stop and ask** per
`mod-ledger-ui/CLAUDE.md` scope rule. The submodule boundary is intentional
blast-radius containment.
