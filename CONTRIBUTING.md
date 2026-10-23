# Contributing

Install dependencies with `npm ci`. Follow [AGENTS.md](./AGENTS.md) for task isolation,
Git authorization and local integration. Read known owners directly; use
`npm run context -- <paths>` when ownership is unclear.

## What to run when you change…

Use four entry points for ordinary work:

| Need                                                                                   | Command                                            |
| -------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Check the isolated task                                                                | `npm run check`                                    |
| Check selected paths                                                                   | `npm run check -- <paths>`                         |
| Check the entire repository, including every unit suite, full static checks and builds | `npm run check:all`                                |
| Diagnose units                                                                         | `npm run test:unit -- <test-files-or-directories>` |

`check` selects the isolated task, including its uncommitted work. In a mixed or
unrecorded checkout, name task-owned paths explicitly, including deletions and
both sides of renames. Add `--plan` to inspect the selected scope before running.
`test:unit` accepts existing test files/directories; without paths it runs all units.
[Selection details](./scripts/VERIFICATION.md#task-selection) cover advanced selectors
and the relationship to main.

The task gate runs affected units and applicable static, localization and documentation
checks. Markdown-only tasks run documentation checks and formatting. Broader checks
add full static validation, builds, bundle budgets and preview smoke.
[Gate details](./scripts/VERIFICATION.md#local-verification-profiles) explain selection,
large-batch deferrals and compatibility commands.

Task work authorizes units, compilation, lint, development previews, focused
browser/Electron checks and builds without another permission request. Start with
bounded checks; use exhaustive browser suites, coverage, mutation and profiling
for a concrete risk or explicit request. Avoid overlapping expensive runs on an
overloaded host. Release packaging, signing, publication and uploads retain their
release authorization rules.

Run the task gate before handoff. Protected integration checks the merged task
against pinned main/task commits, then revalidates both under the integration lock
before advancing the clean integration checkout on `main`. If main advances during verification, integration
incorporates it and checks again. Pre-push uses the same task gate against outgoing
changes and requires a clean checkout. A passing gate establishes local completion
for its reported scope; claim CI or platform acceptance only when actually run.
When a push and CI follow-up are requested, finish both before calling the task complete.

For visible changes, [visual review](./Docs/UI_VISUAL_REVIEW.md) requires rendered
comparison and affected interactions. Finalize text in the task worktree, then
[translate and review](./Docs/LOCALIZATION.md#agent-workflow) before final checks
and integration. Checks and builds never invoke a translation service.

The runner schedules tests automatically and prints the selected lane. One broad
run and one focused unit run can execute together; focused runs use one worker,
including when filtering by test name or selecting a reporter. Reservations wait
in registration order and remain cancellable. A task's overlapping unit selections
share one Vitest session and reservation. Never terminate another task's run. Use `test:status`
only to diagnose contention. Raw CLI/watch commands bypass managed scheduling.
[Runner details](./scripts/VERIFICATION.md#compatibility-commands-and-test-runners)
are for diagnosing scheduling and advanced filters.

### Agent preview ownership

Use `npm run agent:browser -- <action and arguments>` for interactive review on
macOS/Linux. Task sessions and a 1920 × 1080 viewport are automatic. Use
`set viewport <width> <height>` for responsive checks. Screenshots default to
`reports/visual-review/`. Task finishing preserves the complete `reports/` directory and non-build ignored
files in its reported integration bundle.

For repeatable screen captures, use `npm run visual:scenario -- --list`, then
`npm run visual:scenario -- battle --label before`. The command starts a private
current-source server and isolated browser context, seeds its checkpoint, and
captures the settled screen. [Visual review](./Docs/UI_VISUAL_REVIEW.md#reproducible-scenarios)
owns scenario options and original/candidate comparison.

Checks and integration preserve interactive sessions. After reviewing integration,
run `node scripts/agent-worktree.mjs finish --task <slug>` from the original
workspace to preserve evidence, close task browsers and remove the completed
worktree. A cleanup failure leaves integration complete and prints its retry
command. Never close all sessions or reclaim another task's browser. [Preview details](./scripts/VERIFICATION.md#preview-implementation-notes)
cover one-shot runners and platform behavior.

## Verification reuse

The gate automatically reuses eligible deterministic successes when commands and
inputs match; CI always runs fresh. Set `ALCHEMY_VERIFY_FRESH=1` for nondeterminism
investigations or benchmarks. Reuse never substitutes narrower coverage. See
[receipt rules](./scripts/VERIFICATION.md#verification-receipt-rules) for cache identity,
expiry and diagnostics.

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

Retire tests when test maintenance is requested or a test demonstrably obstructs
the task. Reading nearby tests creates no cleanup obligation. Diagnose failures
before changing coverage; never weaken a test to hide a product defect. Preserve
consequential regressions and distinct integration protection, preferably at the
cheapest effective layer. No separate approval or one-for-one replacement is required.

For material changes, report protection added/reused and retired, including any
unique risk accepted. Remove unused support code and repair references. Select
deleted tests and surviving replacements in the task gate. Keep incidental cleanup
within the task. [Maintenance details](./scripts/VERIFICATION.md#test-maintenance-details)
cover fixtures, exhaustive checks and timeouts.

### Component and hook tests

Use the [component and hook conventions](./scripts/VERIFICATION.md#component-and-hook-conventions)
for Vitest environments, mock ordering and rerendering.

## E2E policy

[The E2E guide](./tests/e2e/README.md) owns fixtures, tags, page objects and diagnostics.
Every push/PR runs critical journeys; nightly and release run the full browser
suite, with broader Electron and analysis gates at their configured tiers.
[Workflows](./.github/workflows/) own exact CI topology.

## Hooks and workflow hygiene

Hooks format staged files and validate commit messages; pre-push checks outgoing
source and committed asset integrity. Task checks allow dirty task work; pre-push
requires cleanliness. Install hooks with `npm run prepare`.

Plans are optional workflow artifacts. Finish only task-owned plans under the
[plan lifecycle](./Docs/Plans/README.md); other tasks' plans do not block handoff.
`docs:check:final` is an explicit repository-wide closure check. See
[hook details](./scripts/VERIFICATION.md#git-hook-implementation) for ref selection.

## Static, build, and CI policy

Node 24 (minimum 24.18) and npm 11 are required. Keep package engines, lockfile and
CI aligned. Oxlint owns lint; TypeScript owns source/test compilation; Prettier
owns formatting. Builds validate generated outputs without rewriting sources.
Use explicit asset/sync commands for authoring.

CI runs full static and unit validation, a web build and preview smoke, critical
browser journeys and representative localization acceptance. Desktop and asset
gates remain path-selected; nightly/release expand coverage. Release validation
retains its artifact checks under [RELEASE.md](./Docs/RELEASE.md).
[The infrastructure reference](./scripts/VERIFICATION.md#toolchain-and-ci-reference)
owns tool configuration, dependency security, platform targets and CI mechanics.

## Failure-first triage

Follow [REFERENCE.md](./Docs/REFERENCE.md#failure-first-triage): start with the compact
failure digest, form a hypothesis, and inspect only the relevant logs or traces.

## Changelog and patch notes

Update changelogs at release only. Use Conventional Commits and `User-Facing: yes`
or `User-Facing: no` trailers under [release policy](./Docs/RELEASE.md#changelog-release-time-only).

### Connected interaction progress tests

[Interaction coverage](./tests/interaction/README.md) owns connected lifecycle
families and deterministic replay. Use these tests for consequential completion,
cancellation and stale-callback failures. [Runner details](./scripts/VERIFICATION.md#connected-interaction-runner)
cover seeds and reproduction; ordinary execution follows the task policy above.
