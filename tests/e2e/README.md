# E2E tests and helpers

Canonical E2E helper, fixture, tag, and diagnostic contract. Changed-path and
CI tier policy lives in [CONTRIBUTING.md](../../CONTRIBUTING.md).

When a command or E2E test fails, follow [failure-first triage](../../docs/REFERENCE.md#failure-first-triage) before opening a raw trace or report directory.

Browser specs live in [`specs/`](./specs/). Electron specs and their launch/setup helpers live in [`tests/electron/`](../electron/). Shared fixtures and page objects also serve performance checks.

Helpers live in this directory and are re-exported from [`tests/helpers.ts`](../helpers.ts) (all modules, including `mid-combat-save` and `gear-combat`). Layout assertions are in [`layout-assertions.ts`](./layout-assertions.ts), page objects in [`tests/pages/`](../pages/), and fixtures in [`tests/fixtures/e2e.ts`](../fixtures/e2e.ts). Run-phase assertions use `expectRunPhase(page, phase)` from [`tests/pages/game-stage.ts`](../pages/game-stage.ts).

## Choosing browser coverage

Apply [test value and coverage strategy](../../CONTRIBUTING.md#test-value-and-coverage-strategy) before choosing fixtures. Identify the browser-specific failure a test would detect and inspect existing journeys first. Use representative journeys and shared UI behavior rather than one spec per mechanic or content variant. Extend a journey only when the assertion fits its purpose; keep unrelated scenarios independently diagnosable. Consolidate or retire low-value coverage under the shared policy, preserving real-timing canaries where timing is the behavior under test.

## Running focused checks

For current source edits, run `PLAYWRIGHT_VITE_MODE=dev npx playwright test <spec> --project=chromium`. Preview mode is the default and serves the existing build; rebuild before using it to verify source changes. Use `--project=chromium` with an equals sign so a following spec is not consumed as another project name.

Run browser batches serially or combine specs in one invocation. Browser, Electron, and performance tests start their own server and reject occupied ports, leaving existing processes running. This prevents a run from silently testing another checkout or reusing preview output when development mode was requested; see [Playwright configuration](../playwright-shared.ts).

Browser tests default to port 4173. To use another port, run `PLAYWRIGHT_BROWSER_PREVIEW_PORT=4273 PLAYWRIGHT_VITE_MODE=dev npx playwright test tests/e2e/specs/menu-navigation.spec.ts --project=chromium`. The override also sets the browser URL and seeded storage origin. Electron uses `PLAYWRIGHT_ELECTRON_PREVIEW_PORT` (default 4175), and performance uses `PLAYWRIGHT_PERF_PORT` (default 4176). Preview mode still requires rebuilding after source changes.

Run the full Vitest suite separately from browser and performance batches. Concurrent full-unit and browser runs can exhaust local resources and cause unrelated interaction and teardown timeouts; reproduce the affected checks without that competing load before changing assertions or timeouts. If multiple browser workers time out during startup or teardown with GPU-stall warnings, isolate an affected spec with `--workers=1` before changing its timeout or assertions.

## Test import

| Import                                      | Use                                                                                                                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `import { test } from "../../fixtures/e2e"` | Most battle/flow specs; opt in to `fastBattle` and `runtimeErrors`                                                                                                        |
| `import { test } from "@playwright/test"`   | Animation specs, boot-only smoke, and Electron specs; never enable fast mode for animation coverage. `audio-sfx` uses `baseTest.describe` to opt out of `autoDiagnostic`. |

Decision order:

1. Animation canary/focused spec → raw `@playwright/test`, no `enableFastMode`/`fastBattle`.
2. Combat or turn cycling → fixture test with `{ page, fastBattle, runtimeErrors }`; reference both fixture values.
3. Visibility-only battle check → fast mode is recommended but optional.

## Navigation and bootstrap

- Save injectors install page-level initialization scripts that run again on navigation and reload. To verify changes persisted after injection, open a fresh page in the same browser context (shared storage, no page-level seeding script), collect its runtime errors, and close it after assertions.
- The fresh-storage cold-start test keeps real loading enabled, with a 30-second menu wait inside a 60-second test budget for parallel suite load. Ordinary menu checks retain their shorter budgets.
- `openGameModeSelect` retries Play if bootstrap unmounts the menu.
- `selectGameMode(page, mode, action?)` clicks the mode card with `Play` (default) or `Resume ${title}`.
- `selectCharacterAndContinue` clicks a hero portrait; character select has no Back/Continue footer.
- `resumeCampaignRun` waits for the saved destination rather than clicking Play during hydrate.
- `startBattleWithDeck` and `startAtDestination` bootstrap battle.
- `injectActiveBattle` injects a mid-battle snapshot and boots straight into the battle screen.
- `winBattleAndClaimReward` wins via combat and claims the first reward card.
- `assertDefeatFromEndRun` ends a run and asserts defeat.
- `injectMidCombatSave`, `injectDestinationAtIndex`, and `injectMysterySummaryVisit` inject exact persisted states.
- `failOnRuntimeErrors` is the manual console/page-error collector for specs that do not use the fixture.

## Cards and battle page

- Card factories are in `cards.ts`; use named presets when the assertion depends on a specific card.
- Injected decks and draft choices must use live library ids as shells (for example `slash`): hydrate drops unknown ids via `filterLiveCards` and `hydrateCard` renders titles from the library while keeping the injected effects and cost, so play cards by the library title.
- `enableFastMode` disables animations and is forbidden in animation-focused specs.
- `BattlePage.endTurn` must work with animations both on and off; changing it requires the critical animation canary.
- Prefer `winViaCombat`, `playCardNamed`, or `playFirstCard`; `playAllCards` is normally internal.
- Do not use `skipCombatToVictory`, `skipCombatBtn`, or production-hidden Unlock All/Skip Combat strings. Legitimate in-game Skip actions remain valid.

## Fixtures and diagnostics

- `fastBattle` enables fast mode when explicitly requested. New specs may call `useFastBattle(page)` from `tests/fixtures/e2e.ts` instead of destructuring the `void` fixture.
- `runtimeErrors` collects page errors and asserts that none occurred.
- `autoDiagnostic` runs for every test. On failure it writes one run-attributed bounded digest with an accessibility snapshot and an exact entry in `test-results/failures/<run-id>/index.json`. If the page can no longer provide that snapshot, the digest falls back to bounded HTML; raw traces remain secondary evidence.

Page objects: `BattlePage`, `MenuPage`, `DestinationPage`, `RewardPage`, `ShopPage`, `MysteryPage`, `CorruptionPage`, `HomesteadPage`, plus `expectRunPhase(page, phase)`.

## Tags

- `@critical` — every-push CI coverage for representative core gameplay, boot, animation, SFX, and adjacent flows.
- `@slow` — animation canaries and viewport loops; release/full-suite tier.

Combine tags with the array form — `{ tag: [a.tag, b.tag] }` — never object
spread, which silently drops every tag but the last. Tests with no tag run only
in the nightly/full suite, not in the every-push `@critical` gate;
tag a test `@critical` when its journey must gate every push.

The path-filtered `save-gate` intentionally reruns full save specs, including overlapping `@critical` tests, for save-touching pushes.
