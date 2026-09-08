# Active agent friction

Read only when the current task encounters a related failure or surprise. Current procedures belong in canonical owners, not this log.

Add one short row for unresolved friction with the observation and next useful action. When fixed, move the evidence to the current month's file in [history](./history/README.md), link the canonical prevention or explain why it was a one-off, and remove the active row. Do not reread resolved history routinely.

## Open

- 2026-09-07 — `cardHasKeyword` checks damage types and explicit tags, while `getCardKeywords` also derives utility keywords such as Companion from Pack Tactics. Using the former for Whistle left the regression failing. Companion perks now use content keywords; clarify the helper naming or classification documentation before extending other utility-keyword perks.

- 2026-09-07 — The audio browser route in development mode timed out both tests during startup (`playwright-20260907t212948z-88179-403a0c`, snapshot remained Loading). The freshly built preview passed both tests (`playwright-20260907t213143z-89849-1adaa1`); the multi-page music journey uses a 60-second overall budget. If development-mode startup repeats, inspect cold Vite loading before changing playback behavior.

- 2026-09-06 — Broad combat-feedback verification twice timed out the 5-second affix sweep in `tests/lib/balance/report-sweeps.test.ts`; the exact file passed in a focused run (alongside both combat-feedback unit files). Latest failed run: `check-20260906t230621z-43224-30899b`. Check suite contention before changing the test or its timeout.

- 2026-09-07 — A manual Labyrinth browser session on a separate Vite port reloaded when Playwright rewrote `playwright-report/*.html`; Vite logged those files as page-reload triggers, resetting the temporary inspector selection. Consider excluding generated browser reports from the development watcher before debugging similar apparent selection resets.

## Resolved history

[September 2026](./history/friction-2026-09.md). All previous resolved entries are preserved there.

- Corruption expansion: `normalize-active-run-data.ts`’s offer-repair serializer used a truthy Consume check, unlike the explicit-override hydration contract. Preserve `false` as well as `true`; the canonical rule is in `shared/storage/MIGRATIONS.md`.
