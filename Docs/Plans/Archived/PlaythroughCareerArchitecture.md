---
status: complete
updated: 2026-09-24
---

# Playthrough career architecture

`runCareer` formerly mixed choice sequencing with save transport, autosave acknowledgement, telemetry, and state checks. `career-persistence.ts` now owns save round trips and acknowledgement; `career-evidence.ts` owns combat and run observations. `career.ts` retains ordered journal-before-execution, actions, replay, and completion.

Recorded shapes and sampling points remain unchanged so checkpoints and replay stay comparable. The implementation commit includes playthrough-related checks; this archive does not retain a separate gate result.

Implementation: `81132e6c`. Current owner: [Headless playthrough testing](../../PLAYTHROUGH_SIMULATION.md#owners-and-verification).
