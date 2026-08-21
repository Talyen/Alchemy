# UI Consistency Audit

Merges the former Design System Consistency (06) and UI Interaction & Feedback (16) audits.

**Goal:** Keep visual language and interaction behavior on their shared owners — migrate token/primitive drift, and fix confirmed interaction/feedback defects desktop players feel — without flattening justified game UI.

Token/primitive owners: `src/components/ui/README.md`, `src/features/alchemy/shared/ui/README.md`, `src/styles/theme.css`.

## Scope

| Concern       | Owns                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| Design system | Spacing/color/typography/state-role drift away from shared primitives and CSS variables                 |
| Interaction   | Broken clicks, drag ghosts, stuck modes, missing feedback, keyboard/focus gaps, responsive reachability |

Structural screen twins → Simplification; Playwright rewrites → TestQuality; product rules behind a surface stay with their feature owner.

## Hard stops

- Do not rewrite battle battlefield/hand layout unsupervised in one pass; scope it as a migration phase.
- Do not replace intentional game juice: combat float text, card fan, Armory drag ghosts, Motion stagger recipes. The Armory drag FSM is intentional complexity — fix bugs, don't simplify the product model unsupervised.
- Do not hand-roll buttons/inputs that exist in `src/components/ui`; do not restyle unrelated chrome or turn `data-testid` churn into an a11y project.
- Each pass selects one related flow family (e.g. Armory drag/equip/craft, battle targeting/end-state, shop/reward claim, run navigation/resume) and verifies 2–3 representative journeys live when available; rotate families across passes. Full user-requested audits sample every major family at least once.

## Triage

| Priority | Cluster                                                                                                                                                                                       | Remedy                                                         |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1        | Raw spacing literals beside tokens; duplicated chrome in 3+ files                                                                                                                             | Theme spacing / shared component                               |
| 2        | One-off colors bypassing CSS variables; unused typography roles; state-role drift (focus/disabled/error/selected/loading); responsive/motion inconsistency; rapid-tap gaps on primary actions | Adopt the existing semantic variant or primitive; add guards   |
| 3        | Justified custom layout (battle hand fan, Armory packing); competing undocumented size rules                                                                                                  | Extract constants / one documented rule; keep product behavior |

**Leave alone (justified custom):** fanned battle hand + drag-to-play; combat float motion; health-bar geometry fills; intentional Motion recipes.

## Domain rules

- **Interaction:** every modal has a dismiss path; destructive actions confirm; Escape cancels overlays where expected. Every `setPointerCapture` releases on up/cancel/unmount; cursor/body styles restore; no ghost clicks; one interaction mode at a time.
- **Feedback:** visible click response; progress/disabled during async work; victory/defeat and claim flows remain completable/dismissible.
- **Keyboard/focus:** accessible names and roles; visible focus rings; sensible focus restore on modal/route transitions; keyboard order follows visible order.
- **Responsive/motion:** controls reachable at supported viewports; scroll lock/restore correct; reduced-motion avoids nonessential blocking motion while preserving feedback; Electron blur/deactivate must not leave drag/targeting armed.
- **Tokens:** prefer existing shadcn/Radix wrappers, CVA variants, Tailwind theme variables used by neighbors; no double padding on already-padded surfaces; drag motion tracks 1:1 and settles with interruptible springs.

## Known signals

- Arbitrary Tailwind literals (`w-[…]`, `p-[…]`, `text-[…]`) beside tokens; raw hex/`rgb(`/`hsl(` in TSX or `src/styles`; parallel button/card markup beside primitives; repeated shadow/border recipes.
- Sibling controls with incompatible focus/selected/disabled/loading states; conflicting breakpoints/easing/durations in one surface family; inconsistent icon treatment.
- `setPointerCapture` without matching release; overlapping drag+tooltip+modal handlers; tooltips intercepting clicks; primary actions without `isProcessing` guards; overlays without Escape wiring.
- Window `blur`/`visibilitychange` leaving modes armed (check Armory + battle targeting, `desktop/`); focus lost/trapped across modals and routes; clickable non-controls and unnamed icon actions; body/container scroll left locked after overlay exit.
