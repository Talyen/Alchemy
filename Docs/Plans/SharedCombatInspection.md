---
status: active
updated: 2026-10-22
---

# Share combat rules with battle inspection

## Objective

Make battle card inspection follow the same combat rules and ordering as live
resolution, without consuming gameplay RNG or promising uncertain outcomes.
Keep combat behavior, save shapes, and presentation timing stable during migration.

## Diagnosis

The largest architectural problem identified in this review is the second combat
interpreter inside battle inspection. The problem is duplicated ownership of rule
sequencing, rather than the size of any single module.

Live combat executes card setup in
[`card-play.ts`](../../src/lib/battle/card-play.ts), effects through
[`effect-handlers/registry.ts`](../../src/lib/battle/effect-handlers/registry.ts),
attack packets in [`damage.ts`](../../src/lib/battle/damage.ts), and hit consequences
in [`hit-resolution.ts`](../../src/lib/battle/hit-resolution.ts).
[`card-damage-inspection.ts`](../../src/lib/battle/card-damage-inspection.ts)
independently walks effects and reconstructs payment, hit consequences, status
buildup, mitigation, retaliation, and follow-up ordering in a 982-line module at
the reviewed base, `89ef8ddc1`.

There is already useful sharing: utility effects, resource rewards, Wishes,
Companions, and crowd-control helpers have reusable owners. Their hosts still
assemble substantial overlapping combat recipes. Changes to those recipes can
therefore require matching edits in inspection. Recent commits `8ff15db08`,
`6da20dbfb`, and `1362d35fb` include further preview corrections; they show an
ongoing maintenance cost despite that sharing.

Uncertainty is also encoded as ordinary concrete battle state.
`mergeKnownOutcomes` retains original field values when branch results disagree.
Later effects cannot distinguish those placeholders from known facts. A temporary
unit probe using a synthetic, supported effect sequence demonstrated this:

1. Start with zero Block and no damage bonuses.
2. A 50/50 effect grants either 4 or 8 Block.
3. A Physical attack deals damage equal to current Block.
4. Inspection returns an exact damage effect of 0; controlled live executions
   produce 4 and 8 damage.

This demonstrates an interpreter-level failure, rather than proving that this
exact sequence occurs on an authored card today. The probe passed after controlling
its RNG values to avoid unrelated Dodge outcomes. Four existing inspection suites
also passed, for 60 tests including the probe. The temporary probe was removed;
implementing the fix should add permanent outcome-based protection.

This ranks above the other boundaries inspected because it affects the core
player decision aid and compounds with combinations of Cards, Gear, Talents, and
Companions. The session aggregate is broad, but has explicit atomic publication,
immutable state, and lifetime ownership. The balance simulator calls production
combat resolution. Autoplay scoring is intentionally heuristic. Neither is as
direct a case of independently maintained combat truth as inspection.

## Intended boundaries

- Existing combat owners define eligibility, captured pre-hit facts, ordered
  mutations, reaction settlement, and defeat cutoffs once. Preserve synchronous,
  depth-first resolution as required by [battle rules](../GAME_RULES.md).
- Execution supplies seeded decisions and card sampling. Inspection supplies
  known decisions or explicit unresolved alternatives. Extend the existing
  resolution-port pattern only where these concrete consumers need it.
- A small inspection projection distinguishes exact values, bounded alternatives,
  and unknown values. Unknown facts must never be represented by the initial
  snapshot's concrete values. Keep correlated alternatives together until their
  dependent effects resolve; independently merging fields can invent impossible
  combinations.
- Capture offensive packet power separately from applied damage and resulting
  Health loss. Tooltips deliberately show power before defenses and critical
  strikes; intermediate state still needs actual guaranteed consequences to
  evaluate later packets. Do not compare all displayed values directly with
  combat-text damage.
- Keep projection types outside persisted battle state. Initially retain
  `getBattleDamageInspectionCard` as a compatibility adapter. Its presentation-only
  card copies must never enter live execution; any eventual replacement should
  update the description context and all three UI entry points together.

## Plan

### 1. Establish behavior and uncertainty contracts

- [ ] Add a permanent regression for the branch-dependent Block example. Cover
      a shared branch outcome, a later Health/kill threshold, and a dependent
      multi-hit effect so the tests distinguish exact, ranged, and unknown results.
- [ ] Preserve the current guarantees covered by the four inspection suites:
      payment, utility ordering, resource rewards, retaliation, and fatal cutoffs.
      Retain their independent expected results; shared implementation cannot be
      its own correctness oracle.
- [ ] Define the projection result and a coverage classification for every effect
      kind: resolved, branched, or explicitly unknown/deferred. An unhandled kind
      must not silently pass unchanged state into dependent calculations.
- [ ] Specify uncertain proc behavior, random card identities, future-turn
      effects, and guaranteed critical consequences separately from displayed
      critical power. Preserve existing authored descriptions where computation
      is unavailable instead of inventing exact values or new explanatory copy.

### 2. Share direct attack and hit sequencing

- [ ] Extract the overlapping attack recipe from `damage.ts` and inspection's
      `attack`, with `hit-resolution.ts` retaining ownership of hit consequences.
      Keep captured eligibility distinct from post-purge Health facts.
- [ ] Parameterize only decision/sampling boundaries and projection observation;
      rule ordering stays in the shared owner. Include flag consumption, purge,
      status buildup, rewards, detonation, follow-ups, Thorns, and reaction settlement.
- [ ] Migrate live execution first with identical outcomes, combat texts, and RNG
      draw order for fixed seeds. Then bind deterministic inspection to that same
      recipe and delete its corresponding copied stages in the same change.

### 3. Share effect and action sequencing

- [ ] Extend the existing effect registry and sequence owner so live and inspected
      effects use the same deterministic transitions and defeat boundaries.
      Migrate payment/pre-hit setup, hostile/self hits, and secondary hits in
      separate reviewable changes rather than expanding a single universal port.
- [ ] Reuse the existing Wish, Companion, utility, crowd-control, and resource
      owners. Preserve their explicit reaction boundaries and action-source
      eligibility; do not replace depth-first execution with an event queue.
- [ ] Remove each replaced `project*` recipe. Inspection should retain description
      mapping and uncertainty handling, with no separate combat-stage ordering.

### 4. Carry uncertainty through dependent effects

- [ ] Replace `mergeKnownOutcomes` with the projection contract. Fork supported
      alternatives through shared transitions; merge only facts proved equal or
      retain the alternatives needed by later effects.
- [ ] Bound work for nested chance branches, random amounts, and unknown draws.
      When the budget is reached, downgrade dependent results to unknown using
      the established rendering fallback. Never sample the live RNG to pick a
      plausible answer, silently drop alternatives, or claim endpoint evaluation
      bounds a nonlinear threshold calculation.
- [ ] Render 4–8 for the reproduced Block case. Cover correlated resources,
      threshold crossings, branch-local defeat, and uncertainty from fractional
      procs, not just explicit `chance` effects.

### 5. Finish migration and guard the ownership boundary

- [ ] Add focused differential tests: exact scenarios match shared offensive
      observations; deterministic state consequences match controlled live plays;
      bounded scenarios contain the enumerated supported outcomes. Independently
      assert critical/mitigation presentation conventions.
- [ ] Prove repeated inspection leaves the card, input snapshot, RNG counters,
      and session revision unchanged. Preserve deterministic execution replay,
      action-source eligibility, and reaction order across the migration.
- [ ] Add a focused architecture guard against inspection acquiring another
      independent effect dispatcher or attack recipe. Use exhaustive effect-kind
      classification alongside it; import restrictions alone cannot prove parity.
- [ ] Update [battle rules](../GAME_RULES.md) and the
      [handler guide](../../src/lib/game-data/effects/BATTLE_HANDLERS.md) with final
      ownership and the workflow for adding previewable mechanics. Remove this
      plan only after the implementation and its verification are complete.

## Verification and completion

Run focused battle unit suites at each migration stage, followed by
`npm run check -- <task-owned paths>` and `npm run docs:check` for documentation.
Select affected coverage with the [verifier](../../.agents/skills/verifier/SKILL.md)
and [verification policy](../../CONTRIBUTING.md#what-to-run-when-you-change).

Browser/Electron review, full static checks, and builds require an explicit local
execution request. Once authorized, exercise player card descriptions, card
inspection overlays, and enemy inspection through `npm run agent:browser`, checking
the same snapshot, input flow, and bounded projection behavior. Full CI validation
remains separate from local unit evidence.

Completion means deterministic combat and seeded draw order remain unchanged,
inspection consumes no gameplay RNG, uncertain values cannot become false exact
claims, and changing hit order or adding a deterministic effect requires one rules
implementation. Measure removal of duplicated recipes, not movement of lines into
more files. No save migration, store rewrite, combat DSL, or autoplay-policy change
is needed for this work.

## Notes

This is an implementation plan requested for future work; implementation has not
started. Keep it active while those steps remain unresolved. Durable ownership
rules belong in the linked canonical guides when the implementation lands.
