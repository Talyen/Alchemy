# Scripts implementation map

Use [Commands](../Docs/COMMANDS.md#script-command-reference) to choose a command,
[CONTRIBUTING](../CONTRIBUTING.md#what-to-run-when-you-change) to select checks,
and this map to locate their implementation owners.

[Verification implementation](./VERIFICATION.md) covers gate nesting, changed-path
selection, reports, build validation, and receipt caching.

Keep command entry points directly in `scripts/`. Asset registries and pipeline
helpers live together in `assets/`, with TypeScript declarations beside their
modules. Sound desk mapping, media, server and board modules live in `audio-review/`;
`audio-review.mjs` remains its command entry point. `lib/agent/`, `lib/release/`, and `lib/verification/` group task-specific helpers; general process and repository helpers remain directly in `lib/`.

## Assets

[WORKFLOWS-ASSETS](../Docs/WORKFLOWS-ASSETS.md) owns authoring commands and the
choice between fast generated checks and prepared-output verification.
Asset and synchronization CLIs validate selectors before writing, including in
skip mode; keep that validation at each entry point.

| Concern                                    | Implementation owner                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Asset CLI and preparation                  | `assets.mjs` → `prepare-assets.mjs` (canonical surface; `npm run assets:check` is the local source check; `assets:check:outputs` adds `--outputs-only` for CI; direct `optimize-*.mjs` calls are the supported iteration shortcut behind `assets:optimize[:art\|:sounds\|:music]`)                                               |
| Art, sound, and music optimization         | `assets/optimize-pipelines.mjs` → `optimize-assets.mjs`, `optimize-sounds.mjs`, `optimize-music.mjs` via `assets/asset-pipeline-runner.mjs`                                                                                                                                                                                      |
| Generated art barrels and version metadata | `sync-generated.mjs` → `sync-art-barrels.mjs`, `sync-version-metadata.mjs` (`sync:art` syncs both barrels; `sync:gear-art` alone refuses stale `assets.generated.ts`; `sync:version` stamps the build version alone; asset preparation syncs art barrels and version metadata independently; `assets:check` only validates them) |
| Fast generated-output validation           | `sync-generated.mjs --check`                                                                                                                                                                                                                                                                                                     |
| Read-only prepared-output freshness        | `assets.mjs --check` → `check-prepared-assets.mjs` (partial-failure `prepare` advances barrels when art succeeds; `check` is all-or-nothing)                                                                                                                                                                                     |

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

`platforms.json` owns the desktop target list; `package.json` build blocks own per-platform packaging configuration. Sentry release and desktop sourcemap mode are owned by `lib/release/sentry-release.mjs`; chunk splitting is owned by `lib/vite-chunks.mjs`. Vite uses only Rolldown chunk groups.

## Audits (periodic sweep, not a push gate)

`npm run audit` runs `audit.mjs`, which dispatches to `audit-all.mjs` when no
selector is supplied, including with `--verbose`. `npm run audit:all` is the
same sweep via `audit.mjs --all` (thin forward, not a separate entry).
Pass a focused selector after
to dispatch one probe instead. `--all` is the periodic sweep, not literally
content-audit. Advisory trend probes (always exit 0):
`audit-type-escapes.mjs`, `audit-change-amplification.mjs` — direction signals, see
`Docs/Audits/TypeSafetyAudit.md`. `runs:show` is advisory process
evidence and never block handoff.

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

`run-performance.mjs` owns profiling options and validates them before builds
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

Playthrough and performance-case workers use `runCommandAsync` so deadlines and
cancellation stop their process trees. Interrupted playthroughs keep their
journal prefix and starting-state evidence for replay.

## Development

`npm run dev` runs committed-output validation and port cleanup through `predev`.
`npm run dev:checked` starts Vite with the live TypeScript 7 checker directly;
run `npm run predev` first when using that command. Desktop development runs
the same preparation and adds Steam App ID synchronization.

## Cleanup (`clean` = explicit reset, `prune:transient` = expiry)

`npm run clean` removes local reports and Vite cache; `--builds` adds rebuildable
build outputs. `--processes` stops Alchemy-owned test listeners;
`--include-dev-port` also selects the normal dev port, only with `--processes`.
`--all` combines builds and processes. Use `--dry-run` to preview deletion.

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
Inspection and backup must honor the caller's Git options and checkout; failed
inspection blocks the operation. Git clean and push dry runs bypass backup so
inspection never stashes the working tree. Creation instructions return to the
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
