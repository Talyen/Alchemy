# Release and Steam shipping

Automated gates validate builds and release artifacts. Public release readiness also requires the [provenance and notice review](./RELEASE_SETUP.md#player-notices-and-asset-provenance) and manual Steamworks promotion described below.

## Commands

Build and installer selection: [REFERENCE.md § Build commands decision tree](./REFERENCE.md#build-commands-decision-tree). `package.json` owns the complete script list. `check:ship:full` adds save E2E on top of `check:ship`. Electron coverage runs in the path-filtered `electron-e2e` CI job and unconditionally each night; `npm run test:ship:desktop` is also available locally but is not part of the pre-tag gate. Gate composition and tiers are owned by [CONTRIBUTING.md](../CONTRIBUTING.md#static-build-and-ci-policy).

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

Commit with [Conventional Commits](https://www.conventionalcommits.org/).
Player-facing types are `feat`, `fix`, `balance`, and `perf`; optional
`User-Facing: yes` or `User-Facing: no` trailers override type and path inference.
Infra-only commits stay out of player notes even when typed `feat`.

`CHANGELOG.md` is generated developer history. The release command's
`.versionrc.json` hooks populate Unreleased from recognized commits since the
latest `v*` tag (`sync-changelog.mjs`, prerelease), then promote it to a dated
version section (`release-changelog.mjs`, postbump). Never edit, trim, or
reorganize it by hand. If it becomes hard to consume, improve the generator's
filtering/grouping with tests or cut a release. Repeating promotion for an existing
version leaves it unchanged when Unreleased is empty; new unreleased content
against that version is a conflict and is preserved for review.

Player notes come directly from git through `generate-patch-notes.mjs`, using
types, changed paths, and trailers. `npm run generate:patch-notes` writes
`release-notes/UNRELEASED.md`; tag CI writes `release-notes/vX.Y.Z.md` from the
nearest preceding release tag in the current tag's ancestry to the current tag.
Commit validation uses the same boundary; later or unrelated tags do not affect
release reruns. Unreleased notes start at the nearest release tag reachable from
HEAD. `npm run release -- --dry-run` prints the draft
without gates, a bump, a tag, or a push. A real release prints it after gates
and before tagging.

Unknown release options fail before any gates, version changes, or publishing.
The workflow watcher returns failure when the watched GitHub Actions run fails;
if monitoring is unavailable, inspect the printed workflow link.

## Agent release flow

Desktop builds validate Steam, Sentry, and signing configuration before invoking
Vite, so invalid configuration fails before source-map uploads. Packaging repeats
this validation when invoked directly and retains its post-build artifact checks.
These checks validate configuration completeness; signing credentials are still
authenticated by the signing provider during packaging.

Production Steam App IDs must contain only digits and represent a positive safe
integer other than 480. Releases with Sentry reporting reject
`ALCHEMY_SKIP_SOURCEMAP=1`; local builds can still omit maps, and release crash
reporting remains optional. `dist:desktop` checks the renderer bundle budget
before creating or signing installers.

1. Ensure your working tree is clean and you're on `main`. Before publishing, confirm the applicable [release setup](./RELEASE_SETUP.md) is current, including notice and provenance review for changed assets or service use.
2. Run **`npm run release`** — runs `check:ship:full`, prints the player-facing patch-note draft, bumps version (inferred from commits via `commit-and-tag-version`), creates the release commit + `vX.Y.Z` tag, pushes both to origin, and watches the release workflow (matched by the tag name, not `main`). Preview notes without shipping: **`npm run release -- --dry-run`**.
3. For urgent hotfixes: **`npm run release:hotfix`** — lighter gate (`check:ship` + critical E2E), forces a patch bump.
4. [`.github/workflows/release.yml`](../.github/workflows/release.yml) is the
   source of truth for release job ordering, gates, packaging, patch notes, and
   Steam publishing. The release job must not introduce a second desktop build
   when the workflow already produced the release artifact.
5. Before promotion, complete the [notice and provenance review](./RELEASE_SETUP.md#player-notices-and-asset-provenance), revalidate [Steam Input when its listed triggers apply](./RELEASE_SETUP.md#steam-input-default-mapping-controller-playable), and verify the [listing baseline](./RELEASE_SETUP.md#steam-listing-baseline-windows). After a successful Steam upload, **manually promote** the new build to the live branch in Steamworks (`setlive` is empty so uploads do not auto-publish).

## Packaged Windows startup check

`npm run smoke:desktop` launches the unpacked Windows executable and waits up to
60 seconds for the title screen's enabled Play button using Windows accessibility
APIs. It isolates the player profile and closes the game afterward. It runs after
packaging in Windows CI and before Steam upload in release CI. The packaged fuses,
ASAR, and renderer policy remain intact; no development server or debug interface
is required. Run this check on Windows; renderer builds and unit tests on other
hosts do not substitute for it.

Desktop renderer artifacts used for packaging include music. The package verifier
compares packaged MP3 bytes with `public/Music/` and rejects source maps inside
`app.asar`, independently of whether crash reporting is configured.

## Failed release and rollback

`npm run release` pushes `main` and the release tag atomically before watching
GitHub Actions. A rejected push updates neither remote ref and stops without
retrying separate pushes or starting the watcher. A workflow failure after a
successful push is a published failed release attempt, not an uncommitted local operation.

After package verification and startup smoke pass, release CI retains the complete
desktop package and versioned release notes for seven days before contacting
Steam. The artifact name includes the tag and producing run attempt. A separate
publishing job downloads the exact artifact ID exported by the packaging job,
then uploads to Steam and GitHub. Retrying only the failed publishing job reuses
that verified package without rebuilding or signing again. Retry within the
seven-day retention window; an expired artifact requires rerunning packaging.
Rerunning all jobs intentionally creates a new package.

- If a job fails before Steam upload, fix the cause on `main` and use a new
  patch release. Do not move or reuse the published tag.
- If packaging succeeds but Steam upload fails, leave the current live branch
  untouched, repair credentials or the external service, and rerun only the
  failed publishing job for the same immutable tag. Code or workflow changes
  require a new patch release.
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

## One-time setup

Account setup, signing, and secrets live in [RELEASE_SETUP.md](./RELEASE_SETUP.md); revisit them when configuration or credentials change. That guide also owns the recurring notice, provenance, input, and listing reviews linked from the release flow above.

## CI jobs

The current release workflow, job names, path filters, and artifact ownership
are defined in [`.github/workflows/release.yml`](../.github/workflows/release.yml)
and [`.github/workflows/ci.yml`](../.github/workflows/ci.yml). Keep this page
focused on release decisions; update the workflow files when CI topology
changes.
