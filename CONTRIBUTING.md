# Contributing

Install dependencies with `npm ci`. Use `npm run context -- <relevant paths>` for the applicable owner sections, or `npm run context` to list task categories. The [documentation map](./README.md#documentation) is the human index; [AGENTS.md](./AGENTS.md) owns scope, preservation of existing work, and Git authorization.

## What to run when you change…

Use the gate appropriate to the work. `check` includes `verify`, so do not run both consecutively on unchanged inputs:

| Moment           | Command                    | Responsibility                                                                                                     |
| ---------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| During work      | `npm run verify -- --diff` | Changed Vitest files, dependency-related tests, and save/assets/desktop/balance/performance escalations            |
| Push and handoff | `npm run check -- --diff`  | Verification, the CI static aggregate for executable changes, lockfile consistency, pure builds, and preview smoke |
| Release          | `npm run release`          | Full release, desktop packaging, tag, push, and CI watch                                                           |

`npm run verify -- --diff --plan` previews selection without running it. Explicit file or directory paths may replace `--diff`; relative and absolute paths within the checkout select the same checks. Directories expand to tracked and untracked nonignored files, retaining deleted tracked paths for risk selection. When the checkout contains unrelated work, use the complete set of task-owned paths (including incidental fixes) for task verification and state that scope at handoff; the pre-push hook selects the complete outgoing revision range. A failure elsewhere must be reported or resolved under the incidental-fix policy, not hidden by narrowing a failed check. Browser flows remain available through the `test:e2e:*` scripts when investigation needs them, but local handoff does not rerun the every-push critical suite.

The risk escalations are intentionally broad and few:

- Save changes run the complete save/persistence unit suite.
- Asset source or pipeline changes run the read-only prepared-output freshness check.
- Desktop changes run the desktop boundary unit suite.
- Balance changes run the report-construction check; performance changes run performance harness unit tests. FPS/hitch profiling remains opt-in under [PERFORMANCE](./docs/PERFORMANCE.md).
- Tooling and configuration changes run the complete tooling and architecture unit suite because those tests inspect repository files directly. When gameplay changes are included, their dependency-related tests still run.
- Other implementation changes use Vitest dependency selection; changed test files execute directly.

Eligible expensive unit commands can reuse a recent passing result under the [verification reuse policy](#verification-reuse). Use `ALCHEMY_VERIFY_FRESH=1` for fresh observations during nondeterminism investigation.

The completion gate records every passed, failed, and skipped stage under one run ID, retains bounded failure evidence, and rejects results if tracked source inputs change during the run. Documentation-only changes run documentation and format checks without unit, build, or browser work, including Markdown under source, script, and test directories. Executable changes run the same static aggregate as CI, but not full Vitest or browser journeys. Runtime inputs trigger a non-mutating build, its bundle budget check, and preview smoke. Package manifests trigger `npm ci --dry-run --ignore-scripts`; other pushes do not.

## Verification reuse

`verify` keeps local passing receipts under `reports/verification-cache/` for eligible slow commands: dependency-related and changed unit tests plus save, desktop, and performance unit suites. Reuse requires unchanged inputs and the same executable and arguments; a narrower command cannot satisfy broader coverage. Tooling suites, reports, assets, static checks, builds, smoke tests, browser runs, and CI always execute.

Receipts expire after one hour. Reused results retain their original run ID and expiry, with provenance in the run-specific `verify/summary.json` linked by the completion report. Failures invalidate receipts; changed or unverifiable inputs prevent reuse. Normal report cleanup removes disposable receipts.

Set `ALCHEMY_VERIFY_FRESH=1` for fresh local observations, including nondeterminism investigations and benchmark comparisons. Actual outcomes still replace or invalidate receipts. [Cache implementation details](./scripts/README.md#verification-cache) document input identity and the cost threshold.

## Test value and coverage strategy

Prefer fewer, higher-value tests that detect meaningful failures and remain affordable to maintain and run. Judge coverage by distinct failure risks, assertion strength, diagnostic usefulness, runtime, and upkeep. Test counts and coverage percentages are not improvement targets; existing configured gates still apply.

Before adding coverage, inspect nearby tests and shared validation. Retain or improve an existing assertion when it already protects the behavior; adding no test is valid when the change has adequate protection or no consequential automated-test risk. A bug fix or audit finding does not automatically require a new test. Add coverage when a meaningful risk lacks trustworthy protection, at the cheapest layer that can actually detect it.

- **Mechanics and content:** prefer fast engine tests for combat rules, effect ordering, and consequential interactions. Use shared invariant/content validation for common contracts, with representative cases and meaningful boundaries. Do not enumerate every card, talent, effect, numeric variant, or combination merely because it exists.
- **Components and hooks:** test meaningful interaction and orchestration outcomes. Avoid duplicating engine arithmetic, incidental markup, styling tables, and private implementation details.
- **Browser journeys:** protect representative core flows, integration wiring, real timing, layout, focus, and persistence across reloads when a browser is needed to establish correctness. Per-mechanic UI/E2E coverage is not a goal. Similar assertions at different layers can protect different risks.

Consolidate, streamline, move to a cheaper layer, or delete tests encountered within the task's scope when justified; separate permission and one-for-one replacements are unnecessary. This includes redundant, obsolete, brittle implementation-detail, and unique low-value tests whose limited protection does not justify their cost. For overlap, identify the surviving protection; for unique coverage retired, briefly explain the risk accepted and maintenance tradeoff. Diagnose failures before retirement: never delete or weaken a test simply to hide a product defect or obtain a green gate. Preserve meaningful protection for known regressions, save compatibility, critical journeys, and architectural boundaries, while allowing better tests to replace their existing form.

Keep scenarios focused and failures diagnosable. Combining unrelated checks into a giant journey or parameterized matrix does not improve value merely by reducing test declarations. Share fixtures where they preserve a common invariant or prevent drift; keep scenario-specific setup clear. Local cleanup is encouraged, not a requirement to audit the entire suite during every task.

When removing or moving suites, update maintained references and explicit gate selections to match the surviving protection. Include deleted paths in verification scope; changed unit files that no longer exist are not executed, but their route escalations remain. For consolidation, also select the surviving test files; for retirement without replacement, run applicable gates and report material lost protection. Use timing and coverage reports as evidence when useful, without inventing quotas, mandatory measurements, or automatic threshold ratcheting.

### Component and hook tests

Vitest runs React, hook, and browser-adapter suites in the `dom` project; pure engine, validation, desktop-contract, and tooling suites run in the `node` project. `vitest.config.ts:testEnvironmentForPath` owns that classification.

Preserve test import order when a shared harness registers mocks or hooks. Import organization must not move that harness after modules whose dependencies it mocks; use explicit hoisted mocks where feasible. Ordinary explanatory comments are allowed; ESLint suppressions still require a reason. Keep comments focused on ordering, compatibility, and other reasons that names and tests alone do not explain.

Hook tests pass changing inputs through `renderHook(callback, { initialProps })` and `rerender(nextProps)`. `rerender` updates props; it does not replace the render callback.

## E2E policy

Fixture, bootstrap, page-object, tag, and diagnostic instructions live in [tests/e2e/README.md](./tests/e2e/README.md). Every push runs the `@critical` suite once; save-touching pushes additionally run the complete save specs, intentionally repeating their overlapping critical tests. Nightly and release workflows own the full browser suite; nightly also owns coverage, mutation, deep entry-export analysis, and full Electron coverage.

## Hooks and workflow hygiene

`lefthook` pre-push invokes only `npm run check -- --pre-push`, forwarding Git’s ref/object-ID pairs through stdin. The gate selects the union of outgoing changes, including removed paths; a new remote ref selects its full tree. Deleted remote refs require no checks. Large selections travel through a JSON path file and use the complete unit suite rather than exceeding platform command limits. Outgoing commits must match the checked-out HEAD, and unavailable base revisions fail explicitly. When source checks are needed, pre-push requires a clean checkout (including nonignored untracked files) so tests cannot pass against an uncommitted fix. Ordinary task checks still support dirty work. Local `--diff` continues to select working-tree changes, retaining both sides of renames for risk selection and falling back to HEAD’s changes when clean. Pre-commit formats staged files selected by `scripts/prettier-paths.mjs`; commit-msg runs commitlint. Install hooks with `npm run prepare`.

Execution plans under `docs/Plans/` are workflow artifacts, not product correctness gates. Follow the [plan lifecycle](./docs/Plans/README.md) to finish and archive only task-owned plans, then validate with `npm run docs:check` (also included in the handoff gate). `npm run docs:check:final` is an explicit repository-wide closure check; another task's active plan does not require cancellation or block ordinary handoff.

For instruction changes that affect coding behavior, use the pinned [agent evaluations](./.agents/evals/README.md); compare correctness alongside observed reads, retries and available host usage.

`npm run context:hotspots` and `npm run runs:show -- --last 10` are advisory process evidence. They never block push or handoff.

## Static, build, and CI policy

| Command                           | Role                                                                                                  |
| --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `npm run check:static`            | Generated outputs, formatting, source/test types, ESLint, import boundaries, and architecture smoke   |
| `npm run lint:ci`                 | The canonical every-push static aggregate: `check:static`, docs, dead code, and Playwright collection |
| `npm run build` / `build:desktop` | Pure generated-output-validating web or desktop build                                                 |
| `npm run assets:check`            | Read-only authored-asset freshness check                                                              |
| `npm run test:e2e:critical`       | Every-push representative player journeys                                                             |

Independent static checks finish even when a sibling fails, including the nested
aggregate. The aggregate still fails if any checker fails; dependent build and
smoke steps do not run after failure. Compact failure summaries share their
budget across failed checkers, retain excerpts from both ends of long diagnostics,
and link to numbered full-log locations. Exit status identifies a failed checker;
when its diagnostic format is unrecognized, retain bounded output from both ends
instead of reducing the summary to its exit footer.

Builds only validate generated outputs and never prepare or rewrite tracked
sources. `npm run dev` prepares assets through its `predev` lifecycle; use the
explicit `sync:*` and asset authoring commands when intentionally regenerating
outputs for a build.

Every push to `main` runs the static aggregate, full Vitest, one web build plus preview smoke, and the critical browser suite. Only save persistence, prepared assets, desktop packaging, and Electron tests remain path-gated. Dependency setup skips Electron downloads by default; only packaging and Electron test jobs install the binary. Installed Electron binaries use exact lockfile-specific caches without fallback to an older dependency set. Browser setup installs OS dependencies even when browser binaries are cached. Asset freshness jobs use a full checkout. CI topology is owned solely by `.github/workflows/`; local test selection is owned by the broad categories in `scripts/lib/change-routes.mjs`.

[Bugbot](./.cursor/BUGBOT.md) remains an optional post-push review aid for gameplay, save, and battle-rule changes; it is not a required status check.

Release validation remains deliberately redundant because it protects published artifacts. See [RELEASE.md](./docs/RELEASE.md).

## Failure-first triage

Follow [REFERENCE.md](./docs/REFERENCE.md#failure-first-triage). Start with the compact run record or failure digest, then open raw logs or traces only when the digest does not identify the next seam. Do not paste full reports into agent context.

## Changelog and patch notes

Changelog updates happen at release only. Player patch notes are generated from Conventional Commits, changed paths, and an optional `User-Facing: yes` or `User-Facing: no` trailer. Release-time details live in [RELEASE.md](./docs/RELEASE.md).
