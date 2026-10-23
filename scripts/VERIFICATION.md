# Verification implementation

## Checks / verification (nesting order)

Gate composition, CI tiers, and reuse policy live in
[CONTRIBUTING](../CONTRIBUTING.md#static-build-and-ci-policy).

| Concern                                   | Implementation owner                                                                                                                                                                                 |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Completion orchestration                  | `check.mjs`                                                                                                                                                                                          |
| Task and opt-in full test selection       | `verify-changed.mjs` + `run-local-tests.mjs`                                                                                                                                                         |
| Finished-step exposure/digest reporting   | `lib/run-step.mjs` (shared by `check` + `verify`)                                                                                                                                                    |
| Path parsing and classification           | `lib/verification/changed-paths.mjs` + `lib/verification/change-routes.mjs`                                                                                                                          |
| Documentation contracts and plan metadata | `check-docs.mjs` (also serves `plans:check` via `--plans-only` and `docs:check:final` via `--final`), `check-documentation-contract.mjs`, `lib/plan-checks.mjs` (`finish-plans.mjs` shares that lib) |
| Passing unit receipts                     | `lib/verification/verification-cache.mjs`                                                                                                                                                            |
| Bundle budgets                            | `lib/verification/bundle-budget.mjs`                                                                                                                                                                 |
| Full and staged formatting                | `run-prettier.mjs` + `lib/verification/prettier-paths.mjs` + `.prettierignore` (`PRETTIER_NEVER_FORMAT_RE` is the staged-path subset; `.prettierignore` also covers build outputs)                   |
| Plan creation and completion              | `new-plan.mjs` + `finish-plans.mjs`; [plan lifecycle](../Docs/Plans/README.md#task-handoff)                                                                                                          |
| Selection byte budgets                    | `lib/verification/selection-budgets.mjs` (`INLINE_ARGS_BYTES` for check paths.json spill vs `RELATED_SELECTION_BYTES` for verify unit-all fallback; same value, different meanings)                  |
| Test concurrency                          | `lib/verification/test-concurrency.mjs` (`VITEST_MAX_WORKERS` for related, ship, and full unit runs via `vitest.config.ts`; local smoke uses `vitest.local.config.ts`)                               |
| Overlapping local test runs               | `lib/verification/local-test-lane.mjs` (used by `run-compact.mjs` and `run-ship-unit.mjs`)                                                                                                           |

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
(`isDocumentationPath`) and verify routing agree on documentation images.

## Local verification profiles

`check` runs the task-scoped plan described in [CONTRIBUTING](../CONTRIBUTING.md#what-to-run-when-you-change). `verify-changed.mjs` filters route commands to selected units and documentation by default; `--unit` omits documentation and `--full` retains report/asset routes. The outer gate adds applicable localization, source/test compilation, formatting and bounded selected-file lint. `check --plan` prints both the outer stages and selected route commands without executing them. Integration invokes that same gate outside the shared integration lock after merging current `main`, then revalidates the pinned commits under the lock before advancement; eligible deterministic commands reuse passing receipts in task and full profiles.

`lib/exclusive-port.mjs` supplies cancellable waiting for the test lane and integration lock. It retries occupied ports without reclaiming them, reports acquisition and periodic waiting status, and supports AbortSignal cancellation. Waiting policy and optional deadlines live in [CONTRIBUTING](../CONTRIBUTING.md#what-to-run-when-you-change). Normal release or process termination frees the OS-owned listener. Raw test invocations and watch/debug sessions remain outside the test lane; it does not coordinate unrelated host workloads.

## CI and documentation contracts

CI path filters (`.github/workflows/ci.yml` `changes` job) stay owned by the
workflows; `tests/scripts/ci-path-filters.test.ts` pins the intended
route↔gate alignment so the two lists cannot drift silently. In the full profile, `docs:check` runs
once per gate: verification skips its copy (`--skip-docs-check`) when `check`
will run it through the static aggregate.
`check:static` runs generated + format + typecheck + lint;
`lint:ci` adds docs + deadcode + boundaries + architecture-smoke + Playwright
collection, so the boundary subset is not double-run on every full static
invocation. Generated-output validation stays layered by design: fast
`sync-generated --check` (barrels + version), `assets:check:outputs` (prepared
outputs without the library), local `assets:check` (raw-source freshness), and the pre-build guard in `build-verified.mjs` share one
`syncGenerated` implementation.

Shared command launch, script lifecycle, and package metadata helpers select both
renderer builds and the desktop-family CI gates. Asset execution and publication
helpers also select prepared-output integrity checks, even when no asset selection
or binary changes. Node version and npm configuration changes select tooling
units, both renderer builds, and all path-gated CI checks. Bundle-budget code and
tuning select both renderer builds and desktop-family CI checks. The headless playthrough workflow reuses the shared dependency
setup action and cancels superseded runs on the same ref.

Documentation and Oxlint inventories exclude isolated `.worktrees/` checkouts,
reports, and installed dependencies. Broken explicit links, documented npm commands and discovery pointers remain blocking. Inline backticked filenames are explanatory prose, not inferred path contracts; use a Markdown link when a reference must remain valid. Document reachability and skill-index completeness are advisory and never fail the gate. Documentation contract checks share one
per-file fact walk (explicit links and script names) plus one
Markdown helper (`lib/agent/markdown-sections.mjs`) and one exemption owner per scope
(`isHistoryOnlyDoc` / `isReachabilityExempt` in
`check-documentation-contract.mjs`).
Explicit links can protect E2E paths as well as other source references. Keep current workflow rules and unresolved issues rather than instruction histories.
Repository-relative matching uses forward slashes on every platform. Release
notes retain historical command-name exemptions; explicit links in maintained
documents remain checked.

## Build and test selection

Script interface ownership is described in [Script declarations](./README.md#script-declarations). Shared build inputs select both renderer builds through the existing
change routes. Test selection preserves deleted paths for classification and risk escalations, but executes only surviving changed unit files. When consolidating tests, include the surviving files in the task selection; update stale suite references rather than disabling their validation. [Test value](../CONTRIBUTING.md#test-value-and-coverage-strategy) owns coverage decisions.

`check:bundle` enforces total JavaScript size, reports individual chunk sizes, and checks the selected edition's renderer assets, failing when the build is missing
or empty. [Edition policy](../Docs/STEAM_DEMO.md#edition-contract) selects `dist/` for full and `dist-demo/` for demo through `ALCHEMY_EDITION`. Web and desktop builds of the same edition overwrite that edition's renderer directory; run them sequentially with the same edition selection and check immediately
after the relevant build. The opt-in full completion gate checks each selected build
before continuing; skipping builds also skips their budgets. CI checks web bundles
on every push and release; ship gates check desktop bundles, and `dist:desktop`
checks before packaging or signing.

Preview smoke checks start and close their own server through Vite’s preview API;
an occupied port fails before any HTTP validation. They require an application script and nonempty JavaScript/CSS responses with matching content types, plus a served MP3 matching authored bytes. HTML fallbacks cannot stand in for missing resources. CI browser artifacts include music and run this smoke check after download.

### Verification cache

`lib/verification/verification-cache.mjs` implements the [reuse policy](../CONTRIBUTING.md#verification-reuse). A command can establish a receipt on its first run. Ordinary checks share one input scan pair across their deterministic stages, including selected units/docs; nested verification does not scan again. Documentation-only checks do not scan dependencies or reuse receipts. Full verification retains per-unit receipts because its aggregate also produces assets and reports. Reuse requires an observed duration of at least five seconds and must save more than twice the measured input-scan cost. The exact executable and ordered argument list identify coverage.

Input identity covers tracked and untracked nonignored files, root environment files and npm configuration, installed dependency file identities, Node executable/version/platform, checkout location, and environment. File identities include mode, size, nanosecond modification/change times, and inode; this is local filesystem reuse, not a portable content-addressed build cache. Dependency caches are excluded. Managed worktrees resolve their linked `node_modules` to the actual installation before scanning it. Linked source or external package symlinks, unreadable inputs, a missing npm install receipt, or changed inputs disable reuse. Fresh successes replace receipts atomically; failures invalidate them. Reuse preserves the original run ID and expiry. Each verifier writes a run-specific `verify/summary.json`, linked by the outer completion report.

## Compatibility commands and test runners

`npm test` prints its scope and runs only three fixed Node smoke suites; `test:full` is a compatibility alias
for `test:unit`. Existing `verify`, `verify:unit`, and `verify:full` remain available for
selection diagnosis: `verify` selects units and documentation, `verify:unit`
restricts that selection to units, and `verify:full` adds broader route checks.
Use `check` for ordinary work so the supporting gates are included automatically.
Pre-push retains outgoing-path selection and source/cleanliness guards and uses
the same task gate.

Use `rg --files tests` to locate unfamiliar suite paths. Vitest arguments are
filters: a passing mixed selection can ignore a misspelled path while another
matches, so confirm the reported file count before claiming that scope passed.

One-shot Vitest and Playwright commands through `run-compact.mjs` share a host-wide
budget. Broad units, related selections, directories, coverage and browser runs
retain the existing broad lane. One focused Vitest invocation selecting one or two
explicit `*.test.ts`/`*.test.tsx` files without additional flags may run alongside
it in a separate reservation, forced to one worker. A second run of either class
waits without a default timeout. `npm run test:status` lists active owners and
waiting work (PID, checkout, command, start time); `--json` returns the same data.
Status ignores dead processes and never reclaims their listeners. Raw/watch runs
and commands started by older checkouts are outside the status inventory.
Waiting reports progress every 30 seconds and is cancellable. Set
`ALCHEMY_LOCK_WAIT_MS` for an explicit deadline (`0` fails immediately).
The minimal Node smoke does not acquire this lane. Raw CLI and watch/debug
sessions bypass it and must be coordinated manually. The runner defaults native
bundler threads to one; the four-worker Vitest ceiling remains unchanged. An
unrelated overloaded host can still cause failures: preserve the failed result
and inspect collection and host resources before retrying or changing timeouts.
Implementation: [local test lane](./lib/verification/local-test-lane.mjs).

## Preview implementation notes

Without a Codex task identity, or on Windows, `agent:browser` passes through to
the native CLI and leaves human session ownership unchanged. User-attached
sessions are not resized. Use `npm run agent:browser -- close` for explicit
task teardown; preserve ownership records if cleanup fails.

One-shot Playwright/Electron runs use the existing managed command and test-lane
cleanup; do not replace them with detached browser daemons. The Alchemy test lane
does not reserve memory against Lantern previews or Trinket builds. When another
repo is running an expensive inspection and memory pressure is high, finish or
close the owned inspection before admitting another; source editing can continue.

DOM suites use [the JSDOM environment](../tests/jsdom-environment.ts), which
temporarily removes Node storage descriptors before browser globals are installed
and restores them during teardown. JSDOM owns both local and session storage;
Node Web Storage flags and a Node storage file are unnecessary for these tests.

The task gate selects save/persistence units for save changes, desktop boundary units for desktop changes, tooling/architecture units for tooling changes, and dependency-related coverage for other implementation changes. The full completion gate additionally selects report/asset checks, full static checks, lockfile consistency, applicable builds, bundle budgets and preview smoke.

Authoritative working-tree discovery disables Git's filesystem monitor and untracked cache per command (`-c core.fsmonitor=false -c core.untrackedCache=false`). Discovery failures are not a clean checkout. Checks preserve run-attributed diagnostics. Default checks guard task selections and declared local harness inputs; full and pre-push checks retain checkout-wide guards. Unrelated runtime edits do not invalidate a scoped local check.

## Verification receipt rules

Local task and full checks reuse passing results for deterministic unit selections
and supporting type, localization, format and lint diagnostics when their exact
commands and inputs match. This includes repeated checks before handoff, during
integration and at pre-push in the same checkout. Committing unchanged files does
not invalidate a receipt; changes to source, dependency identities, configuration,
environment or checkout do. Documentation-only checks do not scan dependencies or reuse receipts. CI always runs fresh. Builds, browser runs, assets
and report-producing gates always execute.

Receipts expire after one hour without extending on reuse. Reuse is accepted only
when it saves more than twice the input-scan cost and the original command took
at least five seconds. Reports identify the original passing run; failures and
input drift invalidate receipts. Managed worktrees support the root checkout's
linked dependency installation. Normal report cleanup removes disposable receipts.

Set `ALCHEMY_VERIFY_FRESH=1` for fresh observations, including nondeterminism
investigations and benchmark comparisons. [Cache implementation details](#verification-cache)
document input identity. Reuse is an optimization, never permission to omit a
newly selected check or substitute narrower coverage.

Supporting local stages have a 60-second deadline. Selected units use their test deadlines after acquiring the shared lane; lane waiting has no default deadline. Minimal Node smoke retains its 30-second deadline.

When source/catalog inputs change, the local check also runs the offline [localization freshness gate](../Docs/LOCALIZATION.md#agent-workflow). Agents settle experimental wording in their isolated worktree, then update translations before final verification and integration; checks and builds never invoke a translation service.

## Test maintenance details

Test retirement is required when the task concerns test maintenance or a test demonstrably obstructs the requested work. Reading or diagnosing nearby tests creates no cleanup obligation. Useful incidental consolidation is allowed when its purpose and dependencies are understood and it stays within the task. When an inexpensive change provides stronger protection, improve the test or move it to a cheaper layer.

Before retirement, check why the test exists, including known regressions, distinct integration risks, and execution tiers. Diagnose failures first: never delete or weaken a test simply to hide a product defect or obtain a green gate. Preserve trustworthy protection for consequential known regressions, save compatibility, critical journeys, and architectural boundaries; their existing test form is not sacred.

No separate permission or one-for-one replacement is required. For material coverage changes, briefly report protection added or reused, justified additions, and protection retired. For overlap, identify surviving protection; for unique coverage retired, explain the specific risk accepted and maintenance tradeoff. Avoid scoring forms and routine essays.

Keep cleanup within the task's needs; do not turn every task into a suite-wide audit. Keep scenarios focused and failures diagnosable. Combining unrelated checks into a giant journey or parameterized matrix does not improve value merely by reducing test declarations. Share fixtures where they preserve a common invariant or prevent drift; keep scenario-specific setup clear.

For exhaustive orchestration checks such as the affix sweep, retain the scenario coverage while collecting invariant violations into a total and bounded, scenario-specific examples. Avoid thousands of identical matcher calls. Test-local timeouts are failure ceilings, not performance targets; reproduce a slowdown with the full unit suite running separately from browser work before changing global workers, timeouts, or gameplay.

When removing or moving tests, remove support code made unused by retirement and update maintained references and explicit gate selections to match the surviving protection. Include deleted paths in verification scope; changed unit files that no longer exist are not executed, but their route escalations remain. For consolidation, also select the surviving test files; for retirement without replacement, run applicable gates and report material lost protection. Use timing and coverage reports as evidence when useful, without inventing quotas, mandatory measurements, or automatic threshold ratcheting.

CLI tests that create package or release artifacts must use temporary project roots,
including the script dependency closure and output directories. Never create or
remove fixtures in the checkout's real package-output or Steam build directories.

For lint policy tests, batch distinct fixture paths through
`lintFixtures` in `tests/helpers/lint-fixture.ts` so they share a real linter
launch. Preserve the original paths and configuration overrides. Independent
statements for the same path can share a source file when they parse together;
assert diagnostic source lines to distinguish rejected statements from allowed
neighbors. Keep separate launches for different configuration or type-aware modes.
Do not trade away path exceptions or diagnostic precision to reduce process count.

## Component and hook conventions

Vitest runs React, hook, and browser-adapter suites in the `dom` project; pure engine, validation, desktop-contract, and tooling suites run in the `node` project. Name browser-API suites without React `*.dom.test.ts` so their environment is clear and the shared glob selects them. React `*.test.tsx` and `use-*` / `*-hook` suites already select DOM. The include/exclude patterns in `vitest.config.ts` own that classification; the project guard checks actual collection rules for omissions and overlap. Full unit runs share the four-worker ceiling used by related and ship checks, leaving one CPU free on smaller hosts. CLI worker overrides remain available for focused diagnosis.

Preserve test import order when a shared harness registers mocks or hooks. Import organization must not move that harness after modules whose dependencies it mocks; use explicit hoisted mocks where feasible. Ordinary explanatory comments are allowed; Oxlint suppressions still require a reason. Keep comments focused on ordering, compatibility, and other reasons that names and tests alone do not explain.

Hook tests pass changing inputs through `renderHook(callback, { initialProps })` and `rerender(nextProps)`. `rerender` updates props; it does not replace the render callback.

## Git hook implementation

`lefthook` pre-push invokes only `npm run check -- --pre-push`, forwarding Git’s ref/object-ID pairs through stdin. The gate selects the union of outgoing changes, including removed paths; a new remote ref selects its full tree. Deleted remote refs require no checks. Large selections travel through a JSON path file; the opt-in full verifier falls back to the complete unit suite when related-test arguments exceed platform limits. Outgoing commits must match the checked-out HEAD, and unavailable base revisions fail explicitly. When source checks are needed, pre-push requires a clean checkout (including nonignored untracked files) so tests cannot pass against an uncommitted fix. Ordinary task checks still support dirty work. Local `--diff` selects working-tree changes only, retaining both sides of renames for risk selection. A clean diff selects nothing. `--committed <revision>` explicitly selects one commit, including its deletions. Unknown explicit paths fail instead of yielding empty test coverage. Pre-commit formats staged files selected by `scripts/lib/verification/prettier-paths.mjs`; commit-msg runs commitlint. Install hooks with `npm run prepare`.

Execution plans under `Docs/Plans/` are workflow artifacts, not product correctness gates. Follow the [plan lifecycle](../Docs/Plans/README.md) to finish and remove only task-owned plans, then validate with `npm run docs:check` (also included in the opt-in full gate). `npm run docs:check:final` is an explicit repository-wide closure check; another task's active plan does not require cancellation or block ordinary handoff.

## Toolchain and CI reference

Development and CI use Node 24 (minimum 24.18) and npm 11; package engines and
strict install checks enforce that supported toolchain. Peer dependencies are
validated rather than bypassed. ESLint is installed only as the peer host for
the plugins run through Oxlint's JS bridge; Oxlint remains the lint runner.

Dependabot checks npm and Actions weekly. Related React, Vite, Vitest and Tailwind
minor/patch updates travel together; major upgrades remain separate reviews.
`npm run check:dependencies` audits all dependencies at moderate severity and
above and runs in `lint:ci`. Do not bypass a new advisory without tracing its
actual dependency path and exposure. Temporary overrides keep electron-builder
on the maintained ESM Electron downloader and typed-rest-client on patched qs;
remove each when its upstream dependency range incorporates the fix.
Electron binary downloads use Electron's own hardened ZIP extractor. Install
scripts are explicitly allowed for Electron, Sharp, Sentry CLI, SWC and hooks;
optional fsevents scripts are disabled in favor of Node's watcher fallback.

Desktop renderer output targets Electron 45's Chromium 156; web QA output uses
Vite's widely available browser baseline. Keep the desktop target aligned when
updating Electron. Packaged Windows smoke, native Steam overlay/input and release
signing still need their respective platform and release checks.

TypeScript 7 owns source and test compilation. Oxlint owns linting through
`oxlint.config.ts`, with type-aware source checks supplied by `oxlint-tsgolint`.
Prettier continues to own formatting. The Oxc and TypeScript 7 language-server
extensions are recommended in `.vscode/extensions.json`; the TypeScript extension
still uses the upstream `native-preview` extension identifier, while the compiler
package itself is the stable release. `dev:checked` retains terminal diagnostics
and the browser overlay through vite-plugin-checker's native compiler watcher.
Dependency-cruiser uses SWC and the shared alias through its resolve-config seam;
its cycle gate excludes erased type edges, while Oxlint enforces type import
boundaries as well as runtime imports.

| Command                           | Role                                                                                                                                         |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check:static`            | Generated outputs, formatting, source/test types, and Oxlint (fast local static; no boundary subset double-run)                              |
| `npm run lint:ci`                 | The canonical every-push static aggregate: `check:static`, docs, dead code, import boundaries, architecture smoke, and Playwright collection |
| `npm run build` / `build:desktop` | Pure generated-output-validating web or desktop build                                                                                        |
| `npm run assets:check`            | Read-only local Asset Library source freshness check                                                                                         |
| `npm run test:e2e:critical`       | Every-push representative player journeys                                                                                                    |

Independent static checks finish even when a sibling fails, including the nested
aggregate. The aggregate still fails if any checker fails; dependent build and
smoke steps do not run after failure. Compact failure summaries share their
budget across failed checkers, retain excerpts from both ends of long diagnostics,
and link to numbered full-log locations. Exit status identifies a failed checker;
when its diagnostic format is unrecognized, retain bounded output from both ends
instead of reducing the summary to its exit footer.

Pre-push also validates committed asset integrity: asset-related selections run
`npm run assets:check` and require the selected local library sources; other
selections run `npm run assets:check:outputs` without the library. Ordinary
task-scoped `check` does not add either asset check.

Builds only validate generated outputs and never prepare or rewrite tracked
sources. `npm run dev` validates committed outputs through its `predev` lifecycle; use the
explicit `sync:*` and asset authoring commands when intentionally regenerating
outputs for a build.

Every pull request and push to `main` runs the static aggregate, full Vitest, one web build plus preview smoke, the critical browser suite, and representative production localization acceptance in an independent job. Nightly and release retain the full shipped-locale matrix plus expanded-English development acceptance. Prepared assets, desktop packaging, and Electron tests remain path-gated. Dependency setup skips Electron downloads by default; only packaging and Electron test jobs install the binary. Installed Electron binaries use exact lockfile-specific caches without fallback to an older dependency set. Browser setup installs OS dependencies even when browser binaries are cached. Prepared-output integrity jobs use committed selections and outputs without Asset Library. CI topology is owned solely by `.github/workflows/`; local test selection is owned by the broad categories in `scripts/lib/verification/change-routes.mjs`.

Static and unit CI jobs use one-commit checkouts; history-dependent tests create
their own fixture repositories. Change detection and release ancestry jobs retain
full history. Clean shallow selections conservatively use the checked-out tree.

External GitHub Actions in workflows and composite actions use full commit SHAs,
with version comments for review. Resolve pins from the action's own repository;
keep local actions on relative paths. [.github/dependabot.yml](../.github/dependabot.yml)
groups weekly Actions updates into reviewable pull requests; updates still pass
the normal CI gates before merging.

[Bugbot](../.cursor/BUGBOT.md) remains an optional post-push review aid for gameplay, save, and battle-rule changes; it is not a required status check.

Release validation remains deliberately redundant because it protects published artifacts. See [RELEASE.md](../Docs/RELEASE.md).

## Connected interaction runner

[Interaction coverage](../tests/interaction/README.md) maps every screen to its
lifecycle family and documents deterministic replay. `npm run test:interactions`
runs the seven connected families with 16 fixed seeds and up to 40 actions each.
The normal CI unit suite includes those cases. Nightly unit coverage sets
`ALCHEMY_INTERACTION_TIER=nightly` for 128 distinct seeds and up to 120 actions;
it does not rerun push seeds. Failures and seed manifests live in the existing
run-attributed reports directory. `--family`, `--seed`, `--replay`, `--day` and
`--shrink` support reproduction and bounded trace reduction.

Use these tests for asynchronous completion, cancellation and stale callbacks;
retain real commands and gate logic. Replace low-value helper-call assertions
when connected outcome coverage supersedes them. Electron interaction canaries
run in the existing desktop CI tier, with deeper variants nightly. No additional
browser engine or worker/shard expansion is required. Local execution follows
the [gate policy](../CONTRIBUTING.md#what-to-run-when-you-change), including its authorization for
bounded rendered UI review and focused browser checks.
