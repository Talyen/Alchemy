# Verification implementation

## Checks / verification (nesting order)

Gate composition, CI tiers, and reuse policy live in
[CONTRIBUTING](../CONTRIBUTING.md#static-build-and-ci-policy).

| Concern                                   | Implementation owner                                                                                                                                                                                  |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Completion orchestration                  | `check.mjs`                                                                                                                                                                                           |
| Related tests and risk escalations        | `verify-changed.mjs`                                                                                                                                                                                  |
| Finished-step exposure/digest reporting   | `lib/run-step.mjs` (shared by `check` + `verify`)                                                                                                                                                     |
| Path parsing and classification           | `lib/verification/changed-paths.mjs` + `lib/verification/change-routes.mjs`                                                                                                                           |
| Documentation contracts and plan metadata | `check-docs.mjs` (also serves `plans:check` via `--plans-only` and `docs:check:final` via `--final`), `check-documentation-contract.mjs`, `lib/plan-checks.mjs` (`archive-plans.mjs` shares that lib) |
| Passing unit receipts                     | `lib/verification/verification-cache.mjs`                                                                                                                                                             |
| Bundle budgets                            | `lib/verification/bundle-budget.mjs`                                                                                                                                                                  |
| Full and staged formatting                | `run-prettier.mjs` + `prettier-paths.mjs` + `.prettierignore` (`PRETTIER_NEVER_FORMAT_RE` is the staged-path subset; `.prettierignore` also covers build outputs)                                     |
| Plan creation and archiving               | `new-plan.mjs` + `archive-plans.mjs`; [plan lifecycle](../Docs/Plans/README.md#task-handoff)                                                                                                          |
| Selection byte budgets                    | `lib/agent/selection-budgets.mjs` (`INLINE_ARGS_BYTES` for check paths.json spill vs `RELATED_SELECTION_BYTES` for verify unit-all fallback; same value, different meanings)                          |
| Test concurrency                          | `lib/verification/test-concurrency.mjs` (`VITEST_MAX_WORKERS` for ship suites; CI full runs keep Vitest defaults)                                                                                     |

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
Markdown helper (`lib/agent/markdown-sections.mjs`) and one exemption owner per scope
(`isHistoryOnlyDoc` / `isHistoricalDoc` / `isReachabilityExempt` in
`check-documentation-contract.mjs`); route context budgets live in
`lib/agent/route-context-budgets.mjs`. Current-file checks cover E2E paths as well as other source references. Instruction
history is advisory and does not require an entry for each skill or knowledge edit.
Repository-relative matching uses forward slashes on every platform, including
history and archived-plan exemptions.

Script interface ownership is described in [Script declarations](./README.md#script-declarations). Shared build inputs select both renderer builds through the existing
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

`lib/verification/verification-cache.mjs` implements the [reuse policy](../CONTRIBUTING.md#verification-reuse). A command becomes eligible after an observed duration of at least five seconds, and reuse must save more than twice the measured input-scan cost. The first run records duration without scanning dependencies; a subsequent slow run establishes its receipt. The exact executable and ordered argument list identify coverage.

Input identity covers tracked and untracked nonignored files, root environment files and npm configuration, installed dependency file identities, Node executable/version/platform, checkout location, and environment. File identities include mode, size, nanosecond modification/change times, and inode; this is local filesystem reuse, not a portable content-addressed build cache. Dependency caches are excluded. Linked source or external dependency symlinks, unreadable inputs, a missing npm install receipt, or changed inputs disable reuse. Fresh successes replace receipts atomically; failures invalidate them. Reuse preserves the original run ID and expiry. Each verifier writes a run-specific `verify/summary.json`, linked by the outer completion report.
