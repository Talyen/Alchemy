# Contributing

Install dependencies with `npm ci`. `npm run context -- <relevant paths>` can locate applicable owner sections; `npm run context` lists task categories. Direct reads and scoped searches are equally valid. The [documentation map](./README.md#documentation) is the human index; [AGENTS.md](./AGENTS.md) owns scope, preservation of existing work, and Git authorization.

## What to run when you change…

The default local gate is deliberately resource-light. Agents may run unit tests whenever useful without user approval; CI still owns complete validation.

| Moment           | Command                        | Responsibility                                                                                                 |
| ---------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Local smoke      | `npm test`                     | Three fixed Node suites, one worker, lower process priority, 512 MiB Node heap limit and a 30-second deadline  |
| During work      | `npm run verify -- --diff`     | Bounded Node smoke; no import-graph selection or dependency-cache identity walk                                |
| Push and handoff | `npm run check -- --diff`      | Local smoke plus selected-file formatting; no builds, installs, browsers, DOM suites, or full static aggregate |
| CI               | Pull request or push to `main` | Full Vitest, static checks, builds, smoke, critical browser journeys and applicable desktop/assets checks      |

Local formatting checks at most 50 existing files, each no larger than 256,000 bytes. Larger batches are explicitly deferred to CI. Reports say that a passing local check still requires full CI validation; it is not release evidence.

Markdown-only selections skip Node smoke in the default verifier. For documentation
edits, run `npm run docs:check` explicitly as well as the task-scoped `check`;
the default gate checks selected-file formatting but does not run documentation contracts.

Use explicit task-owned paths in a mixed checkout. `--diff` selects the complete dirty set, including deletions. `npm run verify -- --diff --plan` previews the lightweight selection. The pre-push hook selects outgoing paths and retains its source/cleanliness guards, but uses the same lightweight gate.

Focused, dependency-related, and full unit tests, including DOM unit tests, may run locally without user approval. Use `npm run test:full -- <paths>` for focused suites or `npm run test:full` for the full unit suite. Broader local validation still requires an explicit user request: `npm run check:full -- --diff` and `npm run verify:full -- --diff` include checks beyond unit tests. Browser/Electron, coverage, mutation, profiling, builds, and full static commands remain opt-ins. Do not substitute a direct Playwright invocation to bypass that policy. Release workflows remain fully verified in CI.

One-shot Vitest and Playwright commands through `run-compact.mjs`, including
full/focused unit tests and the full verifier's related/changed selections, share
one local test lane with the ship unit runner across checkouts on the same host.
An occupied lane fails before tests start; retry after the active run finishes.
The lightweight Node smoke does not acquire this lane. Raw CLI and watch/debug
sessions bypass it and must be coordinated manually. The runner defaults native
bundler threads to one; the four-worker Vitest ceiling remains unchanged. An
unrelated overloaded host can still cause failures: preserve the failed result
and inspect collection and host resources before retrying or changing timeouts.
Implementation: [local test lane](./scripts/lib/verification/local-test-lane.mjs).

### Agent preview ownership

For an authorized interactive browser review, use one uniquely named session per
task and reuse it for navigation, reloads, and captures. Record its session name
and owner; close it on completion, failure, and cancellation, and verify that its
browser processes exited. A successful close request alone is insufficient when
the browser is unresponsive. Preserve the session identity and report failed
cleanup instead of opening additional replacement sessions. Never close all
sessions, kill unrelated browsers, or reclaim an active session based on age.

One-shot Playwright/Electron runs use the existing managed command and test-lane
cleanup; do not replace them with detached browser daemons. The Alchemy test lane
does not reserve memory against Lantern previews or Trinket builds. When another
repo is running an expensive inspection and memory pressure is high, finish or
close the owned inspection before admitting another; source editing can continue.

DOM suites use [the JSDOM environment](./tests/jsdom-environment.ts), which
temporarily removes Node storage descriptors before browser globals are installed
and restores them during teardown. JSDOM owns both local and session storage;
Node Web Storage flags and a Node storage file are unnecessary for these tests.

The full verifier retains broad risk selection: save changes select persistence suites, asset changes select prepared-output checks, desktop changes select boundary suites, and tooling changes select tooling/architecture tests. Other implementation changes use dependency-related selection. These escalations do not run in the default local gate. The full completion gate adds static checks, lockfile consistency, applicable builds, bundle budgets, and preview smoke.

Authoritative working-tree discovery disables Git's filesystem monitor and untracked cache per command (`-c core.fsmonitor=false -c core.untrackedCache=false`). Discovery failures are not a clean checkout. Checks preserve run-attributed diagnostics and reject results if source inputs change during the run.

## Verification reuse

The default local verifier does not scan installed dependencies or create full-verification receipts.

The opt-in full verifier keeps local passing receipts under `reports/verification-cache/` for eligible slow commands: dependency-related and changed unit tests plus save, desktop, and performance unit suites. Reuse requires unchanged inputs and the same executable and arguments; a narrower command cannot satisfy broader coverage. Tooling suites, reports, assets, static checks, builds, smoke tests, browser runs, and CI always execute.

Receipts expire after one hour. Reused results retain their original run ID and expiry, with provenance in the run-specific `verify/summary.json` linked by the completion report. Failures invalidate receipts; changed or unverifiable inputs prevent reuse. Normal report cleanup removes disposable receipts.

Set `ALCHEMY_VERIFY_FRESH=1` for fresh local observations, including nondeterminism investigations and benchmark comparisons. Actual outcomes still replace or invalidate receipts. [Cache implementation details](./scripts/VERIFICATION.md#verification-cache) document input identity and the cost threshold.

## Test value and coverage strategy

Add permanent tests for high-value protection by default. Add low- or medium-value tests only as rare exceptions with a concrete justification. Judge value by the failure detected, its consequence, assertion strength, distinct protection, diagnostic usefulness, runtime, and upkeep. Test counts and coverage percentages are not improvement targets; existing configured gates still apply.

- **High-value:** detects a concrete, consequential failure, asserts the behavior strongly enough to catch it, and adds distinct protection at a justified maintenance and execution cost. Examples include incorrect combat outcomes, lost or duplicated progress, blocked interactions, broken save/resume, and violated architectural contracts.
- **Medium-value:** tests real behavior but has limited consequences, substantial overlap, or disproportionate setup and upkeep.
- **Low-value:** checks incidental details, repeats implementation, or provides little credible defect detection.

Before adding coverage, identify the plausible failure and inspect nearby tests and shared validation. Prefer strengthening an existing assertion when that closes the gap; otherwise choose the cheapest layer that can actually detect the failure. Adding no test is valid when existing protection is adequate or the remaining risk does not justify permanent coverage. A changed function, bug fix, audit finding, content variant, or uncovered line does not automatically require a new test.

Evidence that a fix works and permanent regression coverage are separate decisions. Existing assertions, a focused reproduction, or source inspection can provide evidence where justified; report material limits of that evidence. For a rare low- or medium-value addition, explain the specific benefit and why stronger or cheaper protection is unavailable. No numeric scoring or separate approval is required.

| Layer         | Usually high-value                                                                                                         | Usually decline                                                                                                                   |
| ------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Engine/unit   | Consequential combat interactions; save reconciliation that prevents progress loss; shared content invariants              | Trivial wrappers; repeated numeric or content variants; checks already guaranteed by types                                        |
| Component/DOM | An interaction dispatches the correct command and handles a consequential failure                                          | Incidental markup or CSS classes; duplicated engine arithmetic behind mocks                                                       |
| Browser/E2E   | Reload preserves progress; actual keyboard focus permits continued play; real animation timing or integration wiring works | Per-card mechanics journeys already protected by engine tests; duplicated screen smoke; cosmetic variants without a concrete risk |

These examples are contextual: exact values and layout assertions can be high-value when they protect the actual contract. Similar assertions at different layers can protect distinct failures. Use representative cases and meaningful boundaries rather than enumerating every card, talent, effect, or combination.

### Active test retirement

Evaluate tests read, modified, or diagnosed during authorized work. Remove encountered low- and medium-value tests by default after checking their purpose and dependencies; retaining a borderline test requires a concrete reason. Unique coverage alone does not require retention or replacement. When an inexpensive change can provide high-value protection, strengthen the test or move it to a cheaper layer instead.

Before retirement, check why the test exists, including known regressions, distinct integration risks, and execution tiers. Diagnose failures first: never delete or weaken a test simply to hide a product defect or obtain a green gate. Preserve trustworthy protection for consequential known regressions, save compatibility, critical journeys, and architectural boundaries; their existing test form is not sacred.

No separate permission or one-for-one replacement is required. For material coverage changes, briefly report protection added or reused, justified exceptions or borderline retention, and protection retired. For overlap, identify surviving protection; for unique coverage retired, explain the specific risk accepted and maintenance tradeoff. Avoid scoring forms and routine essays.

Keep cleanup within tests encountered during authorized work; do not turn every task into a suite-wide audit. Keep scenarios focused and failures diagnosable. Combining unrelated checks into a giant journey or parameterized matrix does not improve value merely by reducing test declarations. Share fixtures where they preserve a common invariant or prevent drift; keep scenario-specific setup clear.

For exhaustive orchestration checks such as the affix sweep, retain the scenario coverage while collecting invariant violations into a total and bounded, scenario-specific examples. Avoid thousands of identical matcher calls. Test-local timeouts are failure ceilings, not performance targets; reproduce a slowdown with the full unit suite running separately from browser work before changing global workers, timeouts, or gameplay.

When removing or moving tests, remove support code made unused by retirement and update maintained references and explicit gate selections to match the surviving protection. Include deleted paths in verification scope; changed unit files that no longer exist are not executed, but their route escalations remain. For consolidation, also select the surviving test files; for retirement without replacement, run applicable gates and report material lost protection. Use timing and coverage reports as evidence when useful, without inventing quotas, mandatory measurements, or automatic threshold ratcheting.

CLI tests that create package or release artifacts must use temporary project roots,
including the script dependency closure and output directories. Never create or
remove fixtures in the checkout's real package-output or Steam build directories.

### Component and hook tests

Vitest runs React, hook, and browser-adapter suites in the `dom` project; pure engine, validation, desktop-contract, and tooling suites run in the `node` project. The include/exclude patterns in `vitest.config.ts` own that classification; the project guard checks actual collection rules for omissions and overlap. Full unit runs share the four-worker ceiling used by related and ship checks, leaving one CPU free on smaller hosts. CLI worker overrides remain available for focused diagnosis.

Preserve test import order when a shared harness registers mocks or hooks. Import organization must not move that harness after modules whose dependencies it mocks; use explicit hoisted mocks where feasible. Ordinary explanatory comments are allowed; ESLint suppressions still require a reason. Keep comments focused on ordering, compatibility, and other reasons that names and tests alone do not explain.

Hook tests pass changing inputs through `renderHook(callback, { initialProps })` and `rerender(nextProps)`. `rerender` updates props; it does not replace the render callback.

## E2E policy

Fixture, bootstrap, page-object, tag, and diagnostic instructions live in [tests/e2e/README.md](./tests/e2e/README.md). Every pull request and push to `main` runs the `@critical` suite once, including all retained save specs. There is no separate save browser job. Nightly and release workflows own the full browser suite; nightly also owns coverage, mutation, deep entry-export analysis, and full Electron coverage.

## Hooks and workflow hygiene

`lefthook` pre-push invokes only `npm run check -- --pre-push`, forwarding Git’s ref/object-ID pairs through stdin. The gate selects the union of outgoing changes, including removed paths; a new remote ref selects its full tree. Deleted remote refs require no checks. Large selections travel through a JSON path file; the opt-in full verifier falls back to the complete unit suite when related-test arguments exceed platform limits. Outgoing commits must match the checked-out HEAD, and unavailable base revisions fail explicitly. When source checks are needed, pre-push requires a clean checkout (including nonignored untracked files) so tests cannot pass against an uncommitted fix. Ordinary task checks still support dirty work. Local `--diff` continues to select working-tree changes, retaining both sides of renames for risk selection and falling back to HEAD’s changes when clean. Pre-commit formats staged files selected by `scripts/prettier-paths.mjs`; commit-msg runs commitlint. Install hooks with `npm run prepare`.

Execution plans under `Docs/Plans/` are workflow artifacts, not product correctness gates. Follow the [plan lifecycle](./Docs/Plans/README.md) to finish and archive only task-owned plans, then validate with `npm run docs:check` (also included in the opt-in full gate). `npm run docs:check:final` is an explicit repository-wide closure check; another task's active plan does not require cancellation or block ordinary handoff.

Use matched [agent evaluations](./.agents/evals/README.md) for uncertain workflow changes, consequential changes to safeguards, or claims of improved agent performance. Straightforward contradiction removal and procedural simplification can use source review and documentation checks. Compare correctness alongside observed reads, retries, and available host usage when running trials.

`npm run context:hotspots` and `npm run runs:show -- --last 10` are advisory process evidence. They never block push or handoff.

## Static, build, and CI policy

| Command                           | Role                                                                                                                                         |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check:static`            | Generated outputs, formatting, source/test types, and ESLint (fast local static; no boundary subset double-run)                              |
| `npm run lint:ci`                 | The canonical every-push static aggregate: `check:static`, docs, dead code, import boundaries, architecture smoke, and Playwright collection |
| `npm run build` / `build:desktop` | Pure generated-output-validating web or desktop build                                                                                        |
| `npm run assets:check`            | Read-only authored-asset freshness check                                                                                                     |
| `npm run test:e2e:critical`       | Every-push representative player journeys                                                                                                    |

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

Every pull request and push to `main` runs the static aggregate, full Vitest, one web build plus preview smoke, and the critical browser suite. Prepared assets, desktop packaging, and Electron tests remain path-gated. Dependency setup skips Electron downloads by default; only packaging and Electron test jobs install the binary. Installed Electron binaries use exact lockfile-specific caches without fallback to an older dependency set. Browser setup installs OS dependencies even when browser binaries are cached. Asset freshness jobs use a full checkout. CI topology is owned solely by `.github/workflows/`; local test selection is owned by the broad categories in `scripts/lib/verification/change-routes.mjs`.

External GitHub Actions in workflows and composite actions use full commit SHAs,
with version comments for review. Resolve pins from the action's own repository;
keep local actions on relative paths. [.github/dependabot.yml](./.github/dependabot.yml)
groups weekly Actions updates into reviewable pull requests; updates still pass
the normal CI gates before merging.

[Bugbot](./.cursor/BUGBOT.md) remains an optional post-push review aid for gameplay, save, and battle-rule changes; it is not a required status check.

Release validation remains deliberately redundant because it protects published artifacts. See [RELEASE.md](./Docs/RELEASE.md).

## Failure-first triage

Follow [REFERENCE.md](./Docs/REFERENCE.md#failure-first-triage). Start with the compact run record or failure digest when the cause is unclear. Open relevant logs or traces directly for a specific hypothesis; keep excerpts focused rather than pasting full reports into agent context.

## Changelog and patch notes

Changelog updates happen at release only. Player patch notes are generated from Conventional Commits, changed paths, and an optional `User-Facing: yes` or `User-Facing: no` trailer. Release-time details live in [RELEASE.md](./Docs/RELEASE.md).
