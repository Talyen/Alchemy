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

`sync:assets` remains as a deprecated alias of `sync:art-barrels` (art barrels only —
not sounds/music/version). Prefer `sync:art-barrels` in new docs.

Fast vs heavy check: `check:generated` verifies barrels are current without running
transforms (cheap, static-gate safe). `assets:check` runs full `prepareAssets`,
diffs output hashes, and restores the tree — use before ship, not per-push.

Shared: `lib/asset-constants.mjs` (tuning), `lib/asset-manifest-cache.mjs` (freshness),
`lib/process-helpers.mjs` (generic `formatProcessError`), `lib/audio-optimizer.mjs` (audio discovery/runner).

## Checks / verification (nesting order)

`check.mjs` ⊃ `verify-changed.mjs` → `check:static` ⊃ (`check:generated` +
`format:check` + `typecheck:all` + `lint` + `lint:boundaries` + `lint:architecture-smoke`).
`lint:ci` (every-push CI) = `check:static` + `docs:check` + `deadcode` + `playwright --list`.
Pre-push runs `npm run check -- --diff` only (lefthook) — do not stack `verify` or
`docs:check` on top in the same gate; the docs route inside `verify-changed` reuses
the same contracts.

| Task                  | Command                                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Local completion gate | `npm run check -- --diff` (`check.mjs`; classification via `lib/changed-paths.mjs` over `lib/change-routes.mjs`) |
| Changed-path verifier | `npm run verify -- --diff` (`verify-changed.mjs`; same `changed-paths` parser)                                   |
| Docs gate             | `npm run docs:check` (`check-docs.mjs` → 9 gating contracts + plans + 1 advisory ledger reminder)                |
| Static set            | `npm run check:static` (generated + format + typecheck + eslint + boundaries + arch-smoke)                       |
| Bundle budget         | `npm run check:bundle` (constants in `lib/bundle-budget.mjs`; ship-only, requires `dist/`)                       |

`check:bundle` runs in `check:ship` only — it needs a built `dist/` + `dist-desktop/`
and skips with a warning otherwise. Size regressions surface at ship/release, not per-push.

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

`npm run audit` (dispatcher: `--types/--amplification/--content/--hotspots`, default `--all`)
forwards to `npm run audit:all` (`audit-all.mjs`). Gating probes: knip, depcruise,
eslint complexity, content-audit. Advisory trend probes (always exit 0):
`audit-type-escapes.mjs`, `audit-change-amplification.mjs` — direction signals, see
`docs/Audits/TypeSafetyAudit.md`. `context-hotspots` / `runs:show` are advisory process
evidence and never block handoff.

## Test / E2E (all `test:e2e:*` forward to `run-e2e-route.mjs`)

`npm run test:e2e:route -- <shop|audio|gear|homestead|mystery> [-- extra playwright args]`;
`test:ship:unit`, `test:e2e:audit` (full timings), `perf`, `balance:sim`, `ci:summarize`.
Per-route `test:e2e:<name>` scripts are convenience aliases of the same router.
`ci-summarize-vitest.mjs` / `ci-summarize-playwright.mjs` are the CI entry points
consumed directly by `.github/workflows/` — not dead shims.

## Cleanup (`clean` = explicit reset, `prune:transient` = age-based GC)

`npm run clean[--:all]` resets gitignored dirs (+ processes); `npm run prune:transient` deletes stale files only.
Both share `lib/clean-dev-artifacts.mjs` transient roots. `platforms.json` owns the desktop target list;
`package.json` build blocks own per-platform packaging config. Sentry release and desktop sourcemap mode are
owned by `lib/sentry-release.mjs`; chunk splitting is owned by `lib/vite-chunks.mjs`.

## Worktree / git safety

`node scripts/agent-worktree.mjs create --task <slug>` (`.worktrees/<slug>` on `agent/<slug>`);
`--detached` for verification-only runs. `scripts/bin/git` shims destructive git through
`git-safety-guard.mjs` (auto-stash backup); `setup-git-safety.mjs` installs the PATH hook.
