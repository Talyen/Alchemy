---
name: playwright-e2e
description: Browser automation, Playwright testing, and app verification skill for Alchemy. Auto-triggers when authoring, modifying, or debugging Playwright specs (*.spec.ts), controlling the game via browser fixtures/page objects, adding UI/journey test coverage, or triaging E2E failures.
---

# Playwright E2E & app control

Canonical helper, fixture, and tag contracts live in [tests/e2e/README.md](../../../tests/e2e/README.md). Changed-path and CI tier policy lives in [CONTRIBUTING.md](../../../CONTRIBUTING.md).

## Test setup and imports

Choose the test import based on the test's intent:

| Import                                            | Use case                                                                                                                                                                |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `import { test, expect } from "./fixtures/e2e"`   | Combat, turn cycling, screen transitions, and journey specs. Opt in to `{ page, fastBattle, runtimeErrors }` and reference both fixture values (`void runtimeErrors;`). |
| `import { test, expect } from "@playwright/test"` | Animation canaries and boot-only smoke specs. Never enable fast mode (`fastBattle` / `enableFastMode`) in animation specs.                                              |

> [!TIP]
> To enable `runtimeErrors` trapping across an entire suite without repeating it in every test signature, use:
>
> ```ts
> test.beforeEach(async ({ runtimeErrors }) => {
>   void runtimeErrors;
> });
> ```

## Controlling the app

### 1. Page Objects (`tests/pages/`)

Always use dedicated page objects rather than fragile ad-hoc CSS selectors:

- `GameStage`: `expectRunPhase(phase)`, `runPhase()`.
- `BattlePage`: `playCardNamed(name)`, `playFirstCard()`, `winViaCombat()`, `endTurn()`, `block()`, `mana()`, `playerHealth()`, `enemyHealth()`, `statusChip(name)`.
- `MenuPage`: `openGameModeSelect()`, `goToCharacterSelect(mode)`, `gotoCollection(overrides)`. Mode clicks use `selectGameMode(page, mode)` from `tests/e2e/navigation.ts` (re-exported by `tests/helpers.ts`).
- `DestinationPage`: `expectVisible()`, `pick(name)`, `enterCombat(name)`, `enterAnyCombat()`.
- `RewardPage`: `selectFirstReward()`, `claimFirstReward()`, `claimWithConfirmationGate()`.
- `ShopPage`: `buyCard(index)`, `startCardRemoval()`, `refresh()`.
- `MysteryPage`: `pickFirstChoice()`, `handleCardOutcome()`.
- `CorruptionPage`: `open()`, `selectAndCorrupt(index)`.
- `HomesteadPage`: `goto(overrides)`, `switchTab(name)`.

### 2. State injection vs. UI navigation (`tests/helpers.ts`)

- **Direct injection (preferred for targeted specs):** Avoid clicking through multiple screens to reach a state. Use state injectors:
  - `injectSaveState(page, overrides)` — base localStorage save injection.
  - `injectActiveBattle(page, battleState, overrides)` — boots directly into a mid-battle state.
  - `injectMidCombatSave(page)` — seeds a persisted mid-combat save.
  - `injectDestinationAtIndex(page, options)` — lands on a specific node index.
  - `injectMysterySummaryVisit(page)` — seeds mystery screen states.
  - `enterPrimaryRewardScreen(page, pending)` — seeds reward claim screens.
- **UI bootstrap:** `openGameModeSelect(page)`, `selectGameMode(page, mode)`, `resumeCampaignRun(page)`, `startBattleWithDeck(page, deck)`, `startAtDestination(page)`.
- **Layout assertions:** `assertNoOverflow(page, name)`, `assertStageFitsViewport(page)`, `assertHorizontalNeighborGap(locator)`.

### 3. Combat invariants & flake prevention

- Never use fake test buttons (`skipCombatToVictory`, `skipCombatBtn`, etc.). Use legitimate combat actions (`winViaCombat`) or state injection.
- Ensure `endTurn()` works with both animations on and animations off.
- Avoid raw `page.waitForTimeout()`; use `expect.poll()` or `await expect(...).toPass({ timeout: 5000 })` for UI settling.

## Tags and execution tiers (`tests/playwright-tags.ts`)

Import tag helpers: `import { critical, prepush, slow, desktop } from "./playwright-tags";`

- `@prepush` (`prepush`): Fast local hook subset (boot smoke, battle animation canary, SFX smoke).
- `@critical` (`critical`): Core gameplay and user journeys; runs on every push CI gate.
- `@slow` (`slow`): Animation canaries and viewport matrices; nightly/release suites.
- `@desktop` (`desktop`): Electron-specific desktop specs.

> [!WARNING]
> Combine multiple tags using array syntax (`{ tag: [prepush.tag, critical.tag] }` or `{ tag: ["@critical", "@prepush"] }`). **Never use object spread** (`{ ...critical, ...prepush }`), which silently drops all but the last tag.

```ts
// Describe-level tag
test.describe("Collection", critical, () => { ... });

// Multi-tag test
test("representative battle flow", { tag: [critical.tag, prepush.tag] }, async ({ page, fastBattle, runtimeErrors }) => {
  void fastBattle;
  void runtimeErrors;
  // test logic
});
```

## Cursor IDE browser teardown

After any `cursor-ide-browser` use, including failed checks:

1. `browser_tabs` with action `list`
2. `close` each listed tab until the list is empty
3. Do not stop at `browser_lock` unlock — that leaves a live document

Playwright Test already destroys its own Chromium; this protocol is for the Cursor IDE browser only.

## Running & triaging E2E tests

1. **Targeted spec:**
   - `npx playwright test tests/my-spec.spec.ts --project chromium`
2. **Suite commands:**
   - Critical CI gate: `npm run test:e2e:critical`
   - Prepush hook: `npm run test:e2e:prepush`
   - Full test suite: `npm run test:e2e:full`
   - Desktop Electron: `npm run test:ship:desktop`
3. **Failure triage:**
   - On test failure, `autoDiagnostic` writes a bounded failure digest to `test-results/failures/<run-id>/index.json` containing accessibility snapshots and console/runtime error logs.
   - Inspect the bounded failure digest / console output first before downloading or opening heavy raw Playwright traces.
