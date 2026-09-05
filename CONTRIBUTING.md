# Contributing

Install dependencies with `npm ci`, find the canonical owner in the [documentation map](./README.md#documentation), and begin the change with that owner. Clear bugs, failing checks, broken docs or invariants, and well-supported maintenance, accessibility, or UX issues encountered elsewhere may be fixed; follow their cause without starting a broad cleanup or uncited audit. Preserve existing edits with surgical changes, and ask when a safe merge or remedy is ambiguous.

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

The completion gate records every passed, failed, and skipped stage under one run ID, retains bounded failure evidence, and rejects results if tracked source inputs change during the run. Documentation-only changes run documentation and format checks without unit, build, or browser work. Executable changes run the same static aggregate as CI, but not full Vitest or browser journeys. Runtime inputs trigger a non-mutating build and preview smoke. Package manifests trigger `npm ci --dry-run --ignore-scripts`; other pushes do not.

## E2E policy

Fixture, bootstrap, page-object, tag, and diagnostic instructions live in [tests/e2e/README.md](./tests/e2e/README.md). Every push runs the `@critical` journeys exactly once. Save changes additionally run the complete save specs. Nightly and release workflows own the full browser suite; nightly also owns coverage, mutation, deep entry-export analysis, and full Electron coverage.

Vitest runs React, hook, and browser-adapter suites in the `dom` project; pure engine, validation, desktop-contract, and tooling suites run in the `node` project. `vitest.config.ts:testEnvironmentForPath` owns that classification.

## Hooks and workflow hygiene

`lefthook` pre-push invokes only `npm run check -- --diff`. Pre-commit formats staged files selected by `scripts/prettier-paths.mjs`; commit-msg runs commitlint. Install hooks with `npm run prepare`.

Execution plans under `docs/Plans/` are workflow artifacts, not product correctness gates. While a plan is active, run `npm run plans:check`. When this task owns a finished plan, mark it complete or cancelled, refresh its date, run `npm run archive:plans`, then `npm run docs:check:final`.

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
