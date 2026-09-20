# Scripts implementation map

Use [REFERENCE](../Docs/REFERENCE.md#script-command-reference) to choose a command,
[CONTRIBUTING](../CONTRIBUTING.md#what-to-run-when-you-change) to select checks,
and this map to locate their implementation owners.

## Assets

[WORKFLOWS-ASSETS](../Docs/WORKFLOWS-ASSETS.md) owns authoring commands and the
choice between fast generated checks and prepared-output verification.
Asset and synchronization CLIs validate selectors before writing, including in
skip mode; keep that validation at each entry point.

| Concern                                    | Implementation owner                                                                                                                                                                                                                                                                                      |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Asset CLI and preparation                  | `assets.mjs` → `prepare-assets.mjs` (canonical surface; `npm run assets:check` is `assets.mjs --check`; direct `optimize-*.mjs` calls are the supported iteration shortcut behind `assets:optimize[:art\|:sounds\|:music]`)                                                                               |
| Art, sound, and music optimization         | `optimize-pipelines.mjs` → `optimize-assets.mjs`, `optimize-sounds.mjs`, `optimize-music.mjs` via `lib/asset-pipeline-runner.mjs`                                                                                                                                                                         |
| Generated art barrels and version metadata | `sync-generated.mjs` → `sync-art-barrels.mjs`, `sync-version-metadata.mjs` (`sync:art` syncs both barrels; `sync:gear-art` alone refuses stale `assets.generated.ts`; `sync:version` stamps the build version alone; `prepare`/`assets:check` sync art barrels and version metadata as independent steps) |
| Fast generated-output validation           | `sync-generated.mjs --check`                                                                                                                                                                                                                                                                              |
| Read-only prepared-output freshness        | `assets.mjs --check` → `check-prepared-assets.mjs` (partial-failure `prepare` advances barrels when art succeeds; `check` is all-or-nothing)                                                                                                                                                              |

Shared: `lib/asset-constants.mjs` (tuning, `MANAGED_DIRS` managed outputs — the manifest is the complete inventory, no directory exceptions), `lib/asset-pipeline-runner.mjs` (pipeline paths, output-dir creation, source reads, freshness, failure normalization),
`lib/asset-manifest-cache.mjs` (freshness,
check-mode `ENOENT` maps to stale errors),
`lib/process-helpers.mjs` (generic `targetErrorHandler`, `failedResult`),
`lib/gear-filenames.mjs` (single owner for gear slugging/patterns, slot IDs, WebP/gear classification), `assets/music-assets.mjs` (music filename registry).
Manifest paths derive from `MANAGED_DIRS` + `MANIFEST_BASENAME` via `getManagedManifestPath` (`getOptimizedManifestPath` is the art-specific alias used by barrel sync).

## Agent discovery and evaluation

| Concern                                                             | Implementation owner        |
| ------------------------------------------------------------------- | --------------------------- |
| Owner sections and implementation entry points                      | `lib/agent-context.mjs`     |
| Markdown fences, headings, and section extraction                   | `lib/markdown-sections.mjs` |
| Bounded search, related-file hints, and disposable context sessions | `lib/agent-discovery.mjs`   |
| Preread measurement                                                 | `measure-agent-context.mjs` |
| Evaluation records and comparison                                   | `agent-eval.mjs`            |

Source declarations, authored entries, and optional test navigation are parsed in `lib/source-outline.mjs`; `agent-context.mjs` owns bounded rendering. `run-compact.mjs`, `lib/run-command.mjs`, and `lib/compact-output.mjs` provide the shared one-shot command policy: compact summaries by default, complete logs on disk, and explicit live output for interactive work. `lint-ci.mjs` applies that policy to the aggregate static gate so direct CI checks do not dump every collected browser test.

[Agent discovery](../Docs/REFERENCE.md#agent-discovery) documents command options
and limitations; [evaluations](../.agents/evals/README.md) owns pinned setup and
interpretation. Discovery metadata must reference canonical prose rather than
copying it, and it does not own verification selection. The search fallback skips deleted
tracked files and files removed during a search, while other read errors fail.

## Checks / verification (nesting order)

Gate composition, CI tiers, and reuse policy live in
[CONTRIBUTING](../CONTRIBUTING.md#static-build-and-ci-policy).

| Concern                                   | Implementation owner                                                                                                                                                                                  |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Completion orchestration                  | `check.mjs`                                                                                                                                                                                           |
| Related tests and risk escalations        | `verify-changed.mjs`                                                                                                                                                                                  |
| Finished-step exposure/digest reporting   | `lib/run-step.mjs` (shared by `check` + `verify`)                                                                                                                                                     |
| Path parsing and classification           | `lib/changed-paths.mjs` + `lib/change-routes.mjs`                                                                                                                                                     |
| Documentation contracts and plan metadata | `check-docs.mjs` (also serves `plans:check` via `--plans-only` and `docs:check:final` via `--final`), `check-documentation-contract.mjs`, `lib/plan-checks.mjs` (`archive-plans.mjs` shares that lib) |
| Passing unit receipts                     | `lib/verification-cache.mjs`                                                                                                                                                                          |
| Bundle budgets                            | `lib/bundle-budget.mjs`                                                                                                                                                                               |
| Full and staged formatting                | `run-prettier.mjs` + `prettier-paths.mjs` + `.prettierignore` (`PRETTIER_NEVER_FORMAT_RE` is the staged-path subset; `.prettierignore` also covers build outputs)                                     |
| Plan creation and archiving               | `new-plan.mjs` + `archive-plans.mjs`; [plan lifecycle](../Docs/Plans/README.md#task-handoff)                                                                                                          |
| Selection byte budgets                    | `lib/selection-budgets.mjs` (`INLINE_ARGS_BYTES` for check paths.json spill vs `RELATED_SELECTION_BYTES` for verify unit-all fallback; same value, different meanings)                                |
| Test concurrency                          | `lib/test-concurrency.mjs` (`VITEST_MAX_WORKERS` for ship suites; CI full runs keep Vitest defaults)                                                                                                  |

`lib/repository-paths.mjs` normalizes selections for checks and discovery. Relative
and absolute paths inside the checkout are equivalent. Directory selections use
tracked and untracked nonignored Git paths, including deleted tracked files;
empty directory selections fail explicitly. It also owns `toRepoRelative` (the
single repo-relative spelling, also used by route matching) and `runGit` (the single git spawn with
stale-cache overrides); `git-safety-guard.mjs` is the deliberate exception
because it must exec the real binary past its own shim. Release writes keep
logged inherit flows via `command-invocation.mjs`; release reads use `runGit`.
Route glob matching precompiles `ROUTES` + shared build patterns once instead
of per file. The `documentation` route covers `Docs/**` so check classification
(`isDocumentationPath`) and verify routing agree on docs images and archives.

CI path filters (`.github/workflows/ci.yml` `changes` job) stay owned by the
workflows; `tests/scripts/ci-path-filters.test.ts` pins the intended
route↔gate alignment so the two lists cannot drift silently. `docs:check` runs
once per gate: verification skips its copy (`--skip-docs-check`) when `check`
will run it through the static aggregate.
`check:static` runs generated + format + typecheck + lint (fast local static);
`lint:ci` adds docs + deadcode + boundaries + architecture-smoke + Playwright
collection, so the boundary subset is not double-run on every local static
invocation. Generated-output validation stays layered by design: fast
`sync-generated --check` (barrels + version), full `assets:check` (prepared
outputs), and the pre-build guard in `build-verified.mjs` share one
`syncGenerated` implementation.

Documentation and ESLint inventories exclude isolated `.worktrees/` checkouts,
reports, and installed dependencies. Documentation contract checks share one
per-file fact walk (`links`, backticked candidates, script names) plus one
Markdown helper (`lib/markdown-sections.mjs`) and one exemption owner per scope
(`isHistoryOnlyDoc` / `isHistoricalDoc` / `isReachabilityExempt` in
`check-documentation-contract.mjs`); route context budgets live in
`lib/route-context-budgets.mjs`. Current-file checks cover E2E paths as well as other source references. Instruction
history is advisory and does not require an entry for each skill or knowledge edit.
Repository-relative matching uses forward slashes on every platform, including
history and archived-plan exemptions.

Script interface ownership is described in [Script declarations](#script-declarations). Shared build inputs select both renderer builds through the existing
change routes. Test selection preserves deleted paths for classification and risk escalations, but executes only surviving changed unit files. When consolidating tests, include the surviving files in the task selection; update stale suite references rather than disabling their validation. [Test value](../CONTRIBUTING.md#test-value-and-coverage-strategy) owns coverage decisions.

`check:bundle` enforces total JavaScript size, reports individual chunk sizes, and checks the current `dist/assets/` and fails when the build is missing
or empty. Web and desktop renderer builds both write `dist/`; run them sequentially and check immediately
after the relevant build. The local completion gate checks each selected build
before continuing; skipping builds also skips their budgets. CI checks web bundles
on every push and release; ship gates check desktop bundles, and `dist:desktop`
checks before packaging or signing.

Preview smoke checks start and close their own server through Vite’s preview API;
an occupied port fails before any HTTP validation. They require an application script and nonempty JavaScript/CSS responses with matching content types, plus a served MP3 matching authored bytes. HTML fallbacks cannot stand in for missing resources. CI browser artifacts include music and run this smoke check after download.

### Verification cache

`lib/verification-cache.mjs` implements the [reuse policy](../CONTRIBUTING.md#verification-reuse). A command becomes eligible after an observed duration of at least five seconds, and reuse must save more than twice the measured input-scan cost. The first run records duration without scanning dependencies; a subsequent slow run establishes its receipt. The exact executable and ordered argument list identify coverage.

Input identity covers tracked and untracked nonignored files, root environment files and npm configuration, installed dependency file identities, Node executable/version/platform, checkout location, and environment. File identities include mode, size, nanosecond modification/change times, and inode; this is local filesystem reuse, not a portable content-addressed build cache. Dependency caches are excluded. Linked source or external dependency symlinks, unreadable inputs, a missing npm install receipt, or changed inputs disable reuse. Fresh successes replace receipts atomically; failures invalidate them. Reuse preserves the original run ID and expiry. Each verifier writes a run-specific `verify/summary.json`, linked by the outer completion report.

## Release / changelog (three stages, shared `lib/patch-notes-core.mjs` + `lib/git-release.mjs`)

| Output or operation                                          | Implementation owner                                                                    |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Developer Unreleased history                                 | `sync-changelog.mjs`                                                                    |
| Versioned changelog section                                  | `release-changelog.mjs`                                                                 |
| Player notes from commits and trailers                       | `generate-patch-notes.mjs`                                                              |
| Release orchestration (`release`, `release:hotfix --hotfix`) | `release.mjs` → `lib/release-runner.mjs`                                                |
| Build version stamping                                       | `sync-version-metadata.mjs` (sequenced by `release-runner.mjs` post-bump)               |
| Release artifact validation                                  | `verify-release.mjs` → `lib/release-checks.mjs`                                         |
| Tag-vs-package check                                         | `verify-release.mjs --skip-package` (also run locally pre-push by `release-runner.mjs`) |
| Steam upload                                                 | `steam-upload.mjs`                                                                      |
| Verified build                                               | `build-verified.mjs`                                                                    |

[RELEASE](../Docs/RELEASE.md#changelog-release-time-only) owns timing, note policy,
and the release decision flow.

Desktop: `ensure-electron.mjs` (orchestrator) → `electron-download.mjs` + `electron-path.mjs`
(pure predicates); `dist-desktop.mjs` → `verify-desktop-package.mjs`.
`lib/desktop-build-config.mjs` validates release configuration before both the
verified desktop build and direct packaging. `desktop/after-pack.cjs` locates
default V8 snapshots with one directory walker on all supported Node versions,
then installs the browser-process copies before enabling their fuse. The build wrapper rejects conflicting mode selectors before validation or Vite, so `build:desktop` always builds desktop mode.
Packaged Windows startup: `smoke-desktop.mjs` resolves the artifact and invokes
`smoke-desktop.ps1` for native accessibility verification (see [RELEASE](../Docs/RELEASE.md#packaged-windows-startup-check)).

`platforms.json` owns the desktop target list; `package.json` build blocks own per-platform packaging configuration. Sentry release and desktop sourcemap mode are owned by `lib/sentry-release.mjs`; chunk splitting is owned by `lib/vite-chunks.mjs`. Vite uses only Rolldown chunk groups.

## Audits (periodic sweep, not a push gate)

`npm run audit` runs `audit.mjs`, which dispatches to `audit-all.mjs` when no
selector is supplied, including with `--verbose`. `npm run audit:all` is the
same sweep via `audit.mjs --all` (thin forward, not a separate entry).
Pass a focused selector after
the npm separator (`npm run audit -- --types|--amplification|--content|--hotspots`)
to dispatch one probe instead. `--all` is the periodic sweep, not literally
every audit — use `--hotspots` separately. Gating probes: knip, depcruise, eslint complexity,
content-audit. Advisory trend probes (always exit 0):
`audit-type-escapes.mjs`, `audit-change-amplification.mjs` — direction signals, see
`Docs/Audits/TypeSafetyAudit.md`. `context-hotspots` / `runs:show` are advisory process
evidence and never block handoff.

## Test / E2E

`npm run test:e2e:route -- <route> [-- extra playwright args]`;
`test:ship:unit`, `test:e2e:audit` (full timings), `perf`, `balance:sim`, `ci:summarize`.
Every `E2E_ROUTES` entry has a matching `test:e2e:<name>` alias
(`tests/scripts/run-e2e-route.test.ts` pins the set); legacy screen names
`shop-screen` and `homestead-screen` remain accepted as aliases.
`ci-summarize.mjs --vitest/--playwright/--all` is the single CI summary entry;
workflows call it directly with the matching flag. A lone positional path is
inferred from its filename (playwright-containing paths summarize Playwright).
Report parsing lives in
`lib/vitest-summary.mjs` and `lib/playwright-summary.mjs`; both share the
`lib/report-summary.mjs` skeleton (budgets, first-line truncation, runner-error
and overflow sections, missing-report wording) via one table-driven publisher.
`summarize*Report` headers are
stats-authoritative while `collectPlaywrightTests` is the walked audit model
for slowest-tables (`topSlowestTests` is shared with `analyze-e2e.mjs`) — on inconsistent reports the header and the tables can
differ by design. Malformed reports must fail rather than appear to be
successful zero-test runs.

`run-performance.mjs` owns profiling options and validates them before builds
or downloads. Measurements and interpretation follow [PERFORMANCE](../Docs/PERFORMANCE.md).

Balance and loot reports share the middleware-mode Vite bootstrap in
`lib/vite-report-server.mjs` (also used by `content-audit.mjs`, which is now an
import-safe `defineScript` entry); both are import-safe `defineScript` entries and
both leave a run receipt. Report paths resolve from the script root, not the
invoking CWD. Long-running suite/build/profiling CLIs
(`run-ship-unit`, `run-e2e-route`, `run-performance`, `build-verified`,
`run-prettier`, `audit` dispatcher) stream output intentionally through the
shared `runStreamCommand` runner instead of bounded `runCommand` capture or raw
`spawnSync`.

## Development

`dev` and `dev:checked` share `predev` asset preparation and port cleanup;
`dev:checked` also enables the live TypeScript checker. Desktop development adds
Steam App ID synchronization.

## Cleanup (`clean` = explicit reset, `prune:transient` = age-based GC)

`npm run clean` removes local reports and the Vite cache. `npm run clean:all`
also removes build outputs and stops Alchemy-owned test-server processes; add
`--include-dev-port` with `--processes` to include the development server
(passing it alone warns and does nothing). `npm run prune:transient`
deletes stale local artifacts by age. Neither command removes shared Playwright
browser caches.
Age-based pruning skips symlinked transient roots as well as nested symlink traversal.
Both share `lib/clean-dev-artifacts.mjs` transient roots.

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
another validator. Path selection stays on `lib/changed-paths.mjs`; complex
CLIs (audit, performance) keep bespoke validators until migrated.

`lib/run-command.mjs` owns subprocess execution: `runCommand`/`runCommandAsync`
for captured bounded output with `logPath` (checks, verification, audits, E2E
analysis; only bounded excerpts enter summaries), `runStreamCommand` for
long-running CLIs that stream inherit output (builds, ship suites, browser
runs, profiling, formatting). Do not use raw `spawnSync` in scripts — the
documented long-running owners are `repository-paths.mjs:runGit` (single git spawn with
stale-cache overrides; `git-safety-guard` must exec past its own shim and
`release-runner` keeps mockable flows) and `agent-worktree.mjs` worktree git.
Bounded-deadline desktop CLIs (`ensure-electron`, `dist-desktop`,
`smoke-desktop`) still use raw `spawnSync` for timeout/inherit flows that
`runStreamCommand` does not support yet; migrate them when the shared runner
grows deadline support rather than adding new raw call sites.

`lib/command-invocation.mjs` resolves installed Node tools and npm without a shell,
keeping arguments literal and never downloading missing tools. Interrupted
commands fail even without a numeric exit status. Output formatters bound display
without changing command success; exposure metrics remain advisory.

## Script declarations

Keep TypeScript declarations beside the JavaScript module (the .d.mts extension beside .mjs), following the module's actual exports. Tests import those modules normally. Shared interface types belong to their implementation owner and are imported by other declarations; do not recreate wildcard ambient declarations in tests. Update the adjacent declaration when changing a script's public interface, and run source/test type checks.
