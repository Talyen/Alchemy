---
name: frontend-design
description: Design and review Alchemy player-facing UI, layout, visual polish, copy density, and artwork composition with rendered acceptance. Use for visible behavior fixes too; excludes purely mechanical edits with no presentation or interaction effect.
license: Complete terms in LICENSE.txt
---

# Alchemy frontend design

Adapted from Anthropic's [frontend-design skill](https://github.com/anthropics/skills/blob/41bbe19d1a1a7eaab5e7bb9050a417e5c6cffc8f/skills/frontend-design/SKILL.md),
revision `41bbe19d1a1a7eaab5e7bb9050a417e5c6cffc8f` (Apache-2.0; [license](./LICENSE.txt)).
Modified for Alchemy: replaces general website direction with game-screen design,
existing UI ownership, and scoped visual verification. Review upstream updates
manually against this pinned revision and Alchemy's current conventions.

## Required inputs

Read [visual acceptance](../../../Docs/UI_VISUAL_REVIEW.md) and the relevant
[UI owner](../../../Docs/UI.md) sections. Inspect actual images in the
[current reference set](../../../Docs/design/visual-references.md), affected
screens, and shared primitives. For art, also read the applicable style prompt in
[asset workflows](../../../Docs/WORKFLOWS-ASSETS.md#art-style-and-generation-prompts).
Do not substitute a style adjective or prompt for reference inspection.

## Design and implement

- Capture the starting screen and reproducible conditions before editing. State
  the player's main decision and necessary information in the task brief, not
  in player-facing explanatory text.
- Name the reference and concrete qualities to borrow. Current screens are
  baselines, not automatic quality standards. Preserve functional contracts;
  replace weak visual treatments within scope. Existing primitives do not
  require copying a poor screen composition.
- For new screens or major redesigns, render two meaningfully different
  compositions with real content before detailed polish. Select by hierarchy,
  artwork prominence, density, and the player's task. Use a simple A/B screenshot
  choice when user preference matters. Follow the one-screen calibration pilot
  before propagating an unapproved treatment across the game.
- Use existing type/color roles and owners. Give the main decision clear visual
  emphasis. Make grouping, alignment, spacing and artwork crop work before
  decorating. New panels, badges, borders, glow or motion must have an actual
  information/interaction purpose; do not fill empty space with chrome or copy.
- Apply the acceptance contract's copy test to each new explanatory block and
  the text in the affected composition. Delete narration of visible controls,
  state and success. Preserve mechanics, accessible names, errors and required
  decisions. Use existing keyboard/pointer inspection for secondary details.
  Update all translations through the localization workflow when copy changes.
- Review art candidates at their actual display size and crop, in the game,
  alongside existing assets. Compare silhouette, focal point, lighting,
  materials, palette, ink/shading and detail density with approved anchors.
  Reject poor composition before adding effects. Follow the established asset
  pipeline; do not introduce a separate project-wide style.

## Critique, verify and accept

Run a distinct critique pass from screenshots, the player task and reference,
without starting from the implementation's justification. Make specific visible
observations about hierarchy, alignment, spacing, type, contrast, artwork and
visual noise; fix defects and recapture. Do not assign aesthetic scores.

Separately exercise relevant pointer/keyboard flows, selection/focus,
unavailability, pending/error outcomes, and muted/reduced-motion feedback.
Inspect affected localized/long content and display sizes. Looking attractive
cannot compensate for an unclear action or broken interaction.

Bounded local rendered review and focused browser checks for this work are
already authorized. Use [managed previews](../../../CONTRIBUTING.md#agent-preview-ownership).
Capture before/after at identical viewport and reproducible state; default to
1920 × 1080. Loading states, code inspection and passing tests do not pass visual
acceptance. Blocked rendering leaves acceptance pending and prevents ordinary
integration; never disguise it as a nonvisual edit.

Complete the [local evidence receipt](../../../Docs/UI_VISUAL_REVIEW.md#local-evidence-gate)
and use [verifier](../verifier/SKILL.md) before handoff. Report appearance findings,
copy removals/justifications, interaction coverage, remaining limitations and
reference approval status separately from functional checks. Only explicit user
selection promotes an image into the approved screen references. Keep only
current approved examples, not experiment or task-report archives.
