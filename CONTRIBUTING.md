# Contributing

Install dependencies with `npm ci`, find the canonical owner for the behavior
in the [documentation map](./README.md#documentation), and keep the change
focused on that owner. During implementation, run
`npm run verify:changed -- --diff`; before pushing, run `npm run check:push`.
Use Conventional Commits and
leave `CHANGELOG.md` to the release automation.

## What to run when you change…

The executable catalog in `scripts/lib/change-routes.mjs` owns path-to-command and path-to-document selection; `scripts/verify-changed.mjs` executes its deduplicated plan.

- During development: `npm run verify:changed -- --diff` (or pass explicit paths).
- Asset source or pipeline changes also route through `npm run assets:check`,
  which verifies complete preparation is idempotent. If preparation would change
  outputs, the check restores them and fails with the changed paths.
- Inspect without running: add `--plan`; use `--verbose-plan` only when full argv is needed.
- Local defaults run focused unit suites plus the `@prepush` canary only; no focused browser flow runs by default. All five focused flows (`save`, `shop`, `audio`, `gear`, `mystery`) are opt-in via `--e2e <route>`, or bare `--e2e` for every touched route; `--full` adds the full local handoff gate. CI owns these flows: every-push critical gate, path-filtered `save-gate` / `shop-gate` / `gear-gate` / `mystery-gate` / `audio-gate`, and nightly.
- The Electron desktop suite (`test:ship:desktop`) is CI-only: it runs on pushes matching the `desktop_renderer` path filter and unconditionally on nightly. Run it locally only by explicit choice.
- Unknown paths are labeled `unknown` and receive a TypeScript fallback with a warning that non-TypeScript behavior may not be exercised.
- Canonical route fixtures and selected commands are tested in `tests/scripts/verify-changed.test.ts`.
- On any push to `main`, use the fast pre-push hook (`check:push`); CI runs after push. CI E2E parity is `test:e2e:prepush:full`.

## E2E policy

E2E fixture, bootstrap, page-object, tag, and diagnostic instructions live in
[tests/e2e/README.md](./tests/e2e/README.md). This document owns only the
changed-path and CI tier policy. When a test fails, follow
[failure-first triage](./docs/REFERENCE.md#failure-first-triage) before opening
raw traces or report directories.

## Before you push

Execution plans are short-lived working documents under [`docs/Plans/`](docs/Plans/README.md). Run `npm run plans:check` while a plan is active; `npm run docs:check` includes that check plus repository-wide documentation contracts. When the work ends, mark the plan `complete` (or `cancelled`), refresh its `updated` date, and run `npm run docs:check:final`; the command archives terminal plans and requires no active plans to remain.

The default local hook is `npm run check:push` (format, TypeScript for src and tests, ESLint, a fresh production build, `@prepush` E2E canary). CI is the full gate after every push to `main`. Do **not** require a GitHub **push** status check on `main` — that blocks trunk pushes before CI can run.

`lefthook` `pre-push` runs `check:push` against a freshly built bundle (`ALCHEMY_SKIP_ASSETS=1`) so the animation canary never hits stale `dist/`. Default pre-push skips `lint:boundaries` and `deadcode` — those run in CI `lint:ci`.

Install hooks once: `npm run prepare` (runs on `npm install`).

`lefthook` `pre-commit` runs Prettier on **staged files** that match `scripts/prettier-paths.mjs` (same set as `npm run format` / `format:check`). Do not hand-duplicate those globs in lefthook. Static checks and the lockfile check live in `pre-push` (`lockfile-check` then `check:push`), which blocks the push anyway; CI repeats them.

E2E timings / flakiness: `npm run test:e2e:timings`, `npm run test:e2e:audit`.
Recent local verification/test records: `npm run runs:show -- --last 10`.
Frame pacing (on-demand, not CI): [docs/PERFORMANCE.md](./docs/PERFORMANCE.md).
Release command: `npm run release` runs `check:ship:full`, creates the release
commit and tag, pushes `main` and the tag, then watches GitHub Actions. Use it
only when intentionally shipping; see [RELEASE.md](./docs/RELEASE.md).

### Lint / format / dead-code commands

| Command                           | Role                                                                                                                                                                                                                                                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run format` / `format:check` | Prettier via `scripts/run-prettier.mjs`                                                                                                                                                                                                                                                                             |
| `npm run lint`                    | ESLint (`eslint.config.js` + `eslint/`)                                                                                                                                                                                                                                                                             |
| `npm run lint:boundaries`         | dependency-cruiser phase / lib edges                                                                                                                                                                                                                                                                                |
| `npm run lint:architecture-smoke` | Cold ESLint smoke over representative screens and effective-config checks; included in `lint:ci`                                                                                                                                                                                                                    |
| `npm run deadcode`                | knip (`lint:ci` / CI; not default `pre-push`)                                                                                                                                                                                                                                                                       |
| `npm run deadcode:strict`         | knip strict + entry exports, deps excluded (nightly)                                                                                                                                                                                                                                                                |
| `npm run lint:ci`                 | Nine concurrent static gates (docs:check, CI routing, generated-output check, format:check, typecheck:all, lint, boundaries, architecture-smoke, deadcode); fails fast on the first failure. The GitHub `lint` job runs this, then adds push-only `ci:verify-plan` (informational) and `check:test-owners`          |
| `npm run check:test-owners`       | CI-only on push: fail when a newly added `src` file has no mirrored Vitest owner. Screens, types, and generated files are excluded. `src/lib` requires a basename match (`src/lib/battle/dot-resolve.ts` → `tests/lib/battle/dot-resolve.test.ts`); other source may share a sibling test in the mirrored directory |
| `npm run ci:verify-plan`          | CI-only informational: print the `verify:changed --plan` for the push range                                                                                                                                                                                                                                         |
| `npm run test:mutation`           | Nightly Stryker canary on `damage-calc.ts` and `dot-resolve.ts`; not a local gate                                                                                                                                                                                                                                   |

Local leftover reports/builds: `npm run clean` (safe artifacts) or `npm run clean:all` (also `dist` / `release-desktop` + stale E2E/smoke ports `4173`/`4174`/`4175`). The main Vite port is left alone unless you pass `--include-dev-port`.

## CI parity

| Job                                                          | Local equivalent                                                                                                                                                                                |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CI `ship-gate`                                               | `ALCHEMY_SKIP_ASSETS=1 npm run build:desktop` (path-gated by `desktop_renderer` across Electron + renderer routing/boot/screen changes, after unit tests pass); uploads `dist-desktop` artifact |
| CI `assets`                                                  | `npm run assets:check` (path-filtered on Raw Assets, asset scripts/helpers, and committed outputs)                                                                                              |
| CI `save-gate`                                               | `npm run test:ship:e2e` (path-filtered)                                                                                                                                                         |
| CI `shop-gate` / `gear-gate` / `mystery-gate` / `audio-gate` | `npm run test:e2e:shop` / `test:e2e:gear` / `test:e2e:mystery` / `test:e2e:audio` (path-filtered; still opt-in locally via `verify:changed --e2e`)                                              |
| CI `desktop-build` / `electron-e2e`                          | `npm run dist:desktop` / desktop Playwright suite is CI-only (path-filtered job + nightly); manual opt-in: `npm run test:ship:desktop`                                                          |
| CI `e2e` (`@critical` + `@prepush`, every push)              | `npm run build && npm run test:e2e:prepush:full`                                                                                                                                                |
| Nightly `coverage`                                           | `npm run test:coverage` — unit tests with coverage thresholds from `vite.config.ts` (sparse checkout excludes Raw Assets; asset-reading suites self-skip)                                       |
| Nightly `mutation`                                           | `npm run test:mutation` — Stryker canary on `src/lib/battle/damage-calc.ts` and `src/lib/battle/dot-resolve.ts` (informational `break` threshold)                                               |
| Pre-push hook                                                | `npm run check:push`                                                                                                                                                                            |
| Tag `v*` release (`e2e-full` + release job)                  | `npm run release` — see [docs/RELEASE.md](./docs/RELEASE.md); release job runs `dist:desktop` once (no `check:ship` rebuild)                                                                    |

CI annotations, summaries, path filters, and shared setup are defined in
[`.github/workflows/ci.yml`](.github/workflows/ci.yml) and
[`.github/actions/setup`](.github/actions/setup).
Vitest and Playwright job summaries include a changed-path route hint so the next agent can open the digest instead of the raw report.
Cursor Bugbot is not a required GitHub check on `main`; use it as a post-push review on gameplay, save, and battle-rule diffs. Custom review focus lives in [`.cursor/BUGBOT.md`](./.cursor/BUGBOT.md).

## Changelog and patch notes

Changelog updates happen at release only; `CHANGELOG.md` is never hand-edited. Player patch notes are generated from git using `feat` / `fix` / `balance` / `perf`, changed paths, and an optional `User-Facing: yes` or `User-Facing: no` commit-body trailer. Release-time changelog promotion, `sync:changelog`, and `generate:patch-notes`: [RELEASE.md](./docs/RELEASE.md).
