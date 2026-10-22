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

## Review the affected screen

[Visual review](../../../Docs/UI_VISUAL_REVIEW.md) owns design quality and rendered comparison requirements. Read the relevant [UI owner](../../../Docs/UI.md) sections, then inspect the current screen before choosing a change.

Use the existing primitives and compare the candidate in matched game states. For artwork, follow the [asset workflow](../../../Docs/WORKFLOWS-ASSETS.md#art-style-and-generation-prompts) and inspect its actual destination size and crop. Exercise affected interactions and localized layouts.

Use [verifier](../verifier/SKILL.md) for the task gate and [localization](../localization/SKILL.md) when text changes. [CONTRIBUTING](../../../CONTRIBUTING.md#what-to-run-when-you-change) owns execution permissions.
