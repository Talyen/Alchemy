---
status: complete
updated: 2026-09-07
---

# Responsive pagination: consistent browsing with less duplicated state

## Objective

Approved and implemented on 2026-09-07.

Make Collection, Armory, and card-picker pagination retain a valid browsing position through resizing and list changes. Consolidate the shared arithmetic and state transitions without creating a configurable grid framework or changing game rules.

## Selection and investigation

A simple JavaScript random draw selected shared UI. The candidate list was battle, card, UI, audio, tooltip, gear, rewards, shop, save, run-state, assets, and tooling. `Math.random()` returned `0.1816765994990155`; multiplying by 12 and flooring selected index 2, UI. Investigation narrowed to pagination once substantial improvements emerged; broader exploration stopped.

Existing uncommitted changes were inspected and left intact. In particular, the Alchemist's Shop already has unrelated edits, so implementation must preserve those and avoid unnecessary changes to its caller.

## Findings and evidence

### 1. Collection maintains conflicting page state

[CollectionScreen](../../../src/features/alchemy/meta/screens/collection-screen.tsx) copies the supplied page into local state. Resizing updates only that local copy. Returning to a tab restores the older supplied page, and changes to the supplied page on the active tab are ignored unless the tab or page size also changes.

A read-only Node diagnostic transpiled the actual component and exercised its render-time state transitions with a minimal state harness and mocked grid measurements. With 40 entries, zero-based page 2, and eight entries per page:

- Increasing capacity to ten entries correctly moves the display to page 1, retaining the previous first entry.
- Switching to another tab and back restores page 2, losing that browsing position.
- Supplying page 0 while the tab stays active still displays page 2.
- None of those transitions calls the supplied page-change callback.

The resize behavior was introduced in commit `9f4ee909`; previously the displayed page was derived directly from the supplied page. The [UI owner](../../UI.md) explicitly requires resizing to retain the selected or first visible item. These are source-level reproductions, not browser verification.

### 2. Bounds are applied to output but not retained state

[usePaginatedRows](../../../src/features/alchemy/shared/ui/use-paginated-rows.ts) clamps only the returned page. The same diagnostic reproduced page 2 becoming page 0 after a 30-entry list shrinks to ten, then unexpectedly returning to page 2 when the list grows again. Armory and card selection use the same output-only clamping pattern.

The arithmetic also leaves negative pages negative. A zero page size produces `NaN` for an empty list. The latter is a reachable input shape because [CardChoicePicker](../../../src/features/alchemy/run-loop/screens/mystery/mystery-deck-pickers.tsx) supplies `choices.length` as page size; investigation did not establish that current game content presents an empty choice list. Treat this as boundary robustness, not a confirmed live encounter bug.

### 3. Parallel implementations obscure the intended rules

[CardSelectionGrid](../../../src/features/alchemy/shared/ui/card-selection-grid.tsx), Collection, [Armory's picker](../../../src/features/alchemy/meta/screens/armory/paged-picker-grid.tsx), and the fixed-size pagination hook independently combine page state, page counts, clamping, resetting, and slicing. Their policies differ legitimately, but their basic transitions should not drift independently.

Existing Collection tests cover initial rendering, tab callbacks, and page-button callbacks. Pagination-hook tests cover reset-key changes and unchanged rerenders. Capacity tests exercise individual calculations. They do not protect the reproduced transition sequences.

## Plan

- [x] Recheck the dirty checkout and capture the reproduced cases as failing regression tests before changing behavior.
- [x] Establish one small, pure pagination owner for page counts, bounded page selection, and resize anchoring. Reuse the existing `anchoredPage` and slicing logic where practical. Empty collections have page 0 and one logical page; nonpositive capacity is normalized to a usable minimum. Keep dimension measurement separate from page policy.
- [x] Make the fixed-size hook retain its clamped page so removed pages cannot silently reappear. Preserve its existing reset-key semantics and setter behavior.
- [x] Apply the same bounded transition rules to Armory. Preserve resetting on picker-context changes and prioritizing the selected entry during resize.
- [x] Repair Collection's state ownership: honor parent page changes, and publish a changed effective page after resizing or clamping through the existing callback. Do this after commit, never during render; suppress unchanged notifications and test for feedback loops. Retain per-tab page memory and the existing profile representation. Account for tabs with different measured capacities without publishing intermediate stale measurements.
- [x] Apply the same parent/display synchronization to card selection while preserving selected-entry anchoring, original deck indices, fixed offered-choice counts, and the one/two-row height behavior. Keep existing screen props where possible. Extract a shared hook only for identical state ownership; retain explicit screen policy rather than accumulating configuration switches. If a cross-feature contract must change, follow the architect workflow before implementing it.
- [x] Remove duplicated calculations and obsolete wrappers made unnecessary by the new owner. Update the pagination paragraph in the UI owner with the chosen reset, clamping, and callback rules.
- [x] Run focused tests, targeted browser verification, and the complete path-scoped handoff gate. Review the resulting diff against this plan and preserve all unrelated work.

## Verification and acceptance

- Pure tests: empty and partial pages, lower/upper bounds, zero capacity, selection anchoring, and a capacity change that clamps the last page.
- Hook tests: shrink then grow, reset-key change, ordinary rerender, and explicit page navigation after clamping.
- Collection component tests: resize then tab round-trip, active-tab parent update, portrait/landscape capacity changes, and exactly-once notifications without update loops.
- Card-grid and Armory tests: selected entry remains visible after resize, filtered card indices retain their action identity, context changes reset as before, and fixed offered choices remain available.
- Keep arithmetic tests lightweight and put transition coverage at the owning hook/component. Do not multiply full-screen fixtures for every numeric edge case or introduce timing benchmarks without evidence of a performance problem.
- After implementation, use the repository browser workflow to check Collection tab switching and resizing plus a card-removal grid at one-row and two-row heights. Verify visible entries, selection, pagination controls, and console errors.
- Run `npm run check -- <all task-owned paths>` with explicit paths because this checkout contains unrelated edits. It selects applicable tests, static checks, build, and preview checks. Implementation verification results are recorded below.

## Approval scope and limits

Approval authorizes the listed browsing corrections, including retaining the clamped page after a list grows again and remembering the resized page through the existing Collection callback. These are player-visible navigation fixes. Costs, rewards, card effects, offered-choice counts, selection/confirmation rules, artwork dimensions, and save formats remain outside this proposal. No tech-stack change or new dependency is justified by the findings.

The main implementation risk is callback feedback or transient page updates during responsive measurement. Transition tests must settle that before handoff. Collection currently remembers numeric pages, not durable item identities; retaining the exact same item across a fresh mount with a different viewport would require a separate product/storage decision and is outside this plan.

Stop and obtain explicit approval before any additional change that significantly alters player-visible behavior or game design. Do not broaden the investigation into other UI systems.

## Notes

Implementation is complete. Shared arithmetic and page transitions replace duplicate screen logic; measured width and scale prevent intermediate capacity errors when artwork shape changes. Removed the redundant Armory slicing/filler wrappers and their duplicate tests. Updated the UI owner and resolved-friction history.

Verification:

- Regression tests first reproduced Collection synchronization failures, stale-page regrowth, and invalid pagination bounds.
- Targeted hook and component tests pass, including callback deduplication under StrictMode, selected filtered-card identity, fixed choices, list regrowth, and portrait/landscape capacity transitions.
- Four focused Chromium checks passed against development source: Collection resize/tab round trips and three card-removal layouts covering one and two rows. Runtime-error collectors were clean. Reviewed the Collection screenshot and a separate agent-browser load screenshot; menu controls rendered and no browser errors or Vite error overlay were found. The task-owned browser session was closed.
- `check-20260907t184724z-15500-82ba27` passed explicit task-path verification: related and changed unit tests, documentation checks, CI static checks, web build, and preview smoke. An initial test matcher typing error was corrected before the passing run.

No game-design or save-format changes, new dependencies, or unresolved implementation decisions. Existing unrelated edits were preserved.

Final documentation validation passed its documentation contracts but rejected the unrelated, then-active [OverlayLifecycle](./OverlayLifecycle.md) plan. That plan belongs to another task and was left unchanged. This pagination plan is complete and archived.
