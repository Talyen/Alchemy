# Release and Steam shipping

Automation enforces release readiness — agents do not rely on manual checklists.

## Commands

| Command                          | When it runs                                                                      |
| -------------------------------- | --------------------------------------------------------------------------------- |
| `npm run check:ship`             | Pre-push (`build:ship`), release workflow                                         |
| `npm run check:ship:ci`          | CI `ship-gate` (unit + desktop compile; reuses `dist` artifact)                   |
| `npm run check:ship:full`        | Nightly + before tagging (`unit` + save E2E + Electron E2E)                       |
| `npm run verify:release-version` | `release.yml` — tag must match `package.json`                                     |
| `npm run sync:version`           | `prebuild` / `prebuild:desktop` — syncs `package.json` → `metadata.generated.ts`  |
| `npm run sync:steam-appid`       | `prebuild:desktop` / release — writes `steam_appid.txt` from `STEAM_APP_ID`       |
| `npm run sync:changelog`         | Rebuilds `CHANGELOG.md` ## [Unreleased] from git since latest `v*` tag            |
| `npm run sync:changelog:check`   | CI drift guard — fails if `CHANGELOG.md` is stale                                 |
| `npm run generate:patch-notes`   | Active dev → `release-notes/UNRELEASED.md`; tag CI → `release-notes/vX.Y.Z.md`    |
| `npm run dist:desktop`           | Hardened, verified targets from [`steam/platforms.json`](../steam/platforms.json) |
| `npm run steam:upload:dry-run`   | Validates Steam VDF templates without credentials                                 |
| `npm run release`                | Bumps version, promotes changelog, creates git tag                                |

## Changelog automation (main-only)

1. When explicitly asked to commit, agents commit to `main` with [Conventional Commits](https://www.conventionalcommits.org/) headers.
2. **Pre-push hook** runs `sync-changelog-commit.mjs` — updates `CHANGELOG.md` ## [Unreleased] and auto-commits when dirty.
3. During development: `npm run generate:patch-notes` writes player-facing `release-notes/UNRELEASED.md` from the changelog.
4. `tests/architecture/changelog-sync.test.ts` fails CI if the unreleased section drifts from git.

## Agent release flow

1. Ensure your working tree is clean and you're on `main`.
2. Run **`npm run release`** — runs `check:ship:full`, bumps version (inferred from commits via `commit-and-tag-version`), creates the release commit + `vX.Y.Z` tag, pushes both to origin, and watches the release workflow.
3. For urgent hotfixes: **`npm run release:hotfix`** — lighter gate (`check:ship` + `prepush` E2E), forces a patch bump.
4. [`.github/workflows/release.yml`](../.github/workflows/release.yml) runs `lint` → `test` → `build` → `e2e-full` (3-shard full E2E matrix) → `release` (builds installers, generates patch notes, uploads Steam depots when secrets exist, creates a GitHub Release). **The release job is blocked until the full E2E suite passes.**

## Desktop crash reporting (one-time setup)

Alchemy uses Sentry only for anonymous crashes from packaged production desktop releases. Browser development,
tests, and ordinary local packages do not initialize reporting. No performance traces, replay, analytics,
continuous logs, gameplay breadcrumbs, saves, Steam identity, or player-entered content are sent.

1. Create an Electron project in Sentry and copy its public DSN.
2. Add `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` as GitHub Actions secrets. Scope the
   auth token only to release creation and source-map upload.
3. In Sentry, create an email alert for new and regressed issues. The initial free tier is quota limited; when the
   quota is exhausted the game continues normally and events are dropped.
4. Add this disclosure to the Steam privacy notice before enabling the secrets:
   “Alchemy automatically sends anonymous technical crash reports, including the game version, operating system,
   Electron version, crash location, and non-identifying screen label, to Sentry. Reports do not include Steam
   identity, save data, gameplay state, or user-entered content.”

Release desktop builds create hidden source maps, upload them as `alchemy@<package version>`, and delete them before
electron-builder assembles the application. The packaging verifier checks that maps and CI credentials are absent.
Reporting failures and offline play never block startup, saves, gameplay, or quit.

Before treating reporting as operational, run **Sentry Private Verification** from the GitHub Actions page. This
manual workflow never tags a release, creates a GitHub release, or uploads a Steam depot. It produces a private
Windows installer retained for three days and uploads source maps under an isolated
`alchemy@<version>-sentry-test.<run number>` release.

Install that artifact and run each command from PowerShell, replacing the path if necessary:

```powershell
& "$env:LOCALAPPDATA\Programs\Alchemy\Alchemy.exe" --alchemy-sentry-test=renderer
& "$env:LOCALAPPDATA\Programs\Alchemy\Alchemy.exe" --alchemy-sentry-test=main
& "$env:LOCALAPPDATA\Programs\Alchemy\Alchemy.exe" --alchemy-sentry-test=native-renderer
```

Each launch waits for the packaged renderer to load, then produces exactly one controlled crash. Confirm all three
events appear in the matching isolated Sentry release and that the JavaScript stack traces are symbolicated. The
arguments are inert in development, ordinary local packages, and public release packages: the crash harness requires
private-build metadata that only the manual workflow embeds.

## Windows signing readiness

Unsigned Steam depots remain supported. To opt into Azure Trusted Signing, create the Trusted Signing account and
certificate profile, grant a Microsoft Entra application the Certificate Profile Signer role, then configure:

- Credentials: `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, and `AZURE_CLIENT_SECRET`.
- Signing profile: `AZURE_CODE_SIGNING_PUBLISHER_NAME`, `AZURE_CODE_SIGNING_ENDPOINT`,
  `AZURE_CODE_SIGNING_ACCOUNT_NAME`, and `AZURE_CODE_SIGNING_CERTIFICATE_PROFILE_NAME`.

All four profile values must be present together. When configured, electron-builder signs automatically and the
package verifier requires a valid Authenticode signature. Leave `REQUIRE_CODE_SIGNING` unset for the current
fail-open policy. Set the GitHub Actions repository variable `REQUIRE_CODE_SIGNING=true` when public releases must
fail closed; this maps to electron-builder’s `forceCodeSigning`.

No publisher identifiers or credentials belong in the repository. Azure credentials are only exposed to the
Windows release job.

## GitHub secrets (one-time setup)

| Secret                              | Purpose                        |
| ----------------------------------- | ------------------------------ |
| `STEAM_APP_ID`                      | Production Steam App ID        |
| `STEAM_DEPOT_ID`                    | Primary content depot          |
| `STEAM_USERNAME` / `STEAM_PASSWORD` | `steamcmd` upload              |
| `SENTRY_DSN`                        | Public packaged crash endpoint |
| `SENTRY_AUTH_TOKEN`                 | Source-map upload only         |
| `SENTRY_ORG` / `SENTRY_PROJECT`     | Source-map destination         |
| `AZURE_*` values above              | Optional Azure Trusted Signing |

## System requirements (Windows)

- Windows 10/11 64-bit
- 4 GB RAM
- DirectX 11 GPU
- ~500 MB disk

## CI jobs

| Job                                         | Trigger                                                     |
| ------------------------------------------- | ----------------------------------------------------------- |
| `e2e` (`@critical`)                         | Every push                                                  |
| `ship-gate`                                 | Every push (`check:ship:ci` after lint/test/build)          |
| `save-gate`                                 | Push when save/migration paths change                       |
| `active-run-gate`                           | Push when active-run paths change                           |
| `desktop-build`                             | Push when desktop paths change (Windows installer artifact) |
| `electron-e2e`                              | Push when desktop/Electron paths change                     |
| `release` (incl. `e2e-full` 3-shard matrix) | Tag `v*` push                                               |
| `Sentry Private Verification`               | Manual only; private crash-test installer, no Steam upload  |
