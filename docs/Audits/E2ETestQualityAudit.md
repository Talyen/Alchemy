# E2E Test Reliability & Signal Audit

**Goal:** Improve confirmed Playwright reliability, signal, and tier fit without weakening product coverage.

Conventions: [CONTRIBUTING.md](../../CONTRIBUTING.md) (E2E helpers, tags, CI parity).

## Intent

Confirm P0–P2 candidates across suites and write a plan to address all identified issues (breaking into phases if the scope is large), preferring delete → merge → move to a cheaper tier → shorten. Add page-object or harness surface only when at least three current uses become shorter or one enforced test boundary requires it.

## Hard stops

- Do not invent wall-clock budgets that conflict with CONTRIBUTING / lefthook tiers.
- Do not expand into unit-test portfolio cleanup (`UnitTestAudit.md`).
- Do not add or rely on dev-only QA shortcuts (Skip Combat / Unlock All selectors). Prefer `winViaCombat()`, `playCardNamed()`, and real flows.
- Animation canaries must use raw `@playwright/test` — never `enableFastMode` / `fastBattle`.
- Electron / desktop E2E (`test:e2e:electron`, `test:ship:desktop`) is optional verification when available — do not fail the audit solely because Electron tooling is absent (see [README.md](README.md) toolchain limits).

## Tier rules

| Tier        | Command / tag                                       | Belongs here                                         |
| ----------- | --------------------------------------------------- | ---------------------------------------------------- |
| Pre-push    | `npm run test:e2e:prepush` (`@prepush`)             | Fast shell/entry canaries + one animation canary     |
| Critical    | `npm run test:e2e:prepush:full` / CI (`@critical`)  | State-changing journeys required before main         |
| Broader E2E | tagged `@smoke` / `@slow` / `@armory` as documented | Longer journeys; do not duplicate prepush assertions |
| Unit        | `npm test`                                          | Rules/state — not full-app spins                     |

`@smoke` is **not** the pre-push gate — prefer `@prepush` / `@critical` for shipping canaries. Do not re-add layout/chrome, copy catalogs, or prepush+critical duplicates. Prefer bootstrap helpers (`startBattleWithDeck`, `resumeCampaignRun`, deep fixtures) over brittle menu navigation when a helper already exists.

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

## Probe hints

- **Hardcoded wall-clock delays:** `rg -n 'waitForTimeout|setTimeout\(|sleep\(' tests --type ts`
- **Brittle selectors:** index-based `.nth(n)` chains or localized-text-only queries where a role/test id exists.
- **QA shortcut leakage:** selectors for Skip Combat / Unlock All / other dev-only controls in specs.
- **Wrong fixture import:** animation canaries must import `@playwright/test` (not `./fixtures/e2e`); combat/flow specs use `./fixtures/e2e` **with** `runtimeErrors`.
- **Tier duplication:** same multi-step journey asserted in both `@prepush` and a slower tagged suite.
- **Diagnostic tooling:** `npm run test:e2e:audit` / timings reports as supporting evidence for flake classes — not a required every-pass gate.
