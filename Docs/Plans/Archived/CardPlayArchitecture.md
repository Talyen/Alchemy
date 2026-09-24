---
status: complete
updated: 2026-09-24
---

# Card play phase ownership

Validation and payment, effect execution, and post-play rewards once lived in one card-play module. Ordinary play now keeps validation, payment, and sequencing; focused battle modules own shared effects, rewards, and Consume routing for ordinary and Dodge-triggered plays. Named routing context makes their ordering explicit.

The refactor preserves public play behavior and reaction order. The implementation commit includes focused battle ordering coverage; this archive does not retain a separate gate result.

Implementation: `c02a7f56`. Current owner: [Battle path](../../ARCHITECTURE.md#battle-path).
