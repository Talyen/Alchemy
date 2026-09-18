# UI Consistency Audit

Merges the former Design System Consistency (06) and UI Interaction & Feedback (16) audits.

**Goal:** Keep visual language and interaction behavior on their shared owners — migrate token/primitive drift, and fix confirmed interaction/feedback defects desktop players feel — without flattening justified game UI.

Use the [shared audit contract](README.md#shared-contract) for scope, confirmation,
prioritization, and verification.

Token/primitive owner: [UI.md](../UI.md), with implementation tokens in `src/styles/theme.css`.

## Scope

| Concern       | Owns                                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------- |
| Design system | Spacing/color/typography/state-role drift away from shared primitives and CSS variables                             |
| Interaction   | Broken clicks, stale targeting cursors, stuck modes, missing feedback, keyboard/focus gaps, responsive reachability |

Structural screen twins → Simplification; Playwright rewrites → TestQuality; product rules behind a surface stay with their feature owner.

## Hard stops

- Do not rewrite battle battlefield/hand layout unsupervised in one pass; scope it as a migration phase.
- Preserve the battle hand, immediate combat feedback, and [Armory click targeting](../UI.md#armory-crafting-and-salvage). Inspect targeting activation, pointer feedback, valid/invalid targets, confirmation, and cancellation against that contract; do not infer a drag-and-drop interaction model.
- Use the shared primitives in `src/components/ui` and the existing accessibility contract; audit signals do not authorize a new accessibility feature set.
- Match coverage to the requested scope. A full pass inspects each major flow family (Armory, battle, shops/rewards, navigation/resume, and meta/setup) rather than silently limiting itself to one; a focused pass can stay within its requested family.

## Investigation and evidence

Trace player tasks through entry, action, feedback, cancellation, and completion. Start with blocked actions, wrong targeting, stuck modes, or misleading state before cosmetic drift. Inspect representative supported viewports and input methods, and compare sibling surfaces against [UI.md](../UI.md), not personal visual preference.

A token or markup difference is a candidate only: establish an unintended visible inconsistency, broken semantic behavior, or independently maintained rule that should use an existing owner. Preserve justified geometry and motion, including the battle hand, health bars, and Armory packing.

Verify interaction fixes in the affected flow, including interruption or repeat input when relevant. Verify visual changes in context rather than from class names alone. Report unavailable live checks; static inspection cannot establish visual correctness.

## Domain rules

- **Interaction:** dialogs and modes retain their documented completion/cancellation paths and destructive-action protections. Check capture ownership, pointer cancellation, cursor/body restoration, ghost clicks, and conflicting modes. Browser implicit capture release can satisfy cleanup; verify behavior rather than requiring a matching API call.
- **Feedback:** visible click response; progress/disabled during async work; victory/defeat and claim flows remain completable/dismissible.
- **Keyboard/focus:** preserve semantic controls, programmatic names/states, and shared keyboard behavior whether or not tests query them. Follow [UI.md accessibility stance](../UI.md#accessibility-stance), including existing Armory confirmation focus behavior; do not infer new product requirements from audit heuristics.
- **Responsive/motion:** controls reachable at supported viewports; scroll lock/restore correct; Electron blur/deactivate must not leave targeting armed.
- **Tokens:** prefer existing shadcn/Radix wrappers, CVA variants, Tailwind theme variables used by neighbors; no double padding on already-padded surfaces; targeting cursors must follow the pointer without intercepting input.

## Known signals

- Arbitrary Tailwind literals (`w-[…]`, `p-[…]`, `text-[…]`) beside tokens; raw hex/`rgb(`/`hsl(` in TSX or `src/styles`; parallel button/card markup beside primitives; repeated shadow/border recipes.
- Sibling controls with incompatible focus/selected/disabled/loading states; conflicting breakpoints/easing/durations in one surface family; inconsistent icon treatment.
- Overlapping targeting, tooltip, and modal handlers; tooltips intercepting clicks; primary actions without `isProcessing` guards; overlays without Escape wiring.
- Window `blur`/`visibilitychange` leaving modes armed (check Armory + battle targeting, `desktop/`); clickable non-controls and unnamed icon actions; body/container scroll left locked after overlay exit.
