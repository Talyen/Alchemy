# Contributing

## What to run when you change…

> Automated mid-task test routing (`verifier` skill) maps touched file paths to the localized test commands below during development.

| Area                            | Paths (prefixes)                                                                                                                                                                              | Run locally                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Active run / screen / bootstrap | `shared/stores/`, `src/app/use-alchemy-bootstrap.ts`, `src/app/use-app-navigation.ts`, `shell/use-alchemy-run-controller`, `shared/ui/fade-slot.tsx`, `shared/ui/use-sequential-fade-swap.ts` | `npm test -- tests/app/use-alchemy-bootstrap.test.ts tests/app/use-rendered-screen-transition.test.ts tests/features/alchemy/shared/stores/ tests/features/alchemy/shared/ui/fade-slot.test.tsx tests/features/alchemy/shared/ui/use-sequential-fade-swap.test.ts tests/features/alchemy/shell/ tests/types/run-architecture-contracts.test.ts` then `npm run lint:boundaries` and `npm run test:e2e:prepush`                                                                                          |
| Save / persistence              | `shared/storage/`, `src/lib/validation/save-schemas/`, `active-run.ts`                                                                                                                        | `npm test -- tests/features/alchemy/shared/storage tests/features/alchemy/app/autosave-hook.test.ts tests/features/alchemy/app/autosave-active-run.test.ts` + `tests/save-persistence.spec.ts` + `npm run test:e2e:prepush`                                                                                                                                                                                                                                                                            |
| Battle / cards                  | `src/lib/battle/`, `src/lib/game-data/`, `run-loop/battle/`, `app/screen-routes/use-battle-playback.ts`                                                                                       | `npm test -- tests/lib/battle tests/features/alchemy/run-loop/battle tests/app/use-battle-playback.test.ts` + `tests/lib/game-data/descriptions-match-effects.test.ts` + `tests/lib/game-data/talent-pool.test.ts` + `tests/lib/game-data/talent-effect-invariants.test.ts`                                                                                                                                                                                                                            |
| Balance sim                     | `src/lib/balance/`                                                                                                                                                                            | `npm test -- tests/lib/balance` (findings HTML is opt-in: `npm run balance:sim`)                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Shop                            | `run-loop/shop/`, `run-loop/screens/*shop*`, `run-loop/screens/alchemist-shop-screen.tsx`, `shell/use-shop-controller.ts`                                                                     | `npm test -- tests/features/alchemy/run-loop/shop` + `npx playwright test tests/shop-and-rewards.spec.ts --project chromium` when changing shop screens                                                                                                                                                                                                                                                                                                                                                |
| Audio / SFX                     | `src/lib/audio*.ts`, `sound-registry.ts`, `public/sounds/`                                                                                                                                    | `npm test -- tests/lib/audio-sfx.test.ts tests/lib/audio-sfx-playback.test.ts tests/lib/audio-buffer-cache.test.ts tests/lib/sound-assets.test.ts` + `npx playwright test tests/audio-sfx.spec.ts --project chromium`                                                                                                                                                                                                                                                                                  |
| Routing / destinations          | `src/lib/routing/`, `app/screen-routes/`, `src/app/use-app-navigation.ts`, `shell/use-screen-transitions.ts`                                                                                  | `npm test -- tests/lib/routing tests/features/alchemy/shell/use-screen-transitions.test.ts tests/app/use-rendered-screen-transition.test.ts tests/app/use-battle-playback.test.ts` then `npm run lint:boundaries` and `npm run test:e2e:prepush`. New run-flow edges must also update `PRODUCTION_NAVIGATION_EDGES` in `tests/lib/routing/screen-transition-policy.test.ts`.                                                                                                                           |
| Gear                            | `src/lib/gear/`, `meta/screens/armory/`                                                                                                                                                       | `npm test -- tests/lib/gear tests/architecture/affix-catalog-guard.test.ts tests/architecture/gear-ranged-tags.test.ts tests/architecture/gear-affix-pool.test.ts tests/features/alchemy/shared/stores/gear-store.test.ts tests/features/alchemy/shared/stores/gear-crafting.test.ts tests/features/alchemy/meta/screens/armory tests/features/alchemy/shared/storage/gear-save.test.ts` + `npx playwright test tests/armory-crafting.spec.ts tests/gear-equip.spec.ts --project chromium`             |
| Mystery                         | `lib/mystery/`, `run-loop/navigation/*mystery*`, `run-loop/screens/mystery/`, `app/screen-routes/mystery-screen-route.tsx`, `shell/use-mystery-event-navigation.ts`                           | `npm test -- tests/features/alchemy/run-loop/navigation/mystery-flow.test.ts tests/features/alchemy/shell/use-mystery-event-navigation.test.ts tests/features/alchemy/app/mystery-route.test.tsx tests/lib/mystery tests/lib/active-run-session/mystery-visit-persistence.test.ts tests/features/alchemy/shared/storage/active-run-data.test.ts tests/features/alchemy/shared/stores/run-domain-*.test.ts` + `npx playwright test tests/destination-progression.spec.ts -g Mystery --project chromium` |
| Integration-style unit tests    | `run-domain`, `storage`, `reward-flow`, `shell/*-hook`                                                                                                                                        | `npm test -- tests/features/alchemy/shared/stores/run-domain-*.test.ts tests/features/alchemy/shared/storage tests/features/alchemy/run-loop/navigation/reward-flow tests/features/alchemy/shell`                                                                                                                                                                                                                                                                                                      |
| Battle E2E helpers              | `tests/pages/battle-page.ts`, `tests/helpers.ts` (`enableFastMode`)                                                                                                                           | `npm run test:e2e:prepush` (animation canary) + relevant specs                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| UI flows                        | `screens/`, controllers                                                                                                                                                                       | Relevant `tests/*.spec.ts` + `npm run test:e2e:prepush`; longer UI coverage runs in CI/nightly                                                                                                                                                                                                                                                                                                                                                                                                         |
| Any push to `main`              | —                                                                                                                                                                                             | Fast pre-push hook (`check:push`); CI runs after push. Optional fuller local static+unit: `check:push:full`. CI E2E parity: `test:e2e:prepush:full`                                                                                                                                                                                                                                                                                                                                                    |

## E2E helpers

Layout: helpers in [`tests/e2e/`](tests/e2e/), re-exported from [`tests/helpers.ts`](tests/helpers.ts); overflow, neighbor-gap, and stage-fit assertions live in [`tests/e2e/layout-assertions.ts`](tests/e2e/layout-assertions.ts); page objects in [`tests/pages/`](tests/pages/); Playwright fixtures in [`tests/fixtures/e2e.ts`](tests/fixtures/e2e.ts).

### When to use which test import

| Import                                    | Use for                                                                                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `import { test } from "./fixtures/e2e"`   | Most battle/flow specs — opt-in `fastBattle` + `runtimeErrors` fixtures                                                                                      |
| `import { test } from "@playwright/test"` | Animation specs (`draw-discard-animations.spec.ts`, `battle-end-turn-canary.spec.ts`) — **no** fast mode; also boot-only smoke (`alchemy.spec.ts` uses both) |

**Decision tree:**

1. **Animation canary or animation-focused spec** → raw `@playwright/test`, never `enableFastMode` / `fastBattle`.
2. **Combat or turn cycling** → `fixtures/e2e` and declare `{ page, fastBattle, runtimeErrors }` with `void fastBattle; void runtimeErrors;`.
3. **Manual fast mode without fixtures** → `enableFastMode(page)` in `beforeEach` or per test (e.g. `run-outcomes.spec.ts` when not using `fastBattle`).
4. **Visibility-only battle checks** (no `endTurn` / card play) → `fastBattle` recommended but optional (`accessibility.spec.ts`, `save-mid-combat-resume.spec.ts`).

### Navigation and bootstrap

- **`openGameModeSelect`** — retries Play if the menu unmounts during bootstrap.
- **`selectGameMode`** — clicks the mode art card (immediate begin or resume); there is no Play/Resume footer.
- **`selectCharacterAndContinue`** — clicks a hero portrait to begin; there is no Back/Continue footer. Leave via the screen menu.
- **`resumeCampaignRun`** — use for campaign resume; waits for destination when `currentScreen` was saved as `destination` instead of clicking Play during hydrate.
- **`startBattleWithDeck`**, **`startAtDestination`**, **`skipBattleAndClaimReward`**, **`startCampaignBattle`** — battle bootstrap (`tests/e2e/battle-setup.ts`).
- **`assertDefeatFromEndRun`** — end run from battle menu and assert defeat screen (`tests/e2e/run-end.ts`).
- **`injectMidCombatSave`** — inject a save mid-combat for resume tests (`tests/e2e/mid-combat-save.ts`).
- **`injectDestinationAtIndex`** — inject a campaign save paused at a destination index (`tests/e2e/save-injection.ts`).
- **`injectMysterySummaryVisit`** — inject a campaign save paused on the mystery Continue summary (`tests/e2e/save-injection.ts`).
- **`failOnRuntimeErrors`** — manual console/pageerror collection when not using the fixture (e.g. boot smoke in `alchemy.spec.ts`).

### Card factories (`tests/e2e/cards.ts`)

- **`makeCard`**, **`makeHighDamageCard`**, **`makeStatusCard`** — deck builders for E2E.
- Preset cards: **`ANVIL_CARD`**, **`MANA_BERRIES_CARD`**, etc.

### Battle page object

- **`enableFastMode`** — disables animations via `localStorage`; safe for most battle tests. Do **not** use in `battle-end-turn-canary.spec.ts`, `draw-discard-animations.spec.ts`, or other animation-focused specs. ESLint blocks `fixtures/e2e` and `enableFastMode` in those files.
- **`BattlePage.endTurn`** — must work with animations off (fast tests) and on (canary + full suite). Changing it requires the prepush canary to pass.
- **`winViaCombat(maxTurns?)`** — play all cards and end turns until victory; use for preview-safe wins.
- **`playCardNamed(title)`** — click a named card in hand (`Play ${title}` button); use when the deck defines explicit titles.
- **`playFirstCard()`** — play the first card in hand; use for generic `makeCard()` decks.
- **`playAllCards()`** — used internally by `winViaCombat`; rarely needed directly.
- **Do not** use `skipCombatToVictory()`, `skipCombatBtn`, or target Skip Combat / Unlock All strings in e2e specs — hidden in preview/production. ESLint enforces this in `eslint.config.js` for `tests/**/*.spec.ts`.
- In-game **Skip** buttons (e.g. Wildwood reward skip) are legitimate UI, not dev QA shortcuts.

### Fixtures (`tests/fixtures/e2e.ts`)

- **`fastBattle`** — opt-in fixture dep; calls `enableFastMode` before the test when listed in the callback params and referenced (`void fastBattle;`).
- **`runtimeErrors`** — collects page errors and asserts `[]` after each test.
- **`autoDiagnostic`** — runs automatically on every test. If a test fails, it automatically dumps browser console logs, page errors, and a 10KB DOM snapshot to `test-results/failures/<test-title>.md` to allow agents and developers to quickly inspect the failures in text format.

### Page objects (`tests/pages/`)

`BattlePage`, `MenuPage`, `DestinationPage`, `RewardPage`, `ShopPage`, `MysteryPage`, `CorruptionPage`, `HomesteadPage`, `GameStage`.

### Tags (`tests/playwright-tags.ts`)

- **`@prepush`** — fast subset selected into the CI `@critical` command and run by the pre-push hook (`npm run test:e2e:prepush`). App boot + battle canary.
- **`@critical`** — CI gate on every push (`npm run test:e2e:prepush:full` greps `@critical|@prepush`). Keep representative fast coverage for core gameplay, save integrity, progression locks, difficulty select, combat mechanics, armory in battle, keyboard navigation, and cheap adjacent flows. Treat the live Playwright report—not a documented count or duration—as the source of truth for suite size and timing.
- **`@smoke`** — quick boot/menu checks (alchemy boot + Electron boot).
- **`@slow`** — intentionally slow specs (animation canaries, viewport loops). Runs in full E2E on release; can be run manually with `npm run test:e2e:slow`.
- **`@armory`** — armory screen / gear interaction specs. Overlaps with `critical` and `slow` on a per-test basis.

The `save-gate` job (`test:ship:e2e`, path-filtered) re-runs the full `save-persistence`/`save-error-paths` specs, including their `@critical` tests; that overlap with the always-on e2e gate is intentional redundancy for save-touching pushes.

## Before you push

The default local hook is `npm run check:push` (format, TypeScript for src and tests, ESLint, a fresh production build, `@prepush` E2E canary). CI is the full gate after every push to `main`. Do **not** require a GitHub **push** status check on `main` — that blocks trunk pushes before CI can run.

`lefthook` `pre-push` runs `check:push` against a freshly built bundle (`ALCHEMY_SKIP_ASSETS=1`) so the animation canary never hits stale `dist/`. Default pre-push skips `lint:boundaries` and `deadcode` — those run in CI `lint:ci` and in optional `check:push:full` via `check`.

`npm run check:push:full` is optional local static+unit (`lint:ci` + Vitest + web build) plus the same `@prepush` E2E canary. It is **not** CI E2E parity — that is `npm run test:e2e:prepush:full` (`@critical|@prepush`).

Install hooks once: `npm run prepare` (runs on `npm install`).

`lefthook` `pre-commit` runs `npm ci --dry-run`, `npm run typecheck`, and Prettier on **staged files** that match `scripts/prettier-paths.mjs` (same set as `npm run format` / `format:check`). Do not hand-duplicate those globs in lefthook.

E2E timings / flakiness: `npm run test:e2e:timings`, `npm run test:e2e:audit`. Frame pacing (on-demand, not CI): [docs/PERFORMANCE.md](./docs/PERFORMANCE.md). Release gate: `npm run release` (includes `check:ship:full`). Script catalog: [REFERENCE.md](./docs/REFERENCE.md#script-command-reference).

### Lint / format / dead-code commands

| Command                           | Role                                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------------ |
| `npm run format` / `format:check` | Prettier via `scripts/run-prettier.mjs`                                                          |
| `npm run lint`                    | ESLint (`eslint.config.js` + `eslint/`)                                                          |
| `npm run lint:boundaries`         | dependency-cruiser phase / lib edges                                                             |
| `npm run lint:architecture-smoke` | Cold ESLint smoke over representative screens and effective-config checks; included in `lint:ci` |
| `npm run deadcode`                | knip (`lint:ci` / CI; not default `pre-push`; in `check:push:full` via `check`)                  |
| `npm run deadcode:strict`         | knip strict + entry exports, deps excluded (nightly)                                             |
| `npm run lint:ci`                 | format:check → typecheck:all → lint → boundaries → architecture-smoke → deadcode                 |

First-time Playwright: `npx playwright install chromium`.

Local leftover reports/builds: `npm run clean` (safe artifacts) or `npm run clean:all` (also `dist` / `release-desktop` + stale E2E ports `4173`/`4175`). The main Vite port is left alone unless you pass `--include-dev-port`.

**PowerShell command chaining:** PowerShell 7 supports `&&` and `||`; prefer them for simple chains. Use `; if ($?) { next-command }` only when you need a conditional block; `;` alone ignores exit codes on Windows.

## CI parity

| Job                                             | Local equivalent                                                                                                                                                                                |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CI `ship-gate`                                  | `ALCHEMY_SKIP_ASSETS=1 npm run build:desktop` (path-gated by `desktop_renderer` across Electron + renderer routing/boot/screen changes, after unit tests pass); uploads `dist-desktop` artifact |
| CI `assets`                                     | `node scripts/prepare-assets.mjs` + git diff on committed outputs (path-filtered on Raw Assets / asset scripts / committed outputs)                                                             |
| CI `save-gate`                                  | `npm run test:ship:e2e` (path-filtered)                                                                                                                                                         |
| CI `desktop-build` / `electron-e2e`             | `npm run dist:desktop` / `npm run test:ship:desktop` (electron reuses ship-gate `dist/`)                                                                                                        |
| CI `e2e` (`@critical` + `@prepush`, every push) | `npm run build && npm run test:e2e:prepush:full`                                                                                                                                                |
| Pre-push hook                                   | `npm run check:push`                                                                                                                                                                            |
| Tag `v*` release (`e2e-full` + release job)     | `npm run release` — see [docs/RELEASE.md](./docs/RELEASE.md); release job runs `dist:desktop` once (no `check:ship` rebuild)                                                                    |

CI surfaces failures via GitHub check annotations (Vitest `github-actions` / Playwright `github` reporters) and a short job Step Summary from `scripts/ci-summarize-*.mjs`. The `lint` job runs each `lint:ci` stage as its own step so the failed step name identifies format vs typecheck vs ESLint vs boundaries vs knip. Local `check:push:full` matches CI for static analysis + Vitest + web build, but keeps `@prepush` E2E only; the default pre-push hook uses the faster `check:push` subset (no boundaries/knip).

Path-filtered jobs (`assets`, `save-gate`, `desktop-build`, `electron-e2e`) are gated by the `changes` job (`dorny/paths-filter`); `ship-gate` and `electron-e2e` share the broader `desktop_renderer` filter, while installer packaging uses the narrower `desktop` filter. On `workflow_dispatch` they always run. A newer push to `main` cancels an in-progress CI run for that ref. Shared job setup (Node + `npm ci`) lives in the composite action `.github/actions/setup`. Nightly failures show as a failed workflow run only.

## Changelog and patch notes

When explicitly asked to commit or push, agents work directly on `main`; there is no required PR merge step. **Do not edit `CHANGELOG.md`.** Conventional commit messages are the day-to-day source of truth.

- **Release:** `npm run release` / `release:hotfix` runs `sync-changelog.mjs` (fill ## [Unreleased] from recognized Conventional Commits since the latest `v*` tag) then `release-changelog.mjs` (promote that section to `[x.y.z]`). Merge/non-conventional history noise is omitted and verbose bodies are capped; full detail remains in git. Wired in `.versionrc.json` as `prerelease` / `postbump`.
- **Draft patch notes anytime:** `npm run generate:patch-notes` → `release-notes/UNRELEASED.md` (derives from git in memory; does not require a synced `CHANGELOG.md` on disk).
- **Optional preview:** `npm run sync:changelog` rewrites ## [Unreleased] locally — not part of normal commits or CI.

Commit message rules: [Conventional Commits](https://www.conventionalcommits.org/). Release flow: [RELEASE.md](./docs/RELEASE.md).

**Docs:** [AGENTS.md](./AGENTS.md) (rules) · [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) (run state) · [docs/WORKFLOWS.md](./docs/WORKFLOWS.md) (how-to) · [docs/REFERENCE.md](./docs/REFERENCE.md) (commands, glossary, battle) · [MIGRATIONS.md](./src/features/alchemy/shared/storage/MIGRATIONS.md) (save-compat) · [docs/ARMORY.md](./docs/ARMORY.md) (gear) · [docs/PERFORMANCE.md](./docs/PERFORMANCE.md) (FPS profiling) · [docs/RELEASE.md](./docs/RELEASE.md) (Steam) · [docs/Audits](./docs/Audits/README.md) (audits)
