# E2E helpers

Canonical E2E helper, fixture, tag, and diagnostic contract. Changed-path and
CI tier policy lives in [CONTRIBUTING.md](../../CONTRIBUTING.md).

When a command or E2E test fails, follow [failure-first triage](../../docs/REFERENCE.md#failure-first-triage) before opening a raw trace or report directory.

Helpers live in this directory and are re-exported from [`tests/helpers.ts`](../helpers.ts). Layout assertions are in [`layout-assertions.ts`](./layout-assertions.ts), page objects in [`tests/pages/`](../pages/), and fixtures in [`tests/fixtures/e2e.ts`](../fixtures/e2e.ts).

## Test import

| Import                                    | Use                                                                                |
| ----------------------------------------- | ---------------------------------------------------------------------------------- |
| `import { test } from "./fixtures/e2e"`   | Most battle/flow specs; opt in to `fastBattle` and `runtimeErrors`                 |
| `import { test } from "@playwright/test"` | Animation specs and boot-only smoke; never enable fast mode for animation coverage |

Decision order:

1. Animation canary/focused spec → raw `@playwright/test`, no `enableFastMode`/`fastBattle`.
2. Combat or turn cycling → fixture test with `{ page, fastBattle, runtimeErrors }`; reference both fixture values.
3. Visibility-only battle check → fast mode is recommended but optional.

## Navigation and bootstrap

- `openGameModeSelect` retries Play if bootstrap unmounts the menu.
- `selectGameMode` clicks the mode art card; there is no Play/Resume footer.
- `selectCharacterAndContinue` clicks a hero portrait; there is no Back/Continue footer.
- `resumeCampaignRun` waits for the saved destination rather than clicking Play during hydrate.
- `startBattleWithDeck` and `startAtDestination` bootstrap battle.
- `injectActiveBattle` injects a mid-battle snapshot and boots straight into the battle screen.
- `winBattleAndClaimReward` wins via combat and claims the first reward card.
- `assertDefeatFromEndRun` ends a run and asserts defeat.
- `injectMidCombatSave`, `injectDestinationAtIndex`, and `injectMysterySummaryVisit` inject exact persisted states.
- `failOnRuntimeErrors` is the manual console/page-error collector for specs that do not use the fixture.

## Cards and battle page

- Card factories are in `cards.ts`; use named presets when the assertion depends on a specific card.
- `enableFastMode` disables animations and is forbidden in animation-focused specs.
- `BattlePage.endTurn` must work with animations both on and off; changing it requires the critical animation canary.
- Prefer `winViaCombat`, `playCardNamed`, or `playFirstCard`; `playAllCards` is normally internal.
- Do not use `skipCombatToVictory`, `skipCombatBtn`, or production-hidden Unlock All/Skip Combat strings. Legitimate in-game Skip actions remain valid.

## Fixtures and diagnostics

- `fastBattle` enables fast mode when explicitly requested.
- `runtimeErrors` collects page errors and asserts that none occurred.
- `autoDiagnostic` runs for every test. On failure it writes one run-attributed bounded digest with an accessibility snapshot and an exact entry in `test-results/failures/<run-id>/index.json`. If the page can no longer provide that snapshot, the digest falls back to bounded HTML; raw traces remain secondary evidence.

Page objects: `BattlePage`, `MenuPage`, `DestinationPage`, `RewardPage`, `ShopPage`, `MysteryPage`, `CorruptionPage`, `HomesteadPage`, `GameStage`.

## Tags

- `@critical` — every-push CI coverage for representative core gameplay, boot, animation, SFX, and adjacent flows.
- `@slow` — animation canaries and viewport loops; release/full-suite tier.

Combine tags with the array form — `{ tag: [a.tag, b.tag] }` — never object
spread, which silently drops every tag but the last. Tests with no tag run only
in the nightly/full suite, not in the every-push `@critical` gate;
tag a test `@critical` when its journey must gate every push.

The path-filtered `save-gate` intentionally reruns full save specs, including overlapping `@critical` tests, for save-touching pushes.
