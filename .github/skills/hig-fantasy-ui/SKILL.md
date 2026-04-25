---
name: hig-fantasy-ui
description: 'Design or refine Alchemy frontend UI and UX using Apple Human Interface Guidelines as a principle-level reference. Use for React screens, Tailwind styling, shadcn/ui composition, interaction design, motion, spacing, hierarchy, accessibility, and fantasy game interface polish. Do not copy Apple text, screenshots, diagrams, or visual assets; consult the official HIG when exact source material is needed.'
argument-hint: 'Describe the screen, interaction, or component that needs design direction.'
user-invocable: true
---

# HIG Fantasy UI

Use this skill for any Alchemy screen, component, or flow that needs UI or UX direction.

## Goal

Create original interfaces that feel calm, layered, tactile, and highly legible while translating HIG principles into a browser-based fantasy deckbuilder.

## Copyright boundary

- Treat Apple Human Interface Guidelines as a reference for principles, not a source to reproduce.
- Never copy Apple prose, screenshots, diagrams, illustrations, or other visual assets into project files or generated deliverables.
- If a task asks for exact HIG wording or imagery, provide an original summary and point back to the official guide instead of recreating the source.

## Core principles to translate

- Hierarchy: the most important state should be visible first, especially player health, energy, enemy intent, and the next meaningful action.
- Harmony: group controls and readouts into coherent layers so the board feels calm even when the game state is busy.
- Consistency: reuse the same visual language for card frames, badges, panel depth, icon treatment, and motion timing.
- Direct manipulation: cards, buttons, toggles, and map choices must look tappable and feel responsive.
- Deference: decoration supports gameplay comprehension rather than competing with it.
- Feedback: every action should produce a clear state change, motion response, or textual confirmation.
- Accessibility: maintain semantic structure, keyboard support, visible focus, readable contrast, and touch targets of at least 44 by 44 CSS pixels.

## Alchemy visual direction

- Typography: ceremonial serif display faces for headings, readable humanist body text for dense rules and logs.
- Color: parchment, brass, ember, jade, obsidian, and moonlit neutrals instead of generic neon game palettes.
- Shape: rounded cards, capsule controls, softened panel corners, and grouped clusters that establish depth.
- Materials: layered surfaces with subtle translucency, gradients, and texture, but no noisy chrome.
- Motion: measured transitions that clarify cause and effect; prefer fades, lifts, and slides under 250ms.

## Procedure

1. Identify the UI problem to solve, then review the most relevant HIG topic links in [the topic map](./references/topic-map.md).
2. Rank the information by player urgency before changing layout or styling.
3. Define or reuse tokens for color, spacing, radius, depth, and motion.
4. Compose the screen from shadcn-style primitives and semantic HTML.
5. Keep the primary action visible on laptop and mobile layouts without relying on hidden menus.
6. Use one or two focal surfaces per screen instead of many competing accents.
7. Introduce fantasy flavor through iconography, palette, and material treatment, not unreadable ornament.
8. Check keyboard focus, touch targets, reduced motion behavior, and contrast before considering the screen done.

## Screen checklist

- Is the current encounter state understandable in under three seconds?
- Can the player see enemy intent before committing an action?
- Are the hand, resources, and confirm actions grouped in a predictable way?
- Are secondary systems visibly quieter than the core battle state?
- Does the layout remain usable on a narrow mobile viewport?
- Would the interface still read clearly if decorative backgrounds were removed?

## Expected output for design tasks

- Interaction hierarchy for the screen or component
- Token and palette direction
- Layout structure across mobile and desktop
- Motion notes tied to gameplay feedback
- Accessibility checks and known risks

## Source reference

- Official guide: https://developer.apple.com/design/human-interface-guidelines
- HIG topic map: [references/topic-map.md](./references/topic-map.md)

