# Commands

Choose an operation here. [Contributing](../CONTRIBUTING.md) owns task checks;
[Verification diagnostics](../scripts/VERIFICATION.md#failure-first-triage) covers failures;
[simulation](./SIMULATION.md) covers battle and career investigations.

## Script Command Reference

[Contributing](../CONTRIBUTING.md#what-to-run-when-you-change) contains the complete
ordinary verification workflow and permissions. This reference lists other operations.
`package.json` owns the complete script list.

| Task                        | Command                            | Notes                                                                                             |
| --------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------- |
| Develop in the browser      | `npm run dev`                      | From the original workspace, serves current local `main`; task worktrees serve their own source   |
| Preview this checkout       | `npm run dev:local`                | Validates committed assets, then starts Vite in this checkout                                     |
| Develop in Electron         | `npm run dev:desktop`              | Starts the desktop shell                                                                          |
| Build the web renderer      | `npm run build`                    | Validates generated outputs; does not rewrite them or run typecheck                               |
| Regenerate assets           | `npm run assets`                   | [Asset workflow](./WORKFLOWS-ASSETS.md) covers narrower operations                                |
| Check local asset freshness | `npm run assets:check`             | Read-only; reads committed masters under `assets/sources/`                                        |
| Check prepared outputs      | `npm run assets:check:outputs`     | Read-only; validates prepared files without reading source masters                                |
| Inspect test reservations   | `npm run test:status`              | Shows managed active and waiting commands; add `--json`                                           |
| Run a browser journey       | `npm run test:e2e:route -- <name>` | [E2E guide](../tests/e2e/README.md#running-focused-checks); preview mode requires a current build |
| Simulate isolated battles   | `npm run balance:sim`              | [Battle simulation](./SIMULATION.md#balance-simulation)                                           |
| Resume a battle sweep       | `npm run balance:sim:batch`        | [Bounded battle simulation](./SIMULATION.md#balance-simulation)                                   |
| Simulate careers            | `npm run balance:playthrough`      | [Headless careers](./SIMULATION.md#headless-careers)                                              |
| Compare loot offers         | `npm run balance:loot`             | [Loot report](./ARMORY.md#loot-progression-report)                                                |
| Profile frames and hitches  | `npm run perf`                     | [Performance guide](./PERFORMANCE.md)                                                             |
| Produce gameplay trailers   | `npm run trailer -- help`          | [Automated capture, cinematic edits and Steam exports](./TRAILERS.md)                             |
| Find recent check evidence  | `npm run runs:show -- --last 10`   | Run IDs, outcomes and artifact locations                                                          |
| Clear rebuildable caches    | `npm run clean`                    | Cleanup details below                                                                             |
| Publish a release           | `npm run release`                  | Gates, commit/tag, push and CI watch; follow [Release](./RELEASE.md)                              |

For changed player-facing text, use `npm run i18n:prepare -- <task-file.json>`,
translate and separately review its result templates, then run
`npm run i18n:finish -- <task-file.json> --reviewed`. [Localization](./LOCALIZATION.md#agent-workflow) owns the workflow.

Use [Agent discovery](./AGENT_DISCOVERY.md) for optional lookup/measurement
commands and [Plans](./Plans/README.md) for plan creation and completion.
`npm run docs:check:final` is a non-mutating repository-wide closure check: it
requires no active or blocked plans and does not finish or delete them.
See [Contributing](../CONTRIBUTING.md#hooks-and-workflow-hygiene) for plan handoff requirements.

Use `npm run visual:scenario -- --list` for repeatable seeded screen captures.

## Local development

From the original workspace, `npm run dev` delegates to the checkout that owns
local `main`, even when the workspace branch lags. It prints the served checkout
and commit; Vite watches that checkout as integrations arrive. No fetch, merge,
or build is needed. Task worktrees retain their own previews. Use `npm run dev:local`
to explicitly preview the current checkout, including the original workspace's edits.
If no checkout owns `main`, the root launcher fails rather than serving stale source.

`npm run dev`, `npm run dev:local`, and `npm run dev:desktop` validate committed
prepared outputs in the served checkout before starting. Desktop and checked
development remain checkout-local. Asset authoring and source freshness checks use committed
masters under `assets/sources/`; no external library is required. If validation reports stale
outputs, follow [asset preparation](./WORKFLOWS-ASSETS.md#repository-sources-and-ci)
rather than bypassing the check.

If Electron's binary download was skipped or the installation is incomplete, run
`npm run ensure:electron` before `npm run dev:desktop`. It repairs the existing
Electron installation; it does not build the renderer or launch the game.
Desktop startup also prepares the patched Steamworks native binding. Its
[native prerequisites](../scripts/steamworks/README.md) include Rust and a
platform linker. If a task worktree links `node_modules` and the binding needs
rebuilding, remove only that checkout's dependency symlink and run `npm ci` to
create a task-local installation; never modify the shared installation.

Set `ALCHEMY_DEV_PORT` to a free port for concurrent development checkouts, for
example `ALCHEMY_DEV_PORT=5273 npm run dev:desktop` in a POSIX shell. Vite, desktop
readiness polling, and development cleanup share that setting; a Vite-only
`--port` override does not configure the desktop waiter. The default is 5173;
invalid values fail, and Vite fails if the selected port remains occupied rather
than silently selecting another port.
Cleanup only stops listeners identified as belonging to its checkout. Keep other
checkouts' servers running; [browser-test ports](../tests/e2e/README.md#browser-and-electron-commands)
have separate overrides.

## Build commands decision tree

- **Local web/dev** — `npm run dev` / `npm run build`
- **Vercel web** — `vercel.json` buildCommand: typecheck + `build`; Git auto-deploys disabled, deploy deliberately (dashboard Redeploy or Deploy Hook)
- **Packaged Windows startup check** — `npm run smoke:desktop`
- **Desktop renderer** — `npm run build:desktop`
- **Unpacked Windows app (local iterate)** — `npm run package:win`
- **Installers for configured targets (currently Windows)** — `npm run dist:desktop`

Builds accept `--live` or `--verbose` after `--` to stream Vite output; other Vite options remain available.

Commands default to the full edition. Set `ALCHEMY_EDITION=demo` consistently
for demo development, builds, bundle checks, browser tests, packaging, and uploads.
The [edition contract](./STEAM_DEMO.md#edition-contract) owns output directories
and Steam targets; `build` and `build:desktop` overwrite the same renderer
directory within an edition, so run them sequentially.

**Local build and checker overrides:**

- `ASSET_LIBRARY_ROOT` is ignored. Production preparation always uses this checkout's `assets/sources/`; optional Sound desk browsing accepts `--library <Sounds directory>`.
- `ALCHEMY_SKIP_ASSETS=1` — only for direct asset-preparation invocation; semantics owned by
  [`WORKFLOWS-ASSETS.md`](./WORKFLOWS-ASSETS.md#validation-and-commit).
- `ALCHEMY_ENABLE_CHECKER=1` — opt-in to the in-Vite `vite-plugin-checker` typecheck (off by default so `npm run dev` stays snappy; use `npm run typecheck:watch`, `npm run dev:checked`, or this flag when you need live type errors). Run `npm run predev:local` before `npm run dev:checked`, which starts Vite directly without the committed-output validation lifecycle. `ALCHEMY_SKIP_CHECKER=1` is a hard off used by the Playwright preview server.
- `ALCHEMY_SKIP_SOURCEMAP=1` — opt-out of hidden sourcemaps for `mode=desktop` builds when fast local iterate is preferred; rejected for releases with Sentry reporting. `npm run clean -- --builds` removes existing build outputs and their maps.
- `ALCHEMY_CHECK_SKIP_BUILD=1` — skip web/desktop builds, their bundle budgets, and preview smoke in the opt-in `npm run check:full`; the default `check` already omits them. CI and ship gates still build.

`npm run clean` removes rebuildable caches and preserves evidence. Add
`-- --reports` to explicitly select diagnostics/evidence, `-- --caches` for tool
environments, or `-- --builds` for build outputs; preview with `--dry-run`.
`npm run clean:all` selects all of these and Alchemy-owned test-server processes.
`npm run prune:transient` expires only reproducible diff inventories after 24 hours.
`npm run storage:report -- --json reports/storage/baseline.json` measures existing
files without building or deleting them. [Cleanup details](../scripts/README.md#cleanup-clean--explicit-reset-prunetransient--expiry)
own ownership guards and preservation rules.
Its exact options are owned by `scripts/prune-transient-artifacts.mjs`; reset options
belong to `scripts/clean-dev-artifacts.mjs`. Neither command manages shared
Playwright caches.

One-shot test commands retain full logs and emit bounded summaries. Use `npm run test:full:verbose`, `npm run test:e2e:verbose`, `npm run test:watch`, or `npm run test:e2e:debug` for raw output or interactive work. Gates that already capture output bypass the inner compact wrapper. Formatting emits a summary and full-log location; content audits group failures by area with bounded examples.
