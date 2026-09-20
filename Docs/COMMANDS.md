# Commands

Canonical detail linked from [REFERENCE.md](./REFERENCE.md).

### Script Command Reference

```sh
npm run dev                 # Vite dev server
npm run build               # Non-mutating Vite build; validates generated outputs first (typecheck is a separate gate; Vercel runs vercel.json buildCommand)
npm run assets:check        # Read-only authored-asset freshness validation; use npm run assets to regenerate
npm run assets              # Full asset prep (art+sounds+music+barrels+version); assets:optimize[:art|:sounds|:music] slices optimization, sync:art / sync:gear-art / sync:version slice barrel sync (sync:generated / check:generated cover all)
npm test                    # Compact Vitest output with full logs; `npm test -- <path>` for a single file
npm run verify -- --diff    # Related tests plus broad risk escalations (--plan previews)
npm run runs:show -- --last 10    # Recent run IDs, outcomes, counts, and evidence availability
npm run context:hotspots          # Ranked route context and recent command-output exposure (--run-id <id> checks one exact run)
npm run typecheck           # tsc --noEmit (fast; also in check:static)
npm run lint:ci             # Full static gate (check:static + docs + deadcode + boundaries + arch-smoke + Playwright collection)
npm run check -- --diff     # Source-aware handoff gate with CI static checks and conditional pure builds
npm run check:ship          # Ship gate before tagging/desktop packaging
npm run docs:check          # Validate documentation contracts and plan metadata
npm run docs:check:final    # Repository-wide closure: requires every plan to be finished and archived
npm run plans:check         # Validate active plan metadata only (alias for docs:check --plans-only)
npm run new:plan -- <Name>  # Scaffold an execution plan under Docs/Plans/
npm run archive:plans -- PlanName.md  # Archive a task-owned complete/cancelled plan (--dry-run previews)
npm run balance:sim         # Headless balance findings (opens reports/balance-findings.html)
npm run balance:loot        # Seeded loot progression report (reports/loot-progression/report.html)
npm run perf                # FPS / hitch profiling ([PERFORMANCE.md](./PERFORMANCE.md))
npm run clean               # Remove local diagnostics/artifacts
npm run release             # Full release: gates, commit/tag, push, CI watch ([RELEASE.md](./RELEASE.md))
npm run test:e2e:route -- <name>  # Focused browser journey (e.g. `-- audio`, `-- homestead`); see [tests/e2e/README.md](../tests/e2e/README.md#choosing-browser-coverage)
```

This is the curated agent subset. The full catalog is `package.json` (exhaustive); what each gate includes and when it applies is owned by [CONTRIBUTING.md](../CONTRIBUTING.md#what-to-run-when-you-change).

### Build commands decision tree

- **Local web/dev** — `npm run dev` / `npm run build`
- **Vercel web** — `vercel.json` buildCommand: typecheck + `build`; Git auto-deploys disabled, deploy deliberately (dashboard Redeploy or Deploy Hook)
- **Packaged Windows startup check** — `npm run smoke:desktop`
- **Desktop renderer** — `npm run build:desktop`
- **Unpacked Windows app (local iterate)** — `npm run package:win`
- **Installers for configured targets (currently Windows)** — `npm run dist:desktop`

**Skip flags:**

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
