# Scripts implementation map

Use [Commands](../Docs/COMMANDS.md#script-command-reference) to choose a command,
[CONTRIBUTING](../CONTRIBUTING.md#what-to-run-when-you-change) to select checks,
and this map to locate their implementation owners.

[Verification implementation](./VERIFICATION.md) covers gate nesting, changed-path
selection, reports, build validation, and receipt caching.

Keep command entry points directly in `scripts/`. Asset registries and pipeline
helpers live together in `assets/`, with TypeScript declarations beside their
modules. Sound desk mapping, media, server and board modules live in `audio-review/`;
`audio-review.mjs` remains its command entry point. `lib/agent/`, `lib/release/`, `lib/verification/`, `lib/performance/`, and `lib/playthrough/` group subsystem implementations; general process and repository helpers remain directly in `lib/`.

The standalone [combat feedback lab](./combat-feedback-lab/README.md) compares
Alchemy, Trinket, and proposed animation presets with synchronized playback,
individual controls, and portable settings. It runs without a game build.

## Trailer production

`trailer.mjs` owns automated media production. `trailers/` contains the strict edit
model, offline capture runtime, FFmpeg encoding/mixing and isolated Remotion
renderer/dependencies. `tests/trailers/scenarios.ts` reuses production content and
the browser staging helpers. [Trailer production](../Docs/TRAILERS.md) owns recipes,
quality targets, setup and retained bundles; these tools do not enter the game build.

## Assets

[WORKFLOWS-ASSETS](../Docs/WORKFLOWS-ASSETS.md) owns authoring commands and the
choice between fast generated checks and prepared-output verification.
Asset and synchronization CLIs validate selectors before writing, including in
skip mode; keep that validation at each entry point.

| Concern                                    | Implementation owner                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Asset CLI and preparation                  | `assets.mjs` → `prepare-assets.mjs` (canonical surface; `npm run assets:check` is the local source check; `assets:check:outputs` adds `--outputs-only` for CI; direct `optimize-*.mjs` calls are the supported iteration shortcut behind `assets:optimize[:art\|:sounds\|:music]`)                                                                         |
| Art, sound, and music optimization         | `assets/optimize-pipelines.mjs` → `optimize-assets.mjs`, `optimize-sounds.mjs`, `optimize-music.mjs` via `assets/asset-pipeline-runner.mjs`                                                                                                                                                                                                                |
| Generated art barrels and version metadata | `sync-generated.mjs` → `sync-art-barrels.mjs`, `sync-version-metadata.mjs` (`sync:art` syncs the general art barrel; Gear use eager catalog registration; `sync:gear-art` aliases the art sync; `sync:version` stamps the build version alone; asset preparation syncs art barrels and version metadata independently; `assets:check` only validates them) |
| Fast generated-output validation           | `sync-generated.mjs --check`                                                                                                                                                                                                                                                                                                                               |
| Read-only prepared-output freshness        | `assets.mjs --check` → `check-prepared-assets.mjs` (partial-failure `prepare` advances barrels when art succeeds; `check` is all-or-nothing)                                                                                                                                                                                                               |

Shared: `assets/asset-constants.mjs` (tuning, `MANAGED_DIRS` managed outputs — the manifest is the complete inventory, no directory exceptions), `assets/asset-pipeline-runner.mjs` (pipeline paths, output-dir creation, source reads, freshness, failure normalization),
`assets/asset-manifest-cache.mjs` (freshness,
check-mode `ENOENT` maps to stale errors),
`lib/process-helpers.mjs` (generic `targetErrorHandler`, `failedResult`),
`assets/gear-filenames.mjs` (single owner for gear slugging/patterns, slot IDs, WebP/gear classification), `assets/music-assets.mjs` (music filename registry).
Manifest paths derive from `MANAGED_DIRS` + `MANIFEST_BASENAME` via `getManagedManifestPath` (`getOptimizedManifestPath` is the art-specific alias used by barrel sync).

## Agent owner lookup

`agent-diff.mjs` owns `review:diff` and `review:status`: complete inventories on disk, bounded task patches/status in the terminal. Generated/media details expand with `--full <path>`.

| Concern                                           | Implementation owner              |
| ------------------------------------------------- | --------------------------------- |
| Owner sections and implementation entry points    | `lib/agent/agent-context.mjs`     |
| Markdown fences, headings, and section extraction | `lib/agent/markdown-sections.mjs` |

`run-compact.mjs`, `lib/run-command.mjs`, and `lib/compact-output.mjs` own compact one-shot diagnostics and complete logs.

[Agent discovery](../Docs/AGENT_DISCOVERY.md) documents command options
interpretation. Discovery metadata must reference canonical prose rather than
copying it, and it does not own verification selection. The search fallback skips deleted
tracked files and files removed during a search, while other read errors fail.

## Release / changelog (three stages, shared `lib/release/patch-notes-core.mjs` + `lib/release/git-release.mjs`)

| Output or operation                                          | Implementation owner                                                                    |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Developer Unreleased history                                 | `sync-changelog.mjs`                                                                    |
| Versioned changelog section                                  | `release-changelog.mjs`                                                                 |
| Player notes from commits and trailers                       | `generate-patch-notes.mjs`                                                              |
| Release orchestration (`release`, `release:hotfix --hotfix`) | `release.mjs` → `lib/release/release-runner.mjs`                                        |
| Build version stamping                                       | `sync-version-metadata.mjs` (sequenced by `release-runner.mjs` post-bump)               |
| Release artifact validation                                  | `verify-release.mjs` → `lib/release/release-checks.mjs`                                 |
| Tag-vs-package check                                         | `verify-release.mjs --skip-package` (also run locally pre-push by `release-runner.mjs`) |
| Steam upload                                                 | `steam-upload.mjs`                                                                      |
| Verified build                                               | `build-verified.mjs`                                                                    |

[RELEASE](../Docs/RELEASE.md#changelog-release-time-only) owns timing, note policy,
and the release decision flow.

Desktop: `ensure-electron.mjs` (orchestrator) → `electron-download.mjs` + `electron-path.mjs`
(pure predicates); `dist-desktop.mjs` → `verify-desktop-package.mjs`.
`lib/release/desktop-build-config.mjs` validates release configuration before both the
verified desktop build and direct packaging. `desktop/after-pack.cjs` locates
default V8 snapshots with one directory walker on all supported Node versions,
then installs the browser-process copies before enabling their fuse. The build wrapper rejects conflicting mode selectors before validation or Vite, so `build:desktop` always builds desktop mode.
Packaged Windows startup: `smoke-desktop.mjs` resolves the artifact and invokes
`smoke-desktop.ps1` for native accessibility verification (see [RELEASE](../Docs/RELEASE.md#packaged-windows-startup-check)).

[`steam/platforms.json`](../steam/platforms.json) must declare at least one desktop target; `package.json` build blocks own per-platform packaging configuration. Sentry release and desktop sourcemap mode are owned by `lib/release/sentry-release.mjs`; chunk splitting is owned by `lib/vite-chunks.mjs`. Vite uses only Rolldown chunk groups.

## Audits (periodic sweep, not a push gate)

`npm run audit` runs `audit.mjs`, which dispatches to `audit-all.mjs` when no
selector is supplied, including with `--verbose`. `npm run audit:all` is the
same sweep via `audit.mjs --all` (thin forward, not a separate entry).
Pass a focused selector after npm's `--`, for example
`npm run audit -- --types`, to dispatch one probe instead. `--all` runs the
measurable sweep; it does not execute every guide in [Docs/Audits](../Docs/Audits/README.md).
`audit-type-escapes.mjs` and `audit-change-amplification.mjs` report
advisory trends without thresholds; read or Git failures still fail execution.
Interpret type-escape counts through the [Type Safety audit](../Docs/Audits/TypeSafetyAudit.md)
and co-edit trends through the [Simplification audit](../Docs/Audits/SimplificationAudit.md).
`runs:show` supplies advisory process evidence rather than a handoff gate.

## Test / E2E

Invocation, fixtures and routes belong to the [E2E guide](../tests/e2e/README.md).
[Performance](../Docs/PERFORMANCE.md) and [headless careers](../Docs/SIMULATION.md#headless-careers)
own their respective workflows.

CI, nightly, and release callers own job prerequisites, path filters, and shard matrices.
`web-build.yml`, `web-e2e.yml`, and `electron-e2e.yml` under `.github/workflows/`
own shared execution and artifact retention. `release-package.yml` builds both editions
and returns each producer's artifact ID; the release caller owns serialized delivery.

| Concern                                    | Implementation owner                                                                                                                                |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Named browser routes and aliases           | `run-e2e-route.mjs`; all `E2E_ROUTES` use `test:e2e:route -- <name>`, including `shop-screen` → `shop` and `homestead-screen` → `homestead` aliases |
| CI summary entry                           | `ci-summarize.mjs --vitest/--playwright/--all`; a positional filename containing `playwright` selects that format                                   |
| Report parsing and bounded publication     | `lib/verification/vitest-summary.mjs`, `playwright-summary.mjs`, shared `report-summary.mjs`                                                        |
| Frame profiling                            | `run-performance.mjs` → `lib/performance/performance-runner.mjs`                                                                                    |
| Headless career CLI and worker             | `run-playthrough.mjs` → `lib/playthrough/playthrough-runner.mjs`; `run-playthrough-worker.mjs` → `lib/playthrough/career-worker.mjs`                |
| Balance, loot and content-report bootstrap | `lib/vite-report-server.mjs` (middleware-mode Vite)                                                                                                 |

Summary headers use supplied stats; walked assertions supply slowest tables via
`collectPlaywrightTests` and shared `topSlowestTests`, so inconsistent inputs may
produce differing header/table totals. Malformed reports, negative/noninteger
counters and unknown assertion outcomes fail with retained diagnostics.

Command entries retain CLI lifecycle/artifact registration; their implementations
are import-safe. Balance, loot and content-audit entries use `defineScript` and
leave run receipts, resolving report paths from the script root. One-shot suite,
build and profiling CLIs use [shared command execution](#command-execution-and-argument-handling)
for compact summaries, full logs and supported streaming options. Profiling validates
options before builds/downloads. Career/performance-case workers use `runCommandAsync`
to stop process trees on deadline/cancellation; interrupted careers retain their
journal prefix and starting-state evidence. Performance models/scenarios stay in `performance/`.

## Development

[Local development](../Docs/COMMANDS.md#local-development) owns invocation,
checkout selection, preparation and port settings. `dev.mjs` resolves the source
checkout for browser development; desktop startup adds Steam App ID synchronization.
Vite and Electron share a lifetime: exiting either process stops the other,
and the first exit determines the command's status.
Desktop startup waits for a successful HTTP response and releases the readiness
response body before launching Electron.

## Cleanup (`clean` = explicit reset, `prune:transient` = expiry)

`npm run clean` removes rebuildable Vite and trailer webpack caches. It preserves
reports and test evidence by default. `--reports` explicitly selects those evidence
roots; inspect them with `--dry-run` first. `--caches` also selects `.cache/` tool
environments; stop their owners first. `--builds` selects rebuildable renderer and
package outputs. `--processes` stops Alchemy-owned test listeners;
`--include-dev-port` also selects the normal dev port, only with `--processes`.
`--all` combines all selectors, including evidence deletion. No command follows
linked dependency ancestors into another checkout's shared caches.

`npm run prune:transient` automatically expires reproducible Git diff inventories
after 24 hours and known expired verification-cache receipts after 24 hours. New
managed run receipts declare their retention policy: old unpinned, unreferenced
successful runs expire after 30 days and failed runs after 90 days. The latest
success and failure per command, current run, referenced baselines, pinned or
owned runs, legacy runs, and unknown evidence stay protected. Other performance,
visual, integration and experimental evidence is not automatically expired.
At producer completion it also writes a bounded
`reports/retention-review.json`: a 1 GiB review threshold, latest success/failure per
command retained, pins/owners and referenced baselines protected, and at most 64
exact historical run candidates. Dry runs return this plan without writing it.
Legacy candidates remain intact; only runs created with the explicit expiry policy
are eligible for automatic deletion. Production footage,
portable trailer bundles and release artifacts are outside this reviewer. Tool environments belong under `.cache/`, not
inside reports. Legacy `reports/boss-lyrics/venv` remains usable in place until its
owner stops; worktree finishing excludes that known rebuildable environment.

Report-producing CLIs register process-owned guards. Pruning skips while another
participating tool is active; explicit cleanup refuses deletion. Registration and
deletion share an OS-released loopback mutex keyed by the checkout's real path.
Separate checkouts do not share a fixed port; a collision fails without deleting
artifacts. Abandoned guards are recovered only after confirming the owner is dead;
unreadable ownership stays protected. Raw tools require manual ownership inspection.
No cleanup command authorizes terminating foreign work.

Build outputs, production sources, retained release packages, saves and scratch/output
experiments are outside automatic expiry. Never remove unfinished experiments or
unique evidence to meet a disk target. Worktree finishing preserves evidence while
excluding nested `node_modules/` and `.cache/` environments; it does not archive
another copy of rebuildable dependencies. Retained files use independent copy-on-write
copies where the filesystem supports them, with ordinary-copy fallback.

`npm run storage:report -- --json reports/storage/baseline.json` records logical
file sizes for shared Git/dependencies, checkout assets, reports and existing build
outputs. It never builds or deletes anything. Shared roots are resolved explicitly;
nested links are excluded. Areas overlap and APFS clones/compression can change
physical disk use, so do not sum the rows or call them measured free space.
`check:bundle` enforces shipping media and complete renderer budgets as well as
JavaScript. Packaging records each output's bytes under `reports/storage/`.

## Worktree / git safety

[AGENTS.md](../AGENTS.md) owns authorization and task isolation;
[CONTRIBUTING](../CONTRIBUTING.md#what-to-run-when-you-change) owns verification.
The ordinary sequence, from the original workspace, is:

```sh
node scripts/agent-worktree.mjs create --task <slug>
node scripts/agent-worktree.mjs status --task <slug> # inspect or resume
# Implement, check and commit in .worktrees/<slug>.
node scripts/agent-worktree.mjs integrate --task <slug>
# Review the integrated result, then preserve evidence and close the task.
node scripts/agent-worktree.mjs finish --task <slug>
```

Status shows the task checkout, base, working paths, recorded integration and latest
check receipt. It marks a task receipt current only when main, source identity and
selected paths still match. Other and older receipts remain historical or unverified.
It suggests the next action but does not attest review, visual acceptance or CI;
confirm those separately before integration. Commands that edit or check task files
run in the task checkout; integration and finish run from the original workspace.
If cleanup is blocked, status shows the recorded reason and the finish retry command.

Creation starts `agent/<slug>` from committed local main and links dependencies.
The branch's `alchemyTaskBase` records original provenance; task checks compare
against the latest shared ancestor with main. Existing branches resume their
current commit. Use a new slug for new work, or incorporate main when deliberately
resuming old work. `--base` selects a different starting point for a new branch;
`--detached` creates a verification-only checkout. `integration` is reserved.
The asset checkout defaults and restoration commands are described under
[Dedicated integration checkout](#dedicated-integration-checkout). For a new independent clone,
`git clone --filter=blob:none <repository-url>` avoids downloading historical file
contents until needed; it does not shrink an existing clone or rewrite history.
Commands locate the original workspace from the shared Git directory, including
when invoked from a task. The original workspace's management entry point forwards
to the dedicated main checkout so retained workspace source can stay unchanged.

### Dedicated integration checkout

New task checkouts default to omitting `assets/sources/` when the target
revision supports output-only development/build validation and has prepared art,
music and sounds. Committed runtime media, generated code, test inputs and desktop
icons remain present. Older/incomplete revisions use full assets. Use
`create --task <slug> --full-assets` for asset production, or run
`git sparse-checkout disable` in a task before source checks/preparation/authoring.
`--code-only` remains an alias for automatic defaults; it cannot be combined with
`--full-assets`. Missing-source preparation preserves outputs and prints restoration guidance.

Large retained tracked assets (at least 256 KiB) automatically use per-file APFS
copy-on-write from clean same-commit files in the dedicated main checkout (primary
before adoption). No peer task is a source. An optional Python standard-library
bridge calls Apple's `clonefile` directly; unavailable Python, unsupported
platforms/volumes, dirty/mismatched sources and checkout filters use ordinary Git.
Clones are checked against target blob bytes/modes. Git owns fresh indexes and
normal status/stat checks; dependencies/build databases are not copied. Git's
registration/index locks arbitrate concurrent creation. The report includes omitted
and cloned logical bytes and population/first-status time, not unique physical
savings on APFS. Existing task checkouts retain their configuration.

One-time adoption uses `node scripts/agent-worktree.mjs setup-integration`.
This explicitly moves main ownership to `.worktrees/integration`: the original
workspace receives a new `workspace/main` branch (or an unused numbered variant)
at the same commit. Only its symbolic HEAD changes; staged, unstaged and untracked
files and the index are preserved. Unfinished Git operations block setup.
Setup rolls HEAD back if worktree creation fails and is idempotent after success.
The original workspace can intentionally lag main. Read current committed source
in the dedicated checkout; run task checks in task checkouts and separately
authorized push/release commands in the dedicated main checkout.
The original workspace's `npm run dev` delegates to the checkout owning local
`main`; `scripts/dev.mjs` is a self-contained bootstrap that delegates both
preparation and serving to main's current launcher. Use `npm run dev:local` for
an explicit workspace preview. Task worktrees keep checkout-local development.
Do not run this migration as part of ordinary task creation or switch another
checkout's branch. The dedicated checkout is for integration; implement in task
worktrees. Until adoption, integration supports the old clean-main layout.

### Integration and finish phases

`status --task <slug>` reports the task checkout, original base, changes, recorded
integration and the next action. It is a read-only snapshot; it cannot infer whether
review or checks were completed. Successful integration records attempts and elapsed
verification and integration time in its state file. It records the verified main
commit for review of the exact integrated delta; older records fall back to the
original base and may include concurrent main changes. Failed attempts write separate
records under `reports/integrations/attempts/` with their phase, reason and timings;
they do not replace integration or cleanup state. Abrupt process termination cannot
write a failure record. Older records lack these metrics and the verified review base.

Integration holds a per-task lock. Under the shared repository lock it snapshots
main and merges it into the clean task, releases the shared lock to verify the
combined result, then reacquires it to revalidate both branches, commits and clean
status before fast-forwarding main. If main advanced, it merges and checks again.
Unfinished Git operations, including bisects, block advancement. Failures preserve
work. Locks are OS-owned loopback listeners; waits are cancellable and never
reclaim another owner. Test waits never hold the shared integration lock.
Resolve understood conflicts in the task and retry. Never update main manually.
Integration retains the task checkout and browsers; `--keep-worktree` remains a
compatibility flag. No command pushes.

`reports/integrations/<slug>.json` records integration and cleanup separately.
`finish` requires the unchanged, clean task commit to be contained in main. It
closes only task browsers, preserves the complete `reports/` directory and other
non-build ignored files in a unique evidence bundle, then removes only that
registered checkout. The task branch remains. A failure prints a finish retry
command and leaves integration complete; inspect the state file and reported
recovery path before retrying.

Cleanup rejects changed/locked registrations, unfinished work, submodules,
symlinks in evidence and links escaping the task. It stages the checkout under
`~/.codex/worktree-archives/Alchemy/` before unregistering, restoring it if
unregistration fails. `CODEX_WORKTREE_ARCHIVE_ROOT` overrides that external staging
root; cross-filesystem moves fail without deleting the source. `recovery.json`
records the original checkout, branch and commit. Evidence stays in the original
workspace's reported bundle; its `integration.json` lists preserved paths.
Disposable roots are `node_modules/`, `dist/`, `dist-demo/`, `dist-desktop/`,
`release-desktop/`, `coverage/`, `test-results/`, `playwright-report/`, `.vite/`,
and `.worktrees/`; move irreplaceable files from them into `reports/` before finish.

The legacy `remove` command retains its explicit removal semantics; prefer
`finish` for completed tasks. Never force-remove unfinished work or delete task
branches. `scripts/bin/git` routes destructive Git operations through
`git-safety-guard.mjs`; `setup-git-safety.mjs` installs the PATH hook. Failed safety
inspection blocks the command without changing files, index, refs or stashes.

## Reproducible visual scenarios

`visual-scenario.mjs` validates the scenario, locale, viewport, seed, port and label,
then runs the shared Playwright fixture through the managed test lane.
`playwright.scenario.config.ts` uses one Chromium worker, isolated storage, a
strict private server, reduced motion and a fixed clock. Checkpoints live in
`tests/visual/scenarios.ts`; the existing pixel baselines reuse the battle fixture.
Captures and source/settings metadata live under ignored `reports/visual-review/`.
[Visual review](../Docs/UI_VISUAL_REVIEW.md#reproducible-scenarios) owns usage.

## Command execution and argument handling

`lib/script-run.mjs` owns CLI lifecycles: simple entries use `defineScript`,
asset transform pipelines use `runPipelineScript` (same gating plus the
`{ ok, error }` result convention). Entries with custom usage/exit-code flows
(path selection, plan metadata) stay hand-rolled on `isMainModule`.
Exit codes are 0 = pass, 1 = check failed, 2 = bad invocation (`UsageError`;
`defineScript` maps it to 2, hand-rolled entries do the same).

`lib/cli-args.mjs` owns simple flag parsing (`--flag`, `--key=value`,
`--key value`, `-m value`, `--` passthrough) so new CLIs do not hand-roll
another validator. Path selection stays on `lib/verification/changed-paths.mjs`; complex
CLIs (audit, performance) keep bespoke validators until migrated.

`lib/run-command.mjs` owns subprocess execution: `runTaskCommand` supplies the
compact one-shot interface and full logs; `runCommand`/`runCommandAsync` supply
captured output for callers that own their summaries, with complete logs when
`logPath` is set. `runStreamCommand` supplies inherited output for explicit live
mode and desktop setup, packaging, and startup checks. Do not use raw `spawnSync` in scripts — the
documented long-running owners are `repository-paths.mjs:runGit` (single git spawn with
stale-cache overrides; `git-safety-guard` must exec past its own shim and
`release-runner` keeps mockable flows) and `agent-worktree.mjs` worktree git.
`runStreamCommand` supports deadlines via `timeout`, allowing bounded-deadline desktop CLIs
(`ensure-electron`, `dist-desktop`, `smoke-desktop`) to use the shared runner directly.

`lib/command-invocation.mjs` resolves installed Node tools and npm without a shell,
keeping arguments literal and never downloading missing tools. Interrupted
commands fail even without a numeric exit status. Output formatters bound display
without changing command success; exposure metrics remain advisory.

## Script declarations

Keep TypeScript declarations beside the JavaScript module (the .d.mts extension beside .mjs), following the module's actual exports. Tests import those modules normally. Shared interface types belong to their implementation owner and are imported by other declarations; do not recreate wildcard ambient declarations in tests. Update the adjacent declaration when changing a script's public interface, and run source/test type checks.
