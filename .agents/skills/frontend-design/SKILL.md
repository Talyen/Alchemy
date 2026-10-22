---
name: frontend-design
description: Design and review Alchemy player-facing UI, layout, visual polish, copy density, and artwork composition by comparison with the current implementation. Use for visible behavior fixes too; excludes purely mechanical edits with no presentation or interaction effect.
license: Complete terms in LICENSE.txt
---

# Alchemy frontend design

Adapted from Anthropic's [frontend-design skill](https://github.com/anthropics/skills/blob/41bbe19d1a1a7eaab5e7bb9050a417e5c6cffc8f/skills/frontend-design/SKILL.md),
revision `41bbe19d1a1a7eaab5e7bb9050a417e5c6cffc8f` (Apache-2.0; [license](./LICENSE.txt)).
Modified for Alchemy: replaces general website direction with game-screen design,
existing UI ownership, and scoped visual verification. Review upstream updates
manually against this pinned revision and Alchemy's current conventions.

## Improve the existing game

Read the relevant [UI owner](../../../Docs/UI.md) sections and
[visual review](../../../Docs/UI_VISUAL_REVIEW.md). Inspect the current rendered
screen before deciding what needs changing. Follow these rules:

1. **Name the visible problem.** A different arrangement is not an improvement
   by itself. Identify what already works and preserve its clarity, consistency
   and useful grouping.
2. **Simplify first.** Remove redundant copy and unnecessary visual weight before
   adding emphasis, panels or effects. Judge information by how much attention it
   consumes, not just whether new words were added. Preserve necessary mechanics,
   accessible names and feedback; use existing inspection for secondary details.
3. **Compare with the original throughout.** Use real content and matched capture
   conditions. Judge the whole screen's restraint, cohesion and ease of use.
   Reuse shared primitives. Use relevant references; illustration style cannot
   substitute for a screen-composition reference. For art, read the applicable
   [asset workflow](../../../Docs/WORKFLOWS-ASSETS.md#art-style-and-generation-prompts)
   and inspect candidates at their actual display size and crop in the game.
4. **Reject weak experiments yourself.** Explore alternatives when useful or
   requested, but do not present two regressions as a successful choice. Discard
   rejected directions. If improvement is not convincing, keep the original and
   say the attempt failed.
5. **Verify what changed.** Render and exercise the affected states and input
   flows; check sizes and localized content where affected. Bounded browser
   review is already authorized through [managed previews](../../../CONTRIBUTING.md#agent-preview-ownership).
   Use [verifier](../verifier/SKILL.md) for code checks and localization for text
   changes. Report missing visual review honestly. Screenshots and passing checks
   do not establish design quality; no visual receipt or separate design report
   is required.
