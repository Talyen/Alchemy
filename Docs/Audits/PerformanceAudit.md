# Performance Audit

**Goal:** Fix confirmed runtime and payload performance problems — startup, input latency, render churn, frame cost, memory/allocation pressure, synchronous persistence work, background CPU, and bundle/asset weight — without speculative optimization or degrading intentional spectacle.

Use the [shared audit contract](README.md#shared-contract) for scope, confirmation,
prioritization, and verification.

## Intent

Establish a material cost through runtime profiling, reproducible latency/jank, allocation or build-size evidence, or a statically provable resource problem. Compiler diagnostics and suspicious code patterns guide investigation. Establish a reproducible baseline where measurement is needed, compare the same scenario before/after, and fix the complete hot path through existing owners.

## Hard stops

- Preserve the [boot and loading contract](../ARCHITECTURE.md#boot-and-loading); asset weight at boot is not itself a finding.
- Do not hand-add `useMemo` / `useCallback` / `React.memo` speculatively — the React Compiler owns memoization. Follow the `react-hooks` diagnostics configured in `oxlint.config.ts`; a compiler bailout on a hot component is a lead to investigate for measurable cost.
- Preserve [battle feedback and motion](../UI_BATTLE.md#battle-feedback) and [Armory targeting feedback](../UI_BROWSING.md#armory-crafting-and-salvage). A measured cost alone does not authorize reducing the intended presentation.
- Do not move battle simulation into Workers unless Architecture already requires it (propose only).
- Do not narrow a confirmed hot path to its React leaf when state selection, repeated computation, serialization, asset work, or upstream event frequency is the cause.

## Investigation and evidence

Use sustained play and repeated entry/exit for retention questions.
Record revision, scenario/seed, runtime/build mode, viewport and measurement
conditions. Use production-like execution for player-cost claims. Measure the same
workload before and after under [profiling repetition guidance](../PERFORMANCE.md#measurement-setup),
reporting variation and repetitions without selecting only the best sample.

Report a missing baseline rather than inventing one.
Separate startup, input latency, frame cost, retained memory and payload. A smaller
bundle or fewer renders does not prove faster interaction. Find the dominant cost
and frequency, then check that the fix does not move it elsewhere, retain more
memory, change seeded outcomes or degrade presentation. Distinguish a statically
proven resource issue from an unmeasured speedup; preserve missing evidence under
the [shared finish contract](README.md#finish).

## Investigation leads

| Signal                                                                 | Evidence to seek                                                                                                                                                                  |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compiler bailouts, whole-store `useXStore()`, broad/unstable effects   | Profile battle/large-grid render churn; prefer narrow selectors when unrelated writes cause material work. Pure cancellation defects belong to RuntimeCorrectness                 |
| Long tasks, dropped frames, dense DOM/layout                           | Trace CPU/layout/paint during battle, motion or currency targeting; preserve responsive pointer feedback. Playwright traces locate interactions but do not measure CPU/frame cost |
| Payload growth or heavy boot/menu imports                              | Compare equivalent `npm run build` outputs, then trace dependencies/assets/imports under the eager-art policy; use [asset authoring](../WORKFLOWS-ASSETS.md) for remedies         |
| Slow boot, hydration, route entry, save/resume or input feedback       | Measure player-visible latency and the dominant work/frequency                                                                                                                    |
| Listeners/data retained, unbounded caches, large repeated allocations  | Use sustained-play heap/allocation evidence and repeated entry/exit to distinguish retention from temporary work                                                                  |
| Sorting, parsing, cloning, validation or storage in render/input paths | Demonstrate blocking cost before changing the shared computation or upstream event frequency                                                                                      |
| Hidden views, timers, observers or effects consuming CPU               | Establish sustained background work without player-visible purpose                                                                                                                |
| Decorative randomness/re-rolls                                         | SideEffectSurface owns correctness; use this audit only when profiling establishes material render cost                                                                           |

[Performance profiling](../PERFORMANCE.md) owns `npm run perf`, advisory targets,
traces and controlled comparison. Record build size or runtime measures when they
substantiate the finding; preserve missing baseline/parity evidence in the handoff.
