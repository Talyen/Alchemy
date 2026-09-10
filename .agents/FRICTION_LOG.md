# Active agent friction

Read only when the current task encounters a related failure or surprise. Current procedures belong in canonical owners, not this log.

Add one short row for unresolved friction with the observation and next useful action. When fixed, move the evidence to the current month's file in [history](./history/README.md), link the canonical prevention or explain why it was a one-off, and remove the active row. Do not reread resolved history routinely.

## Open

- 2026-09-07 — The audio browser route in development mode timed out both tests during startup (`playwright-20260907t212948z-88179-403a0c`, snapshot remained Loading). The freshly built preview passed both tests (`playwright-20260907t213143z-89849-1adaa1`); the multi-page music journey uses a 60-second overall budget. If development-mode startup repeats, inspect cold Vite loading before changing playback behavior.

- 2026-09-06 — Broad combat-feedback verification twice timed out the 5-second affix sweep in `tests/lib/balance/report-sweeps.test.ts`; the exact file passed in a focused run (alongside both combat-feedback unit files). Latest failed run: `check-20260906t230621z-43224-30899b`. Check suite contention before changing the test or its timeout.

- 2026-09-07 — A manual Labyrinth browser session on a separate Vite port reloaded when Playwright rewrote `playwright-report/*.html`; Vite logged those files as page-reload triggers, resetting the temporary inspector selection. Consider excluding generated browser reports from the development watcher before debugging similar apparent selection resets.

## Resolved history

[September 2026](./history/friction-2026-09.md). All previous resolved entries are preserved there.

- Corruption expansion: `normalize-active-run-data.ts`’s offer-repair serializer used a truthy Consume check, unlike the explicit-override hydration contract. Preserve `false` as well as `true`; the canonical rule is in `shared/storage/MIGRATIONS.md`.

- 2026-09-08: `cardHasKeyword` in battle classification checks damage types and explicit tags, so it cannot identify untagged summon/Companion-buff cards. Whistle must use the full `getCardKeywords` query, as documented in GAME_RULES’ Companion card perks. Separately authored delayed card amounts also exposed an assumption in numeric upgrades that every matching delayed effect shared the immediate description number; numeric targets now retain scheduled effect paths.

- 2026-09-08: Changed-unit verification selected deleted test paths, causing Vitest to fail an otherwise valid retirement with no matching files. Selection now skips absent unit files while preserving changed paths and risk escalations; CONTRIBUTING documents selecting surviving coverage when consolidating.

- 2026-09-08: A six-worker development-mode layout batch timed out across simple startup and layout checks with GPU-stall warnings (`playwright-20260908t164214z-12124-6dfda6`); the unchanged 4K check passed with one worker. The E2E focused-check guide now calls for serial isolation before changing assertions or timeouts under this symptom.

- 2026-09-08: Removing immer `current()` snapshot-diffing in `mutateGearWithRunHealthSync` broke `gear-combat-restrictions.test.ts` ("without touching state"): on an unmodified draft `current()` returns the same base reference, so the `!==` guard skips `rebindLiveRunMeta` and preserves root identity for blocked gear commands. Do not replace it with an unconditional rebind; the guard is the no-op path. Similarly, the exhaustive `Screen` switch in `encodePersistedShops` is enforced by `tests/architecture/exhaustive-switch-coverage.test.ts` — do not collapse it to ifs; new screens must enumerate explicitly.
