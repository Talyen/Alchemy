# Contributing

Install dependencies with `npm ci`, run `npm run context -- <relevant paths>` to read the selected canonical owner sections, and begin the change there. Use `npm run context` to list task categories when paths are not known; the [documentation map](./README.md#documentation) remains the human index. Clear bugs, failing checks, broken docs or invariants, and well-supported maintenance, accessibility, or UX issues encountered elsewhere may be fixed; follow their cause without starting a broad cleanup or uncited audit. Preserve existing edits with surgical changes, and ask when a safe merge or remedy is ambiguous.

During implementation run `npm run verify -- --diff`; before push and handoff run `npm run check -- --diff`. Use Conventional Commits and leave `CHANGELOG.md` to release automation.

## What to run when you change…

The local workflow has three entry points — one per moment, never interchangeable:

| Moment           | Command                    | Responsibility                                                                                                     |
| ---------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| During work      | `npm run verify -- --diff` | Changed Vitest files, dependency-related tests, and save/assets/desktop/balance/performance escalations            |
| Push and handoff | `npm run check -- --diff`  | Verification, the CI static aggregate for executable changes, lockfile consistency, pure builds, and preview smoke |
| Release          | `npm run release`          | Full release, desktop packaging, tag, push, and CI watch                                                           |

`npm run verify -- --diff --plan` previews selection without running it. Explicit paths may replace `--diff`. When the checkout contains unrelated work, use the complete set of task-owned paths (including incidental fixes) for task verification and state that scope at handoff; the pre-push hook still checks the full diff. A failure elsewhere must be reported or resolved under the incidental-fix policy, not hidden by narrowing a failed check. Browser flows remain available through the `test:e2e:*` scripts when investigation needs them, but local handoff does not rerun the every-push critical suite.

The risk escalations are intentionally broad and few:

- Save changes run the complete save/persistence unit suite.
- Asset source or pipeline changes run the idempotent prepared-output check.
- Desktop changes run the desktop boundary unit suite.
- Balance and performance changes run their dedicated report/harness checks.
- Tooling and configuration changes run the complete tooling and architecture unit suite because those tests inspect repository files directly.
- Other implementation changes use Vitest dependency selection; changed test files execute directly.

Eligible expensive unit commands can reuse a recent passing result under the [verification reuse policy](#verification-reuse). Use `ALCHEMY_VERIFY_FRESH=1` for fresh observations during nondeterminism investigation.

The completion gate records every passed, failed, and skipped stage under one run ID, retains bounded failure evidence, and rejects results if tracked source inputs change during the run. Documentation-only changes run documentation and format checks without unit, build, or browser work. Executable changes run the same static aggregate as CI, but not full Vitest or browser journeys. Runtime inputs trigger a non-mutating build and preview smoke. Package manifests trigger `npm ci --dry-run --ignore-scripts`; other pushes do not.

## Verification reuse

`verify` keeps local passing receipts under `reports/verification-cache/`. After a command has been observed to take at least five seconds, it can reuse dependency-related and changed unit tests plus save, desktop and performance unit suites. It never reuses tooling suites, report generators, assets, static checks, builds, smoke tests or browser runs. The first run records duration without scanning dependencies; a subsequent slow run establishes its receipt. Reuse must also save more time than twice the measured input-scan cost. The exact executable and argument list identify coverage; a narrower prior command cannot satisfy a broader command.

Input identity covers tracked and untracked nonignored files, root environment files and npm configuration, installed dependency file identities, Node executable/version/platform, checkout location and environment. File identities include mode, size, nanosecond modification/change times and inode; this is local filesystem reuse, not a portable content-addressed build cache. Dependency caches are excluded. Linked source or external dependency symlinks, unreadable inputs, a missing npm install receipt or changed inputs disable reuse. Fresh successes replace receipts atomically; failures invalidate them. Reused results retain the original run ID and expiry rather than renewing their age. Each verifier writes a run-specific `verify/summary.json`; the outer completion report links it so reuse provenance survives the final report.

CI always executes tests. Set `ALCHEMY_VERIFY_FRESH=1` to bypass reads locally; actual outcomes still replace or invalidate local receipts. Use it for nondeterminism investigation and benchmark comparisons. Receipts are disposable and age out after one hour; normal report cleanup removes them. Build and browser artifact validity is handled by always executing those stages.

## Test value and coverage strategy

Prefer fewer, higher-value tests that detect meaningful failures and remain affordable to maintain and run. Judge coverage by distinct failure risks, assertion strength, diagnostic usefulness, runtime, and upkeep. Test counts and coverage percentages are not improvement targets; existing configured gates still apply.

Before adding coverage, inspect nearby tests and shared validation. Retain or improve an existing assertion when it already protects the behavior; adding no test is valid when the change has adequate protection or no consequential automated-test risk. A bug fix or audit finding does not automatically require a new test. Add coverage when a meaningful risk lacks trustworthy protection, at the cheapest layer that can actually detect it.

- **Mechanics and content:** prefer fast engine tests for combat rules, effect ordering, and consequential interactions. Use shared invariant/content validation for common contracts, with representative cases and meaningful boundaries. Do not enumerate every card, talent, effect, numeric variant, or combination merely because it exists.
- **Components and hooks:** test meaningful interaction and orchestration outcomes. Avoid duplicating engine arithmetic, incidental markup, styling tables, and private implementation details.
- **Browser journeys:** protect representative core flows, integration wiring, real timing, layout, focus, and persistence across reloads when a browser is needed to establish correctness. Per-mechanic UI/E2E coverage is not a goal. Similar assertions at different layers can protect different risks.

Consolidate, streamline, move to a cheaper layer, or delete tests encountered within the task's scope when justified; separate permission and one-for-one replacements are unnecessary. This includes redundant, obsolete, brittle implementation-detail, and unique low-value tests whose limited protection does not justify their cost. For overlap, identify the surviving protection; for unique coverage retired, briefly explain the risk accepted and maintenance tradeoff. Diagnose failures before retirement: never delete or weaken a test simply to hide a product defect or obtain a green gate. Preserve meaningful protection for known regressions, save compatibility, critical journeys, and architectural boundaries, while allowing better tests to replace their existing form.

Keep scenarios focused and failures diagnosable. Combining unrelated checks into a giant journey or parameterized matrix does not improve value merely by reducing test declarations. Share fixtures where they preserve a common invariant or prevent drift; keep scenario-specific setup clear. Local cleanup is encouraged, not a requirement to audit the entire suite during every task.

When removing or moving suites, update maintained references and explicit gate selections to match the surviving protection. Include deleted paths in verification scope; changed unit files that no longer exist are not executed, but their route escalations remain. For consolidation, also select the surviving test files; for retirement without replacement, run applicable gates and report material lost protection. Use timing and coverage reports as evidence when useful, without inventing quotas, mandatory measurements, or automatic threshold ratcheting.

## E2E policy

Fixture, bootstrap, page-object, tag, and diagnostic instructions live in [tests/e2e/README.md](./tests/e2e/README.md). Every push runs the `@critical` suite once; save-touching pushes additionally run the complete save specs, intentionally repeating their overlapping critical tests. Nightly and release workflows own the full browser suite; nightly also owns coverage, mutation, deep entry-export analysis, and full Electron coverage.

Vitest runs React, hook, and browser-adapter suites in the `dom` project; pure engine, validation, desktop-contract, and tooling suites run in the `node` project. `vitest.config.ts:testEnvironmentForPath` owns that classification.

Hook tests pass changing inputs through `renderHook(callback, { initialProps })` and `rerender(nextProps)`. `rerender` updates props; it does not replace the render callback.

## Hooks and workflow hygiene

`lefthook` pre-push invokes only `npm run check -- --diff`. Pre-commit formats staged files selected by `scripts/prettier-paths.mjs`; commit-msg runs commitlint. Install hooks with `npm run prepare`.

Execution plans under `docs/Plans/` are workflow artifacts, not product correctness gates. Follow the [plan lifecycle](./docs/Plans/README.md) to finish and archive only task-owned plans, then validate with `npm run docs:check` (also included in the handoff gate). `npm run docs:check:final` is an explicit repository-wide closure check; another task's active plan does not require cancellation or block ordinary handoff.

For instruction changes that affect coding behavior, use the pinned [agent evaluations](./.agents/evals/README.md); compare correctness alongside observed reads, retries and available host usage.

`npm run context:hotspots` and `npm run runs:show -- --last 10` are advisory process evidence. They never block push or handoff.

## Static, build, and CI policy

| Command                           | Role                                                                                                  |
| --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `npm run check:static`            | Generated outputs, formatting, source/test types, ESLint, import boundaries, and architecture smoke   |
| `npm run lint:ci`                 | The canonical every-push static aggregate: `check:static`, docs, dead code, and Playwright collection |
| `npm run build` / `build:desktop` | Pure generated-output-validating web or desktop build                                                 |
| `npm run assets:check`            | Idempotent authored-asset preparation check                                                           |
| `npm run test:e2e:critical`       | Every-push representative player journeys                                                             |

Builds only validate generated outputs and never prepare or rewrite tracked
sources. `npm run dev` prepares assets through its `predev` lifecycle; use the
explicit `sync:*` and asset authoring commands when intentionally regenerating
outputs for a build.

Every push to `main` runs the static aggregate, full Vitest, one web build plus preview smoke, and the critical browser suite. Only save persistence, prepared assets, desktop packaging, and Electron tests remain path-gated. Dependency setup skips Electron downloads by default; only packaging and Electron test jobs install the binary. Browser setup installs OS dependencies even when browser binaries are cached. Asset idempotence jobs use a full checkout. CI topology is owned solely by `.github/workflows/`; local test selection is owned by the broad categories in `scripts/lib/change-routes.mjs`.

[Bugbot](./.cursor/BUGBOT.md) remains an optional post-push review aid for gameplay, save, and battle-rule changes; it is not a required status check.

Release validation remains deliberately redundant because it protects published artifacts. See [RELEASE.md](./docs/RELEASE.md).

## Failure-first triage

Follow [REFERENCE.md](./docs/REFERENCE.md#failure-first-triage). Start with the compact run record or failure digest, then open raw logs or traces only when the digest does not identify the next seam. Do not paste full reports into agent context.

## Changelog and patch notes

Changelog updates happen at release only. Player patch notes are generated from Conventional Commits, changed paths, and an optional `User-Facing: yes` or `User-Facing: no` trailer. Release-time details live in [RELEASE.md](./docs/RELEASE.md).
