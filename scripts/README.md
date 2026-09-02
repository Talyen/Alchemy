# Scripts catalog

Canonical entries first; deprecated shims forward with a warning via `lib/deprecated.mjs`.

## Assets (canonical: `assets.mjs --prepare/--optimize/--sync/--check`)

| Task                                                | Command                                                                       |
| --------------------------------------------------- | ----------------------------------------------------------------------------- |
| Full prep (predev library entry over same pipeline) | `node scripts/prepare-assets.mjs` / `npm run assets` (`assets.mjs --prepare`) |
| Optimize only                                       | `assets.mjs --optimize`                                                       |
| Sync all generated                                  | `node scripts/sync-generated.mjs` / `npm run sync:generated`                  |
| Fine-grained sync                                   | `sync-generated.mjs --art-only\|--gear-only\|--version-only`                  |
| Fast barrel check (no transform)                    | `npm run check:generated` (`check-generated-fast.mjs`)                        |
| Heavy idempotence check (rebuild + restore)         | `npm run assets:check`                                                        |
| Deprecated shims (warn + forward)                   | `sync-assets.mjs` → `--art-only`, `sync-gear-art.mjs` → `--gear-only`         |

Shared: `lib/asset-constants.mjs` (tuning), `lib/asset-manifest-cache.mjs` (freshness),
`lib/process-helpers.mjs` (generic `formatProcessError`), `lib/audio-optimizer.mjs` (audio discovery/runner).

## Checks / verification

| Task                  | Command                                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Local completion gate | `npm run check -- --diff` (`check.mjs`; classification via `lib/changed-paths.mjs` over `lib/change-routes.mjs`) |
| Changed-path verifier | `npm run verify -- --diff` (`verify-changed.mjs`; same `changed-paths` parser)                                   |
| Docs gate             | `npm run docs:check` (`check-docs.mjs` → contracts + plans)                                                      |
| Static set            | `npm run check:static` (generated + format + typecheck + eslint + boundaries + arch-smoke)                       |
| Bundle budget         | `npm run check:bundle` (constants in `lib/bundle-budget.mjs`)                                                    |

## Release / changelog (three stages, shared `lib/patch-notes-core.mjs` + `lib/git-release.mjs`)

| Stage                                             | Command                                          |
| ------------------------------------------------- | ------------------------------------------------ |
| Dev `Unreleased` ← git                            | `npm run sync:changelog`                         |
| `Unreleased` → versioned on bump (versionrc hook) | `npm run changelog:promote`                      |
| Player `release-notes/` ← git + trailers          | `npm run generate:patch-notes`                   |
| Release gate                                      | `npm run verify:release` (tag + desktop package) |

## Test / E2E (all `test:e2e:*` forward to `run-e2e-route.mjs`)

`npm run test:e2e:route -- <shop|audio|gear|homestead|mystery> [-- extra playwright args]`;
`test:ship:unit`, `test:e2e:audit` (full timings), `perf`, `balance:sim`, `ci:summarize`.

## Cleanup (`clean` = explicit reset, `prune:transient` = age-based GC)

`npm run clean[--:all]` resets gitignored dirs (+ processes); `npm run prune:transient` deletes stale files only.
