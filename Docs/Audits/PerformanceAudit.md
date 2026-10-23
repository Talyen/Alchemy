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
workload before and after under [profiling repetition guidance](../PERFORMANCE.md#quick-start),
reporting variation and repetitions without selecting only the best sample.

Report a missing baseline rather than inventing one.
Separate startup, input latency, frame cost, retained memory and payload. A smaller
bundle or fewer renders does not prove faster interaction. Find the dominant cost
and frequency, then check that the fix does not move it elsewhere, retain more
memory, change seeded outcomes or degrade presentation. Distinguish a statically
proven resource issue from an unmeasured speedup; preserve missing evidence under
the [shared finish contract](README.md#finish).

## Domain rules

- **Render churn:** hot components (battle board, hand, large grids like compendium/armory) should not re-render wholesale on unrelated store writes. Prefer narrow Zustand selectors over whole-store subscriptions; confirm churn with the profiler, not by reading code alone.
- **Effects:** expensive work re-firing from unstable effect dependencies is a finding when traced; pure lifetime/cancellation bugs → the RuntimeCorrectness audit.
- **Frame cost:** confirm dropped frames or long tasks in a Performance trace during battle/motion before optimizing; preserve responsive pointer feedback.
- **Payload:** compare `npm run build` output sizes under equivalent build conditions; investigate large regressions to their source (new dependency, unoptimized asset, accidental import of a heavy module into a light path). Asset remedies follow the [authoring workflow](../WORKFLOWS-ASSETS.md).
- **Startup and interaction latency:** profile boot/hydration, route entry, large-grid interaction, save/resume, and input-to-feedback latency when users wait or input is blocked.
- **Memory and allocation:** confirm retained listeners/data, unbounded collections, repeated large allocations, or asset/object churn with heap/allocation evidence.
- **Synchronous work:** repeated parsing, sorting, cloning, validation, or storage access on render/input/transition paths is a finding when the scenario shows material blocking cost.
- **Background work:** timers, observers, effects, or hidden views should not consume sustained CPU without user-visible purpose.
- **Decorative randomness / cosmetic state:** re-rolls per render are owned by `SideEffectSurfaceAudit.md`; take them here only when the profiler shows real render cost.

## Known signals

- **React Compiler bailouts:** configured `react-hooks` diagnostics on hot-path components.
- **Whole-store subscriptions:** `useXStore()` without a selector inside battle/grid components.
- **Wide effects:** `useEffect` bodies doing expensive work with broad or unstable dependency arrays.
- **Build size trend:** `npm run build` output size vs the previous pass (record the number in the handoff for comparison).
- **Runtime traces:** browser Performance recordings during battle, Armory browsing, or currency targeting — long tasks and dropped-frame clusters. Playwright traces help locate the interaction and failure context; use runtime profiling for CPU, layout, and frame-cost claims. For a repeatable on-demand FPS / hitch harness (`npm run perf`, advisory targets, optional CDP deep traces), see [PERFORMANCE.md](../PERFORMANCE.md).
- **Heavy imports on light paths:** large modules imported into boot or menu paths that only need them later (respecting the eager-art and no-lazy-routes policy).
- **Repeated computation / serialization:** sorting, parsing, cloning, validation, snapshotting, or storage access repeated inside render, input, or high-frequency transitions.
- **Memory retention:** listeners, timers, caches, object URLs, or state histories retain data after their owning flow ends.
- **DOM and layout scale:** large grids, overlays, or hidden surfaces create excessive nodes, layout, paint, or measurement work.
- **Startup / resume timing:** asset preparation, hydration, migration, or route boot has reproducible user-visible latency.
