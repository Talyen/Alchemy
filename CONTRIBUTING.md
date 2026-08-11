# Contributing

## Before you push

The default local hook is the pre-push gate: it catches formatting, TypeScript (src _and_ tests), ESLint, a fresh production build, and the small Playwright canary. CI is the comprehensive gate after every push to `main` (and on PRs). Do **not** require `ci-ok` as a GitHub **push** gate on `main` — that blocks trunk pushes before CI can run. Rely on local `pre-push`, post-push CI, and the [CI fixer bot](./docs/CI-FIXER.md) on failures. Use `npm run check:push:full` before a high-risk push when you want the full static gate + Vitest locally (still `@prepush` E2E only).

Merging a **PR** into `main` does require the aggregate **`CI OK`** check (repository ruleset; Admin bypass keeps direct trunk pushes allowed). Fixer PRs must use squash auto-merge only — never admin force-merge. Policy and the live automation prompt live in [docs/CI-FIXER.md](./docs/CI-FIXER.md).

`lefthook` `pre-push` runs `npm run check:push` — format check, `typecheck:all`, ESLint, a production build with committed assets (`ALCHEMY_SKIP_ASSETS=1`), then the **@prepush** E2E subset against that freshly built bundle (includes one animation canary). Building before E2E guarantees the canary never runs against stale `dist/`. Default pre-push skips `lint:boundaries` and `deadcode` — those run in CI `lint:ci` and in `check:push:full` via `check`.

`npm run check:push:full` is the fuller local static+unit gate: `check` (`lint:ci` + Vitest + web build) plus the same **@prepush** E2E canary as the hook. It is **not** CI E2E parity — CI runs `@critical|@prepush` via `npm run test:e2e:prepush:full`. On PR branches, wait for `ci-ok` before merging.

To analyze test performance and trace failures, you can run:

- `npm run test:e2e:timings` — runs the E2E suite and exports a timing/stats JSON to `reports/e2e-results.json`.
- `npm run test:e2e:audit` — runs the timing E2E suite and automatically compiles a diagnostic markdown report to `reports/e2e-audit-report.md`.

For **frame pacing / hitch profiling** (on-demand only, not CI): see [docs/PERFORMANCE.md](./docs/PERFORMANCE.md). Commands: `npm run perf`, `npm run perf:trace`, `npm run perf:compare`.

Manual full gate before **releasing**: `npm run release` (pre-flight gate including `check:ship:full`). Fast local checks: `npm run check:push` or `npm run test:e2e:prepush`. Fuller local static+unit: `npm run check:push:full`. CI E2E parity locally: `npm run test:e2e:prepush:full` (`@critical|@prepush`).

Install hooks once: `npm run prepare` (runs on `npm install`).

`lefthook` `pre-commit` runs `npm ci --dry-run`, `npm run typecheck`, and Prettier on **staged files** that match `scripts/prettier-paths.mjs` (same set as `npm run format` / `format:check`: `src`, `tests`, `scripts`, `desktop`, `docs`, `performance`, plus root `*.{js,json,md,ts,yml,yaml}` and `.prettierrc`). Do not hand-duplicate those globs in lefthook.

### Lint / format / dead-code commands

| Command                           | Role                                                                                                  |
| --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `npm run format` / `format:check` | Prettier via `scripts/run-prettier.mjs`                                                               |
| `npm run lint`                    | ESLint (`eslint.config.js` + `eslint/`)                                                               |
| `npm run lint:boundaries`         | dependency-cruiser phase / lib edges                                                                  |
| `npm run lint:architecture-smoke` | Optional cold ESLint smoke over representative screens; subsumed by `npm run lint` (not in `lint:ci`) |
| `npm run deadcode`                | knip (`lint:ci` / CI; not default `pre-push`; in `check:push:full` via `check`)                       |
| `npm run deadcode:strict`         | knip strict + entry exports, deps excluded (nightly)                                                  |
| `npm run lint:ci`                 | format:check → typecheck:all → lint → boundaries → deadcode                                           |

First-time Playwright: `npx playwright install chromium`.

Local leftover reports/builds: `npm run clean` (safe artifacts) or `npm run clean:all` (also `dist` / `release-desktop` + stale E2E ports `4173`/`4175`). The main Vite port is left alone unless you pass `--include-dev-port`. Details: [REFERENCE.md § Script Command Reference](./docs/REFERENCE.md#script-command-reference).

**PowerShell command chaining:** PowerShell 7 supports `&&` and `||`; prefer them for simple chains. Use `; if ($?) { next-command }` only when you need a conditional block; `;` alone ignores exit codes on Windows.

## Changelog and patch notes

When explicitly asked to commit or push, agents work directly on `main`; there is no required PR merge step. **Do not edit `CHANGELOG.md`.** Conventional commit messages are the day-to-day source of truth.

- **Release:** `npm run release` / `release:hotfix` runs `sync-changelog.mjs` (fill ## [Unreleased] from recognized Conventional Commits since the latest `v*` tag) then `release-changelog.mjs` (promote that section to `[x.y.z]`). Merge/non-conventional history noise is omitted and verbose bodies are capped; full detail remains in git. Wired in `.versionrc.json` as `prerelease` / `postbump`.
- **Draft patch notes anytime:** `npm run generate:patch-notes` → `release-notes/UNRELEASED.md` (derives from git in memory; does not require a synced `CHANGELOG.md` on disk).
- **Optional preview:** `npm run sync:changelog` rewrites ## [Unreleased] locally — not part of normal commits or CI.

Commit message rules: [Conventional Commits](https://www.conventionalcommits.org/). Release flow: [RELEASE.md](./docs/RELEASE.md).

## What to run when you change…

| Area                            | Paths (examples)                                                                                                                     | Run locally                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Active run / screen / bootstrap | `gameplay-state-store.ts`, capability ports, `run-transitions.ts`, `use-alchemy-bootstrap.ts`, `shell/use-alchemy-run-controller.ts` | `npm test -- tests/app/use-alchemy-bootstrap.test.ts tests/features/alchemy/shared/stores/ tests/features/alchemy/shell/ tests/types/run-architecture-contracts.test.ts` then `npm run lint:boundaries` and `npm run test:e2e:prepush`                                                                                                                                                                                                                                              |
| Save / persistence              | `shared/storage/`, `src/lib/validation/save-schemas/`, `active-run.ts`                                                               | `npm test -- tests/features/alchemy/shared/storage` + `tests/save-persistence.spec.ts` + `npm run test:e2e:prepush`                                                                                                                                                                                                                                                                                                                                                                 |
| Battle / cards                  | `src/lib/battle/`, `src/lib/game-data/`                                                                                              | `npm test -- tests/lib/battle` + `tests/lib/game-data/descriptions-match-effects.test.ts`                                                                                                                                                                                                                                                                                                                                                                                           |
| Routing / destinations          | `src/lib/routing/`, `app/screen-routes/`, `shell/use-screen-transitions.ts`                                                          | `npm test -- tests/lib/routing tests/features/alchemy/shell/use-screen-navigation.test.ts tests/features/alchemy/shell/screen-transition.test.ts` + `npm run test:e2e:prepush`                                                                                                                                                                                                                                                                                                      |
| Gear                            | `src/lib/gear/`, Armory screens                                                                                                      | `npm test -- tests/lib/gear tests/features/alchemy/shared/stores/gear-store.test.ts tests/features/alchemy/shared/stores/gear-crafting.test.ts tests/features/alchemy/meta/screens/armory-screen.test.tsx tests/features/alchemy/meta/screens/armory/armory-resolve-equip-swap.test.ts tests/features/alchemy/shared/storage/gear-save.test.ts` + `npx playwright test tests/armory-crafting.spec.ts tests/gear-equip.spec.ts tests/gear-drag-positions.spec.ts --project chromium` |
| Integration-style unit tests    | `run-domain.test.ts`, `storage.test.ts`, `reward-flow*.test.ts`, `shell/*-hook.test.ts`                                              | `npm test -- tests/features/alchemy/shared/stores/run-domain.test.ts tests/features/alchemy/shared/storage tests/features/alchemy/run-loop/navigation/reward-flow tests/features/alchemy/shell`                                                                                                                                                                                                                                                                                     |
| Battle E2E helpers              | `tests/pages/battle-page.ts`, `tests/helpers.ts` (`enableFastMode`)                                                                  | `npm run test:e2e:prepush` (animation canary) + relevant specs; CI runs `npm run test:e2e:full` in the broader/release tiers                                                                                                                                                                                                                                                                                                                                                        |
| UI flows                        | `screens/`, controllers                                                                                                              | Relevant `tests/*.spec.ts` + `npm run test:e2e:prepush`; longer UI coverage runs in CI/nightly                                                                                                                                                                                                                                                                                                                                                                                      |
| Any push to `main`              | —                                                                                                                                    | Fast pre-push hook (`check:push`); CI `ci-ok` runs after push (fixer bot on failure — [docs/CI-FIXER.md](./docs/CI-FIXER.md)). Use `npm run check:push:full` for full static+unit locally (`@prepush` E2E only); use `test:e2e:prepush:full` for CI E2E parity                                                                                                                                                                                                                      |

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

- **`@prepush`** — fast subset selected into the CI `@critical` command and run by the pre-push hook (`npm run test:e2e:prepush`). App boot + battle canary.
- **`@critical`** — CI gate on every push (`npm run test:e2e:prepush:full` greps `@critical|@prepush`). Keep representative fast coverage for core gameplay, save integrity, progression locks, difficulty select, combat mechanics, armory in battle, keyboard navigation, and cheap adjacent flows. Treat the live Playwright report—not a documented count or duration—as the source of truth for suite size and timing.
- **`@smoke`** — quick boot/menu checks (alchemy boot + Electron boot).
- **`@slow`** — intentionally slow specs (animation canaries, drag-and-drop, viewport loops). Runs in full E2E on release; can be run manually with `npm run test:e2e:slow`.
- **`@armory`** — armory screen / gear interaction specs. Overlaps with `critical` and `slow` on a per-test basis.

The `save-gate` job (`test:ship:e2e`, path-filtered) re-runs the full `save-persistence`/`save-error-paths` specs, including their `@critical` tests; that overlap with the always-on e2e gate is intentional redundancy for save-touching pushes.

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

Path-filtered jobs (`assets`, `save-gate`, `desktop-build`, `electron-e2e`) are gated by the `changes` job (`dorny/paths-filter`); `ship-gate` and `electron-e2e` share the broader `desktop_renderer` filter, while installer packaging uses the narrower `desktop` filter. On `workflow_dispatch` they always run. The `ci-ok` job aggregates every CI job into a single status check — required to **merge PRs** into `main`, not a required **push** gate on `main`. Shared job setup (Node + `npm ci`) lives in the composite action `.github/actions/setup`. Nightly failures open or update a GitHub issue labeled `nightly-failure`. CI fixer Tier B escalations use label `ci-autofix-failed` (deduped; see [docs/CI-FIXER.md](./docs/CI-FIXER.md)).

**Docs:** [AGENTS.md](./AGENTS.md) (rules) · [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) (run state) · [docs/WORKFLOWS.md](./docs/WORKFLOWS.md) (how-to) · [docs/REFERENCE.md](./docs/REFERENCE.md) (commands, glossary, battle) · [docs/RELEASE.md](./docs/RELEASE.md) (Steam) · [docs/CI-FIXER.md](./docs/CI-FIXER.md) (CI fixer bot) · [docs/Audits](./docs/Audits/README.md) (audits)
