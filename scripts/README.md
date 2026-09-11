# Scripts implementation map

Use [REFERENCE](../docs/REFERENCE.md#script-command-reference) to choose a command,
[CONTRIBUTING](../CONTRIBUTING.md#what-to-run-when-you-change) to select checks,
and this map to locate their implementation owners.

## Assets

[WORKFLOWS-ASSETS](../docs/WORKFLOWS-ASSETS.md) owns authoring commands and the
choice between fast generated checks and prepared-output verification.

| Concern                                     | Implementation owner                                                                          |
| ------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Asset CLI and preparation                   | `assets.mjs` → `prepare-assets.mjs`                                                           |
| Art, sound, and music optimization          | `optimize-pipelines.mjs` → `optimize-assets.mjs`, `optimize-sounds.mjs`, `optimize-music.mjs` |
| Generated art barrels and version metadata  | `sync-generated.mjs` → `sync-art-barrels.mjs`, `sync-version-metadata.mjs`                    |
| Fast generated-output validation            | `check-generated-fast.mjs`                                                                    |
| Prepared-output idempotence and restoration | `check-prepared-assets.mjs`                                                                   |

Shared: `lib/asset-constants.mjs` (tuning), `lib/asset-manifest-cache.mjs` (freshness),
`lib/process-helpers.mjs` (generic `formatProcessError`), `lib/audio-optimizer.mjs` (audio discovery/runner).

## Agent discovery and evaluation

| Concern                                                             | Implementation owner        |
| ------------------------------------------------------------------- | --------------------------- |
| Owner sections and source entry points                              | `lib/agent-context.mjs`     |
| Markdown section extraction                                         | `lib/document-sections.mjs` |
| Bounded search, related-file hints, and disposable context sessions | `lib/agent-discovery.mjs`   |
| Preread measurement                                                 | `measure-agent-context.mjs` |
| Evaluation records and comparison                                   | `agent-eval.mjs`            |

[Agent discovery](../docs/REFERENCE.md#agent-discovery) documents command options
and limitations; [evaluations](../.agents/evals/README.md) owns pinned setup and
interpretation. Discovery metadata must reference canonical prose rather than
copying it, and it does not own verification selection.

## Checks / verification (nesting order)

Gate composition, CI tiers, and reuse policy live in
[CONTRIBUTING](../CONTRIBUTING.md#static-build-and-ci-policy).

| Concern                                   | Implementation owner                                                    |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| Completion orchestration                  | `check.mjs`                                                             |
| Related tests and risk escalations        | `verify-changed.mjs`                                                    |
| Finished-step exposure/digest reporting   | `lib/run-step.mjs` (shared by `check` + `verify`)                       |
| Path parsing and classification           | `lib/changed-paths.mjs` + `lib/change-routes.mjs`                       |
| Documentation contracts and plan metadata | `check-docs.mjs`, `check-documentation-contract.mjs`, `check-plans.mjs` |
| Passing unit receipts                     | `lib/verification-cache.mjs`                                            |
| Bundle budgets                            | `lib/bundle-budget.mjs`                                                 |

CI path filters (`.github/workflows/ci.yml` `changes` job) stay owned by the
workflows; `tests/scripts/ci-path-filters.test.ts` pins the intended
route↔gate alignment so the two lists cannot drift silently. `docs:check` runs
once per gate: verification skips its copy (`--skip-docs-check`) when `check`
will run it through the static aggregate.

Documentation and ESLint inventories exclude isolated `.worktrees/` checkouts,
reports, and installed dependencies. Documentation checks share one file inventory;
current-file checks cover E2E paths as well as other source references. Instruction
history is advisory and does not require an entry for each skill or knowledge edit.

Ambient script-test declarations belong in
`tests/scripts/global.d.ts`; standalone unreferenced declarations fail dead-code
checks. Shared build inputs select both renderer builds through the existing
change routes. Test selection preserves deleted paths for classification and risk escalations, but executes only surviving changed unit files. When consolidating tests, include the surviving files in the task selection; update stale suite references rather than disabling their validation. [Test value](../CONTRIBUTING.md#test-value-and-coverage-strategy) owns coverage decisions.

`check:bundle` checks the current `dist/assets/` and fails when the build is missing
or empty. Web and desktop renderer builds both write `dist/`; check immediately
after the relevant build. CI checks web bundles on every push and release; ship
and release gates also check desktop bundles.

## Release / changelog (three stages, shared `lib/patch-notes-core.mjs` + `lib/git-release.mjs`)

| Output or operation                                          | Implementation owner                                                             |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Developer Unreleased history                                 | `sync-changelog.mjs`                                                             |
| Versioned changelog section                                  | `release-changelog.mjs`                                                          |
| Player notes from commits and trailers                       | `generate-patch-notes.mjs`                                                       |
| Release orchestration (`release`, `release:hotfix --hotfix`) | `release.mjs` → `lib/release-runner.mjs`                                         |
| Build version stamping                                       | `sync-version-metadata.mjs` (sequenced by `release-runner.mjs` post-bump)        |
| Release artifact validation                                  | `verify-release.mjs` → `lib/release-checks.mjs`                                  |
| Tag-vs-package check                                         | `verify-release-version.mjs` (also run locally pre-push by `release-runner.mjs`) |
| Steam upload                                                 | `steam-upload.mjs`                                                               |
| Verified build                                               | `build-verified.mjs`                                                             |

[RELEASE](../docs/RELEASE.md#changelog-release-time-only) owns timing, note policy,
and the release decision flow.

Desktop: `ensure-electron.mjs` (orchestrator) → `electron-download.mjs` + `electron-path.mjs`
(pure predicates); `dist-desktop.mjs` → `verify-desktop-package.mjs`.

## Audits (periodic sweep, not a push gate)

`npm run audit` runs `audit.mjs`, which dispatches to `audit-all.mjs` when no
selector is supplied, including with `--verbose`. Pass a focused selector after
the npm separator (`npm run audit -- --types|--amplification|--content|--hotspots`)
to dispatch one probe instead. Gating probes: knip, depcruise, eslint complexity,
content-audit. Advisory trend probes (always exit 0):
`audit-type-escapes.mjs`, `audit-change-amplification.mjs` — direction signals, see
`docs/Audits/TypeSafetyAudit.md`. `context-hotspots` / `runs:show` are advisory process
evidence and never block handoff.

## Test / E2E

`npm run test:e2e:route -- <route> [-- extra playwright args]`;
`test:ship:unit`, `test:e2e:audit` (full timings), `perf`, `balance:sim`, `ci:summarize`.
Every `E2E_ROUTES` entry has a matching `test:e2e:<name>` alias
(`tests/scripts/run-e2e-route.test.ts` pins the set); legacy screen names
`shop-screen` and `homestead-screen` remain accepted as aliases.
`ci-summarize.mjs --vitest/--playwright/--all` is the single CI summary entry;
workflows call it directly with the matching flag.

## Development

`dev` and `dev:checked` share `predev` asset preparation and port cleanup;
`dev:checked` also enables the live TypeScript checker. Desktop development adds
Steam App ID synchronization.

## Cleanup (`clean` = explicit reset, `prune:transient` = age-based GC)

`npm run clean` removes local reports and the Vite cache. `npm run clean:all`
also removes build outputs and stops Alchemy-owned test-server processes; add
`--include-dev-port` to include the development server. `npm run prune:transient`
deletes stale local artifacts by age. Neither command removes shared Playwright
browser caches.
Both share `lib/clean-dev-artifacts.mjs` transient roots. `platforms.json` owns the desktop target list;
`package.json` build blocks own per-platform packaging config. Sentry release and desktop sourcemap mode are
owned by `lib/sentry-release.mjs`; chunk splitting is owned by `lib/vite-chunks.mjs`.

## Worktree / git safety

`node scripts/agent-worktree.mjs create --task <slug>` (`.worktrees/<slug>` on `agent/<slug>`);
`--detached` for verification-only runs. Creation checks out tracked files only;
run `npm ci` inside the new worktree before running its verification gates.
Some tools can resolve dependencies from the parent checkout while Knip still
reports missing binaries and unused dependencies without a local installation.
Run worktree management commands from the original checkout. Removal validates
the exact registered worktree; an unregistered directory requires inspection
and explicit `--force`. An empty normalized task name is rejected.

`scripts/bin/git` shims destructive git through
`git-safety-guard.mjs` (auto-stash backup); `setup-git-safety.mjs` installs the PATH hook.
