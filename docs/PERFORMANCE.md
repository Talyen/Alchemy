# Performance profiling

On-demand FPS / hitch profiling for Alchemy. **Not** part of CI, pre-push, or ordinary E2E discovery.

For harness failures, use the [failure-first triage guide](./REFERENCE.md#failure-first-triage) before opening a trace or per-run artifact.

Use this when you are actively optimizing frame pacing and need repeatable numbers plus optional deep Chrome traces.

**Goal:** smooth locked **60 FPS** on a 60 Hz panel. Advisory bands and hitch/stall cutoffs are written for that; this harness does not measure sustained 120–144 FPS headroom (rAF is vsync-capped to the display).

## Quick start

```bash
npm run perf
npm run perf -- --all
npm run perf:trace -- --scenario battle-effects
npm run perf -- --electron --scenario battle-end-turn
npm run perf -- --electron --cold --scenario startup-first-use
npm run perf:compare -- reports/performance/<before> reports/performance/<after>
npm run perf -- --help
```

`reports/current-run.md` and `reports/current-run.json` point to the latest
report-producing command. Open that pointer first; it is ephemeral — overwritten on the next
run — and is not a historical index. `reports/` is otherwise opt-in evidence, not committed history.

Agent read order: open the summary first, then the machine-readable result, and
only then a relevant per-run file or trace. Traces are opt-in evidence and
should not be loaded for an ordinary FPS question.

Open a deep trace in Chrome: DevTools → Performance → Load profile → select the `.json` file.

Ordinary runs rebuild the renderer so a clean Git checkout cannot silently reuse an older build.
Reuse an existing `dist/` with `--skip-build` only when intentionally profiling that build, such as when iterating on the harness itself.

Keep ordinary profiling at the default **one measured run per scenario** to limit
local CPU/GPU use. The harness also performs one unmeasured warm-up so cold JIT,
layout, and asset initialization do not contaminate the recorded sample. Pass
`--electron --cold` to intentionally measure first use; each repetition launches a
fresh Electron process and skips warm-up. Increase `--runs` only when explicitly
requested for statistical investigation.

Short smoke / harness iteration (not for baselines):

```bash
PERF_MEASURE_MS=8000 PERF_MIN_FRAMES=50 npm run perf -- --scenario battle-end-turn --skip-build
```

Scenario IDs, defaults, and diagnostic-only modes are maintained by the
performance CLI; use `npm run perf -- --help` instead of copying that list here.
All scenarios keep real animations, exclude setup/navigation from the measured
window, and use production card-library art rather than E2E placeholders.

## Metrics

Collected via `requestAnimationFrame` timestamps and `PerformanceObserver` long tasks:

| Metric                             | Meaning                                            |
| ---------------------------------- | -------------------------------------------------- |
| Average FPS                        | Sampled gap rate (`frameCount / sampledDuration`)  |
| p50 / p95 / p99 / p99.9 frame time | Cadence and tail stalls                            |
| **1% low FPS**                     | `1000 / mean(slowest 1% frame times)`              |
| **0.1% low FPS**                   | `1000 / mean(slowest 0.1% frame times)`            |
| Frames >20 ms / >33.3 ms           | Clear single miss / double miss vs a 60 FPS budget |
| ≥50 ms hitches / ≥100 ms stalls    | Perceptible stutters                               |
| ≥50 ms long tasks                  | Main-thread blocking                               |
| Max / worst frame gaps             | Largest individual stalls                          |
| Event duration / input delay       | Browser Event Timing for sampled user interactions |
| Before/after runtime snapshot      | Heap, DOM/media nodes, and Electron working set    |
| Startup observations               | Renderer-ready and Electron launch-to-ready time   |

Phases (`play-card`, `damage-feedback`, `enemy-turn`, `draw-hand`) label hitches, long tasks, and input events based on their exact recorded start timestamps against the phase timeline. Observers drain pending records (`takeRecords()`) at shutdown before disconnection to preserve terminal events.

The sampler waits for its first frame callback before scenario actions begin, so immediate interaction stalls have a baseline.

Average FPS is computed strictly across sampled frame gaps, avoiding distortion from unsampled window edges, while total measured duration is retained for rate budgets.

Invalid runs (too few frames, empty samples, or missing/non-positive startup observations) **fail the harness**. Missing an advisory target does **not**.

The `startup-first-use` report includes `rendererStartupReadyMs`; Electron runs also include
`electronLaunchToReadyMs`. Use `--electron --cold` for the player-facing cold-start value.
Startup observations are wall-clock diagnostics and are not mixed into frame-time targets.

### Reading the numbers

Ideal frame budget at 60 Hz is **~16.7 ms**. Instantaneous FPS for one gap ≈ `1000 / gapMs`:

| Gap           | Instantaneous FPS | Feel at 60 Hz                    |
| ------------- | ----------------: | -------------------------------- |
| ~16.7 ms      |                60 | On time                          |
| >20 ms        |               <50 | Clear single-frame miss          |
| >33.3 ms      |               <30 | Double miss / visible drop       |
| ≥50 ms hitch  |               ≤20 | ~3 missed vsyncs — a freeze blip |
| ≥100 ms stall |               ≤10 | ~6 missed vsyncs — a hard stall  |

A hitch/stall count is **how many individual gaps** crossed that threshold, not “the game ran at 20 FPS for a while.” We do **not** green-gate on exactly 16.67 ms (OS/rAF jitter is too noisy); the 20 / 33.3 / 50 / 100 ms ladder is the intentional smooth-60 signal.

## Advisory targets

Classification bands only — never CI gates. Compare only on the same machine, display, and runtime.

### Continuous motion (scroll / drag / sustained battle FX)

| Signal            |    Green |
| ----------------- | -------: |
| p95 frame time    |   ≤18 ms |
| p99 frame time    |   ≤20 ms |
| p99.9 frame time  | ≤33.3 ms |
| 1% low            |  ≥50 FPS |
| 0.1% low          |  ≥30 FPS |
| Frames >20 ms     |      ≤2% |
| Frames >33.3 ms   |    ≤0.5% |
| ≥50 ms hitches    |        0 |
| ≥100 ms stalls    |        0 |
| ≥50 ms long tasks |        0 |

### Transition-heavy (card bursts / end-turn)

| Signal            |     Green |
| ----------------- | --------: |
| p95 frame time    |    ≤20 ms |
| p99 frame time    |    ≤25 ms |
| p99.9 frame time  |    ≤50 ms |
| 1% low            |   ≥40 FPS |
| 0.1% low          |   ≥20 FPS |
| Frames >20 ms     |       ≤5% |
| ≥50 ms hitches    | ≤1 / 30 s |
| ≥100 ms stalls    |         0 |
| ≥50 ms long tasks | ≤1 / 30 s |

Scenario mapping: `battle-effects` is continuous-motion (sustained FX); `battle-end-turn` is transition-heavy (card bursts / end-turn).

Optimization rule of thumb: improve the targeted p99/hitch by ≥10% or eliminate a reproducible hitch; do not regress another scenario’s p95/p99 by >5%.

## Workflow

```text
Measure → identify failing scenario/phase → perf:trace that scenario → optimize → perf:compare before/after
```

`perf:compare` derives duration-normalized rates for hitches, stalls, and long tasks (per 30 s) so runs of unequal duration are compared fairly. Material environment differences (runtime, trace mode, cold mode, platform, viewport, DPR, refresh rate, browser, target profile) are rejected with clear compatibility errors.

### Finding the work behind a slow frame

Every measured run retains a `runs/<scenario>-<run>-sample.json` containing the full
frame timeline, phase marks, long tasks, and input events. The summary links to it;
aggregate timestamps concatenate runs, while this file keeps run-local timestamps.

Trace runs add a **Slow-frame evidence** table for the worst twenty gaps over 20 ms,
including drops below the 50 ms hitch cutoff. Sampler start/end marks align the
browser trace clock with the frame timeline and identify the renderer main thread.
The table lists phases crossed during each gap, recorded work by self time, and
unaccounted time. Nested events count once; other threads and work outside the
measured window are excluded. Function names and source locations appear when
Chrome provides them. Detailed evidence remains in the adjacent `-insight.json`.

Treat this as a shortlist for investigation, not an automatic root-cause verdict.
Open the full trace around that interval to inspect call stacks, rendering, and
other threads. Missing trace markers report attribution as unavailable; dropped
trace events fail capture. Screenshots are omitted to reduce trace overhead.

## Limitations

- rAF sampling detects **main-thread cadence gaps**, not hardware GPU present timing.
- Trace mode adds overhead — do not treat its FPS numbers as authoritative.
- Never compare Chromium and Electron results as if they were the same environment.
- Local Electron profiling keeps the GPU enabled (`enableGpu`); CI Electron smoke still uses `--disable-gpu`. Never compare the two — same-machine, same-runtime comparisons only.
- Runtime deltas are diagnostic signals, not automatic leak verdicts. Allow for garbage collection and confirm suspicious monotonic growth across repeated runs.
- A 60 Hz panel cannot report sustained 120+ FPS; use a high-refresh display for that class of measurement.

## Layout

| Path                                | Role                                                     |
| ----------------------------------- | -------------------------------------------------------- |
| `playwright.performance.config.ts`  | Performance test runtime configuration                   |
| `performance/`                      | Sampler, metrics, comparison model, reports, scenarios   |
| `scripts/run-performance.mjs`       | CLI entry (`npm run perf`, `npm run perf:compare`)       |
| `tests/performance/metrics.test.ts` | Metrics, compare, observer, and report unit tests (Node) |

Metric and comparison unit tests in `tests/performance/` run in the ordinary Node Vitest suite (`npm test`).

Related: [PerformanceAudit.md](./Audits/PerformanceAudit.md) (when to change code), [CONTRIBUTING.md](../CONTRIBUTING.md) (E2E helpers / animation policy).
