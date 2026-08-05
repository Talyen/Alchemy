# 16. UI Interaction & Feedback Audit

**Goal:** Find confirmed interaction and feedback defects desktop players feel but static types miss — broken clicks, drag ghosts, stuck modes, missing feedback, keyboard gaps.

## Intent

Identify navigation, responsive, focus, feedback, and interaction defects and fix them through the shared primitive or flow family that owns them. Reuse existing UI coverage; add or extend a test when a confirmed interaction regression has no trustworthy semantic owner. Bounded shared-pattern fixes may ship under [README.md](README.md); interaction-model or player-facing design decisions remain proposals. If the scope is large, phase the plan.

This audit checks interactive clarity for a desktop web/Electron game, including obvious keyboard, focus, semantic-role, and reduced-motion failures; it is not a comprehensive WCAG certification.

**Flow rotation:** confirmation needs a running app, so each pass selects one related flow family or risk theme and verifies two or three representative journeys live when available (Playwright or manual probe) — e.g. Armory drag/equip/craft, battle targeting/overlays/end-state, shop/reward purchase/claim/dismiss, or run navigation/resume/defeat. Rotate families across repeat passes rather than re-walking the whole app every run. A full user-requested audit samples every major interaction family at least once; grep signals may span the repo.

## Hard stops

- Do not restyle unrelated chrome or expand into token/typography migrations (`06-DesignSystemConsistencyAudit.md` owns those).
- Do not expand a selected-flow family into an unfocused full-app manual pass; skip unavailable Electron checks without failing the audit. Explicit full audits still require representative coverage across the major families.
- Do not expand into Playwright rewrites (`10-E2ETestQualityAudit.md` owns those).
- Do not turn `data-testid` churn into an a11y project — only change ids when interaction or E2E stability is blocked.

## Domain rules

**Navigation & overlays:** every modal/portal has a dismiss path; destructive actions use confirmation + working cancel/backdrop dismiss; Escape cancels overlays where users expect it.

**Pointer & drag:** every `setPointerCapture` has matching release on up, cancel, and unmount; cursor/body styles restore on exit; no ghost clicks after drag. One clear interaction mode at a time — drag, modal, targeting, scroll should not fight (Armory drag FSM is intentional complexity — fix bugs, don’t “simplify” the product model unsupervised).

**Feedback:** clicks/buttons give visible response; long async work shows progress or disabled state; victory/defeat and claim flows remain dismissible / completable.

**Keyboard / focus / semantics:** focusable controls have accessible names and correct roles; focus rings remain visible; modal/route transitions restore focus sensibly; keyboard order follows the visible interaction order; do not remove focus styles for aesthetics alone.

**Responsive / motion / scrolling:** controls remain reachable at supported viewport sizes; overlays lock and restore scroll correctly; reduced-motion preferences avoid nonessential blocking motion while preserving feedback; responsive reflow does not invalidate pointer targets or focus order.

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
- **Focus lifecycle:** modal open/close, route changes, and async replacement lose focus, trap it incorrectly, or return it to removed content.
- **Semantic control gaps:** clickable non-controls, unnamed icon actions, invalid role/state combinations, or keyboard activation that differs from pointer activation.
- **Responsive reachability:** supported viewport sizes hide, overlap, or strand required actions, overlays, or scroll regions.
- **Reduced motion / transition blocking:** optional motion ignores user preference or delays the ability to act without adding necessary state clarity.
- **Scroll ownership:** nested overlays, routes, and drag surfaces leave body/container scrolling locked or competing after exit.
