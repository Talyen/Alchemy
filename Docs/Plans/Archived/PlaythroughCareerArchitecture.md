---
status: complete
updated: 2026-09-23
---

# Playthrough career architecture

## Problem

`runCareer` currently mixes choice orchestration with save transport, autosave
acknowledgement, telemetry, and state checks. The order of journal writes,
actions, and persistence checks matters for replay, but those responsibilities
are interleaved in one long function.

## Plan

1. Move the in-memory save backend, production save load, autosave lifecycle,
   acknowledged-byte checks, and resume round trip into one persistence owner.
2. Move battle/card/run evidence and post-action state invariants into one
   evidence owner. Keep recorded shapes and sampling points unchanged.
3. Leave `career.ts` as the sequential coordinator for observation, choice,
   journal-before-execution, action, replay, and completion.
4. Document the new owners and run the existing replay, checkpoint, failure,
   and targeted-career tests, then the changed-path handoff gate.

## Done when

Fresh and replayed careers produce the same journal, final save, and outcomes;
controlled failures retain their stage; resumed checkpoints match the baseline;
and `runCareer` no longer contains transport or telemetry implementation.
