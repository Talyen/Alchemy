---
status: complete
updated: 2026-09-24
---

# Enemy ability resolution architecture

Enemy ability selection, damage and once-per-ability rewards, and trait follow-ups now have separate private owners with one shared per-ability context. This makes reaction order visible without changing public ability entry points, RNG draws, damage, or combat text order.

The implementation commit includes focused enemy ability coverage; this archive does not retain a separate gate result.

Implementation: `81132e6c`. Current ownership: [Enemy combat rules](../../GAME_RULES.md#enemy-abilities-and-traits).
