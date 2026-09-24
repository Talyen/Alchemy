# Alchemy privacy notice

Effective: September 1, 2026

Alchemy stores game progress and settings locally on the player’s device. The
desktop build may mirror saves to Steam Cloud when that service is available.
Alchemy does not operate an account system or deliberately attach Steam
identity to diagnostic reports.

## Local and cloud saves

Browser saves use local browser storage. Desktop saves use local files and may
be mirrored to Steam Cloud. Save data contains gameplay progress, settings,
decks, unlocks, and run state. The [save contract](./src/features/alchemy/shared/storage/MIGRATIONS.md#public-save-contract)
describes technical recovery and deletion behavior.

Options offers **Clear Save Data** to remove local save data and start fresh.
On desktop, Alchemy also attempts to delete its Steam Cloud save copies;
a failed Cloud deletion may leave a copy there. Device-local Game Size and
Tooltip Size preferences remain until Reset to Default is used.

## Crash reporting

Packaged production desktop builds may be configured with Sentry crash
reporting. When a distributed build includes that configuration, reporting is
automatic rather than a player-controlled option. Browser development, tests,
and ordinary local packages do not send these reports. Reports can include the
game version, operating system, Electron version, crash location, current
screen label, and diagnostic context collected by Sentry’s Electron SDK.

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

Privacy questions can be submitted through the
[Alchemy repository issue tracker](https://github.com/Talyen/Alchemy/issues) or
the support contact on its Steam store page. Material changes to collection or
service use require this notice and the store disclosure to be updated before
the changed build is promoted.
