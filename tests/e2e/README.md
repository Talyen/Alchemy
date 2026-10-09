# E2E tests and helpers

Canonical E2E helper, fixture, tag, and diagnostic contract. Changed-path and
CI tier policy lives in [CONTRIBUTING.md](../../CONTRIBUTING.md).

When a command or E2E test fails, use [failure-first triage](../../Docs/REFERENCE.md#failure-first-triage) to locate evidence when the cause is unclear. Open relevant traces or reports directly for a specific hypothesis.

Browser specs live in [`specs/`](./specs/). Electron specs and their launch/setup helpers live in [`tests/electron/`](../electron/). Shared fixtures and page objects also serve performance checks.

Helpers live in this directory and are re-exported from [`tests/browser-helpers.ts`](../browser-helpers.ts) (supported helper modules). Layout assertions are in [`layout-assertions.ts`](./layout-assertions.ts), page objects in [`tests/pages/`](../pages/), and fixtures in [`tests/fixtures/e2e.ts`](../fixtures/e2e.ts). Run-phase assertions use `expectRunPhase(page, phase)` from [`tests/pages/game-stage.ts`](../pages/game-stage.ts).

## Choosing browser coverage

Before adding a journey, identify a distinct, consequential browser-specific
failure and explain why existing journeys or cheaper unit/DOM tests cannot
protect it. [Test value and coverage strategy](../../CONTRIBUTING.md#test-value-and-coverage-strategy)
owns the high-value admission standard, rare exceptions, and active retirement.
Apply it to journeys encountered during authorized work: remove low- and
medium-value coverage by default after checking its purpose, dependencies, and
execution tier, or strengthen/move it when inexpensive high-value protection is
possible. Nightly placement does not justify weak coverage. Preserve real-timing
canaries where timing is the behavior under test.

## Running focused checks

### Local execution policy

Browser and Electron suites are CI-first. The default local `check` gate runs only bounded Node smoke and selected-file formatting. The commands below are manual opt-ins, requiring an explicit user request for local execution. Do not launch suites automatically for an implementation or test-fix task.
[Browser and Electron commands](#browser-and-electron-commands) own invocation,
ports, build edition and concurrency details when local execution is requested.

### Browser and Electron commands

For current source edits, run `npm run test:e2e:dev -- <spec>`. This uses the shared local test lane and retains compact diagnostics. Preview mode is the default for `test:e2e` and serves the existing build; rebuild before using it to verify source changes. For direct Playwright diagnosis, use `--project=chromium` with an equals sign so a following spec is not consumed as another project name; raw invocations require manual coordination under [the test policy](../../CONTRIBUTING.md#what-to-run-when-you-change).

Run browser batches serially or combine specs in one invocation. Browser tests and browser-hosted performance tests start their own server and reject occupied ports, leaving existing processes running. This prevents a run from silently testing another checkout or reusing preview output when development mode was requested; see [Playwright configuration](../playwright-shared.ts).

An explicitly requested local Electron run collects only the desktop bridge and main-menu smoke. Electron tests load the built desktop renderer through the app protocol without starting a preview server; CI and nightly explicitly select the full suite. These tests launch the checkout's Electron runtime. The [packaged Windows startup check](../../Docs/RELEASE.md#packaged-windows-startup-check) separately validates the distributed application.

Local Electron test launches default to background mode, keeping the isolated window
hidden and rendering without taking focus. `ALCHEMY_ELECTRON_BACKGROUND=1`
also explicitly selects this mode. Background mode suppresses native display-mode
changes; native fullscreen checks are skipped unless a user-authorized foreground
run sets `ALCHEMY_ELECTRON_BACKGROUND=0`. The opt-in
[desktop layout review](../layout-review/README.md) captures the full viewport
matrix with this mode and verifies hidden versus offscreen composition.
CI defaults to a visible window inside its isolated virtual display: hidden Linux
windows can suspend frame callbacks and stall the real loading screen.

Browser tests default to port 4173. To use another port, run `PLAYWRIGHT_BROWSER_PREVIEW_PORT=4273 npm run test:e2e:dev -- tests/e2e/specs/menu-navigation.spec.ts`. The override also sets the browser URL and seeded storage origin. Performance uses `PLAYWRIGHT_PERF_PORT` (default 4176); [desktop layout review](../layout-review/README.md) owns its separate preview-server setup. Preview mode still requires rebuilding after source changes.

Build and test with the same `ALCHEMY_EDITION`: full uses `dist/` and demo uses `dist-demo/` under the [edition contract](../../Docs/STEAM_DEMO.md#edition-contract). Do not rebuild the selected renderer directory while a preview-mode suite is running. Web and desktop builds of that edition overwrite the same directory; replaced assets can produce unrelated 404s and interaction failures in tests already in progress.

Run the full Vitest suite separately from browser and performance batches. Concurrent full-unit and browser runs can exhaust local resources and cause unrelated interaction and teardown timeouts; reproduce the affected checks without that competing load before changing assertions or timeouts. If multiple browser workers time out during startup or teardown with GPU-stall warnings, isolate an affected spec with `--workers=1` before changing its timeout or assertions.

## Test import

Use `import { test, expect } from "../../fixtures/e2e"` for all browser specs,
including animation, audio, and cold-start tests. Import Playwright types from
`@playwright/test`. Electron specs keep their separate launch fixture. `launchElectronApp` gives each
launch a temporary user-data and browser-session profile before the app captures
save paths, verifies that isolation, and removes it on close. Never run save tests
against the normal desktop profile.

Diagnostics and runtime-error assertions are automatic. Request `fastBattle`
only for gameplay flows where real timing is not under test; animation canaries
must never request it or call `enableFastMode`/`useFastBattle`.

## Navigation and bootstrap

Choose the existing helper by the state the test needs. Use
[the helper barrel](../browser-helpers.ts) for its supported exports; import other
owners directly.

| Need                          | Owner / helper                                                      | Behavior                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Open mode selection           | `navigation.ts`: `openGameModeSelect`, `selectGameMode`             | Retries Play if bootstrap unmounts the menu; selecting a mode never resumes a separate slot                       |
| Select hero                   | `tests/pages/menu-page.ts`: `MenuPage.selectCharacterAndContinue`   | Clicks the portrait; no Back/Continue footer                                                                      |
| Resume campaign               | `navigation.ts`: `resumeCampaignRun`                                | Waits for the saved destination or uses main-menu Continue                                                        |
| Start battle or destination   | `battle-setup.ts`: `startBattleWithDeck`, `startAtDestination`      | Bootstraps battle                                                                                                 |
| Inject mid-battle             | `save-injection.ts`: `injectActiveBattle`                           | Boots directly into battle                                                                                        |
| Win and claim reward          | `battle-setup.ts`: `winBattleAndClaimReward`                        | Wins through combat and claims the first reward card                                                              |
| End run and return            | `battle-setup.ts`: `assertEndRunShowsRecap`                         | Ends immediately without confirmation, asserts recap, then continues to the menu                                  |
| Seed exact persisted state    | `save-injection.ts`: `injectSaveState`, `injectMysterySummaryVisit` | Page initialization scripts rerun on navigation and reload                                                        |
| Inspect acknowledged save     | `save-injection.ts`: `withSavedGame`, `readSavedGame`               | The former opens an unseeded page, checks runtime errors and closes it; the latter reads the acknowledged payload |
| Collect errors on extra pages | `errors.ts`: `failOnRuntimeErrors`                                  | Assert collected errors before closing; the browser fixture covers its own page automatically                     |

Save assertions wait for the persisted value with `expect.poll`; visible
navigation does not imply that a debounced write has completed. After injection,
verify persistence on a fresh page in the same browser context, without page-level
seeding. If the next enemy turn must deal damage, supply three canonical damaging
ability IDs rather than assume the default Goblin cannot Block.

The fresh-storage cold-start test retains real loading, a 30-second menu wait and
a 60-second test budget for parallel suite load. Ordinary menu checks keep their
shorter budgets. [Cards and battle page](#cards-and-battle-page) owns presets and
hand readiness; [controller input](#controller-equivalent-input) owns keyboard
journeys. Layout assertions live in `layout-assertions.ts`; run-phase assertions
use `tests/pages/game-stage.ts` (`expectRunPhase`).

## Cards and battle page

- Card factories are in `cards.ts`; use named presets when the assertion depends on a specific card.
- Injected decks and draft choices must use live library ids as shells (for example `slash`): hydrate drops unknown ids via `filterLiveCards` and `hydrateCard` renders titles from the library while keeping the injected effects and cost, so play cards by the library title.
- `enableFastMode` disables animations and is forbidden in animation-focused specs.
- `BattlePage.endTurn` must work with animations both on and off; changing it requires the critical animation canary, which checks enemy damage and hand replenishment. Ordinary battle actions use actionable clicks without `force`.
- After entering battle, await `battle.waitForOpeningHand()` instead of a single `handCount()` read: the opening deal briefly shows a zero-hand frame during animation/remount, so poll-then-read flakes in CI.
- Prefer `winViaCombat`, `playCardNamed`, or `playFirstCard`; `playAllCards` is normally internal.
- Do not use `skipCombatToVictory`, `skipCombatBtn`, or production-hidden Unlock All/Skip Combat strings. Legitimate in-game Skip actions remain valid.

## Fixtures and diagnostics

- `fastBattle` enables fast mode when explicitly requested. New specs may call `useFastBattle(page)` from `tests/fixtures/e2e.ts` instead of destructuring the `void` fixture.
- `runtimeErrors` automatically fails on uncaught page errors and console errors, including sound failures and React warnings emitted as errors. No global message exclusions apply. For an intentionally provoked error, request `runtimeErrors` and assert the exact expected entries with `expect(runtimeErrors.splice(0)).toEqual([...])` after the behavior settles. This consumes only errors the test explicitly checks; later errors still fail teardown.
- `autoDiagnostic` runs for every test. On failure it writes one run-attributed bounded digest with an accessibility snapshot and an exact entry in `test-results/failures/<run-id>/index.json`. Fixture and JSON summaries share suite-qualified titles and repository-relative source paths, so repeated local names retain distinct digests and links survive CI downloads. If the page can no longer provide that snapshot, the digest falls back to bounded HTML; both context reads have two-second deadlines so an unresponsive renderer cannot hold teardown. Raw traces remain secondary evidence.

The same digest includes development/preview mode, configured worker count, navigation timing, and pending/failed document or module requests. Request tracking keeps at most 40 pending entries, shows at most five examples, and reports omitted observations. These details share the existing 40-entry/5 KiB log budget and 16 KiB digest cap; timing capture gives up after two seconds if the page cannot answer. A zero DOM-ready/load timestamp means that event had not completed at capture. When audio tests remain on Loading, inspect this startup evidence before changing playback assertions. Keep the music journey's 60-second ceiling, use development mode for current-source iteration, and rebuild before preview acceptance checks.

Page objects: `BattlePage`, `MenuPage`, `DestinationPage`, `RewardPage`, `ShopPage`, `MysteryPage`, `CorruptionPage`, `HomesteadPage`, plus `expectRunPhase(page, phase)`.

## Tags

- `@critical` — every-push CI coverage for representative core gameplay, boot, animation, SFX, and adjacent flows.
- `@slow` — animation canaries and viewport loops; release/full-suite tier.

Combine tags with the array form — `{ tag: [a.tag, b.tag] }` — never object
spread, which silently drops every tag but the last. Tests with no tag run only
in the nightly/full suite, not in the every-push `@critical` gate;
tag a test `@critical` when its journey must gate every push. Tags are inherited:
adding `@slow` to a child does not remove a parent's `@critical`. In mixed suites,
tag representative tests individually so secondary variants stay nightly-only.

CI traces the first retry rather than every passing browser journey. CI retains JSON results on every run and failure diagnostics on failed or flaky
runs, including tests that pass on retry. A retry remains permitted; flakes do
not create an additional gate.

All retained save specs are critical and run once in the every-push/pull-request browser gate. Local `test:ship:e2e` remains an explicit opt-in; release and nightly include the complete retained suite.

## Controller-equivalent input

Use [controllerInput](./controller-input.ts) for Steam Input's intended keyboard and
mouse outputs. `reach` traverses with actual Tab/F7 and detects cycles;
`activate` requires an enabled control before pressing Enter. For an inspectable
aria-disabled control, use `reach` and assert its disabled behavior separately.
Target the actual focusable button, not an art wrapper. Bootstrap fixtures may
seed state before a journey; do not use `.focus()`, clicks, or handler calls to
repair a keyboard-only segment. Direct focus remains appropriate in isolated
preview/component tests.

The [Options journey](./controller-options.ts) is shared with Electron. Keep the
critical combat and real-timing canaries in the existing CI tier, and secondary
viewport/cursor variants in the full suite. Deck-size screenshots are retained in
ignored `reports/controller-support/`; rendered-font measurements are diagnostic
CSS pixel estimates, not physical glyph measurements or Valve certification.

## Connected interaction and Electron canaries

[Interaction coverage](../interaction/README.md) owns the seven progress families,
seeded action replay and screen map. Unit scenarios cover controlled completion
orders without mocking completion or input gates. Steam acceptance uses
`tests/electron/interaction-canaries.spec.ts`: normal animation and actual controls
for last-Mana draws, inspection, turn progress, visit completion, Armory interruption,
native focus and save recovery. `@interaction-nightly` excludes deeper variants
from the push desktop tier; nightly sets `ALCHEMY_INTERACTION_TIER=nightly`.
Existing Chromium journeys remain for distinct renderer evidence; WebKit is not
required for the Electron-only release target.
