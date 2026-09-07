---
status: complete
updated: 2026-09-07
---

# Consistent overlay interaction during opening and closing

## Objective

Approved by the user and implemented. All implementation and handoff checks passed.

Make hidden and closing overlays stop accepting input consistently, while preserving their existing exit animations. Keep this responsibility in the existing shared overlay shell rather than distributing mouse, keyboard, and Escape guards among its callers.

This is a targeted interaction bug fix and consolidation, with no proposed changes to combat, balance, rewards, saves, or navigation destinations.

## Selection and investigation boundary

Selected shared UI using a simple JavaScript random draw:

```js
const sections = [
  "battle",
  "card",
  "ui",
  "audio",
  "tooltip",
  "gear",
  "rewards",
  "shop",
  "save",
  "run-state",
  "assets",
  "browser",
  "tooling",
];
const index = Math.floor(Math.random() * sections.length);
console.log({ index, selected: sections[index] });
```

The observed index was `2`, selecting `ui`. These are the repository context tool's task categories. Investigation narrowed to shared overlays, their consumers, the Escape stack, fade styles, and nearest tests. Broad exploration stopped after identifying the lifecycle inconsistencies below.

## Findings and evidence

### 1. Closing menus still accept keyboard actions

The shared [overlay shell](../../../src/features/alchemy/shared/ui/modal-overlay-shell.tsx) retains its children while [fade presence](../../../src/features/alchemy/shared/ui/use-fade.tsx) completes the exit animation. The `screen-fade-out` rule in [component styles](../../../src/styles/components.css) disables pointer events, which does not disable keyboard activation or remove buttons from keyboard navigation.

[GameMenu](../../../src/features/alchemy/shared/ui/game-menu.tsx) adds another pointer-only guard when closed, but its menu item callbacks remain live. A temporary diagnostic rendered the menu, focused Main Menu, rerendered it with `isOpen={false}`, and pressed Enter before unmount. The Main Menu callback ran once during exit. This demonstrates a real component-level input path; a full browser journey was not run during planning.

Impact: a dismissed menu can still perform navigation during its default 180 ms fade. Boon inspection also retains enabled controls through the same shell, so regression coverage should include its close and pagination controls. No repeated destructive action or lost save was demonstrated.

### 2. An invisible overlay can intercept Escape

The shell registers its Escape handler before returning `null` for `mount={false}`. Handler activation checks fade presence but omits the content mount gate.

A temporary diagnostic rendered `open={true}` with `mount={false}` and registered an underlying, lower-priority Escape handler. The DOM was empty, but pressing Escape invoked the invisible overlay's close callback and prevented the underlying handler from running.

[Boon inspection](../../../src/features/alchemy/run-loop/screens/battle-screen/boon-inspect.tsx) is the current consumer of this gate: it suppresses rendering when no Boons resolve. This confirms a violated shared-component contract; normal gameplay reachability of an open, empty Boon panel was not established. Focused history confirms that `mount=false` was introduced to unmount immediately, including during a fade.

### 3. One lifecycle responsibility is split among callers

The shell handles fade presence and Escape; CSS handles pointer suppression; GameMenu adds its own pointer suppression; [confirmation dialogs](../../../src/features/alchemy/shared/ui/dialogs.tsx) disable their action buttons on close. [Wish](../../../src/features/alchemy/run-loop/screens/battle-screen/wish-overlay.tsx) separately prevents duplicate selection while resolving.

These mechanisms serve different purposes, but there is no common guarantee that a shell retained solely for animation is noninteractive. Consolidate that guarantee in the shell. Keep Wish's selection latch because it also protects the period before its parent closes the overlay, and keep confirmation buttons' explicit disabled state.

## Proposed behavior for approval

- An open, rendered overlay keeps its current mouse, keyboard, and Escape behavior.
- Once closed, the outgoing visual remains for the existing fade duration but cannot activate actions or participate in keyboard navigation.
- An overlay suppressed by `mount=false` renders nothing and registers no Escape handler.
- Existing Escape priorities and fall-through during exit remain unchanged. Wish continues to require a selection and consume Escape while open; its no-op close callback must not be mistaken for dead code.
- Confirmation dialogs still initially focus Cancel, contain focus while open, and restore focus to the existing return target on removal. Do not extend focus trapping or restoration to other overlays.
- Closing and immediately reopening an overlay cancels its pending removal and makes the reopened content interactive again.

These are limited player-visible interaction corrections. Approval of this plan authorizes them. Any newly discovered need to change gameplay decisions, dismissal policy, or significant player-visible behavior requires separate explicit approval.

## Plan

- [x] Record baseline, reproduce the two failures, inspect consumers and relevant history.
- [x] After approval, recheck status and current diffs; preserve concurrent work, especially the separate responsive pagination plan and existing Boon pagination behavior.
- [x] In the existing overlay shell, distinguish retained visual presence from current interaction eligibility. Base eligibility on the current open state and content mount gate, with rendered presence where needed; do not rely on an effect-updated fade phase to decide whether input is allowed.
- [x] Gate Escape registration with that same eligibility. Keep the current mount gate's immediate removal semantics and the current Escape priority contract.
- [x] Make retained exit content inert using the native `inert` attribute already used elsewhere in the app. Add a small shell-level activation guard if needed to reject clicks dispatched to a previously focused descendant during close. Verify keyboard and pointer behavior instead of relying only on CSS or DOM attribute assertions. Avoid a new overlay manager, provider, library, or generalized state machine.
- [x] Remove GameMenu's redundant closed-state pointer class once the shell owns the invariant. Preserve layout anchoring and held content throughout the fade. Keep domain-specific guards such as Wish's resolving latch.
- [x] Check confirmation focus containment against the inert exit subtree. Keep Cancel focus and existing restoration behavior; if coordination needs adjustment, keep it local to the confirmation panel and dialog. Ensure it cannot repeatedly redirect focus into disabled or inert exit controls.
- [x] Add focused lifecycle regression tests and the small browser check described below.
- [x] Document the open/closing/hidden input contract in [UI](../../UI.md), alongside existing modal and fade ownership. Resolve the associated friction entry after implementation.
- [x] Run path-scoped verification for every task-owned implementation, test, and documentation file. Review surrounding behavior and diff before handoff.
- [x] Once implementation is approved and complete, mark this plan complete and archive it using the documented plan workflow. Leave this plan active while awaiting approval.

## Coverage and acceptance criteria

Use small shared-shell tests for lifecycle combinations; do not multiply the full matrix across every screen.

1. `open=false` initially renders no overlay and does not intercept Escape.
2. `open=true, mount=false` renders nothing and lets the underlying Escape handler run. Toggling `mount` while open registers and removes the handler correctly.
3. Open content accepts its normal actions. On close, content remains for the fade but actions stop immediately; after the timer, it unmounts.
4. A focused GameMenu action cannot navigate when Enter or Space is pressed during exit. Boon close and pagination controls likewise cannot act after close.
5. Reopening before the exit timer fires restores interaction and prevents a stale timer from removing the panel.
6. Confirmation Cancel focus, Tab containment while open, disabled exit actions, and return focus remain correct. Test both the explicit return target used by Armory and the previously focused element fallback.
7. Existing Wish single-selection behavior and its Escape suppression remain intact.

Use controlled timers for pure fade tests and the repository's established timer helpers. The temporary menu diagnostic initially timed out with fake timers and asynchronous user-event calls; it passed with real timers. Do not lengthen timeouts to hide this harness issue.

Because DOM emulation does not establish native browser `inert` behavior, verify one actual closing-menu keyboard interaction in the browser, plus confirmation focus restoration. Follow the repository browser skill when implementing that coverage; prefer extending an existing relevant test over creating a broad new journey suite.

Run the nearest shell, fade, GameMenu, confirmation, Boon, Wish, and Escape-stack tests, then use `npm run check -- <all task-owned paths>` for the required implementation gate.

## Baseline validation

- Six existing test files passed: GameMenu, confirmation dialog, fade helpers, Boon inspection, Wish overlay, and Escape stack; 29 tests total.
- Both temporary reproduction tests passed when asserting the current incorrect behavior. The diagnostic file was removed after investigation; implementation should add permanent tests asserting the corrected behavior.
- No application code changes were retained, and no browser verification was performed during this investigation.

## Scope and risks

Expected production changes are concentrated in the overlay shell, GameMenu, and only if necessary the confirmation dialog/panel. Tests and the UI owner documentation complete the change. The fade helpers and Escape stack should retain their existing public contracts unless regression evidence requires a correction.

The main integration risk is confirmation focus handling during the retained exit. Native inert behavior needs browser validation. A secondary risk is accidentally weakening Wish's deliberate non-dismissal behavior. These are addressed explicitly in the acceptance criteria.

No new dependency, rendering framework change, broad UI redesign, balance adjustment, or performance claim is justified by these findings. The payoff is consistent interaction and less duplicated lifecycle handling.

## Notes

Durable policy belongs in the UI owner. Existing checkout edits belong to other work and must be preserved.

## Completion results

- The existing overlay shell now derives input eligibility from open state, content mounting, and rendered presence. Exit content is inert and rejects stale click/keyboard activation. Hidden content does not register Escape handling.
- GameMenu no longer carries a separate exit pointer guard. Confirmation focus containment pauses for inert content without changing its return target or restoration timing.
- All 35 focused component tests passed across seven files. Three focused browser cases passed: closing-menu keyboard input during the fade, Options confirmation focus containment/restoration, and Armory salvage focus restoration. An initial browser attempt was disrupted by editing the running spec; the steady-source rerun passed.
- The full task-scoped handoff gate passed: related and changed unit tests, documentation contracts, CI static checks, web build, and preview smoke. Run: `check-20260907t190606z-21820-988671`.
- No dependency, game rule, save, animation duration, or dismissal-policy changes were needed. Concurrent work was preserved.
