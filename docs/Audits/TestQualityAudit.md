# Test Quality Audit

Merges the former E2E Test Reliability & Signal (10) and Unit Test Portfolio (17) audits.

**Goal:** Maximize portfolio trustworthiness and defect detection while controlling redundant LOC, runtime, flake, and maintenance cost — across Vitest units and Playwright journeys.

Conventions: [tests/e2e/README.md](../../tests/e2e/README.md) (helpers, tags, fixtures), [CONTRIBUTING.md](../../CONTRIBUTING.md) (changed paths, CI tiers).

## Scope

| Concern         | Owns                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------- |
| Unit portfolio  | Duplicate/weaker/implementation-detail/slow/nondeterministic/false-positive cases; coverage gaps at semantic owners |
| E2E reliability | Playwright flake, isolation, diagnostic signal, tier fit, duplicate journeys                                        |

Product interaction defects → UIConsistency; structural test-support mass → Simplification.

## Hard stops

- No invented coverage-% or wall-clock budgets that conflict with configured gates and CONTRIBUTING tiers.
- Preserve unique battle, persistence, migration, architecture-guard, and player-flow owners; never delete a failing journey merely to shrink the portfolio.
- No dev-only QA shortcuts (Skip Combat / Unlock All selectors); use documented helpers and flows.
- Animation canaries import raw `@playwright/test` (never `fastBattle`); combat/flow specs use `./fixtures/e2e` with `runtimeErrors`.
- Do not re-run full suites to hunt flakes; re-run only the suspect cluster. Do not treat deletion as inherently preferable to adding a missing semantic owner.

## Priorities

| Sev | Criteria                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------- |
| P0  | Flaky CI failure; harness crash; double-owned assertion; silent save-path gap                                    |
| P1  | Clear runtime/flake win; weaker feature-shell echo of a `src/lib` owner; missing shipping-critical journey owner |
| P2  | Tier misplacement; duplicate coverage with real cost; false-positive assertions                                  |
| P3  | Consistency (helpers, naming); trivial                                                                           |

## Domain rules

- **Ownership:** battle/effects → `tests/lib/battle`, `tests/lib/game-data`; gear → `tests/lib/gear` + store tests; saves/migrations → storage + `tests/architecture/`; orchestration → stores/shell/navigation tests. Reuse page objects (`tests/pages/`) and helpers; no new page object for 1–2 call sites.
- **Quality:** assert outcomes (HP deltas, events, reloaded save shape), not implementation details or log fingerprints; no "function exists" assertions; no soft-fails; seeded RNG for battle edges; reuse corrupt/partial save fixtures.
- **Fixtures:** extract shared builders at three call sites, two with demonstrated drift, or one canonical invariant builder; track authored declarations separately from expanded executions.
- **Allowed E2E fixes:** delete duplicate journeys; add missing critical journeys; shorten waits after deterministic bootstrap; move multi-step assertions `@prepush` → `@critical` without retaining copies; stable roles/test ids over text/index hunts; repair isolation; improve diagnostics.
- Reduction applies to redundant coverage only; add tests anywhere a confirmed risk lacks a trustworthy owner — extend an existing suite before creating one.

## Known signals

- `waitForTimeout`/`sleep(` in tests; `.nth(n)` chains or localized-text-only queries; QA-shortcut selectors.
- Same journey asserted in both `@prepush` and a slower tier; specs passing alone but failing after siblings (state leakage).
- Exact catalog counts, pixel tables, plain-struct round trips, empty/commented tests, hidden soft failures, multi-second unit waits.
- Assertions on error message text instead of typed kinds; mutation-resilient suites; uncontrolled clocks/RNG/shared state.
- Coverage gaps (discovery: `npm run test:coverage`) on `src/lib/battle`, `src/lib/gear`, storage, validation branches; `npm run test:e2e:audit` timing/flake reports as supporting evidence.
