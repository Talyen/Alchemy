# Release one-time setup

One-time shipping setup for Alchemy: crash reporting, provenance, signing, secrets, and listing baseline. Active release flow stays in [RELEASE.md](./RELEASE.md). Coding rules: [AGENTS.md](../AGENTS.md).

Account and credential setup is one-time; revisit it when configuration or credentials change. Before public promotion, follow the [notice and provenance review](#player-notices-and-asset-provenance), [Steam Input revalidation conditions](#steam-input-default-mapping-controller-playable), and [listing baseline](#steam-listing-baseline-windows). Keep configuration aligned with the release workflow.

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
   runtime contract (canonical wording owned by [PRIVACY.md](../PRIVACY.md)).

Release desktop builds create hidden source maps, upload them as `alchemy@<package version>`, and delete them before
electron-builder assembles the application. All packages also exclude source maps, including builds without Sentry.
The packaging verifier inspects `app.asar` for maps and CI credentials.
Reporting failures and offline play never block startup, saves, gameplay, or quit.

Build version stamping (`src/lib/validation/metadata.generated.ts` via `npm run sync:version`) runs in the release pipeline; art authoring sources stay in [WORKFLOWS-ASSETS](./WORKFLOWS-ASSETS.md).

## Player notices and asset provenance

Before a public build can be promoted, review [PRIVACY.md](../PRIVACY.md) and
[THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) (canonical provenance register; unknown/incomplete provenance is a release blocker).

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

## Steam Input default mapping (controller Playable)

Decision: Alchemy plays with mouse plus keyboard equivalents, with no native
gamepad handling and no controller settings in Options. Steam Deck and Big
Picture support comes from one official Steam Input mapping authored in the
Steamworks dashboard, not from in-game changes.

Author this default mapping once, publish it as the default, and keep it so
players need no tweaks or in-game setting changes:

- Right trackpad or right stick: mouse
- A: Enter to activate the focused control
- Right trigger: left mouse click
- B: back / dismiss (Escape)
- D-pad up/down: previous/next focus (Shift+Tab / Tab)
- D-pad left/right: arrow keys for sliders and select controls
- Bumpers: previous/next focus (Shift+Tab / Tab); focus a tab or page button, then press A
- Start: Escape to open the game menu or dismiss the current overlay
- Select: Escape
- Left stick up/down: mouse wheel scrolling

Tabs and pagination are ordinary buttons without dedicated switch-tab or
switch-page keyboard shortcuts. Validate this proposed mapping in Steam Input
before publishing it as the default. Interactive surfaces use native controls: actions are
native buttons (or `role="button"` with Enter / Space), Options sliders are
native ranges (arrow keys), selects use the existing Radix keyboard and Escape
behavior, dialogs contain focus with Cancel first and dismiss on Escape, and
keyboard focus shows the same card detail popups as hover.

Store tagging: keep the listing below full controller support. The game is
playable with the official mapping; it does not ship native button icons,
remapping, sensitivity, or rumble settings.

Revalidate this mapping before changing the listing or promoting a public
build when any of these appear: non-button interactions such as drag-only
play, new text entry needing the on-screen keyboard, new screens or dialogs
outside the shared button / dialog / tab / pagination primitives, or changes
to Escape ordering.

## Steam listing baseline (Windows)

These are the current player-facing store assumptions, not values derived from
Electron configuration. Revalidate them on representative minimum-spec
hardware before changing the Steam listing or promoting a public build.

- Windows 10/11 64-bit
- 4 GB RAM
- DirectX 11 GPU
- ~500 MB disk
