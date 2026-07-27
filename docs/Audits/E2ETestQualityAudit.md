# E2E Test Reliability & Signal Audit

**Goal:** Improve confirmed Playwright reliability, signal, and tier fit without weakening product coverage.

Conventions: [CONTRIBUTING.md](../../CONTRIBUTING.md) (E2E helpers, tags, CI parity).

## Intent

Confirm P0–P2 candidates across suites and address them, preferring delete → merge → move to a cheaper tier → shorten. Add page-object or harness surface only when at least three current uses become shorter or one enforced test boundary requires it. If the scope is large, phase the plan.

## Hard stops

- Do not invent wall-clock budgets that conflict with CONTRIBUTING / lefthook tiers.
- Do not expand into unit-test portfolio cleanup (`UnitTestAudit.md`).
- Do not add or rely on dev-only QA shortcuts (Skip Combat / Unlock All selectors). Prefer real combat/card helpers and flows documented in CONTRIBUTING.
- Animation canaries must use raw `@playwright/test` — never `enableFastMode` / `fastBattle`.
- Electron / desktop E2E is optional verification when available — do not fail the audit solely because Electron tooling is absent (see [README.md](README.md) toolchain limits).

## Tier rules

Tier meaning and commands live in [CONTRIBUTING.md](../../CONTRIBUTING.md). Intent here:

| Tier        | Belongs here                                         |
| ----------- | ---------------------------------------------------- |
| Pre-push    | Fast shell/entry canaries + one animation canary     |
| Critical    | State-changing journeys required before main         |
| Broader E2E | Longer journeys; do not duplicate prepush assertions |
| Unit        | Rules/state — not full-app spins                     |

`@smoke` is **not** the pre-push gate — prefer `@prepush` / `@critical` for shipping canaries. Do not re-add layout/chrome, copy catalogs, or prepush+critical duplicates. Prefer bootstrap helpers over brittle menu navigation when a helper already exists.

## Scoring

| Score | Criteria                                                                |
| ----- | ----------------------------------------------------------------------- |
| P0    | Flaky CI failure, crash in test harness, runtimeErrors fixture failures |
| P1    | Clear multi-second savings or flaky class fix                           |
| P2    | Tier misplacement / duplicate coverage with real cost                   |
| P3    | Consistency (helpers, naming)                                           |
| P4    | Nice-to-have — skip unless trivial                                      |

## Domain rules

Reuse existing page objects under `tests/pages/` and helpers under `tests/e2e/` / `tests/helpers.ts`; do not extract a new page object for one or two call sites. Product interaction defects belong in `UIInteractionFeedbackAudit.md`.

**Allowed fixes:** delete duplicate journeys/assertions; shorten excessive waits after deterministic bootstrap; move multi-step assertions from `@prepush` → `@critical` without retaining the prepush copy; replace text/index hunts with stable roles/test ids; reuse page objects consistently; remove QA-shortcut selectors.

## Known signals

Optional discovery aids — choose your own probes.

- **Hardcoded wall-clock delays:** `waitForTimeout` / `setTimeout` / `sleep(` in `tests`.
- **Brittle selectors:** index-based `.nth(n)` chains or localized-text-only queries where a role/test id exists.
- **QA shortcut leakage:** selectors for Skip Combat / Unlock All / other dev-only controls in specs.
- **Wrong fixture import:** animation canaries import `@playwright/test` (not `./fixtures/e2e`); combat/flow specs use `./fixtures/e2e` **with** `runtimeErrors`.
- **Tier duplication:** same multi-step journey asserted in both `@prepush` and a slower tagged suite.
- **Diagnostic tooling:** `npm run test:e2e:audit` / timings reports as supporting evidence for flake classes — not a required every-pass gate.
