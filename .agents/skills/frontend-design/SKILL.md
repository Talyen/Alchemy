---
name: frontend-design
description: Design new Alchemy game UI or substantially reshape an existing interface with intentional visual direction and critique. Excludes routine bug fixes, copy edits, and mechanical component changes.
license: Complete terms in LICENSE.txt
---

# Alchemy frontend design

Adapted from Anthropic's [frontend-design skill](https://github.com/anthropics/skills/blob/41bbe19d1a1a7eaab5e7bb9050a417e5c6cffc8f/skills/frontend-design/SKILL.md),
revision `41bbe19d1a1a7eaab5e7bb9050a417e5c6cffc8f` (Apache-2.0; [license](./LICENSE.txt)).
Modified for Alchemy: replaces general website direction with game-screen design,
existing UI ownership, and scoped visual verification. Review upstream updates
manually against this pinned revision and Alchemy's current conventions.

## Ground the design in the player's task

Alchemy is a fantasy roguelite deckbuilder. Identify what the player needs to
understand, decide, or do on the requested screen. Use real game content and
player-facing names. Inspect comparable screens and the shared primitives they
use before proposing a layout. Resolve consequential ambiguity with the user;
use established conventions for routine choices.

[UI.md](../../../Docs/UI.md) is the canonical design authority. Read its relevant
sections and linked guides. Reuse Alchemy's existing typography, gold and
content-owned palettes, artwork, controls, and motion conventions. Propose
departures only when the requested work calls for them; a distinctive design
does not require a new visual system or new tokens for each task.

## Plan, review, implement

- Propose a compact visual direction tied to the player's task: information
  hierarchy, composition, existing type and color roles, and interaction states.
  Use a small wireframe when it clarifies a consequential layout choice.
- Review the direction against the brief and comparable screens before coding.
  Revise choices that feel like a generic template or conflict with Alchemy's
  identity. Put visual emphasis on the player's main decision or outcome and
  keep supporting elements quiet.
- Let structure communicate information. Add borders, labels, divisions, or
  numbering only when they express grouping, state, or an actual sequence.
  Avoid decorative dashboard cards, hero sections, and repeated explanatory copy
  unless the requested screen needs them.
- Implement through existing owners and primitives. Preserve concise labels,
  essential mechanics, accessible names, visible keyboard focus, and reduced
  motion behavior. Follow UI.md's action-feedback rules: every supported action
  communicates its acknowledgment and outcome visibly, including while muted.
  Use purposeful motion to clarify changes; avoid unrelated decorative effects.
- Write from the player's perspective. Name actions consistently, make failures
  specific, and remove copy that repeats visible state. Do not add routine
  success messages when the resulting state already communicates success.

## Critique and verify

Review the implemented hierarchy, spacing, readability, supported display sizes,
focus and selection states, and action outcomes against the brief. Remove
decoration that adds no meaning; assess visual quality from rendered evidence.

Follow [verification permissions](../../../CONTRIBUTING.md#what-to-run-when-you-change)
and use [verifier](../verifier/SKILL.md) for edited-path checks. For an authorized
interactive browser review, use [preview ownership](../../../CONTRIBUTING.md#agent-preview-ownership)
and inspect actual screenshots of the affected screens and relevant interaction
states before claiming visual validation. Code review and passing checks do not
prove the rendered result. When browser execution is not authorized, complete
the permitted checks and report visual validation as pending. This skill does
not authorize browser execution, builds, or publication.
