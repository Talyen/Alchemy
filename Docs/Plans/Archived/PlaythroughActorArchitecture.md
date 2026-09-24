---
status: complete
updated: 2026-09-24
---

# Playthrough actor architecture

The headless actor formerly combined offers for unrelated phases with replay dispatch in one mutable closure; duplicate string keys could replace a command. A choice catalog now owns identities and rejects collisions, while separate between-run and run-activity builders register legal actions. The actor retains observation lifecycle and phase routing.

Recorded choice shapes, production commands, and scoring rules remain unchanged. The implementation commit includes choice-catalog coverage; this archive does not retain a separate gate result.

Implementation: `0e140aa9`. Current owner: [Headless playthrough testing](../../PLAYTHROUGH_SIMULATION.md#owners-and-verification).
