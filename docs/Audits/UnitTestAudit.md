# Unit Test Portfolio Audit

**Goal:** Reduce unit test LOC, declarations, expanded cases, and runtime while preserving unique high-value semantic owners.

Conventions: [CONTRIBUTING.md](../../CONTRIBUTING.md). Architecture owners: [ARCHITECTURE.md](../ARCHITECTURE.md).

## Intent

Confirm duplicate, weaker, implementation-detail, slow, or over-expanded cases with a stronger owner elsewhere. Write a plan to fix all identified test portfolio issues (breaking into phases if the scope is large). A clean pass is valid; do not add coverage to manufacture value.

## Hard stops

- Do not invent coverage % CI gates unless already configured. `npm run test:coverage` is a discovery tool; prefer behavior-targeted tests over chasing line %.
- Do not optimize declaration count alone: parameterized tables may hide more executed cases and runtime.
- Preserve unique battle, persistence, migration, architecture-guard, and player-flow owners. Do not delete a failing journey merely to reduce the portfolio.
- E2E portfolio and Playwright flake work belong in `E2ETestQualityAudit.md`.

## Fix priority

**Tier 1:** same assertion owned twice; weaker feature-shell echoes of `src/lib` owners; exact catalog counts, pixel tables, plain-struct round trips, empty/commented tests, hidden soft failures, or multi-second waits.

**Tier 2:** merge sibling cases only when it reduces executed work or setup cost; reuse an existing fixture; inject short intervals; move an assertion to its cheaper semantic owner and delete the weaker copy.

**Tier 3 (only if quick):** drop redundant assertions inside a kept test; naming/helper cleanup with demonstrated value.

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

Directional coverage interest: branch coverage on `src/lib/battle`, `src/lib/gear`, `src/features/alchemy/shared/storage`, and `src/lib/validation` — add behavior-targeted tests for untested exports; do not pad with dead assertions.

## Probe hints

- **Assertion density outliers:** `rg --no-filename -c -e '^\s*(expect|assert)' tests --type ts | sort -t: -k2 -n | head -50`
- **Trivial / empty tests:** files with zero meaningful assertions or commented-out bodies.
- **Wall-clock sleeps in unit tests:** `rg -n 'setTimeout|waitForTimeout|sleep\(' tests -g '*.test.ts' -g '*.test.tsx'`
- **Duplicate tier ownership:** feature tests that only restate `tests/lib/battle` matrices.
- **Coverage gaps (discovery):** `npm run test:coverage` — review weak branches on core `src/lib` modules.
- **Fragile string matching:** assertions on error message text instead of typed error kinds / result shapes.
