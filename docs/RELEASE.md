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
filtering/grouping with tests or cut a release.

Player notes come directly from git through `generate-patch-notes.mjs`, using
types, changed paths, and trailers. `npm run generate:patch-notes` writes
`release-notes/UNRELEASED.md`; tag CI writes `release-notes/vX.Y.Z.md` from the
previous tag to the current tag. `npm run release -- --dry-run` prints the draft
without gates, a bump, a tag, or a push. A real release prints it after gates
and before tagging.

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

## One-time setup

Crash reporting, provenance, signing, secrets, and listing baseline live in [RELEASE_SETUP.md](./RELEASE_SETUP.md). Revalidate only when rotating credentials, changing the listing, or preparing the first public release.

## CI jobs

The current release workflow, job names, path filters, and artifact ownership
are defined in [`.github/workflows/release.yml`](../.github/workflows/release.yml)
and [`.github/workflows/ci.yml`](../.github/workflows/ci.yml). Keep this page
focused on release decisions; update the workflow files when CI topology
changes.
