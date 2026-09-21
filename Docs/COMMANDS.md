# Commands

Canonical detail linked from [REFERENCE.md](./REFERENCE.md).

## Script Command Reference

The table covers common tasks; `package.json` owns the complete list.
[Contributing](../CONTRIBUTING.md#what-to-run-when-you-change) owns what each gate
includes and when it applies.

| Task                           | Command                            | Notes                                                                                             |
| ------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------- |
| Develop in the browser         | `npm run dev`                      | Prepares assets, then starts Vite                                                                 |
| Develop in Electron            | `npm run dev:desktop`              | Starts the desktop shell                                                                          |
| Build the web renderer         | `npm run build`                    | Validates generated outputs; does not rewrite them or run typecheck                               |
| Regenerate assets              | `npm run assets`                   | [Asset workflow](./WORKFLOWS-ASSETS.md) covers narrower operations                                |
| Check asset freshness          | `npm run assets:check`             | Read-only; requires raw sources                                                                   |
| Run unit tests                 | `npm test -- <path>`               | Omit the path for the full suite                                                                  |
| Run related checks during work | `npm run verify -- --diff`         | Add `--plan` to preview selection                                                                 |
| Finish a task                  | `npm run check -- --diff`          | Use explicit task-owned paths in a mixed checkout                                                 |
| Check source types             | `npm run typecheck`                | Source types; the completion gate selects broader checks when needed                              |
| Run the CI static aggregate    | `npm run lint:ci`                  | See [gate policy](../CONTRIBUTING.md#static-build-and-ci-policy)                                  |
| Validate docs                  | `npm run docs:check`               | Links, paths, commands, discovery references, plan metadata                                       |
| Run a browser journey          | `npm run test:e2e:route -- <name>` | [E2E guide](../tests/e2e/README.md#running-focused-checks); preview mode requires a current build |
| Simulate isolated battles      | `npm run balance:sim`              | [Battle simulation](./REFERENCE.md#balance-simulation)                                            |
| Simulate careers               | `npm run balance:playthrough`      | [Headless playthroughs](./PLAYTHROUGH_SIMULATION.md)                                              |
| Compare loot offers            | `npm run balance:loot`             | [Loot tuning](./ARMORY.md#loot-tuning)                                                            |
| Profile frames and hitches     | `npm run perf`                     | [Performance guide](./PERFORMANCE.md)                                                             |
| Find recent check evidence     | `npm run runs:show -- --last 10`   | Run IDs, outcomes and artifact locations                                                          |
| Reset local diagnostics        | `npm run clean`                    | Cleanup details below                                                                             |
| Publish a release              | `npm run release`                  | Gates, commit/tag, push and CI watch; follow [Release](./RELEASE.md)                              |

Use [Agent discovery](./AGENT_DISCOVERY.md) for optional lookup/measurement
commands and [Plans](./Plans/README.md) for plan creation and archiving.
`npm run docs:check:final` is only for intentionally closing every plan in the
repository; ordinary task handoff uses `check`.

## Build commands decision tree

- **Local web/dev** — `npm run dev` / `npm run build`
- **Vercel web** — `vercel.json` buildCommand: typecheck + `build`; Git auto-deploys disabled, deploy deliberately (dashboard Redeploy or Deploy Hook)
- **Packaged Windows startup check** — `npm run smoke:desktop`
- **Desktop renderer** — `npm run build:desktop`
- **Unpacked Windows app (local iterate)** — `npm run package:win`
- **Installers for configured targets (currently Windows)** — `npm run dist:desktop`

**Local build and checker overrides:**

- `ALCHEMY_SKIP_ASSETS=1` — only for direct asset-preparation invocation; semantics owned by
  [`WORKFLOWS-ASSETS.md`](./WORKFLOWS-ASSETS.md#skip-mode-and-verification).
- `ALCHEMY_ENABLE_CHECKER=1` — opt-in to the in-Vite `vite-plugin-checker` typecheck (off by default so `npm run dev` stays snappy; use `npm run typecheck:watch`, `npm run dev:checked`, or this flag when you need live type errors). `ALCHEMY_SKIP_CHECKER=1` is a hard off used by the Playwright preview server.
- `ALCHEMY_SKIP_SOURCEMAP=1` — opt-out of hidden sourcemaps for `mode=desktop` builds when fast local iterate is preferred; rejected for releases with Sentry reporting. `npm run clean -- --builds` removes existing build outputs and their maps.
- `ALCHEMY_CHECK_SKIP_BUILD=1` — skip web/desktop builds, their bundle budgets, and preview smoke in `npm run check` for fast local iteration; CI and ship gates still build.

`npm run clean` removes local diagnostics and the Vite cache (explicit reset);
add `-- --builds` to remove build outputs. `npm run clean:all` also stops
Alchemy-owned test-server processes. `npm run prune:transient` removes only stale
files by age. Its exact
options are owned by `scripts/prune-transient-artifacts.mjs`; reset options
belong to `scripts/clean-dev-artifacts.mjs`. Neither command manages shared
Playwright caches.

One-shot test commands retain full logs and emit bounded summaries. Use `npm run test:verbose`, `npm run test:e2e:verbose`, `npm run test:watch`, or `npm run test:e2e:debug` for raw output or interactive work. Gates that already capture output bypass the inner compact wrapper. Formatting emits a summary and full-log location; content audits group failures by area with bounded examples.
