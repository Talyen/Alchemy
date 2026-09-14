# Active agent friction

Read only when the current task encounters a related failure or surprise. Current procedures belong in canonical owners, not this log.

Record unresolved recurring friction and consequential lessons with the observation and next useful action. Corrected typos, one-off environment issues, and self-explanatory fixes need no entry. When resolving an existing entry, preserve its useful evidence in [history](./history/README.md) and link reusable prevention in the canonical owner. Preserve existing history; do not create a record solely to log routine maintenance or reread resolved history routinely.

## Open

- 2026-09-10 — A newly written `combat-feedback-sounds.test.ts` was absent from an unrestricted `git status --short` despite not being ignored or tracked; targeted `git status --short --untracked-files=all -- <path>` then found it. Both `core.fsmonitor` and `core.untrackedCache` were enabled. When a newly created test is missing from changed-path discovery, verify with a targeted status or disable fsmonitor for that diagnostic command before selecting verification paths.

- 2026-09-10 — Image generation with approved transparent icons as references baked checkerboards into five opaque PNGs; background-only image edits repeated the issue. Fresh generations without image references produced real alpha for all five. Validate PNG alpha before asset import; if this recurs, isolate reference-image handling rather than accepting the visible checkerboard as evidence of transparency.

- 2026-09-07 — The audio browser route in development mode timed out both tests during startup (`playwright-20260907t212948z-88179-403a0c`, snapshot remained Loading). The freshly built preview passed both tests (`playwright-20260907t213143z-89849-1adaa1`); the multi-page music journey uses a 60-second overall budget. If development-mode startup repeats, inspect cold Vite loading before changing playback behavior.

- 2026-09-06 — Broad combat-feedback verification twice timed out the 5-second affix sweep in `tests/lib/balance/report-sweeps.test.ts`; the exact file passed in a focused run (alongside both combat-feedback unit files). Latest failed run: `check-20260906t230621z-43224-30899b`. Check suite contention before changing the test or its timeout.

- 2026-09-14 — `tests/e2e/specs/contiguous-run.spec.ts` fails identically (a passing `handCount` poll followed ~170ms later by a zero single-read, Victory screen at teardown, no console/page errors) on unrelated mains (`34735747719`, `34737987106`, `34798101391`) while unit, build, and lint stay green. If it recurs, re-poll the read instead of single-reading and trace the opening deal/remount timing before touching battle behavior.

## Resolved history

[September 2026](./history/friction-2026-09.md). All previous resolved entries are preserved there.
