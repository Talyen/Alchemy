# Unit Test Portfolio Audit

**Goal:** Reduce unit test LOC, declarations, expanded cases, and runtime while preserving unique high-value semantic owners.

Conventions: [CONTRIBUTING.md](../../CONTRIBUTING.md). Architecture owners: [ARCHITECTURE.md](../ARCHITECTURE.md).

## Intent

Confirm duplicate, weaker, implementation-detail, slow, or over-expanded cases with a stronger owner elsewhere, then fix them. A clean pass is valid; do not add coverage to manufacture value. If the scope is large, phase the plan.

## Hard stops

- Do not invent coverage % CI gates unless already configured. Coverage reports are discovery tools; prefer behavior-targeted tests over chasing line %.
- Do not optimize declaration count alone: parameterized tables may hide more executed cases and runtime.
- Preserve unique battle, persistence, migration, architecture-guard, and player-flow owners. Do not delete a failing journey merely to reduce the portfolio.
- E2E portfolio and Playwright flake work belong in `E2ETestQualityAudit.md`.

## Fix priority

Prefer highest-impact portfolio waste first:

- **Highest:** same assertion owned twice; weaker feature-shell echoes of `src/lib` owners; exact catalog counts, pixel tables, plain-struct round trips, empty/commented tests, hidden soft failures, or multi-second waits.
- **Next:** merge sibling cases only when it reduces executed work or setup cost; reuse an existing fixture; inject short intervals; move an assertion to its cheaper semantic owner and delete the weaker copy.
- **Only if quick:** drop redundant assertions inside a kept test; naming/helper cleanup with demonstrated value.

## Domain rules

**Coverage ownership:**

| Concern                                      | Prefer owner                                                                                                         |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Battle rules / effects                       | `tests/lib/battle`, `tests/lib/game-data`                                                                            |
| Gear rules                                   | `tests/lib/gear` + `tests/features/alchemy/shared/stores/gear-*.test.ts`                                             |
| Save / migrations                            | `tests/features/alchemy/shared/storage`, `tests/architecture/`                                                       |
| Run orchestration                            | `tests/features/alchemy/shared/stores`, `tests/features/alchemy/shell`, `tests/features/alchemy/run-loop/navigation` |
| Structural / deleted-module / changelog sync | `tests/architecture/`                                                                                                |

**Quality:** assert outcomes (HP deltas, events, reloaded save shape), not implementation details or log fingerprints; no trivial “function exists” / “returns defined” assertions; no soft-fail that hides errors.

**Fixtures:** reuse existing helpers under `tests/` rather than duplicating setup; extract shared fixtures when ≥3 call sites benefit.

Track authored declarations and expanded executions separately. A merge is successful only when it reduces duplication, runtime/setup, or maintenance surface—not merely the number of `it`/`test` calls.

**Reduction vs addition:** the reduction goal applies to _redundant_ coverage — duplicated owners, weaker echoes, over-expanded cases. It is not a license to whittle unique coverage across repeat runs. Adding tests is allowed only for confirmed behavioral gaps in the core modules below; everywhere else, prefer extending an existing semantic owner.

Directional coverage interest: branch coverage on `src/lib/battle`, `src/lib/gear`, `src/features/alchemy/shared/storage`, and `src/lib/validation` — add behavior-targeted tests for untested exports there; do not pad with dead assertions.

## Known signals

Optional discovery aids — choose your own probes.

- **Assertion density outliers:** unusually sparse or dense `expect`/`assert` counts across test files.
- **Trivial / empty tests:** files with zero meaningful assertions or commented-out bodies.
- **Wall-clock sleeps in unit tests:** `setTimeout` / `waitForTimeout` / `sleep(` in `*.test.ts(x)`.
- **Duplicate tier ownership:** feature tests that only restate `tests/lib/battle` matrices.
- **Coverage gaps (discovery):** `npm run test:coverage` — review weak branches on core `src/lib` modules.
- **Fragile string matching:** assertions on error message text instead of typed error kinds / result shapes.
