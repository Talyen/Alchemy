# UI Consistency Audit

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
- Preserve the battle hand, immediate combat feedback, and [Armory click targeting](../UI_BROWSING.md#armory-crafting-and-salvage). Inspect targeting activation, pointer feedback, valid/invalid targets, confirmation, and cancellation against that contract; do not infer a drag-and-drop interaction model.
- Use the shared primitives in `src/components/ui` and the existing accessibility contract; audit signals do not authorize a new accessibility feature set.
- Match coverage to the requested scope. A full pass inspects each major flow family (Armory, battle, shops/rewards, navigation/resume, and meta/setup) rather than silently limiting itself to one; a focused pass can stay within its requested family.

## Investigation and evidence

Trace player tasks through entry, action, feedback, cancellation and completion.
Prioritize blocked actions, wrong targeting, stuck modes and misleading state.
Inspect supported viewports/input methods and compare sibling surfaces against
[UI.md](../UI.md), preserving intentional hand geometry, health bars and Armory packing.

A markup/token difference needs a demonstrated visible, semantic or ownership cost.
Exercise interruption/repeated input where relevant and inspect visual fixes in
the renderer. Follow the [shared evidence and reporting contract](README.md#shared-contract);
static inspection cannot establish visual correctness.

## Investigation leads

| Signal                                                                          | Question                                                                                                                                                         |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Arbitrary sizes/colors, parallel button/card markup, conflicting spacing/easing | Is there a visible or semantic cost versus the shared Radix/CVA/Tailwind primitives and neighboring tokens? Check double padding and preserve justified variants |
| Incompatible hover/focus/selected/disabled/pending feedback                     | Does every accepted/rejected action communicate its actual result and remain completable?                                                                        |
| Overlapping modal, tooltip or targeting handlers                                | Are activation, capture, cursor/body restoration, cancellation and Escape ownership coherent? Browser implicit capture release may satisfy cleanup               |
| Blur/visibility changes leaving modes armed                                     | Exercise Armory/battle cancellation and desktop lifecycle; targeting cursors must follow the pointer without intercepting it                                     |
| Clickable non-controls, missing names or keyboard behavior                      | Preserve semantic roles, programmatic states, dialog focus and the [accessibility stance](../UI.md#accessibility-stance), even when tests do not query them      |
| Small windows or motion changes                                                 | Are controls reachable and scroll lock/restoration correct? Preserve existing completion, dismissal and destructive-action protections                           |

Search leads include raw hex/`rgb`/`hsl`, arbitrary Tailwind utilities beside tokens,
repeated shadow/border recipes, ghost clicks and stranded async actions. Confirm the
actual interaction rather than demanding a particular API or local processing flag.
