# Release and Steam shipping

Automation enforces release readiness — agents do not rely on manual checklists.

## Commands

Ship, desktop, and installer scripts (`check:ship`, `check:ship:full`, `build:desktop`, `package:win`, `dist:desktop`, `sync:version`): [REFERENCE.md § Script Command Reference](./REFERENCE.md#script-command-reference). `check:ship:full` adds save E2E on top of `check:ship`; the Electron desktop suite is CI-only (path-filtered `electron-e2e` job plus an unconditional nightly run), so releases rely on CI coverage rather than a local pre-tag desktop run. Gate composition and tiers are owned by [CONTRIBUTING.md](../CONTRIBUTING.md#static-build-and-ci-policy) — used nightly and before tagging.

| Command                          | When it runs                                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `npm run verify:release-version` | `release.yml` — tag must match `package.json`                                                                |
| `npm run sync:steam-appid`       | `dist:desktop` — writes `steam_appid.txt` from `STEAM_APP_ID` before packaging                               |
| `npm run sync:changelog`         | Optional: rebuild `CHANGELOG.md` ## [Unreleased] from git (also runs automatically as release `prerelease`)  |
| `npm run generate:patch-notes`   | Active dev → `release-notes/UNRELEASED.md`; tag CI → `release-notes/vX.Y.Z.md`. `--dry-run` prints to stdout |
| `npm run steam:upload:dry-run`   | Validates Steam VDF templates + contentroot (`release-desktop/win-unpacked`) without credentials             |
| `npm run release`                | Full gate, prints player-note draft, release commit/tag, pushes `main` + tag, then watches release CI        |
| `npm run release -- --dry-run`   | Print the player-facing patch-note draft from git; no gates, bump, tag, or push                              |
| `npm run release:hotfix`         | Lighter gate, forced patch commit/tag, pushes `main` + tag, then watches release CI                          |

## Changelog (release-time only)

1. Day to day: commit to `main` with [Conventional Commits](https://www.conventionalcommits.org/). **Do not edit `CHANGELOG.md`.** Player-facing types are `feat`, `fix`, `balance`, and `perf`. Optional body trailer `User-Facing: yes` or `User-Facing: no` overrides type and path inference. Infra-only commits (`scripts/`, `docs/`, `.github/`, `tests/`, generated barrels) stay out of patch notes even when typed `feat`.
2. `npm run release` / `release:hotfix` → `commit-and-tag-version` runs `.versionrc.json` hooks:
   - **prerelease:** `sync-changelog.mjs` fills ## [Unreleased] from recognized Conventional Commits since the latest `v*` tag; it omits merge/non-conventional noise and caps verbose bodies
   - **postbump:** `release-changelog.mjs` promotes that section to `## [x.y.z] (date)`
3. Player patch notes are generated from git (not from `CHANGELOG.md`): types, changed paths, and `User-Facing` trailers. Anytime: `npm run generate:patch-notes` writes `release-notes/UNRELEASED.md`. Tag CI writes `release-notes/vX.Y.Z.md` from the previous tag to the current tag. `npm run release -- --dry-run` (and the real release, after gates) prints that draft before tagging.

## Agent release flow

1. Ensure your working tree is clean and you're on `main`.
2. Run **`npm run release`** — runs `check:ship:full`, prints the player-facing patch-note draft, bumps version (inferred from commits via `commit-and-tag-version`), creates the release commit + `vX.Y.Z` tag, pushes both to origin, and watches the release workflow (matched by the tag name, not `main`). Preview notes without shipping: **`npm run release -- --dry-run`**.
3. For urgent hotfixes: **`npm run release:hotfix`** — lighter gate (`check:ship` + critical E2E), forces a patch bump.
4. [`.github/workflows/release.yml`](../.github/workflows/release.yml) is the
   source of truth for release job ordering, gates, packaging, patch notes, and
   Steam publishing. The release job must not introduce a second desktop build
   when the workflow already produced the release artifact.
5. After a successful Steam upload, **manually promote** the new build to the live branch in Steamworks (`setlive` is empty so uploads do not auto-publish).

## Failed release and rollback

`npm run release` pushes the release commit and tag before it watches GitHub
Actions. A workflow failure is therefore a published failed release attempt,
not an uncommitted local operation.

- If a job fails before Steam upload, fix the cause on `main` and use a new
  patch release. Do not move or reuse the published tag.
- If packaging succeeds but Steam upload fails, leave the current live branch
  untouched, repair credentials or workflow configuration, and rerun the
  failed workflow for the same immutable tag.
- If a promoted build is defective, use Steamworks to restore the previously
  known-good build to the live branch, then ship a new hotfix tag. Record the
  rollback and affected versions in the release or incident notes.
- Never delete a public release tag merely to make history look successful.
  GitHub and Steam artifacts must remain traceable to immutable source.

The release workflow must keep upload and live promotion separate so a failed
or unreviewed build cannot become player-visible automatically.

## Steam depot and App ID

- **Depot contentroot** is the unpacked app under `release-desktop/`; the exact
  path and safety assertions are owned by `scripts/steam-upload.mjs` and its
  dry-run command.
- **Runtime Steam App ID** is synchronized from `STEAM_APP_ID` and
  `steam/platforms.json` by `npm run sync:steam-appid`; packaged resolution and
  verification are owned by `desktop/main.cjs` and the desktop package verifier.
- **SteamCMD** setup and credential handling belong to `release.yml` and
  `scripts/steam-upload.mjs`. Configure Steam Guard for the build account per
  [Valve's SteamCMD / CI guidance](https://partner.steamgames.com/doc/sdk/uploading).

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
4. Publish [the privacy notice](../PRIVACY.md) on the Steam store page before
   enabling the secrets. Keep its crash-reporting disclosure aligned with this
   runtime contract:
   “Alchemy automatically sends technical error reports to Sentry. Reports can include the game version, operating
   system, Electron version, crash location, screen label, and diagnostic context collected by Sentry's Electron
   SDK. Alchemy does not deliberately attach Steam identity or save data.”

Release desktop builds create hidden source maps, upload them as `alchemy@<package version>`, and delete them before
electron-builder assembles the application. The packaging verifier checks that maps and CI credentials are absent.
Reporting failures and offline play never block startup, saves, gameplay, or quit.

## Player notices and asset provenance

Before a public build can be promoted, review [PRIVACY.md](../PRIVACY.md) and
[THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md). Every third-party art,
audio, font, or bundled runtime must have a recorded source, license, required
attribution, and redistribution permission. An unknown or incomplete asset
provenance row is a release blocker; do not infer permission from the presence
of a file in `Raw Assets/`.

Before the first public release, obtain legal review of the repository license.
The current CC BY-NC 4.0 notice covers code and content together, while Creative
Commons [recommends a software-specific license for code](https://creativecommons.org/faq/).
Decide and document the code/content split without silently changing existing
grant terms.

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

## Steam listing baseline (Windows)

These are the current player-facing store assumptions, not values derived from
Electron configuration. Revalidate them on representative minimum-spec
hardware before changing the Steam listing or promoting a public build.

- Windows 10/11 64-bit
- 4 GB RAM
- DirectX 11 GPU
- ~500 MB disk

## CI jobs

The current release workflow, job names, path filters, and artifact ownership
are defined in [`.github/workflows/release.yml`](../.github/workflows/release.yml)
and [`.github/workflows/ci.yml`](../.github/workflows/ci.yml). Keep this page
focused on release decisions; update the workflow files when CI topology
changes.

## Changelog output policy

`CHANGELOG.md` is a generated developer history and may be verbose between
releases. Never trim or reorganize it by hand. If an unreleased section becomes
hard to consume, change `sync-changelog.mjs` filtering/grouping with tests or
cut a release. Player-facing communication is generated from git by
`generate-patch-notes.mjs` (conventional type, changed paths, and optional
`User-Facing:` trailers), not by copying changelog entries.
