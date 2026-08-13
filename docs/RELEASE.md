# Release and Steam shipping

Automation enforces release readiness — agents do not rely on manual checklists.

## Commands

| Command                          | When it runs                                                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `npm run check:ship`             | Local ship gate (`lint:ci` + ship unit + `ALCHEMY_SKIP_ASSETS=1` `build:desktop`); also used by `release:hotfix` |
| `npm run check:ship:full`        | Nightly + before tagging (`unit` + save E2E + Electron E2E)                                                      |
| `npm run build:desktop`          | Desktop Vite build via `prebuild:desktop` (version + steam app id + assets; CI sets `ALCHEMY_SKIP_ASSETS=1`)     |
| `npm run verify:release-version` | `release.yml` — tag must match `package.json`                                                                    |
| `npm run sync:version`           | `prebuild` / `prebuild:desktop` — syncs `package.json` → `metadata.generated.ts`                                 |
| `npm run sync:steam-appid`       | `prebuild:desktop` — writes `steam_appid.txt` from `STEAM_APP_ID` (release job relies on this hook)              |
| `npm run sync:changelog`         | Optional: rebuild `CHANGELOG.md` ## [Unreleased] from git (also runs automatically as release `prerelease`)      |
| `npm run generate:patch-notes`   | Active dev → `release-notes/UNRELEASED.md`; tag CI → `release-notes/vX.Y.Z.md`                                   |
| `npm run package:win`            | Unpacked Windows app via `dist-desktop.mjs` (`ALCHEMY_PACKAGE_DIR=1`)                                            |
| `npm run dist:desktop`           | Hardened, verified installers from [`steam/platforms.json`](../steam/platforms.json)                             |
| `npm run steam:upload:dry-run`   | Validates Steam VDF templates + contentroot (`release-desktop/win-unpacked`) without credentials                 |
| `npm run release`                | Bumps version, syncs + promotes changelog, creates git tag                                                       |

## Changelog (release-time only)

1. Day to day: commit to `main` with [Conventional Commits](https://www.conventionalcommits.org/). **Do not edit `CHANGELOG.md`.**
2. `npm run release` / `release:hotfix` → `commit-and-tag-version` runs `.versionrc.json` hooks:
   - **prerelease:** `sync-changelog.mjs` fills ## [Unreleased] from recognized Conventional Commits since the latest `v*` tag; it omits merge/non-conventional noise and caps verbose bodies
   - **postbump:** `release-changelog.mjs` promotes that section to `## [x.y.z] (date)`
3. Anytime: `npm run generate:patch-notes` writes player-facing `release-notes/UNRELEASED.md` (uses git via an in-memory sync; no need to commit changelog churn).

## Agent release flow

1. Ensure your working tree is clean and you're on `main`.
2. Run **`npm run release`** — runs `check:ship:full`, bumps version (inferred from commits via `commit-and-tag-version`), creates the release commit + `vX.Y.Z` tag, pushes both to origin, and watches the release workflow (matched by the tag name, not `main`).
3. For urgent hotfixes: **`npm run release:hotfix`** — lighter gate (`check:ship` + `prepush` E2E), forces a patch bump.
4. [`.github/workflows/release.yml`](../.github/workflows/release.yml) runs `lint`, `test`, and `build` → `e2e-full` (3-shard full E2E matrix) → `release` (builds installers once via `dist:desktop`, generates patch notes, uploads Steam depots, creates a GitHub Release). **The release job is blocked until lint, unit tests, and the full E2E suite all pass.** It does not re-run `check:ship` (that would rebuild desktop); `dist:desktop` with `CI_RELEASE=true` is the sole desktop compile. If Steam secrets are missing, the release fails unless the repository variable `ALLOW_STEAM_DRY_RUN=true` explicitly permits a dry-run.
5. After a successful Steam upload, **manually promote** the new build to the live branch in Steamworks (`setlive` is empty so uploads do not auto-publish).

## Steam depot and App ID

- **Depot contentroot** is `release-desktop/win-unpacked` (the unpacked app), not the whole `release-desktop/` tree. That keeps the NSIS installer, `.blockmap`, and `builder-debug.yml` out of the depot. `steam:upload` (including dry-run) asserts the contentroot exists, contains `Alchemy.exe`, and has no `*Setup*.exe` / `builder-debug.yml`.
- **Runtime Steam App ID** is baked into packaged `package.json` via electron-builder `extraMetadata.steamAppId` when `CI_RELEASE=true` (same pattern as Sentry metadata). `desktop/main.cjs` resolves: packaged metadata → `STEAM_APP_ID` env (dev) → `480` (Spacewar / local). Canonical source for the ID file used by Steamworks locally is `STEAM_APP_ID` / `steam/platforms.json` `devAppId` via `npm run sync:steam-appid`. The package verifier fails CI release builds that bake `480` or omit the ID.
- **SteamCMD** is installed in `release.yml` with `CyberAndrii/setup-steamcmd@v1.3.0` (pinned version tag). `scripts/steam-upload.mjs` fails fast if `steamcmd` is not on `PATH`, and passes credentials as argv with `shell: false` (never logged). Configure Steam Guard for the build account per [Valve's SteamCMD / CI guidance](https://partner.steamgames.com/doc/sdk/uploading).

## Desktop crash reporting (one-time setup)

Alchemy uses Sentry for error reporting from packaged production desktop releases. Browser development, tests, and
ordinary local packages do not initialize reporting. Performance traces and continuous logs are disabled, and the
SDK is configured with `sendDefaultPii: false`. Alchemy does not set a Sentry user or deliberately attach Steam
identity or save data. Otherwise, events use Sentry's standard Electron error context and breadcrumbs.

1. Create an Electron project in Sentry and copy its public DSN.
2. Add `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` as GitHub Actions secrets. Scope the
   auth token only to release creation and source-map upload.
3. In Sentry, create an email alert for new and regressed issues. The initial free tier is quota limited; when the
   quota is exhausted the game continues normally and events are dropped.
4. Add this disclosure to the Steam privacy notice before enabling the secrets:
   “Alchemy automatically sends technical error reports to Sentry. Reports can include the game version, operating
   system, Electron version, crash location, screen label, and diagnostic context collected by Sentry's Electron
   SDK. Alchemy does not deliberately attach Steam identity or save data.”

Release desktop builds create hidden source maps, upload them as `alchemy@<package version>`, and delete them before
electron-builder assembles the application. The packaging verifier checks that maps and CI credentials are absent.
Reporting failures and offline play never block startup, saves, gameplay, or quit.

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

| Job                                         | Trigger                                                                           |
| ------------------------------------------- | --------------------------------------------------------------------------------- |
| `e2e` (`@critical`)                         | Every push                                                                        |
| `ship-gate`                                 | Pushes matching the `desktop_renderer` filter (desktop renderer after unit tests) |
| `assets`                                    | Push when Raw Assets / asset scripts change (prep + drift check)                  |
| `save-gate`                                 | Push when save/migration/active-run paths change                                  |
| `desktop-build`                             | Push when desktop paths change (`dist:desktop` Windows installer artifact)        |
| `electron-e2e`                              | Pushes matching `desktop_renderer` (reuses ship-gate `dist/`)                     |
| `release` (incl. `e2e-full` 3-shard matrix) | Tag `v*` push                                                                     |
