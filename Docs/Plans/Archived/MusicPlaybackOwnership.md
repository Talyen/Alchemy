---
status: complete
updated: 2026-09-21
---

# Music playback ownership

## Diagnosis and scope

A short architecture inspection found a concrete ownership problem in music playback:
`audioState.currentMusicKey` becomes the requested destination before
`audioState.currentMusic` stops playing the outgoing track. Cache invalidation,
volume updates, timer cancellation, and test fixtures must reconcile these
independently writable representations. Pausing during a switch retains the
pending destination without retaining its timer; invalidating a destination can
leave a timer that resurrects it.

The existing Armory and save-storage changes are outside this task. This is a
focused improvement, not a repository-wide ranking or audit.

## Plan

1. Make `music.ts` the sole owner of cached track records and playback lifecycle.
   Each track binds its key, element, and fade gain. Use an explicit playback
   union for idle, paused, playing, fading in, and fading out; only fading out
   has a pending destination. A transition owns its timer and stale callbacks
   cannot act after cancellation.
2. Replace shared element access from volume controls with a music settings
   synchronization operation. Remove music pointers from shared audio state.
3. Preserve catalog, caching, seek positions, fade curves, previews, unknown-key
   handling, and host muting. Make pause/resume and invalidation cancel relevant
   work coherently, including invalidation during a switch.
4. Test observable media behavior through the existing fake Audio boundary,
   removing fixtures that inject foreign elements into runtime state. Cover
   interruption, pause/resume, and invalidation races. Keep pure volume coverage.
5. Update the audio ownership contract, run scoped completion checks, review the
   final diff, and archive this plan with results.

## Validation

Completed all five steps. Music owns a typed playback lifecycle and each fade
owns its timer; shared audio state no longer exposes media pointers. Settings
updates use `syncMusicSettings()`. Regression tests cover pending-destination
invalidation, outgoing-track invalidation, interrupted fades, and pause/resume.
Existing catalog, seek, host, preview, and volume protection remains. Redundant
arbitrary-element volume tests were consolidated into pure curve and real
playback integration checks; pointer-injection fixtures were removed.

Task-scoped `npm run check` passed (run
`check-20260921t210015z-23702-170005`): changed and dependency-related unit
tests, CI static checks, web build, bundle budget, and preview smoke. The focused
music and volume suites passed 32 tests. No live listening or full browser
journey was run. Existing Armory and save-storage work was preserved.
