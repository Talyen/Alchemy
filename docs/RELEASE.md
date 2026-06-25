# Release and Steam shipping

Automation enforces release readiness — agents do not rely on manual checklists.

## Commands

| Command | When it runs |
|---------|----------------|
| `npm run check:ship` | Pre-push (`build:ship`), release workflow |
| `npm run check:ship:ci` | CI `ship-gate` (unit + desktop compile; reuses `dist` artifact) |
| `npm run check:ship:full` | Nightly + before tagging (`unit` + save E2E + Electron E2E) |
| `npm run verify:release-version` | `release.yml` — tag must match `package.json` |
| `npm run sync:version` | `prebuild` / `prebuild:desktop` — syncs `package.json` → `metadata.generated.ts` |
| `npm run sync:steam-appid` | `prebuild:desktop` / release — writes `steam_appid.txt` from `STEAM_APP_ID` |
| `npm run sync:changelog` | Rebuilds `CHANGELOG.md` ## [Unreleased] from git since latest `v*` tag |
| `npm run sync:changelog:check` | CI drift guard — fails if `CHANGELOG.md` is stale |
| `npm run generate:patch-notes` | Active dev → `release-notes/UNRELEASED.md`; tag CI → `release-notes/vX.Y.Z.md` |
| `npm run dist:desktop` | Windows/Linux/Mac targets from [`steam/platforms.json`](../steam/platforms.json) |
| `npm run steam:upload:dry-run` | Validates Steam VDF templates without credentials |
| `npm run release` | Bumps version, promotes changelog, creates git tag |

## Changelog automation (main-only)

1. When explicitly asked to commit, agents commit to `main` with [Conventional Commits](https://www.conventionalcommits.org/) headers (see [AGENTS.md](../AGENTS.md#branch-and-commit-policy)).
2. **Pre-push hook** runs `sync-changelog-commit.mjs` — updates `CHANGELOG.md` ## [Unreleased] and auto-commits when dirty.
3. During development: `npm run generate:patch-notes` writes player-facing `release-notes/UNRELEASED.md` from the changelog.
4. `tests/architecture/changelog-sync.test.ts` fails CI if the unreleased section drifts from git.

## Agent release flow

1. Ensure your working tree is clean and you're on `main`.
2. Run **`npm run release`** — runs `check:ship:full`, bumps version (inferred from commits via `commit-and-tag-version`), creates the release commit + `vX.Y.Z` tag, pushes both to origin, and watches the release workflow.
3. For urgent hotfixes: **`npm run release:hotfix`** — lighter gate (`check:ship` + `prepush` E2E), forces a patch bump.
4. [`.github/workflows/release.yml`](../.github/workflows/release.yml) runs `lint` → `test` → `build` → `e2e-full` (3-shard full E2E matrix) → `release` (builds installers, generates patch notes, uploads Steam depots when secrets exist, creates a GitHub Release). **The release job is blocked until the full E2E suite passes.**

## GitHub secrets (one-time setup)

| Secret | Purpose |
|--------|---------|
| `STEAM_APP_ID` | Production Steam App ID |
| `STEAM_DEPOT_ID` | Primary content depot |
| `STEAM_USERNAME` / `STEAM_PASSWORD` | `steamcmd` upload |
| `CSC_LINK` / `CSC_KEY_PASSWORD` | Optional Windows code signing |

## System requirements (Windows)

- Windows 10/11 64-bit
- 4 GB RAM
- DirectX 11 GPU
- ~500 MB disk

## CI jobs

| Job | Trigger |
|-----|---------|
| `e2e` (`@critical`) | Every push |
| `ship-gate` | Every push (`check:ship:ci` after lint/test/build) |
| `save-gate` | Push when save/migration paths change |
| `active-run-gate` | Push when active-run paths change |
| `desktop-build` | Push when desktop paths change (Windows installer artifact) |
| `electron-e2e` | Push when desktop/Electron paths change |
| `release` (incl. `e2e-full` 3-shard matrix) | Tag `v*` push |
