# Release setup and pre-promotion gates

One-time shipping setup for Alchemy plus recurring gates before public promotion: crash reporting, provenance, signing, secrets, and listing baseline. Active release flow stays in [RELEASE.md](./RELEASE.md). Coding rules: [AGENTS.md](../AGENTS.md).

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

| Secret                              | Purpose                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------- |
| `STEAM_APP_ID`                      | Production Steam App ID                                                                     |
| `STEAM_DEPOT_ID`                    | Primary content depot                                                                       |
| `STEAM_USERNAME` / `STEAM_PASSWORD` | `steamcmd` upload                                                                           |
| `SENTRY_DSN`                        | Public packaged crash endpoint                                                              |
| `SENTRY_AUTH_TOKEN`                 | Source-map upload only                                                                      |
| `SENTRY_ORG` / `SENTRY_PROJECT`     | Source-map destination                                                                      |
| `AZURE_*` values above              | Optional Azure Trusted Signing                                                              |
| `VERCEL_DEPLOY_HOOK_URL`            | Release web QA deploy trigger (Vercel project Settings → Git → Deploy Hooks, `main` branch) |

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
| Left / right bumper            | Shift+Tab / Tab  | Previous / next focus                            |
| D-pad                          | Arrow keys       | Sliders and dropdown options                     |
| Left stick up/down             | Mouse wheel      | Scroll the pointed container                     |

D-pad arrows do not implement spatial navigation across ordinary buttons. Tabs
and pagination remain normal buttons. Pointer activation and focused activation
are separate actions. Holding confirm does not repeatedly activate controls.

### Configuration and validation status

The mappings above are a specification, not published Steam configurations.
No exported configuration IDs or live default assignments have been verified in
this checkout. With authenticated Steam access, author/export recommended layouts
for the supported controller types, publish their default assignments, and record
real identifiers and validation evidence here. Never invent identifiers or infer
publication from passing browser tests. Consult
[Valve's developer setup](https://partner.steamgames.com/doc/features/steam_controller/getting_started_for_devs).

Until actual runtime/configuration evidence exists, do not claim full controller
support, native PlayStation support, or a Steam Deck Playable/Verified rating from
these tests. Valve's formal rating also evaluates runtime, display, and performance;
see [compatibility review](https://partner.steamgames.com/doc/steamhardware/compat).
The Windows build's behavior under Proton and Deck suspend/resume remain unverified.

### Automated game-side coverage

[Controller input helpers](../tests/e2e/controller-input.ts) send actual Playwright
keyboard and mouse input. They never repair focus or invoke gameplay handlers.
Representative journeys cover menu-to-battle, consecutive plays, End Turn,
victory/rewards/destinations, dialogs, Options selects, secondary screens, and
cursor scrolling. Focus traversal is bounded and reports cycles. Chromium and
Electron share the Options journey. Existing display and inspection suites cover
1280×720 and 1280×800; screenshots go to ignored `reports/controller-support/`.
These checks need no controllers, Steam login, or virtual-device drivers.

Use the existing critical, nightly/full, and desktop CI tiers described in
[CONTRIBUTING](../CONTRIBUTING.md#e2e-policy). Revalidate the mapping specification
when adding drag-only actions, text entry, new nonstandard interaction primitives,
or changing Escape ordering. Changes to published mappings need separate Steam
validation; physical-device comfort and Deck performance cannot be inferred from
browser input or workstation FPS.

## Steam listing baseline (Windows)

These are the current player-facing store assumptions, not values derived from
Electron configuration. Revalidate them on representative minimum-spec
hardware before changing the Steam listing or promoting a public build.

- Windows 10/11 64-bit
- 4 GB RAM
- DirectX 11 GPU
- ~500 MB disk
