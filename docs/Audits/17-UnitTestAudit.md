# 17. Unit Test Portfolio Audit

**Goal:** Maximize unit-test portfolio trustworthiness and defect detection while controlling redundant LOC, expanded cases, runtime, and maintenance cost.

Conventions: [CONTRIBUTING.md](../../CONTRIBUTING.md). Architecture owners: [ARCHITECTURE.md](../ARCHITECTURE.md).

## Intent

Confirm duplicate, weaker, implementation-detail, slow, over-expanded, nondeterministic, or false-positive cases and fix them. Also confirm meaningful boundary, branch, mutation, or invariant gaps where regression risk lacks a semantic test owner. A clean pass is valid; do not add coverage to manufacture value, but permit net growth when it closes a demonstrated gap under the correct owner. Follow a confirmed ownership problem through its related fixtures, helpers, and sibling cases rather than optimizing one declaration in isolation. If the scope is large, phase the plan.

## Hard stops

- Do not invent coverage % CI gates unless already configured. Coverage reports are discovery tools; prefer behavior-targeted tests over chasing line %.
- Do not optimize declaration count alone: parameterized tables may hide more executed cases and runtime.
- Preserve unique battle, persistence, migration, architecture-guard, and player-flow owners. Do not delete a failing journey merely to reduce the portfolio.
- E2E portfolio and Playwright flake work belong in `10-E2ETestQualityAudit.md`.
- Do not preserve a low-value test merely to avoid net deletion, and do not reject a high-value missing test merely because the portfolio grows.

## Fix priority

Prefer highest-impact portfolio waste first:

- **Highest:** same assertion owned twice; weaker feature-shell echoes of `src/lib` owners; exact catalog counts, pixel tables, plain-struct round trips, empty/commented tests, hidden soft failures, or multi-second waits.
- **Next:** merge sibling cases only when it reduces executed work or setup cost; reuse an existing fixture; inject short intervals; move an assertion to its cheaper semantic owner and delete the weaker copy.
- **Only if quick:** drop redundant assertions inside a kept test; naming/helper cleanup with demonstrated value.

## Domain rules

**Coverage ownership:**

| Concern                                           | Prefer owner                                                                                                         |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Battle rules / effects                            | `tests/lib/battle`, `tests/lib/game-data`                                                                            |
| Gear rules                                        | `tests/lib/gear` + `tests/features/alchemy/shared/stores/gear-*.test.ts`                                             |
| Save / migrations                                 | `tests/features/alchemy/shared/storage`, `tests/architecture/`                                                       |
| Run orchestration                                 | `tests/features/alchemy/shared/stores`, `tests/features/alchemy/shell`, `tests/features/alchemy/run-loop/navigation` |
| Structural / deleted-module / changelog ownership | `tests/architecture/`                                                                                                |

**Quality:** assert outcomes (HP deltas, events, reloaded save shape), not implementation details or log fingerprints; no trivial “function exists” / “returns defined” assertions; no soft-fail that hides errors.

**Fixtures:** reuse existing helpers under `tests/` rather than duplicating setup; extract shared fixtures when at least three call sites benefit, two callers have demonstrated drift/cost, or one invariant requires a single canonical builder.

Track authored declarations and expanded executions separately. A merge is successful only when it reduces duplication, runtime/setup, or maintenance surface—not merely the number of `it`/`test` calls.

**Reduction vs addition:** reduction applies to _redundant_ coverage — duplicated owners, weaker echoes, over-expanded cases. It is not a license to whittle unique coverage across repeat runs. Adding tests is allowed anywhere a confirmed correctness risk, changed invariant, or historically fragile behavior lacks a trustworthy semantic owner; prefer extending an existing owner before creating a new suite.

Directional coverage interest: branch coverage on `src/lib/battle`, `src/lib/gear`, `src/features/alchemy/shared/storage`, and `src/lib/validation` — add behavior-targeted tests for untested exports there; do not pad with dead assertions.

## Known signals

Optional discovery aids — choose your own probes.

- **Assertion density outliers:** unusually sparse or dense `expect`/`assert` counts across test files.
- **Trivial / empty tests:** files with zero meaningful assertions or commented-out bodies.
- **Wall-clock sleeps in unit tests:** `setTimeout` / `waitForTimeout` / `sleep(` in `*.test.ts(x)`.
- **Duplicate tier ownership:** feature tests that only restate `tests/lib/battle` matrices.
- **Coverage gaps (discovery):** `npm run test:coverage` — review weak branches on core `src/lib` modules.
- **Fragile string matching:** assertions on error message text instead of typed error kinds / result shapes.
- **Boundary and branch gaps:** meaningful empty, maximum, failure, retry, resume, or alternate-variant behavior lacks an assertion under its semantic owner.
- **False-positive tests:** assertions can pass without exercising the intended transition, mutation, or failure path.
- **Nondeterminism:** uncontrolled clocks, RNG, shared state, ordering, or retries make results unstable or mask defects.
- **Fixture coupling:** broad setup creates incidental state, bypasses production invariants, or forces unrelated edits for one behavior change.
- **Mutation resilience:** a plausible change to a rule, predicate, mapping, or error branch would leave the suite green despite changing promised behavior.
- **Recently changed invariants:** implementation or architecture changed without updating or establishing the semantic test that owns the new contract.
