# Release and Steam shipping

Automation enforces release readiness — agents do not rely on manual checklists.

## Commands

| Command | When it runs |
|---------|----------------|
| `npm run check:ship` | Pre-push (`build:ship`), release workflow |
| `npm run check:ship:ci` | PR CI `ship-gate` (unit + desktop compile; reuses `dist` artifact) |
| `npm run check:ship:full` | Nightly + before tagging (`unit` + save E2E + Electron E2E) |
| `npm run verify:release-version` | `release.yml` — tag must match `package.json` |
| `npm run sync:version` | `prebuild` / `prebuild:desktop` — syncs `package.json` → `metadata.generated.ts` |
| `npm run sync:steam-appid` | `prebuild:desktop` / release — writes `steam_appid.txt` from `STEAM_APP_ID` |
| `npm run generate:patch-notes` | `release.yml` on tag push |
| `npm run dist:desktop` | Windows/Linux/Mac targets from [`steam/platforms.json`](../steam/platforms.json) |
| `npm run steam:upload:dry-run` | Validates Steam VDF templates without credentials |
| `npm run release` | Bumps version, updates `CHANGELOG.md`, creates git tag |

## Agent release flow

1. Ensure `npm run check:ship:full` passes locally.
2. Run `npm run release` (or `release:minor` / `release:major`).
3. Push the tag: `git push origin vX.Y.Z`.
4. [`.github/workflows/release.yml`](../.github/workflows/release.yml) builds installers, generates patch notes, uploads Steam depots (when secrets exist), and creates a GitHub Release.

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
| `ship-gate` | Every PR / push (`check:ship:ci` after lint/test/build) |
| `save-gate` | PR when save/migration paths change |
| `active-run-gate` | PR when active-run paths change |
| `desktop-build` | PR when desktop paths change (Windows installer artifact) |
| `electron-e2e` | PR when desktop/Electron paths change |
| `release` | Tag `v*` push |
