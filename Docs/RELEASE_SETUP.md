# Release setup and pre-promotion gates

One-time shipping setup for Alchemy plus recurring gates before public promotion: crash reporting, provenance, signing, secrets, and listing baseline. Active release flow stays in [RELEASE.md](./RELEASE.md). Coding rules: [AGENTS.md](../AGENTS.md).

As of October 23, 2026, no Steam store page exists: Steam ID verification is
pending. App IDs, depots, page creation and survey submission are future setup
steps, not missing information on a published listing.

Account and credential setup is one-time; revisit it when configuration or credentials change. Before public promotion, follow the [notice and provenance review](#player-notices-and-asset-provenance), [Steam Input revalidation conditions](#steam-input-default-mapping-controller-playable), and [listing baseline](#steam-listing-baseline-windows). Keep configuration aligned with the release workflow.

## Desktop crash reporting (one-time setup)

Alchemy uses Sentry for error reporting from packaged production desktop releases. Browser development, tests, and
ordinary local packages do not initialize reporting. Performance traces and continuous logs are disabled, and the
SDK is configured with `sendDefaultPii: false`. Alchemy does not set a Sentry user or deliberately attach Steam
identity or save data. Console breadcrumbs are discarded in both processes to prevent player names or
serialized save diagnostics from entering reports. Other events use Sentry's standard Electron error context and breadcrumbs.

1. Create an Electron project in Sentry and copy its public DSN.
2. Add `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` as GitHub Actions secrets. Scope the
   auth token only to release creation and source-map upload.
3. In Sentry, create an email alert for new and regressed issues. The initial free tier is quota limited; when the
   quota is exhausted the game continues normally and events are dropped.
4. Publish [the privacy notice](../PRIVACY.md) on the Steam store page before
   enabling the secrets. Keep its crash-reporting disclosure aligned with this
   runtime contract (canonical wording owned by [PRIVACY.md](../PRIVACY.md)).
5. Before relying on reporting for a public release, send a controlled test error
   from a packaged candidate and confirm the correct edition and release, a
   symbolicated stack trace, and the configured alert. Do not include player saves
   or account details in the test event. Retain the result with release evidence.

Release desktop builds create hidden source maps, upload them under the edition-specific [Sentry release name](./STEAM_DEMO.md#edition-contract), and delete them before
electron-builder assembles the application. All packages also exclude source maps, including builds without Sentry.
The packaging verifier inspects `app.asar` for maps and CI credentials.
Reporting failures and offline play never block startup, saves, gameplay, or quit.

Build version stamping (`src/lib/validation/metadata.generated.ts` via `npm run sync:version`) runs in the release pipeline; art authoring sources stay in [WORKFLOWS-ASSETS](./WORKFLOWS-ASSETS.md).

## Player notices and asset provenance

Before a public build can be promoted, review [PRIVACY.md](../PRIVACY.md) and
[THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md), the canonical provenance
register and owner confirmation. Follow its [release review](../THIRD_PARTY_NOTICES.md#release-review)
for changed sources, and retain the project's [license](../LICENSE.md) and
third-party font/software notices.

## Steam AI disclosure

When Steam ID verification permits page setup, complete the Content Survey with
**pre-generated AI content** and no live-generated AI, following the
[confirmed provenance](../THIRD_PARTY_NOTICES.md). Use concise, accurate wording,
for example:

> AI tools were used during development to create the game's artwork, music,
> sound effects, writing and localization. All AI content is pre-generated;
> the game does not generate AI content during gameplay.

Include AI-assisted localization in the survey when used. Valve's
[Content Survey](https://partner.steamgames.com/doc/gettingstarted/contentsurvey)
requires disclosure of shipped player-consumed AI content and adequate rights;
it does not require a public per-asset rights inventory. Keep the survey current
if shipped content or generation behavior changes. This draft is not a submitted
survey or an approved Steam listing.

## Windows signing readiness

Steam-only Windows releases default to unsigned depots; signing is not a release
prerequisite. Test the candidate through Steam on Windows 11 with Smart App Control
enabled under [physical acceptance](./STEAM_DEMO_CHECKLIST.md#physical-steam-acceptance-evidence).
Reconsider signing if that test or player reports identify a problem, or if direct
installer distribution is added. Signing does not guarantee reputation or prevent
all warnings. [Microsoft's guidance](https://learn.microsoft.com/windows/apps/package-and-deploy/smartscreen-reputation)
describes Smart App Control and reputation.

If signing is needed, create an Azure Trusted Signing account and
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

| Secret                                      | Purpose                                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `STEAM_APP_ID`                              | Full-game production Steam App ID                                                           |
| `STEAM_DEMO_APP_ID` / `STEAM_DEMO_DEPOT_ID` | Demo app and depot; distinct from full game                                                 |
| `STEAM_DEPOT_ID`                            | Primary content depot                                                                       |
| `STEAM_USERNAME` / `STEAM_PASSWORD`         | `steamcmd` upload                                                                           |
| `SENTRY_DSN`                                | Public packaged crash endpoint                                                              |
| `SENTRY_AUTH_TOKEN`                         | Source-map upload only                                                                      |
| `SENTRY_ORG` / `SENTRY_PROJECT`             | Source-map destination                                                                      |
| `AZURE_*` values above                      | Optional Azure Trusted Signing                                                              |
| `VERCEL_DEPLOY_HOOK_URL`                    | Release web QA deploy trigger (Vercel project Settings → Git → Deploy Hooks, `main` branch) |

## Steam Input default mapping (controller Playable)

Alchemy consumes mouse and keyboard events. It has no native gamepad polling,
controller settings, device glyphs, sensitivity settings, or rumble. Steam Input
can translate controller inputs into those events. The game-side behavior is
covered by automated controller-equivalent journeys; these do not test Steam's
translation, device drivers, or configuration delivery.

### Mapping specification

Use the same conceptual layout for Xbox, PlayStation, Steam Controller, and Deck,
with device-appropriate cursor controls. Physical button positions below avoid
confusing Xbox A with PlayStation Cross.

| Input                          | Output           | Purpose                                          |
| ------------------------------ | ---------------- | ------------------------------------------------ |
| Right stick / right trackpad   | Mouse movement   | Point and inspect                                |
| Right trigger                  | Left mouse click | Activate the pointed control                     |
| South face button              | Enter            | Activate the focused control                     |
| East face button / Menu / View | Escape           | Close the top eligible layer, back, or game menu |
| Left / right bumper            | F7 / Tab         | Previous / next focus                            |
| D-pad                          | Arrow keys       | Directional focus, sliders and dropdown options  |
| Left stick up/down             | Mouse wheel      | Scroll the pointed container                     |

F7 traverses backward through eligible controls within the active dialog or screen, avoiding Steam's Shift+Tab overlay shortcut.

D-pad arrows move focus between visible nearby controls within the active screen
or dialog. Left/right adjust horizontal sliders; up/down leave them. Dropdowns
and text fields retain their own arrow handling. Tabs and pagination remain normal buttons. Pointer activation and focused activation
are separate actions. Holding confirm does not repeatedly activate controls.

### Configuration and validation status

With authenticated Steam access, author/export recommended layouts for supported
controller types, publish their default assignments, and record actual configuration
IDs with the candidate's acceptance evidence. Follow
[Valve's developer setup](https://partner.steamgames.com/doc/features/steam_controller/getting_started_for_devs).
Pending publication and physical validation remain in the
[blocked release plan](./Plans/SteamDemo.md#outstanding-work).

[Physical acceptance](./STEAM_DEMO_CHECKLIST.md#physical-steam-acceptance-evidence)
owns device/service qualification and public support claims. Valve's
[compatibility review](https://partner.steamgames.com/doc/steamhardware/compat)
also evaluates display and performance.

### Automated game-side coverage

[Controller helpers](../tests/e2e/controller-input.ts) send actual keyboard and
pointer events; they never repair focus or call gameplay handlers. The
[E2E guide](../tests/e2e/README.md#controller-equivalent-input) owns journeys,
geometry checks and CI tiers. Local controller-equivalent checks need no Steam
login, controllers or virtual-device driver.

Revalidate this mapping when adding drag-only actions, text entry, nonstandard
interaction primitives or changing Escape ordering. Published mapping changes
also require [physical Steam acceptance](./STEAM_DEMO_CHECKLIST.md#physical-steam-acceptance-evidence).

## Steam listing baseline (Windows)

These are the current player-facing store assumptions, not values derived from
Electron configuration. Revalidate them on representative minimum-spec
hardware before changing the Steam listing or promoting a public build.

- Windows 10/11 64-bit
- 4 GB RAM
- DirectX 11 GPU
- ~500 MB disk

## Demo setup

Follow [Steam demo](./STEAM_DEMO.md) for shared Cloud configuration, edition-specific save files, metadata, output directories, and additional hardware release evidence. Both editions require App IDs and depots before release CI packaging/upload.
