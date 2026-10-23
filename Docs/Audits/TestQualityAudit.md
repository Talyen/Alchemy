# Test Quality Audit

**Goal:** Maximize portfolio trustworthiness and defect detection while controlling redundant LOC, runtime, flake, and maintenance cost — across Vitest units and Playwright journeys.

Conventions: [tests/e2e/README.md](../../tests/e2e/README.md) (helpers, tags, fixtures), [CONTRIBUTING.md](../../CONTRIBUTING.md) (changed paths, CI tiers), and [test value](../../CONTRIBUTING.md#test-value-and-coverage-strategy) (coverage selection, consolidation, retirement, and reporting).

## Scope

| Concern         | Owns                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------- |
| Unit portfolio  | Duplicate/weaker/implementation-detail/slow/nondeterministic/false-positive cases; coverage gaps at semantic owners |
| E2E reliability | Playwright flake, isolation, diagnostic signal, tier fit, duplicate journeys                                        |

Product interaction defects → UIConsistency; structural test-support mass → Simplification.

## Hard stops

- No dev-only QA shortcuts (Skip Combat / Unlock All selectors); use documented helpers and flows.
- Follow [tests/e2e/README.md](../../tests/e2e/README.md) for current fixture and animation-canary requirements; preserve real timing where timing is the behavior under test.
- Do not re-run full suites to hunt flakes; re-run only the suspect cluster.

## Investigation and evidence

Map consequential failure modes to current assertions. For a suspect test, show a
plausible broken implementation that would pass; use a focused temporary mutation
or known regression when useful, restoring it before handoff. Broad mutation testing
is optional.

For flake, distinguish product races from timing, fixture, isolation and environment
failures. Reproduce the relevant ordering/concurrency; one isolated pass cannot
establish a parallel failure fixed. Do not weaken assertions or add retries to hide it.

For overlaps, compare surviving failure detection, layer and CI tier under the
[test value policy](../../CONTRIBUTING.md#test-value-and-coverage-strategy).
Verify changed tests detect the intended failure and pass correct behavior. Report
runtime conditions and repetitions; bounded success is not a zero-flake guarantee.

## Investigation leads

Assert outcomes such as Health deltas, events and reloaded saves, never function
existence or log fingerprints. Do not use soft-failing assertions.

| Signal                                                                                 | Question / supported remedy                                                                                                                                            |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exact catalog counts, pixel tables, trivial round trips, empty tests or log assertions | What consequential broken behavior would pass? Prefer actual outcomes and the cheapest effective layer; seed combat randomness and reuse corrupt/partial save fixtures |
| `waitForTimeout`, index chains, text-only localization queries, QA shortcuts           | Can stable roles/test IDs, documented page objects/helpers and state readiness make the journey reliable without bypassing real behavior?                              |
| Duplicate journeys across tiers, isolated-only success, uncontrolled clocks/state      | Compare distinct failure detection, CI placement and isolation; never copy a journey only for scheduling                                                               |
| Weak/soft-failing assertions or surprising coverage gaps                               | Use a focused temporary mutation or known regression; broad mutation/coverage sweeps are optional, not automatic requirements                                          |
| Slow or high-upkeep scenarios                                                          | Retire weak tests within the shared policy, strengthen high-value protection, shorten deterministic waits and improve diagnostics; retain real-timing canaries         |

Tests follow source owners: battle/effects under `tests/lib/battle` and
`tests/lib/game-data`, Gear under `tests/lib/gear` plus stores, saves under storage
and `tests/architecture`, orchestration under stores/shell/navigation.
Use `tests/pages` and existing helpers; add support abstractions only for a concrete
interaction/invariant. `npm run test:coverage` and `npm run test:e2e:audit` provide
supporting discovery evidence, not targets or proof of test value.
