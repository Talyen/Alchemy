# Performance Audit

**Goal:** Fix confirmed runtime and payload performance problems — startup, input latency, render churn, frame cost, memory/allocation pressure, synchronous persistence work, background CPU, and bundle/asset weight — without speculative optimization or degrading intentional spectacle.

## Intent

Establish a material cost through runtime profiling, reproducible latency/jank, allocation or build-size evidence, or a statically provable resource problem. Compiler diagnostics and suspicious code patterns guide investigation. Establish a reproducible baseline where measurement is needed, compare the same scenario before/after, and fix the complete hot path through existing owners.

## Hard stops

- Eager game-art loading at boot is intentional policy ([AGENTS.md](../../AGENTS.md) routes/boot rules) — asset weight at boot is not itself a finding. Do not introduce `React.lazy()` for route screens.
- Do not hand-add `useMemo` / `useCallback` / `React.memo` speculatively — the React Compiler owns memoization. Fix `react-compiler/react-compiler` ESLint errors instead; a compiler bailout on a hot component is a lead to investigate for measurable cost.
- Preserve intentional juice (combat float text, card fan, Motion stagger, Armory drag tracking). A measured cost justifies investigation; reducing intended spectacle still requires an authorized product choice.
- Do not hand-edit optimized/generated asset outputs — fix the source described in [WORKFLOWS-ASSETS.md](../WORKFLOWS-ASSETS.md).
- Do not move battle simulation into Workers unless Architecture already requires it (propose only).
- Do not narrow a confirmed hot path to its React leaf when state selection, repeated computation, serialization, asset work, or upstream event frequency is the cause.

## Investigation and evidence

Choose representative scenarios with a reason to suspect cost, including sustained play and repeated entry/exit where retention is possible. Record the revision, scenario/seed, runtime and build mode, viewport, and relevant measurement conditions so comparisons are meaningful. Use production-like execution for player-cost claims; development overhead is not a shipping regression.

Measure the same workload before and after, repeat noisy measurements as needed, and report the observed variation rather than a best sample. Separate startup, input latency, frame cost, retained memory, and payload: a smaller bundle or fewer renders does not by itself prove a faster interaction. Do not invent a prior baseline if one is unavailable.

Locate the dominant cost and its frequency before optimizing. Verify that the remedy improves that cost without moving it into another phase, retaining more memory, changing seeded outcomes, or degrading interaction. If measurements cannot be obtained, distinguish a statically established issue (such as an unbounded retained collection) from an unconfirmed speedup; do not claim measured improvement.

## Domain rules

- **Render churn:** hot components (battle board, hand, large grids like compendium/armory) should not re-render wholesale on unrelated store writes. Prefer narrow Zustand selectors over whole-store subscriptions; confirm churn with the profiler, not by reading code alone.
- **Effects:** expensive work re-firing from unstable effect dependencies is a finding when traced; pure lifetime/cancellation bugs → the RuntimeCorrectness audit.
- **Frame cost:** confirm dropped frames or long tasks in a Performance trace during battle/motion before optimizing; keep gesture-driven motion at 1:1 tracking.
- **Payload:** compare `npm run build` output sizes under equivalent build conditions; investigate large regressions to their source (new dependency, unoptimized asset, accidental import of a heavy module into a light path).
- **Startup and interaction latency:** profile boot/hydration, route entry, large-grid interaction, save/resume, and input-to-feedback latency when users wait or input is blocked.
- **Memory and allocation:** confirm retained listeners/data, unbounded collections, repeated large allocations, or asset/object churn with heap/allocation evidence.
- **Synchronous work:** repeated parsing, sorting, cloning, validation, or storage access on render/input/transition paths is a finding when the scenario shows material blocking cost.
- **Background work:** timers, observers, effects, or hidden views should not consume sustained CPU without user-visible purpose.
- **Decorative randomness / cosmetic state:** re-rolls per render are owned by `SideEffectSurfaceAudit.md`; take them here only when the profiler shows real render cost.

## Known signals

- **React Compiler bailouts:** `react-compiler/react-compiler` ESLint errors on hot-path components.
- **Whole-store subscriptions:** `useXStore()` without a selector inside battle/grid components.
- **Wide effects:** `useEffect` bodies doing expensive work with broad or unstable dependency arrays.
- **Build size trend:** `npm run build` output size vs the previous pass (record the number in the handoff for comparison).
- **Runtime traces:** browser Performance recordings during a battle or Armory drag — long tasks and dropped-frame clusters. Playwright traces help locate the interaction and failure context; use runtime profiling for CPU, layout, and frame-cost claims. For a repeatable on-demand FPS / hitch harness (`npm run perf`, advisory targets, optional CDP deep traces), see [PERFORMANCE.md](../PERFORMANCE.md).
- **Heavy imports on light paths:** large modules imported into boot or menu paths that only need them later (respecting the eager-art and no-lazy-routes policy).
- **Repeated computation / serialization:** sorting, parsing, cloning, validation, snapshotting, or storage access repeated inside render, input, or high-frequency transitions.
- **Memory retention:** listeners, timers, caches, object URLs, or state histories retain data after their owning flow ends.
- **DOM and layout scale:** large grids, overlays, or hidden surfaces create excessive nodes, layout, paint, or measurement work.
- **Startup / resume timing:** asset preparation, hydration, migration, or route boot has reproducible user-visible latency.
