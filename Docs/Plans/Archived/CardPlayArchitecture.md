---
status: complete
updated: 2026-09-24
---

# Card play phase ownership

The card play module mixes validation and payment, effect execution, and post-play rewards. Enemy Dodge also imports that top-level module solely to reuse effect and reward helpers. This makes the reaction order and dependency direction difficult to follow.

1. Move shared card effect and post-play reward phases into focused battle modules. Keep the ordinary card play entry point responsible for validation, payment, and sequencing.
2. Replace the positional Consume-routing arguments with a named context. Update both ordinary and Dodge-triggered play callers.
3. Document the phase ownership, add focused coverage for the ordering boundary, and run the task-owned verification gate.
