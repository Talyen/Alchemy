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
- Follow [tests/e2e/README.md](../../tests/e2e/README.md) for current fixture and animation-canary requirements; preserve real timing where timing is the behavior under test.
- Do not re-run full suites to hunt flakes; re-run only the suspect cluster. Do not treat deletion as inherently preferable to adding a missing semantic owner.

## Investigation and evidence

Map important failure modes to their current tests before adding or deleting coverage. A gap means a concrete risky behavior has no trustworthy assertion, not simply that a line is uncovered. For a suspicious test, identify a plausible broken implementation that would still pass. Use a focused temporary mutation or a known regression when useful, and restore it before handoff; do not require broad mutation testing for every finding.

For flake, inspect failure artifacts and distinguish a product race from timing, isolation, fixture, or environment problems. Reproduce the suspect scenario and relevant ordering or concurrency conditions; an isolated pass does not prove a parallel failure fixed. Never weaken an assertion or add retries just to hide the failure.

Before removing overlap, identify the surviving assertion and prove it covers the same failure mode at the required layer and CI tier. Unit rules and browser wiring can exercise similar behavior while protecting different risks. Prioritize false confidence in critical behavior and blocked verification over redundant assertions or naming.

Verify changed tests detect the intended failure and pass on correct behavior. For runtime or flake claims, compare the same scenario and report repetitions and conditions; bounded success is evidence, not a guarantee of zero flakes.

## Domain rules

- **Ownership:** battle/effects → `tests/lib/battle`, `tests/lib/game-data`; gear → `tests/lib/gear` + store tests; saves/migrations → storage + `tests/architecture/`; orchestration → stores/shell/navigation tests. Reuse page objects (`tests/pages/`) and helpers; introduce support abstractions only when they clarify a real interaction or invariant.
- **Quality:** assert outcomes (HP deltas, events, reloaded save shape), not implementation details or log fingerprints; no "function exists" assertions; no soft-fails; seeded RNG for battle edges; reuse corrupt/partial save fixtures.
- **Fixtures:** share builders when they preserve a common invariant or prevent demonstrated drift; keep scenario-specific setup legible. Judge parameterized cases by the distinct behaviors and failure modes they exercise, not their count.
- **Allowed E2E fixes:** delete duplicate journeys; add missing critical journeys; shorten waits after deterministic bootstrap; place journeys in the configured tiers without copying them solely for scheduling; stable roles/test ids over text/index hunts; repair isolation; improve diagnostics.
- Reduction applies to redundant coverage only; add tests anywhere a confirmed risk lacks a trustworthy owner — extend an existing suite before creating one.

## Known signals

- `waitForTimeout`/`sleep(` in tests; `.nth(n)` chains or localized-text-only queries; QA-shortcut selectors.
- Same journey asserted in both `@critical` and a slower tier; specs passing alone but failing after siblings (state leakage).
- Exact catalog counts, pixel tables, plain-struct round trips, empty/commented tests, hidden soft failures, multi-second unit waits.
- Assertions on error message text instead of typed kinds; mutation-resilient suites; uncontrolled clocks/RNG/shared state.
- Coverage gaps (discovery: `npm run test:coverage`) on `src/lib/battle`, `src/lib/gear`, storage, validation branches; `npm run test:e2e:audit` timing/flake reports as supporting evidence.
