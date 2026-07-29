# Performance Audit

**Goal:** Fix confirmed runtime and payload performance problems — render churn, frame cost during battle/motion, bundle and asset weight regressions — without speculative memoization or degrading intentional spectacle.

## Intent

Confirm a performance cost with evidence (profiler trace, React Compiler diagnostics, build output sizes, reproducible jank) before changing code. A clean pass is valid. Do not invent frame-time or bundle-size CI gates; compare run-over-run and fix confirmed regressions through existing owners. Significant architecture changes (workers, virtualization frameworks, render pipelines) remain proposals per [README.md](README.md). If the scope is large, phase the plan.

## Hard stops

- Eager game-art loading at boot is intentional policy ([AGENTS.md](../../AGENTS.md) routes/boot rules) — asset weight at boot is not itself a finding. Do not introduce `React.lazy()` for route screens.
- Do not hand-add `useMemo` / `useCallback` / `React.memo` speculatively — the React Compiler owns memoization. Fix `react-compiler/react-compiler` ESLint errors instead; a compiler bailout on a hot component is a finding.
- Do not degrade intentional juice (combat float text, card fan, Motion stagger, Armory drag tracking) to win frames without a measured dropped-frame or long-task trace on that surface.
- Do not hand-edit optimized/generated asset outputs — asset optimization belongs to the `predev` / `prebuild` pipeline; fix sources.
- Do not move battle simulation into Workers unless Architecture already requires it (propose only).

## Domain rules

- **Render churn:** hot components (battle board, hand, large grids like compendium/armory) should not re-render wholesale on unrelated store writes. Prefer narrow Zustand selectors over whole-store subscriptions; confirm churn with the profiler, not by reading code alone.
- **Effects:** expensive work re-firing from unstable effect dependencies is a finding when traced; pure lifetime/cancellation bugs → `AsyncRaceAudit.md`.
- **Frame cost:** confirm dropped frames or long tasks in a Performance trace during battle/motion before optimizing; keep gesture-driven motion at 1:1 tracking.
- **Payload:** compare `npm run build` output sizes against the previous run; investigate large regressions to their source (new dependency, unoptimized asset, accidental import of a heavy module into a light path).
- **Decorative randomness / cosmetic state:** re-rolls per render are owned by `SideEffectSurfaceAudit.md`; take them here only when the profiler shows real render cost.

## Known signals

Optional discovery aids — choose your own probes.

- **React Compiler bailouts:** `react-compiler/react-compiler` ESLint errors on hot-path components.
- **Whole-store subscriptions:** `useXStore()` without a selector inside battle/grid components.
- **Wide effects:** `useEffect` bodies doing expensive work with broad or unstable dependency arrays.
- **Build size trend:** `npm run build` output size vs the previous pass (record the number in the handoff for comparison).
- **Runtime traces:** browser Performance panel / Playwright tracing during a battle or Armory drag — long tasks > 50ms, dropped-frame clusters.
- **Heavy imports on light paths:** large modules imported into boot or menu paths that only need them later (respecting the eager-art and no-lazy-routes policy).
