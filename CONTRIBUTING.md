# Contributing

## What to run when you change…

The executable catalog in `scripts/lib/change-routes.mjs` owns path-to-command and path-to-document selection; `scripts/verify-changed.mjs` executes its deduplicated plan.

- During development: `npm run verify:changed -- --diff` (or pass explicit paths).
- Inspect without running: add `--plan`; use `--verbose-plan` only when full argv is needed.
- Save, gear, audio, and mystery routes include their focused E2E flow by default. `--e2e <route>` explicitly adds another supported screen flow; `--full` adds the full local handoff gate.
- Unknown paths are labeled `unknown` and receive a TypeScript fallback with a warning that non-TypeScript behavior may not be exercised.
- Canonical route fixtures and selected commands are tested in `tests/scripts/verify-changed.test.ts`.
- On any push to `main`, use the fast pre-push hook (`check:push`); CI runs after push. Optional fuller local static+unit is `check:push:full`, and CI E2E parity is `test:e2e:prepush:full`.

## E2E policy

E2E fixture, bootstrap, page-object, tag, and diagnostic instructions live in [tests/e2e/README.md](./tests/e2e/README.md). Animation-focused specs use raw `@playwright/test` without fast mode. When a test fails, follow [failure-first triage](./docs/REFERENCE.md#failure-first-triage) before opening raw traces or report directories.

## Before you push

Execution plans are short-lived working documents under [`docs/Plans/`](docs/Plans/README.md). Run `npm run docs:check` while a plan is active. Before final handoff, delete the completed plan and run `npm run docs:check:final`; pass `--keep-plan` only when intentionally handing unfinished work to a later task.

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

CI surfaces failures via GitHub check annotations (Vitest `github-actions` / Playwright `github` reporters) and a short job Step Summary from `scripts/ci-summarize-*.mjs`; each report-producing summary points to `reports/current-run.md`. The `lint` job runs each `lint:ci` stage as its own step so the failed step name identifies documentation/CI routing vs format vs typecheck vs ESLint vs boundaries vs knip. Local `check:push:full` matches CI for static analysis + Vitest + web build, but keeps `@prepush` E2E only; the default pre-push hook uses the faster `check:push` subset (no boundaries/knip).

Path-filtered jobs (`assets`, `save-gate`, `desktop-build`, `electron-e2e`) are gated by the `changes` job (`dorny/paths-filter`); `ship-gate` and `electron-e2e` share the broader `desktop_renderer` filter, while installer packaging uses the narrower `desktop` filter. On `workflow_dispatch` they always run. A newer push to `main` cancels an in-progress CI run for that ref. Shared job setup (Node + `npm ci`) lives in the composite action `.github/actions/setup`. Nightly failures show as a failed workflow run only.

## Changelog and patch notes

When explicitly asked to commit or push, agents work directly on `main`; there is no required PR merge step. **Do not edit `CHANGELOG.md`.** Conventional commit messages are the day-to-day source of truth. Release-time changelog promotion, patch notes, and `sync:changelog`: [RELEASE.md](./docs/RELEASE.md).

**Docs:** the table in [AGENTS.md](./AGENTS.md#documentation-owners) is the map for which document to read.
