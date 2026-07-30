# Contributing

## Before you push

GitHub branch protection is not available on this repo, so **local hooks are the main gate**.

`lefthook` `pre-push` runs sequentially (`piped: true`):

1. `node scripts/sync-changelog-commit.mjs` — sync `CHANGELOG.md` ## [Unreleased] from git and auto-commit when dirty
2. `npm ci --dry-run`
3. `npm run lint:ci` (format, TypeScript, ESLint, phase boundaries via dependency-cruiser, architecture smoke, knip)
4. `npm test` (Vitest)
5. `npm run build` (web production build; desktop is covered by CI ship-gate / desktop jobs)
6. `npm run test:e2e:prepush` — fast **@prepush** subset (parallel preview build; includes one animation canary)

**Before pushing to `main`**, also run `npm run test:e2e:prepush:full` (`@critical`, preview + CI flags). The pre-push hook only runs `@prepush`; CI on every push runs the `@critical` suite (which also includes `@prepush` tests). If using a PR branch, run the same before opening the PR.

To analyze test performance and trace failures, you can run:

- `npm run test:e2e:timings` — runs the E2E suite and exports a timing/stats JSON to `reports/e2e-results.json`.
- `npm run test:e2e:audit` — runs the timing E2E suite and automatically compiles a diagnostic markdown report to `reports/e2e-audit-report.md`.

Manual full gate before **releasing**: `npm run release` (pre-flight gate including `check:ship:full`). Lighter checks: `npm run check:push` or `npm run test:e2e:prepush:full` (`@critical` only).

Install hooks once: `npm run prepare` (runs on `npm install`).

`lefthook` `pre-commit` runs `npm ci --dry-run`, `npm run typecheck`, and Prettier on **staged files** that match `scripts/prettier-paths.mjs` (same set as `npm run format` / `format:check`: `src`, `tests`, `scripts`, `desktop`, `docs`, plus root `*.{js,json,md,ts,yml,yaml}` and `.prettierrc`). Do not hand-duplicate those globs in lefthook.

### Lint / format / dead-code commands

| Command                           | Role                                                                |
| --------------------------------- | ------------------------------------------------------------------- |
| `npm run format` / `format:check` | Prettier via `scripts/run-prettier.mjs`                             |
| `npm run lint`                    | ESLint (`eslint.config.js` + `eslint/`)                             |
| `npm run lint:boundaries`         | dependency-cruiser phase / lib edges                                |
| `npm run lint:architecture-smoke` | Cold ESLint lintFiles smoke (not in Vitest)                         |
| `npm run deadcode`                | knip (CI / pre-push)                                                |
| `npm run deadcode:strict`         | knip strict + entry exports, deps excluded (nightly)                |
| `npm run lint:ci`                 | format:check → typecheck:all → lint → boundaries → smoke → deadcode |

First-time Playwright: `npx playwright install chromium`.

**PowerShell command chaining:** PowerShell 7 supports `&&` and `||`; prefer them for simple chains. Use `; if ($?) { next-command }` only when you need a conditional block; `;` alone ignores exit codes on Windows.

## Changelog and patch notes

When explicitly asked to commit or push, agents work directly on `main`; there is no required PR merge step. Commit messages feed an automated changelog:

- **Pre-push hook** syncs `CHANGELOG.md` ## [Unreleased] from git history since the latest `v*` tag
- **Player-facing draft:** `npm run generate:patch-notes` → `release-notes/UNRELEASED.md`
- **Drift guard:** `tests/architecture/changelog-sync.test.ts` (also in `npm run test:ship:unit`)

Commit message rules: [Conventional Commits](https://www.conventionalcommits.org/). Release flow: [RELEASE.md](./docs/RELEASE.md).

## What to run when you change…

| Area                            | Paths (examples)                                                                                                                                                   | Run locally                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Active run / screen / bootstrap | `run-domain-store.ts`, `run-profile-store.ts`, `run-transient-store.ts`, `run-battle-domain-store.ts`, `run-transitions.ts`, `shell/use-alchemy-run-controller.ts` | `npm test -- tests/features/alchemy/shared/stores/ tests/features/alchemy/shell/ tests/architecture/active-run-bootstrap.test.ts` then `npm run test:e2e:prepush`                                                                                                                                                                                                                                                                                                                   |
| Save / persistence              | `shared/storage/`, `src/lib/validation/save-schemas/`, `active-run.ts`                                                                                             | `npm test -- tests/features/alchemy/shared/storage` + `tests/save-persistence.spec.ts` + `npm run test:e2e:prepush`                                                                                                                                                                                                                                                                                                                                                                 |
| Battle / cards                  | `src/lib/battle/`, `src/lib/game-data/`                                                                                                                            | `npm test -- tests/lib/battle` + `tests/lib/game-data/descriptions-match-effects.test.ts`                                                                                                                                                                                                                                                                                                                                                                                           |
| Routing / destinations          | `src/lib/routing/`                                                                                                                                                 | `npm test -- tests/lib/routing/destination-availability.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Gear                            | `src/lib/gear/`, Armory screens                                                                                                                                    | `npm test -- tests/lib/gear tests/features/alchemy/shared/stores/gear-store.test.ts tests/features/alchemy/shared/stores/gear-crafting.test.ts tests/features/alchemy/meta/screens/armory-screen.test.tsx tests/features/alchemy/meta/screens/armory/armory-resolve-equip-swap.test.ts tests/features/alchemy/shared/storage/gear-save.test.ts` + `npx playwright test tests/armory-crafting.spec.ts tests/gear-equip.spec.ts tests/gear-drag-positions.spec.ts --project chromium` |
| Integration-style unit tests    | `run-domain.test.ts`, `storage.test.ts`, `reward-flow*.test.ts`, `shell/*-hook.test.ts`                                                                            | `npm test -- tests/features/alchemy/shared/stores/run-domain.test.ts tests/features/alchemy/shared/storage tests/features/alchemy/run-loop/navigation/reward-flow tests/features/alchemy/shell`                                                                                                                                                                                                                                                                                     |
| Battle E2E helpers              | `tests/pages/battle-page.ts`, `tests/helpers.ts` (`enableFastMode`)                                                                                                | `npm run test:e2e:prepush` (animation canary) + `npm run test:e2e:main-gate` before pushing to `main`                                                                                                                                                                                                                                                                                                                                                                               |
| UI flows                        | `screens/`, controllers                                                                                                                                            | Relevant `tests/*.spec.ts` + `npm run test:e2e:prepush`                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Any push to `main`              | —                                                                                                                                                                  | Pre-push hook + `npm run test:e2e:main-gate` when battle/helpers change                                                                                                                                                                                                                                                                                                                                                                                                             |

## E2E helpers

Layout: bootstrap helpers in [`tests/e2e/`](tests/e2e/) (`battle-setup.ts`, `armory.ts`, `navigation.ts`, `errors.ts`), re-exported from [`tests/helpers.ts`](tests/helpers.ts); page objects in [`tests/pages/`](tests/pages/); Playwright fixtures in [`tests/fixtures/e2e.ts`](tests/fixtures/e2e.ts).

### When to use which test import

| Import                                    | Use for                                                                                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `import { test } from "./fixtures/e2e"`   | Most battle/flow specs — opt-in `fastBattle` + `runtimeErrors` fixtures                                                                                      |
| `import { test } from "@playwright/test"` | Animation specs (`draw-discard-animations.spec.ts`, `battle-end-turn-canary.spec.ts`) — **no** fast mode; also boot-only smoke (`alchemy.spec.ts` uses both) |

**Decision tree:**

1. **Animation canary or animation-focused spec** → raw `@playwright/test`, never `enableFastMode` / `fastBattle`.
2. **Combat or turn cycling** → `fixtures/e2e` and declare `{ page, fastBattle, runtimeErrors }` with `void fastBattle; void runtimeErrors;`.
3. **Manual fast mode without fixtures** → `enableFastMode(page)` in `beforeEach` or per test (e.g. `run-victory-flow.spec.ts`, `progression-locks.spec.ts`).
4. **Visibility-only battle checks** (no `endTurn` / card play) → `fastBattle` recommended but optional (`accessibility.spec.ts`, `save-mid-combat-resume.spec.ts`).

### Navigation and bootstrap

- **`openGameModeSelect`** — retries Play if the menu unmounts during bootstrap.
- **`resumeCampaignRun`** — use for campaign resume; waits for destination when `currentScreen` was saved as `destination` instead of clicking Play during hydrate.
- **`startBattleWithDeck`**, **`startAtDestination`**, **`skipBattleAndClaimReward`**, **`startCampaignBattle`** — battle bootstrap (`tests/e2e/battle-setup.ts`).
- **`assertDefeatFromEndRun`** — end run from battle menu and assert defeat screen (`tests/e2e/run-end.ts`).
- **`injectMidCombatSave`** — inject a save mid-combat for resume tests (`tests/e2e/mid-combat-save.ts`).
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

- **`@prepush`** — fast subset of `@critical` in the pre-push hook (`npm run test:e2e:prepush`). App boot + battle canary.
- **`@critical`** — CI gate on every push (`npm run test:e2e:prepush:full`). One or two fast tests per area covering core gameplay, save integrity, progression locks, difficulty select, combat mechanics, armory in battle, keyboard navigation. **~60-75 tests, ≤3 min on CI.**
- **`@smoke`** — quick boot/menu checks (alchemy boot + Electron boot).
- **`@slow`** — intentionally slow specs (animation canaries, drag-and-drop, viewport loops). Runs in full E2E on release; can be run manually with `npm run test:e2e:slow`.
- **`@armory`** — armory screen / gear interaction specs. Overlaps with `critical` and `slow` on a per-test basis.

## CI parity

| Job                                         | Local equivalent                                                                                                             |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| CI `ship-gate`                              | `npm run build:desktop:no-sync` (after unit tests pass)                                                                      |
| CI `save-gate`                              | `npm run test:ship:e2e` (path-filtered)                                                                                      |
| CI `desktop-build` / `electron-e2e`         | `npm run dist:win` / `npm run test:ship:desktop`                                                                             |
| CI `e2e` (`@critical`, every push)          | `npm run build && npm run test:e2e:prepush:full`                                                                             |
| Pre-push hook                               | `npm run build && npm run test:e2e:prepush`                                                                                  |
| Tag `v*` release (`e2e-full` + release job) | `npm run release` — see [docs/RELEASE.md](./docs/RELEASE.md); release job runs `dist:desktop` once (no `check:ship` rebuild) |

CI surfaces failures via GitHub check annotations (Vitest `github-actions` / Playwright `github` reporters) and a short job Step Summary from `scripts/ci-summarize-*.mjs`. The `lint` job runs each `lint:ci` stage as its own step so the failed step name identifies format vs typecheck vs ESLint vs boundaries vs knip. Local/pre-push still use `npm run lint:ci`.

Path-filtered jobs (`save-gate`, `desktop-build`, `electron-e2e`) are gated by the `changes` job (`dorny/paths-filter`); on `workflow_dispatch` they always run. The `ci-ok` job aggregates every CI job into a single status check — use it as the sole required check in branch protection. Shared job setup (Node + `npm ci`) lives in the composite action `.github/actions/setup`. Nightly failures open or update a GitHub issue labeled `nightly-failure`.

**Docs:** [AGENTS.md](./AGENTS.md) (rules) · [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) (run state) · [docs/WORKFLOWS.md](./docs/WORKFLOWS.md) (how-to) · [docs/REFERENCE.md](./docs/REFERENCE.md) (commands, glossary, battle) · [docs/RELEASE.md](./docs/RELEASE.md) (Steam) · [docs/Audits](./docs/Audits/README.md) (audits)
