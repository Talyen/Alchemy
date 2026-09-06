# Scripts catalog

Canonical entries first.

## Assets (canonical: `assets.mjs --prepare/--optimize/--sync/--check`)

| Task                                                | Command                                                                       |
| --------------------------------------------------- | ----------------------------------------------------------------------------- |
| Full prep (predev library entry over same pipeline) | `node scripts/prepare-assets.mjs` / `npm run assets` (`assets.mjs --prepare`) |
| Optimize only                                       | `assets.mjs --optimize`                                                       |
| Sync all generated                                  | `node scripts/sync-generated.mjs` / `npm run sync:generated`                  |
| Fine-grained sync                                   | `sync-generated.mjs --art-only\|--gear-only\|--version-only`                  |
| Fast barrel check (no transform)                    | `npm run check:generated` (`check-generated-fast.mjs`)                        |
| Heavy idempotence check (rebuild + restore)         | `npm run assets:check`                                                        |
| Aliases (`sync:art-barrels`, `sync:gear-art`)       | Forward to `sync-generated.mjs --art-only` / `--gear-only`                    |

Fast vs heavy check: `check:generated` verifies barrels are current without running
transforms (cheap, static-gate safe). `assets:check` runs full `prepareAssets`,
diffs output hashes, and restores the tree. It runs for asset-touching changes
and before shipping; [CONTRIBUTING](../CONTRIBUTING.md#what-to-run-when-you-change)
owns gate selection.

Shared: `lib/asset-constants.mjs` (tuning), `lib/asset-manifest-cache.mjs` (freshness),
`lib/process-helpers.mjs` (generic `formatProcessError`), `lib/audio-optimizer.mjs` (audio discovery/runner).

## Agent discovery and evaluation

`npm run context -- <paths>` emits bounded canonical owner sections and entry points; `--task <category>` starts before paths are known, and `--outline <file> [--symbol <name>]` supports focused source reads. `--entries` / `--entry <id>` inspect nested content; `--related` adds static consumer/test/fixture hints; `--session <id>` and `--refresh` control optional incremental documentation reads. `lib/agent-context.mjs` owns discovery metadata and `lib/document-sections.mjs` owns section extraction. `measure:agent-context` uses the same selection; verification categories remain separate and broad.

`npm run search -- <literal> [paths...]` returns bounded matching filenames; `--excerpts` returns matching lines. `lib/agent-discovery.mjs` shares the `rg` inventory with related-file discovery and owns disposable context-session state. [Agent discovery](../docs/REFERENCE.md#agent-discovery) documents options and limitations.

`npm run eval:agent -- --init <task> <session>` creates a local measurement record. Set `ALCHEMY_AGENT_SESSION` for automatic context/verification events, fill observed host usage and acceptance evidence, then pass one record to summarize or two to compare. [Evaluation procedure](../.agents/evals/README.md) owns pinned task setup and interpretation. Context bytes and observed events are partial evidence, not inferred host token counts.

## Checks / verification (nesting order)

For executable changes, `check.mjs` ⊃ `verify-changed.mjs` + `lint:ci` + applicable
build/smoke steps. `lint:ci` = `check:static` + `docs:check` + `deadcode` +
`playwright --list`; `check:static` owns generated outputs, formatting, types,
ESLint, boundaries, and architecture smoke. Documentation-only checks stay on
the smaller documentation + format route. Documentation and ESLint inventories exclude isolated
`.worktrees/` checkouts, just as they exclude reports and installed dependencies.
Pre-push runs `npm run check -- --diff` only (lefthook) — do not stack `verify` or
`docs:check` on top; `check.mjs` composes the applicable verification and static
contracts itself. `lib/verification-cache.mjs` automatically reuses only matching successful unit commands with unchanged local inputs; `ALCHEMY_VERIFY_FRESH=1` bypasses reuse, and CI never uses it. Other gates always run. Shared build inputs (package manifests, TypeScript/Vite configuration,
and build helpers) trigger both web and desktop builds.

| Task                  | Command                                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Local completion gate | `npm run check -- --diff` (`check.mjs`; classification via `lib/changed-paths.mjs` over `lib/change-routes.mjs`) |
| Changed-path verifier | `npm run verify -- --diff` (`verify-changed.mjs`; same `changed-paths` parser)                                   |
| Docs gate             | `npm run docs:check` (`check-docs.mjs` → 10 gating contracts + plans + 1 advisory ledger reminder)               |
| Static set            | `npm run check:static` (generated + format + typecheck + eslint + boundaries + arch-smoke)                       |
| Bundle budget         | `npm run check:bundle` (constants in `lib/bundle-budget.mjs`; requires `dist/assets/`)                           |

Tooling and configuration paths run the complete `tests/scripts` +
`tests/architecture` suite because those tests inspect repository files and are
not reliably discoverable through the import graph. Ambient script-test declarations belong in the existing `tests/scripts/global.d.ts` owner; standalone unreferenced declaration files fail dead-code checks. Full Vitest and browser
execution remain CI-owned.

`check:bundle` checks the current `dist/assets/` and fails when the build is missing
or empty. Web and desktop renderer builds both write `dist/`; check immediately
after the relevant build. CI checks web bundles on every push and release; ship
and release gates also check desktop bundles.

## Release / changelog (three stages, shared `lib/patch-notes-core.mjs` + `lib/git-release.mjs`)

| Stage                                             | Command                                          |
| ------------------------------------------------- | ------------------------------------------------ |
| Dev `Unreleased` ← git                            | `npm run sync:changelog`                         |
| `Unreleased` → versioned on bump (versionrc hook) | `npm run changelog:promote`                      |
| Player `release-notes/` ← git + trailers          | `npm run generate:patch-notes`                   |
| Release gate                                      | `npm run verify:release` (tag + desktop package) |

Desktop: `ensure-electron.mjs` (orchestrator) → `electron-download.mjs` + `electron-path.mjs`
(pure predicates); `dist-desktop.mjs` → `verify-desktop-package.mjs`.

## Audits (periodic sweep, not a push gate)

`npm run audit` runs `audit-all.mjs` by default. Pass a focused selector after
the npm separator (`npm run audit -- --types|--amplification|--content|--hotspots`)
to dispatch one probe instead. Gating probes: knip, depcruise, eslint complexity,
content-audit. Advisory trend probes (always exit 0):
`audit-type-escapes.mjs`, `audit-change-amplification.mjs` — direction signals, see
`docs/Audits/TypeSafetyAudit.md`. `context-hotspots` / `runs:show` are advisory process
evidence and never block handoff.

## Test / E2E

`npm run test:e2e:route -- <shop|audio|gear|homestead|mystery> [-- extra playwright args]`;
`test:ship:unit`, `test:e2e:audit` (full timings), `perf`, `balance:sim`, `ci:summarize`.
Per-route `test:e2e:<name>` scripts are convenience aliases of the same router.
`ci-summarize-vitest.mjs` / `ci-summarize-playwright.mjs` are the CI entry points
consumed directly by `.github/workflows/` — not dead shims.

## Development

`dev` and `dev:checked` share `predev` asset preparation and port cleanup;
`dev:checked` also enables the live TypeScript checker. Desktop development adds
Steam App ID synchronization.

## Cleanup (`clean` = explicit reset, `prune:transient` = age-based GC)

`npm run clean` removes local reports and the Vite cache. `npm run clean:all`
also removes build outputs and stops Alchemy-owned test-server processes; add
`--include-dev-port` to include the development server. `npm run prune:transient`
deletes stale local artifacts by age. Neither command removes shared Playwright
browser caches.
Both share `lib/clean-dev-artifacts.mjs` transient roots. `platforms.json` owns the desktop target list;
`package.json` build blocks own per-platform packaging config. Sentry release and desktop sourcemap mode are
owned by `lib/sentry-release.mjs`; chunk splitting is owned by `lib/vite-chunks.mjs`.

## Worktree / git safety

`node scripts/agent-worktree.mjs create --task <slug>` (`.worktrees/<slug>` on `agent/<slug>`);
`--detached` for verification-only runs. `scripts/bin/git` shims destructive git through
`git-safety-guard.mjs` (auto-stash backup); `setup-git-safety.mjs` installs the PATH hook.
