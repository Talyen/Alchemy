# Release one-time setup

One-time shipping setup for Alchemy: crash reporting, provenance, signing, secrets, and listing baseline. Active release flow stays in [RELEASE.md](./RELEASE.md). Coding rules: [AGENTS.md](../AGENTS.md).

Revalidate these sections only when rotating credentials, changing the listing, or preparing the first public release. They go stale once configured.

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
electron-builder assembles the application. The packaging verifier checks that maps and CI credentials are absent.
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

## Steam listing baseline (Windows)

These are the current player-facing store assumptions, not values derived from
Electron configuration. Revalidate them on representative minimum-spec
hardware before changing the Steam listing or promoting a public build.

- Windows 10/11 64-bit
- 4 GB RAM
- DirectX 11 GPU
- ~500 MB disk
