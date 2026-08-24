# Alchemy privacy notice

Alchemy stores game progress and settings locally on the player’s device. The
desktop build may mirror saves to Steam Cloud when that service is available.
Alchemy does not operate an account system or deliberately attach Steam
identity to diagnostic reports.

## Local and cloud saves

Browser saves use local browser storage. Desktop saves use local files and may
be mirrored to Steam Cloud. Save data contains gameplay progress, settings,
decks, unlocks, and run state. Save handling, recovery order, and deletion are
described in the in-game save controls and the project’s save contract.

Deleting local data through Alchemy’s clear-save or protected-save controls
removes the candidates those controls identify. Steam may independently retain
cloud or platform records under its own policies.

## Optional crash reporting

Packaged production desktop builds may enable Sentry crash reporting. Browser
development, tests, and ordinary local packages do not send these reports.
When enabled, reports can include the game version, operating system, Electron
version, crash location, current screen label, and diagnostic context collected
by Sentry’s Electron SDK.

Alchemy configures Sentry with `sendDefaultPii: false`, disables performance
tracing and continuous logs, and does not deliberately attach Steam identity or
save data. Reports are processed and retained according to the configured
Sentry project and Sentry’s privacy terms. Crash-reporting failure never blocks
offline play, startup, saves, gameplay, or quit.

## Third-party services

- Steam provides distribution, platform services, and optional Steam Cloud.
- Sentry processes crash reports only when crash reporting is enabled in a
  packaged production build.
- The web build may be delivered through Vercel; ordinary web-hosting access
  logs are governed by the deployed service configuration.

Those providers process information under their own privacy policies.

## Questions and updates

Privacy questions should be sent through the official Alchemy support contact
listed on its Steam store page or repository. Material changes to collection or
service use require this notice and the store disclosure to be updated before
the changed build is promoted.
