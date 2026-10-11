# Release and Steam shipping

Automated gates validate builds and release artifacts. Public release readiness also requires the [provenance and notice review](./RELEASE_SETUP.md#player-notices-and-asset-provenance) and manual Steamworks promotion described below.

Demo/full edition behavior and save transfer are owned by [Steam demo](./STEAM_DEMO.md). Review the [Alchemy Steam demo checklist](./STEAM_DEMO_CHECKLIST.md) before approving a demo candidate.

## Commands

Build and installer selection: [COMMANDS.md § Build commands decision tree](./COMMANDS.md#build-commands-decision-tree). `package.json` owns the complete script list. `check:ship:full` adds save E2E on top of `check:ship`. Electron coverage runs in the path-filtered `electron-e2e` CI job and unconditionally each night; `npm run test:ship:desktop` is also available locally but is not part of the pre-tag gate. Gate composition and tiers are owned by [CONTRIBUTING.md](../CONTRIBUTING.md#static-build-and-ci-policy).

| Command                          | When it runs                                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `npm run verify:release-version` | `release.yml` — before web build and again before packaging, tag must match `package.json`                   |
| `npm run sync:steam-appid`       | `dist:desktop` — writes `steam_appid.txt` for the selected edition before packaging                          |
| `npm run sync:changelog`         | Optional: rebuild `CHANGELOG.md` ## [Unreleased] from git (also runs automatically as release `prerelease`)  |
| `npm run generate:patch-notes`   | Active dev → `release-notes/UNRELEASED.md`; tag CI → `release-notes/vX.Y.Z.md`. `--dry-run` prints to stdout |
| `npm run steam:upload:dry-run`   | Validates Steam VDF templates and the selected edition's unpacked contentroot without credentials            |
| `npm run release`                | Full gate, prints player-note draft, release commit/tag, pushes `main` + tag, then watches release CI        |
| `npm run release -- --dry-run`   | Print the player-facing patch-note draft from git; no gates, bump, tag, or push                              |
| `npm run release:hotfix`         | Lighter gate, forced patch commit/tag, pushes `main` + tag, then watches release CI                          |

For direct build, packaging, App ID synchronization, and upload commands, keep
`ALCHEMY_EDITION` consistent. The [edition contract](./STEAM_DEMO.md#edition-contract)
owns output directories and Steam targets; release CI handles both editions separately.

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
The workflow watcher matches the release tag and its commit SHA, and returns
failure when the watched GitHub Actions run fails. If no matching run can be
observed, it exits nonzero and reports CI verification as incomplete with a
workflow link. The tag has already been pushed: inspect that run and resume with
`gh run watch <run-id> --exit-status`; rerunning the release command would create
another version rather than resume monitoring.

## Agent release flow

Desktop builds validate Steam, Sentry, and signing configuration before invoking
Vite, so invalid configuration fails before source-map uploads. Packaging repeats
this validation when invoked directly and retains its post-build artifact checks.
These checks validate configuration completeness; signing credentials are still
authenticated by the signing provider during packaging.

Production Steam App IDs must contain only digits and represent a positive safe
integer other than 480. Demo and full-game App IDs must be numerically distinct.
Desktop releases validate Vite's resolved options: output must use the selected
edition's renderer directory, inline source maps are rejected, and Sentry reporting
requires hidden maps even when command-line options override the defaults.
Releases with Sentry reporting also reject `ALCHEMY_SKIP_SOURCEMAP=1`; local builds
can still override output and maps, and release crash reporting remains optional.
`dist:desktop` checks the renderer bundle budget before creating or signing installers.

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

Windows packaging explicitly targets x64, matching the Steamworks native binding.
Package verification reads the executable PE header and rejects other architectures.

Desktop renderer artifacts used for packaging include every runtime file in `public/`,
excluding optimizer receipts (`.asset-hashes.json`) used only for source validation.
Before packaging or signing, verification compares these files with the renderer's
copies, including music, sound effects and their fallbacks, fonts, and licenses.
The package verifier repeats that byte comparison inside `app.asar` and rejects
source maps, independently of whether crash reporting is configured.

Direct packaging validates the selected renderer's HTML before invoking
electron-builder. Application scripts, stylesheets, and module preloads must use
relative paths to nonempty files inside that renderer directory; web builds must
be rebuilt with `npm run build:desktop`. The ASAR verifier repeats these resource
checks against the packaged files.

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

- **Depot contentroot** is the selected edition's unpacked app under
  `release-desktop/` (full) or `release-desktop-demo/` (demo); the exact
  path and safety assertions are owned by `scripts/steam-upload.mjs` and its
  dry-run command.
- **Runtime Steam App ID** is synchronized from `STEAM_APP_ID` (full) or
  `STEAM_DEMO_APP_ID` (demo), with the local development fallback in
  `steam/platforms.json`, by `npm run sync:steam-appid`; packaged resolution and
  verification are owned by `desktop/main.cjs` and the desktop package verifier.
- **SteamCMD** setup and credential handling belong to `release.yml` and
  `scripts/steam-upload.mjs`. Configure Steam Guard for the build account per
  [Valve's SteamCMD / CI guidance](https://partner.steamgames.com/doc/sdk/uploading).

## One-time setup

Account setup, signing, and secrets live in [RELEASE_SETUP.md](./RELEASE_SETUP.md); revisit them when configuration or credentials change. That guide also owns the recurring pre-promotion gates (notice, provenance, input, listing) linked from the release flow above.

## CI jobs

The current release workflow, job names, path filters, and artifact ownership
are defined in [`.github/workflows/release.yml`](../.github/workflows/release.yml)
and [`.github/workflows/ci.yml`](../.github/workflows/ci.yml). Git auto-deploys
on Vercel are disabled (`vercel.json`); each release tag also triggers the
existing Vercel Deploy Hook for the web QA build via the `vercel-qa` job,
which runs alongside Steam publishing and never blocks it. Keep this page
focused on release decisions; update the workflow files when CI topology
changes.
