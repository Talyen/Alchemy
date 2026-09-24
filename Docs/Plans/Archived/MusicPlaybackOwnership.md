---
status: complete
updated: 2026-09-24
---

# Music playback ownership

Shared audio state previously exposed a requested music key separately from the outgoing media element, allowing fades, invalidation, and pause to disagree. `music.ts` now owns cached track records and a typed playback lifecycle; each fade owns its timer. Volume changes synchronize through that owner rather than shared media pointers.

The catalog, seeking, fades, previews, host muting, and public audio facade remain intact. Focused music and volume suites passed 32 tests; the task-scoped check passed static checks, web build, bundle budget, and preview smoke. No live listening or full browser journey was recorded.

Implementation: `ff9299be`. Current owner: [Audio runtime contract](../../AUDIO.md#runtime-contract).
