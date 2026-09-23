---
status: complete
updated: 2026-09-22
---

# Playthrough actor architecture

The headless career actor previously combined offer construction for unrelated phases with replay dispatch in one mutable closure. Its string-keyed command map silently replaced duplicate offers.

1. Introduce a small choice catalog that owns offer identity, rejects duplicates, and dispatches commands registered by the current observation. Preserve the recorded `PlayerChoice` shape.
2. Move between-run progression and Gear offers into a focused module. Keep production command calls and scoring rules intact.
3. Move run-activity offers into a focused module. Keep the actor responsible for observation lifecycle and phase routing only.
4. Protect catalog collisions and replay behavior with focused tests, run the existing headless career suite, and update the architecture owner.
