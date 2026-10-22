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

`npm run test:e2e:route -- <route> [extra Playwright arguments]`;
`test:ship:unit`, `test:e2e:audit` (full timings), `perf`, `balance:sim`, `ci:summarize`.
All `E2E_ROUTES` entries use the single `test:e2e:route` command; individual
`test:e2e:<name>` scripts do not exist. `tests/scripts/run-e2e-route.test.ts`
pins that interface. The route names `shop-screen` and `homestead-screen`
remain accepted as aliases for `shop` and `homestead`.
`ci-summarize.mjs --vitest/--playwright/--all` is the single CI summary entry;
workflows call it directly with the matching flag. A lone positional path is
inferred from its filename (playwright-containing paths summarize Playwright).
Report parsing lives in
`lib/verification/vitest-summary.mjs` and `lib/verification/playwright-summary.mjs`; both share the
`lib/verification/report-summary.mjs` skeleton (budgets, first-line truncation, runner-error
and overflow sections, missing-report wording) via one table-driven publisher.
`summarize*Report` headers are
stats-authoritative while `collectPlaywrightTests` is the walked audit model
for slowest-tables (`topSlowestTests` is shared with `analyze-e2e.mjs`) — on inconsistent reports the header and the tables can
differ by design. Malformed reports must fail rather than appear to be
successful zero-test runs. Supplied counters must be non-negative integers;
unknown assertion outcomes also fail the summary and retain CI diagnostics.

`run-performance.mjs` delegates to `lib/performance/performance-runner.mjs`, which owns profiling options and validates them before builds
or downloads. Measurements and interpretation follow [PERFORMANCE](../Docs/PERFORMANCE.md).

Balance and loot reports share the middleware-mode Vite bootstrap in
`lib/vite-report-server.mjs` (also used by `content-audit.mjs`, which is now an
import-safe `defineScript` entry); both are import-safe `defineScript` entries and
both leave a run receipt. Report paths resolve from the script root, not the
invoking CWD. One-shot suite/build/profiling CLIs
(`run-ship-unit`, `run-e2e-route`, `run-performance`, `build-verified`,
`run-prettier`, `audit` dispatcher) use `runTaskCommand` to retain complete logs
and print compact summaries. Supported `--live` / `--verbose` options select
streaming output when needed.

`run-playthrough.mjs` delegates to `lib/playthrough/playthrough-runner.mjs`;
`run-playthrough-worker.mjs` delegates to `lib/playthrough/career-worker.mjs`.
The entry points retain CLI lifecycle and artifact registration; implementations
are import-safe. Performance comparison models and scenarios remain in `performance/`.

Playthrough and performance-case workers use `runCommandAsync` so deadlines and
cancellation stop their process trees. Interrupted playthroughs keep their
journal prefix and starting-state evidence for replay.

## Development

`npm run dev` runs committed-output validation and port cleanup through `predev`.
`npm run dev:checked` starts Vite with the live TypeScript 7 checker directly;
run `npm run predev` first when using that command. Desktop development runs
the same preparation and adds Steam App ID synchronization.
Vite and Electron share a lifetime: exiting either process stops the other,
and the first exit determines the command's status.
Desktop startup waits for a successful HTTP response and releases the readiness
response body before launching Electron.

## Cleanup (`clean` = explicit reset, `prune:transient` = expiry)

`npm run clean` removes local reports and Vite cache; `--builds` adds rebuildable
build outputs. `--processes` stops Alchemy-owned test listeners;
`--include-dev-port` also selects the normal dev port, only with `--processes`.
`--all` combines builds and processes. Use `--dry-run` to preview deletion.
Cleanup preserves caches reached through a linked `node_modules` directory so
an isolated worktree cannot remove the original checkout's shared cache.
Listener ownership also excludes nested `.worktrees/` checkouts from the
original checkout's process cleanup.

`npm run prune:transient` expires diagnostic bundles after 24 hours of inactivity;
`--days=<number>` changes the cutoff. Runs under `reports/runs`, `compact`,
`agent-diff`, `performance` and test failure collections expire
independently; other report directories expire as complete bundles. Fresh
children preserve older siblings. Age uses the newest contained file (or an
empty directory's timestamp), so copying or moving the checkout does not renew
old evidence. Stale current-run pointers are removed when
their run disappears. Roots and nested symlinks are never traversed.

Report-producing CLIs register process-owned guards and prune on normal idle
exit. Pruning skips the transient tree while another participating tool is
active; explicit cleanup refuses deletion. Registration and deletion share a
short OS-released loopback mutex keyed by the checkout's real path. Separate
checkouts do not share a fixed port; a port collision fails without deleting
artifacts. The mutex remains held until its operation settles. Abandoned guards are recovered only after confirming
the owner is dead; unreadable ownership remains protected. No processes are
terminated for artifact cleanup. Raw tools launched outside the wrappers need
manual coordination. Dry runs change no files.

Both commands share `lib/clean-dev-artifacts.mjs` roots. Build outputs, production
sources, release packages and scratch/output experiments are outside automatic
expiry. Inspect unfinished experiments before deleting them explicitly.

## Worktree / git safety

Use one isolated worktree per implementation chat, without polling other chats
or negotiating ownership. Reuse the chat's existing suitable worktree.
`node scripts/agent-worktree.mjs create --task <slug>` (`.worktrees/<slug>` on `agent/<slug>`, from committed local `main` by default);
`--detached` for verification-only runs. Creation links `node_modules` from
the root checkout automatically when present; run `npm ci` only if package
dependencies change.

If `agent/<slug>` already exists, creation checks out that retained branch at its
current commit; `--base` applies only when creating a new branch (or a detached
checkout). Inspect the resulting branch and commit before reviewing or editing.
Use a fresh slug for new work when the retained branch belongs to an earlier task;
when intentionally continuing it, incorporate current `main` in the task worktree
before relying on its documentation or source.

Run worktree management commands from the original checkout. Removal validates
the exact registered worktree; an unregistered directory requires inspection
and explicit `--force`. An empty normalized task name is rejected.

Task-scoped commits and local integration into `main` are authorized by
[AGENTS.md](../AGENTS.md#working-style); pushes and PRs still require a request.
Commit only reviewed task-owned changes with the required release trailer, then run:

```sh
node scripts/agent-worktree.mjs integrate --task <slug>
```

Integration uses an exclusive loopback port derived from the shared Git directory,
so all worktrees share one OS-released lock. A busy lock waits for up to 60 seconds with status output; cancellation stops the wait.
`ALCHEMY_LOCK_WAIT_MS` sets the deadline (`0` fails immediately). If it expires, retry
later without messaging other chats. A port collision also fails closed. The command
requires registered task and `main` checkouts with no dirty files or unfinished Git
operations. Safety reads bypass Git's filesystem monitor and untracked cache
without changing repository settings. While holding the lock, it merges current local `main` into the task,
runs `npm run check -- <combined changed paths>` (including both sides of renames),
using the same selected units, docs and supporting checks as ordinary task verification, then fast-forwards `main` only if verification succeeded and
both checkouts remain clean at the expected commits. It never pushes or switches
checkout branches. Verification uses the merged task's shared Node command launcher
so npm runs without shell interpretation on Windows too. Only protection the selector cannot infer needs an additional focused run.
An active bisect in either checkout also blocks integration before either branch advances.

Resolve understood merge conflicts in the task worktree, commit the resolution,
and retry; ambiguous conflicts or dirty `main` are blockers to report to the user.
Failures preserve task work and leave `main` unchanged. Never bypass serialization
with a manual update to `main`. Keep unintegrated work committed and recoverable;
cleanup must not discard work.

Successful integration automatically deletes and unregisters only the named task
worktree while holding the integration lock. Cleanup rechecks its branch, commit,
clean status, unfinished Git operations, registration and lock state; submodules
block automatic cleanup. Failed verification never removes a worktree. A cleanup
failure leaves the completed integration in place and reports the blocker.

The checkout first moves atomically to a temporary directory under
`~/.codex/worktree-archives/Alchemy/` so failed unregistration can restore it.
After unregistration, the temporary directory is deleted immediately, including
ignored files and build outputs. Successful integration retains no archived
checkout. The task branch remains available through
`git worktree add <original-path> <branch>`; ignored and other local-only files are
permanently deleted. Use `--keep-worktree` when those files are still needed.
`CODEX_WORKTREE_ARCHIVE_ROOT` can select an external staging directory; moving
across filesystems fails without deleting the source. If cleanup fails after
integration, inspect the reported checkout or staging directory; `recovery.json`
records the original path, branch and commit.

Use `node scripts/agent-worktree.mjs integrate --task <slug> --keep-worktree` for
intermediate integration when requested work, a preview or an experiment still
needs the checkout. Final integration cleans up by default. Report cleanup status
alongside integration and verification results.

After handoff, stop: no completion broadcasts,
acknowledgments, polling, or waking completed chats. Only a concrete unresolved
dependency or conflict warrants a bounded chat exchange.

`scripts/bin/git` shims destructive git through
`git-safety-guard.mjs` (rejects destructive commands against dirty checkouts); `setup-git-safety.mjs` installs the PATH hook.
Inspection must honor the caller's Git options and checkout; failed
inspection blocks the operation. Checkout path restores are guarded with or without
`--`; a single branch operand remains a branch switch even when a tracked file
shares its name. Rejection leaves files, the index, branches and stashes untouched. Git clean and push dry runs remain available for inspection. Backups require an explicit, authorized action. Creation instructions return to the
original checkout before worktree removal.

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
