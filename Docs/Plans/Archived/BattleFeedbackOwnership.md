---
status: complete
updated: 2026-09-21
---

# Battle feedback ownership

The presentation store combines hand/snapshot state with combat feedback rules,
module-global timer groups, identity counters, and reset bookkeeping. Feedback
cannot be constructed independently, and adding a timed effect requires changing
several distant parts of the store. This is a concrete ownership problem rather
than a reason to replace Zustand or redesign gameplay.

## Plan

1. Define feedback state and actions together under a dedicated feedback owner.
   Keep the existing presentation store API and subscriptions compatible.
2. Extract pure action-batch preparation (copying, ordering, zero filtering,
   burst formatting, strongest impact). Reuse the existing cross-action merger.
3. Construct a feedback lifetime per store, owning timers, identities, shakes,
   telegraphs, and cancellation. Inject battle visibility and clock reads at the
   composition seam. Reset feedback atomically with the other presentation state.
4. Preserve existing behavior tests and add focused lifetime-isolation coverage.
   Update the battle-controller ownership documentation, review the diff, and run
   the task-scoped completion gate.

## Constraints

No gameplay, save, motion timing, or public controller changes. Preserve original
burst expiry, Companion-to-player telegraphs, impact priorities, and reset hooks.
Do not change the pre-existing Armory, audio, or save work in this checkout.

## Outcome

Implemented the feedback owner and pure preparation model, keeping the existing
store API. All feedback resources and the ghost identity counter are now scoped
to store construction. Full reset publishes fresh state after cancellation.
Synchronous subscriber resets no longer leave newly scheduled feedback timers.

The existing presentation tests pass unchanged. Added three tests for independent
lifetimes, text-only cancellation, and reset during publication; the focused run
passed all 32 tests. No tests were retired. The task-scoped completion gate is the
final handoff check; see the task response for its result.
