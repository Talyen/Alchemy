# E2E tests and helpers

Canonical E2E helper, fixture, tag, and diagnostic contract. Changed-path and
CI tier policy lives in [CONTRIBUTING.md](../../CONTRIBUTING.md).

When a command or E2E test fails, use [failure-first triage](../../scripts/VERIFICATION.md#failure-first-triage) to locate evidence when the cause is unclear. Open relevant traces or reports directly for a specific hypothesis.

Browser specs live in [`specs/`](./specs/). Electron specs and their launch/setup helpers live in [`tests/electron/`](../electron/). Shared fixtures and page objects also serve performance checks.

Helpers live in this directory and are re-exported from [`tests/browser-helpers.ts`](../browser-helpers.ts) (supported helper modules). Layout assertions are in [`layout-assertions.ts`](./layout-assertions.ts), page objects in [`tests/pages/`](../pages/), and fixtures in [`tests/fixtures/e2e.ts`](../fixtures/e2e.ts). Run-phase assertions use `expectRunPhase(page, phase)` from [`tests/pages/game-stage.ts`](../pages/game-stage.ts).

## Choosing browser coverage

Before adding a journey, identify a distinct, consequential browser-specific
failure and explain why existing journeys or cheaper unit/DOM tests cannot
protect it. [Test value and coverage strategy](../../CONTRIBUTING.md#test-value-and-coverage-strategy)
owns the high-value admission standard, rare exceptions, and active retirement.
Follow that owner's retirement scope; ordinary feature work creates no suite-wide
cleanup obligation. Nightly placement does not justify weak coverage. Preserve
real-timing canaries where timing is the behavior under test.

Keep passing-journey screenshots in explicit visual acceptance or layout-review
workflows. Functional checks assert state and geometry without screenshot encoding
or attachment I/O. Motion checks observe frames or actual transition events and
stop when the animation settles; declared CSS properties alone cannot prove motion.
Arm short-lived feedback samplers in the renderer before sending input, then
read their captured result after the action. `observe-during-action.ts` consumes
those handles and cancels/disposes them when either observation or input fails. Locator assertions and protocol
round trips can outlast the feedback being measured. For transition sampling,
remember that motion started and check settled visual values independently of
temporary feedback flags; those flags may clear before enough stable frames arrive.
For fitted text, sample after the frame's resize observers finish, rather than
reading intermediate geometry from a requestAnimationFrame callback.

Responsive functional coverage uses five boundary viewports (narrow, minimum
height, standard, ultrawide and 4K), plus focused maximum-size and DPR journeys.
It protects containment, reachable actions and resize continuity rather than
exact decorative gaps, colors or scale ratios. Trait tooltips exercise the
maximum-size/minimum-height boundary in both Collection and Battle. The layout
review gallery owns the wider visual matrix.
Options checks its shared shell at all five boundaries and each remaining tab at
minimum height and 4K; the narrow-window journey checks tab reachability separately.
Labyrinth checks grid and tooltip containment at each selected viewport, resizing
one mounted map across the standard and narrow boundaries. Keyboard entry uses
the minimum-height boundary; touch has a separate journey.

Collection discovery and authored card tooltip wiring live in the Collection DOM
suite; Bestiary retains the real pointer/keyboard inspection journey. Card Shop
removal combines resize continuity with cancellation, exact deck/Gold settlement,
repeat-input protection and fresh-page resume. It also crosses full and short
picker pages at maximum sizing, checks stable action geometry, and removes a
distinct card from the final page. Its DOM counterpart uses the real
picker for rejected-command recovery and pending-save admission.

Corruption combines resize-history capacity and selection with the actual
mutation/resume journey: the chosen card identity must survive both boundaries.
Keyboard consecutive plays and held-confirm rejection share one real-timing
battle through focus recovery to End Turn. Talent announcements are checked
through the real screen's last-point purchase; reward DOM fixtures need no live
run store. Decorative shadow/icon classes and twelve-decimal density constants
are not functional acceptance contracts; containment, readable descriptions,
accessible states and the reviewed visual baselines remain protected.

Responsive checks resize each mounted screen across the viewport boundaries
before navigating onward; Options checks keep the full tab/viewport matrix without
repeating menu navigation. The shop shelf DOM suite owns Gear/Trinket inspection
without Gold, exact offered identities and repeat-purchase blocking through their
real screens; the card tile keeps its distinct focus-preserving purchase journey.
Keep short discard/badge observations in the renderer before input, including the
stunned-enemy hand-flash canary, rather than polling after those phases can finish.
Route completeness is enforced by the typed registry; real journeys protect
navigation. Route DOM tests focus on preserving committed offers through remounts
and passing the correct command authority, rather than mounting named stubs for
every screen.

Battle resume shares the real End Turn/SFX canary in
`specs/battle-end-turn-canary.spec.ts`: spend a card, accept one turn despite
repeated input, then restore Health, enemy Health, hand and turn on an unseeded
page and play again. The `save` route and `test:ship:e2e` both include that owner.
The other save specs retain current-format destination/reward recovery, cold
boot, corrupt JSON and future-version protection.

Wildwood's final draft pick also verifies the live deck viewer before and after
selection and the committed modified battle. The empty viewer stays in the
inspection DOM suite. One connected Wildwood journey wins a battle, checks no
Health recovery, resumes its actual reward offers, and skips into the next boss
without changing the deck. The menu/meta-detour journey owns open-menu resize
reachability without another battle boot.

Options control-to-store wiring lives in `tests/app/options-screen-route.test.tsx`
with the real screen. It protects independent audio/size settings, gameplay
preferences, reset and clear-save cancellation/confirmation; separate callback-only
screen renders and a stubbed route no longer duplicate that protection.

Options keyboard navigation, minimum-height confirmation reachability and saved
volume share the menu journey. The fresh-profile cold start also checks progression
locks and Armory availability before entering mode selection.

Armory combat locking, editing another hero, reservation persistence and release
share one journey seeded with one complete checkpoint; it checks exact saved
loadout identities as well as rejection feedback. Talent allocation spends the
last point through the keyboard, checks stable tree geometry, then verifies both
purchases on a fresh page. Separate
boots for those same states add no distinct protection. Tooltip movement, content
resize, coalescing and disposal share one DOM lifecycle; asynchronous placement
races retain their own focused cases. The startup skip-flag unit uses Node because
it needs a storage seam, not rendered DOM.

Hand inspection combines edge targeting, raised-card hit testing, draw/reflow,
and pointer-to-keyboard switching in one live journey. Size-boundary journeys
retain crowded maximum-size and ultrawide minimum-size hands; the standard-size
journey owns normal timing. Armory DOM tests retain mutation admission, failed
commands, transfer/selection lifetime and pagination, while exact empty-slot
filler counts and development-only spawn buttons have no permanent coverage.

Real opening-deal, pile-inspection admission, hand-dock stability, sequential
discard motion and transfer-color checks share the normal-timing journey in
`specs/draw-discard-animations.spec.ts`. The overlapping-draw journey remains
separate because it deliberately sends input before the first draw completes.
Short enemy-turn badges and inspection gates are captured before input, so
assertions inspect observed history rather than racing transient DOM states.
Attack-feedback timing requires the correct actor's actual lunge; missing
animations must not count as zero elapsed time.

## Rendered accessibility and visual regression

`specs/accessibility.spec.ts` runs axe WCAG A/AA checks on the live menu,
Options, Battle and card inspection. It complements focus journeys and JSX lint;
passing automated checks does not establish complete screen-reader usability.

`npm run test:visual` uses `playwright.visual.config.ts` and the shared fixtures
to compare Battle, card inspection and English/German Options at 1920 × 1080.
Seeded checkpoints, reduced motion and settled artwork/fonts make captures
repeatable. The dedicated CI job uses macOS 15 and the lockfile's Playwright
Chromium; Darwin baselines are committed under `tests/visual/baselines/darwin/`.
Run a fresh web build first. For an intentional visual change, use
`npm run test:visual -- --update-snapshots` on macOS, inspect every changed
image, then rerun without updates. Never update baselines merely to clear a
failure. Differences and failure diagnostics are retained by CI. Other OSes
need separately reviewed baselines before running this visual suite. Local execution follows
[CONTRIBUTING](../../CONTRIBUTING.md#what-to-run-when-you-change).

These four baselines protect composition, text fitting and layering that
functional assertions cannot see; the wider desktop layout-review gallery
remains the tool for manual review across viewport sizes.

## Running focused checks

### Local execution policy

[CONTRIBUTING](../../CONTRIBUTING.md#what-to-run-when-you-change) owns local execution permissions and the task gate. Use [visual review](../../Docs/UI_VISUAL_REVIEW.md) for affected player-facing flows; prefer development mode for current-source UI checks.
[Browser and Electron commands](#browser-and-electron-commands) own invocation,
ports, build edition and concurrency details for focused local execution.

### Browser and Electron commands

These automated suites are CI-owned, including a single browser spec. For an
explicitly requested local run, set `ALCHEMY_ALLOW_HEAVY_LOCAL=1` on that command
and use the shared Mac host lane under
[Contributing](../../CONTRIBUTING.md#what-to-run-when-you-change). Development mode
changes the source being served; it does not bypass this requirement. Ordinary
interactive visual review uses the [managed preview](../../CONTRIBUTING.md#agent-preview-ownership).

Install browser-test Chromium once before the first run:

```sh
npx playwright install chromium
```

For current source edits, run `npm run test:e2e:dev -- <spec>`. This uses the shared local test lane and retains compact diagnostics. Preview mode is the default for `test:e2e` and serves the existing build; rebuild before using it to verify source changes. For direct Playwright diagnosis, use `--project=chromium` with an equals sign so a following spec is not consumed as another project name; raw invocations require manual coordination under [the test policy](../../CONTRIBUTING.md#what-to-run-when-you-change).

Named route selections use `npm run test:e2e:route -- <name>` and also default to
the existing preview build. Set `PLAYWRIGHT_VITE_MODE=dev` for current-source
iteration, for example `PLAYWRIGHT_VITE_MODE=dev npm run test:e2e:route -- homestead`.
The [route command](../../scripts/run-e2e-route.mjs) owns available names and aliases.

Run browser batches serially or combine specs in one invocation. Browser tests and browser-hosted performance tests start their own server and reject occupied ports, leaving existing processes running. This prevents a run from silently testing another checkout or reusing preview output when development mode was requested; see [Playwright configuration](../playwright-shared.ts).

The default local Electron command collects only the desktop bridge and main-menu smoke. Electron tests load the built desktop renderer through the app protocol without starting a preview server; CI and nightly explicitly select the full suite. These tests launch the checkout's Electron runtime. The [packaged Windows startup check](../../Docs/RELEASE.md#packaged-windows-startup-check) separately validates the distributed application.

Build current source with `npm run build:desktop` before `npm run test:ship:desktop`;
the test command installs a missing Electron runtime but does not rebuild the
renderer. To select another Electron spec, set `PLAYWRIGHT_ELECTRON_FULL=1` and
pass its path, for example
`PLAYWRIGHT_ELECTRON_FULL=1 npm run test:ship:desktop -- tests/electron/electron-security.spec.ts`.
That flag removes the smoke-only filter; deeper interaction cases additionally
require `ALCHEMY_INTERACTION_TIER=nightly`. Check the collected scope before
claiming that a requested spec passed.

Electron-only CI jobs install system libraries with `playwright install-deps` and
use the installed Electron runtime; they do not need Playwright Chromium binaries.
Skip unsupported native fullscreen cases before Electron setup.

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

Ordinary specs use the fixture-owned page so automatic runtime errors and failure
diagnostics follow the tested renderer without allocating an unused second page.
Fresh-page save checks still need a separate unseeded page.

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
| Start battle or destination   | `battle-setup.ts`: `startBattleWithDeck`, `startAtDestination`      | Bootstraps battle                                                                                                 |
| Inject mid-battle             | `save-injection.ts`: `injectActiveBattle`                           | Boots directly into battle                                                                                        |
| Win and claim reward          | `battle-setup.ts`: `winBattleAndClaimReward`                        | Wins through combat and claims the first reward card                                                              |
| Seed exact persisted state    | `save-injection.ts`: `injectSaveState`, `injectMysterySummaryVisit` | Page initialization scripts rerun on navigation and reload                                                        |
| Inspect acknowledged save     | `save-injection.ts`: `withSavedGame`, `readSavedGame`               | The former opens an unseeded page, checks runtime errors and closes it; the latter reads the acknowledged payload |
| Collect errors on extra pages | `errors.ts`: `failOnRuntimeErrors`                                  | Assert collected errors before closing; the browser fixture covers its own page automatically                     |

Fresh-page and desktop relaunch journeys enter active checkpoints through the
main menu's Continue action. `withSavedGame` does this when the acknowledged save
contains an active run; pass its translated Continue label as the third argument
for localized saves. `injectActiveBattle` accepts that label as its fourth argument
when the initial checkpoint already uses another language. Meta-only saves remain on the main menu. Raw `injectSaveState`
and `injectExactSave` only seed storage; callers must navigate if needed and use
`resumeInjectedRun` when they need to enter the run. `enterPrimaryRewardScreen`
loads and enters the seeded reward.

`withSavedGame` closes the source renderer before opening the unseeded page,
preventing stale autosaves and overlapping render loops during resume. The
Homestead read-only detour explicitly passes `{ keepSource: true }` as its fourth
argument because it continues the original gallery afterward. Resume callbacks
must otherwise use their supplied page, including nested resumes.

Save assertions wait for the persisted value with `expect.poll`; visible
navigation does not imply that a debounced write has completed. After injection,
verify persistence on a fresh page in the same browser context, without page-level
seeding. If the next enemy turn must deal damage, supply three canonical damaging
ability IDs rather than assume the default Goblin cannot Block.

Save injection returns whether Electron already reloaded the checkpoint; composed
helpers navigate only for browser injection. Injected runs boot to the main menu; battle, destination, and Labyrinth bootstrap helpers explicitly press Continue before returning the playable checkpoint. Desktop writes remain doubled to
protect against a rewards autosave racing injection; each bridge write awaits disk
acknowledgment. Destination setup requires an explicit destination; Labyrinth setup
reuses the injection result rather than probing the renderer twice.

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
- `BattlePage.endTurn` activates the corner End Turn button directly and waits for turn readiness or a battle outcome. The helper works with animations on and off; changing it requires the critical animation canary for enemy damage and hand replenishment. Ordinary battle actions use actionable clicks without `force`.
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

Localization functional coverage has a separate every-push job, independent of
critical gameplay. `localizationCoverage(locale, representative)` assigns one
shipped language to gate each journey via `@localization-smoke`; Chinese, Japanese
and Cyrillic font checks share the matching Options journeys. Those three Options locales gate pushes, sampling all seven shipped
translations in 14 cases. Locale battle/resume checks have
one owner here and do not carry `@critical`.

Nightly/release retain all shipped locales for live switching/resume, Options and
shop/menu presentation, including Cyrillic, Japanese and Chinese font loading.
The nine gameplay settlement journeys each use one shipped-language representative
and expanded-English QA rather than repeating mechanics in every language. They
retain generated descriptions, movable keyword slots, translated accessible targets
and cross-language saves; unit/DOM tests own mechanics and catalog correctness.
Both workflows also call the expanded-English acceptance workflow, which runs
only `@localization-qa` against development source because QA catalogs are absent
from production. These jobs cover 30 production cases and 12 QA cases.
`ALCHEMY_LOCALIZATION_LAYOUT_REVIEW=1` enables minimum-viewport, maximum-size
geometry and reachability checks. Passing screenshots additionally require
`ALCHEMY_LOCALIZATION_SCREENSHOTS=1` for an explicit visual review; functional CI
keeps assertions and browser failure screenshots without encoding passing PNGs.

The production demo push job runs all five core demo journeys and one German
localized ending via `@critical|@localization-smoke`. Native Chinese/Russian and
Japanese/French quit/relaunch journeys remain on pushes. Nightly/release keep
all seven browser demo locales, including each localized marketing image; six
languages' full demo journeys no longer repeat on every push.

CI traces the first retry rather than every passing browser journey. CI retains critical and localization JSON results for seven days on every run and failure diagnostics on failed or flaky
runs, including tests that pass on retry. A retry remains permitted; flakes do
not create an additional gate.

Critical Chromium coverage runs in one CI job with two workers, avoiding repeated
dependency/browser setup and artifact downloads. Nightly keeps its four shards
until three successful hosted comparisons establish that consolidation lowers
combined runner time without extending CI completion or adding retries.

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
viewport/cursor variants in the full suite. Layout checks assert geometry directly;
use the opt-in [desktop layout review](../layout-review/README.md) for screenshot
artifacts. Rendered-font measurements are CSS pixel estimates, not physical glyph
measurements or Valve certification. DPR input checks set an actual device scale
factor and exercise pointer targeting and keyboard inspection together.

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

## CI report interpretation

CI JSON reports retain commit/run identity, Playwright wall time, summed test
execution including retries, retry execution, and pre-Playwright setup time.
Setup starts at the job's first explicit step; it excludes runner provisioning,
queueing and teardown. The critical and localization jobs each record their own
setup start, summary and JSON report, including successful acceptance runs.
Compare at least three successful hosted runs before claiming a speedup; failed
runs that stop early are not a healthy-runtime baseline.
Summed test execution can exceed elapsed wall time because
workers run concurrently. Compare total job/runner time through Actions as well
as these report metrics before claiming a speedup.

For downloaded nightly/release shards, compare every shard from the same commit,
workflow run, attempt and job with
`npm run ci:summarize -- --playwright-shards <report-1.json> <report-2.json> ...`.
The comparison rejects incomplete, duplicate or mixed-run inputs and reports the
slowest-minus-fastest wall-time spread. Older JSON reports still summarize, but
lack setup timing and cannot establish a shard comparison without identity.
