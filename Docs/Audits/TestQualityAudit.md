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

## Domain rules

- **Ownership:** battle/effects → `tests/lib/battle`, `tests/lib/game-data`; gear → `tests/lib/gear` + store tests; saves/migrations → storage + `tests/architecture/`; orchestration → stores/shell/navigation tests. Reuse page objects (`tests/pages/`) and helpers; introduce support abstractions only when they clarify a real interaction or invariant.
- **Quality:** assert outcomes (HP deltas, events, reloaded save shape), not implementation details or log fingerprints; no "function exists" assertions; no soft-fails; seeded RNG for battle edges; reuse corrupt/partial save fixtures.
- **Allowed E2E fixes:** actively retire low- and medium-value journeys under the shared test value policy; add missing high-value critical journeys; shorten waits after deterministic bootstrap; place journeys in the configured tiers without copying them solely for scheduling; stable roles/test ids over text/index hunts; repair isolation; improve diagnostics.

## Known signals

- `waitForTimeout`/`sleep(` in tests; `.nth(n)` chains or localized-text-only queries; QA-shortcut selectors.
- Same journey asserted in both `@critical` and a slower tier; specs passing alone but failing after siblings (state leakage).
- Exact catalog counts, pixel tables, plain-struct round trips, empty/commented tests, hidden soft failures, multi-second unit waits.
- Assertions on error message text instead of typed kinds; mutation-resilient suites; uncontrolled clocks/RNG/shared state.
- Coverage gaps (discovery: `npm run test:coverage`) on `src/lib/battle`, `src/lib/gear`, storage, validation branches; `npm run test:e2e:audit` timing/flake reports as supporting evidence.
