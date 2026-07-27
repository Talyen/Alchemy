# UI Interaction & Feedback Audit

**Goal:** Find confirmed interaction and feedback defects desktop players feel but static types miss — broken clicks, drag ghosts, stuck modes, missing feedback, keyboard gaps.

## Intent

Identify navigation/feedback/interaction defects and fix them. Reuse existing UI coverage; do not add a test unless CONTRIBUTING identifies a unique shipping journey or safety invariant. Significant shared patterns remain proposals. If the scope is large, phase the plan.

This audit checks interactive clarity for a desktop web/Electron game; it is not a comprehensive WCAG audit.

## Hard stops

- Do not restyle unrelated chrome or expand into token/typography migrations (`DesignSystemConsistencyAudit.md` owns those).
- Do not expand a selected-flow check into a full-app manual pass; skip unavailable Electron checks without failing the audit.
- Do not expand into Playwright rewrites (`E2ETestQualityAudit.md` owns those).
- Do not turn `data-testid` churn into an a11y project — only change ids when interaction or E2E stability is blocked.

## Domain rules

**Navigation & overlays:** every modal/portal has a dismiss path; destructive actions use confirmation + working cancel/backdrop dismiss; Escape cancels overlays where users expect it.

**Pointer & drag:** every `setPointerCapture` has matching release on up, cancel, and unmount; cursor/body styles restore on exit; no ghost clicks after drag. One clear interaction mode at a time — drag, modal, targeting, scroll should not fight (Armory drag FSM is intentional complexity — fix bugs, don’t “simplify” the product model unsupervised).

**Feedback:** clicks/buttons give visible response; long async work shows progress or disabled state; victory/defeat and claim flows remain dismissible / completable.

**Keyboard / focus:** focusable controls have accessible names; focus rings remain visible for keyboard users; do not remove focus styles for aesthetics alone.

**Edge cases:** rapid-tap debounce on reward claim / craft / shop buy / start battle; Electron window blur / deactivate should not leave stuck drag/target modes; empty states for empty collection/inventory/armory.

## Known signals

Optional discovery aids — choose your own probes.

- **Pointer capture pairs:** `setPointerCapture` / `releasePointerCapture` / drag / modal / portal surfaces.
- **Missing release / cleanup:** `setPointerCapture` without matching release on cancel/unmount paths.
- **Mode conflicts:** overlapping drag + tooltip + modal handlers on the same surface.
- **Tooltip blocking clicks:** hover tooltips that intercept pointer events on underlying controls.
- **Rapid-tap gaps:** primary actions without `isProcessing` / disabled guards during async work.
- **Keyboard Escape:** overlays without Escape/dismiss wiring.
- **Electron blur / deactivate:** window `blur` / `visibilitychange` / focus handlers that leave drag or targeting armed — check Armory and battle targeting paths; desktop shell in `desktop/`.
