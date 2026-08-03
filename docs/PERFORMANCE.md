# Performance profiling

On-demand FPS / hitch profiling for Alchemy. **Not** part of CI, pre-push, or ordinary E2E discovery.

Use this when you are actively optimizing frame pacing and need repeatable numbers plus optional deep Chrome traces.

**Goal:** smooth locked **60 FPS** on a 60 Hz panel. Advisory bands and hitch/stall cutoffs are written for that; this harness does not measure sustained 120–144 FPS headroom (rAF is vsync-capped to the display).

## Quick start

```bash
# Production build + battle-effects (1 warm-up + 1 measured)
npm run perf

# Other scenarios / multi-rep baselines
npm run perf -- --scenario battle-end-turn
npm run perf -- --scenario armory-drag --runs 5
npm run perf -- --all

# Opt-in art diagnostics (no metrics aggregate)
npm run perf -- --scenario battle-art-diag

# Deep CDP trace (targets not authoritative — tracing adds overhead)
npm run perf:trace -- --scenario battle-effects

# Confirm on Electron (keep separate from Chromium numbers)
npm run perf -- --electron --scenario battle-end-turn

# Compare two prior report directories
npm run perf:compare -- reports/performance/<before> reports/performance/<after>
```

Reports land under `reports/performance/<timestamp>-<runtime>/` (gitignored):

- `summary.md` — human-readable target table, aggregates, worst gaps, long tasks
- `results.json` — machine-readable aggregates
- `environment.json` — OS, commit, dirty tree, viewport, DPR, refresh estimate
- `runs/<scenario>-<n>.json` — per-repetition metrics
- `traces/` — Chrome DevTools Performance JSON (trace mode only)

Headed Chromium uses a **1440×900** viewport (MacBook Air 13" logical / 16:10) so the window fits on-laptop. Battle scenarios inject `selectedAspectRatio: "16:10"`. The battle scene is a definite-size `[container-type:size]` container (`absolute inset-0`) so `cqh` card widths resolve; a flex-only scene made Chromium treat CQ block size as indefinite (`width: 0`) and portraits painted blank. Art readiness asserts painted rect size (not only `naturalWidth`, which passes for the transparent GIF fallback).

Open a deep trace in Chrome: DevTools → Performance → Load profile → select the `.json` file.

Reuse an existing `dist/` with `--skip-build` when iterating on the harness itself.

Short smoke / harness iteration (not for baselines):

```bash
PERF_MEASURE_MS=8000 PERF_MIN_FRAMES=50 npm run perf -- --scenario battle-end-turn --skip-build
```

## Scenarios

| Id                | Profile    | What it exercises                                                                                                                                                   |
| ----------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `battle-effects`  | continuous | Dense multi-type hand (dual-hit / heal+damage / statuses), play several cards per turn so combat texts overlap, then end turn (**default** for bare `npm run perf`) |
| `battle-end-turn` | transition | One play → wait for play FX to finish → end turn → draw (isolates discard / enemy / redraw)                                                                         |
| `armory-drag`     | continuous | Large inventory scroll + multi-step pointer drags                                                                                                                   |
| `battle-art-diag` | (diag)     | Art readiness diagnostics only — not included in `--all` metrics                                                                                                    |

`--all` runs the three metric scenarios above. All scenarios keep **real animations** (no `enableFastMode` / `fastBattle`). Setup and navigation are excluded from the measured window. Every loop includes one warm-up iteration before measured runs (including `--trace`). Battle decks use real `cardLibrary` ids so `hydrateCard` attaches production art — do not use E2E `placeholder` stubs here. `battle-effects` uses cost-0 multi-effect cards so a full hand can fire in one turn without mana gating; damage stays low so the fight lasts.

## Metrics

Collected via `requestAnimationFrame` timestamps and `PerformanceObserver` long tasks:

| Metric                             | Meaning                                            |
| ---------------------------------- | -------------------------------------------------- |
| Average FPS                        | Familiar summary — not the primary signal          |
| p50 / p95 / p99 / p99.9 frame time | Cadence and tail stalls                            |
| **1% low FPS**                     | `1000 / mean(slowest 1% frame times)`              |
| **0.1% low FPS**                   | `1000 / mean(slowest 0.1% frame times)`            |
| Frames >20 ms / >33.3 ms           | Clear single miss / double miss vs a 60 FPS budget |
| ≥50 ms hitches / ≥100 ms stalls    | Perceptible stutters                               |
| ≥50 ms long tasks                  | Main-thread blocking                               |
| Max / worst frame gaps             | Largest individual stalls                          |

Phases (`play-card`, `damage-feedback`, `enemy-turn`, `draw-hand`, `armory-scroll`, `armory-drag`) label long tasks in the report.

Invalid runs (too few frames, empty samples) **fail the harness**. Missing an advisory target does **not**.

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

On a 60 Hz MacBook you cannot measure sustained 120–144 FPS — rAF tops out near the panel refresh. You can still catch every jank path that breaks smooth 60.

## Advisory targets

Classification bands only — never CI gates. Compare only on the same machine, display, and runtime. Written for **smooth locked 60**, not high-refresh headroom.

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

Optimization rule of thumb: improve the targeted p99/hitch by ≥10% or eliminate a reproducible hitch; do not regress another scenario’s p95/p99 by >5%.

## Workflow

```text
Measure → identify failing scenario/phase → perf:trace that scenario → optimize → perf:compare before/after
```

## Limitations

- rAF sampling detects **main-thread cadence gaps**, not hardware GPU present timing.
- Trace mode adds overhead — do not treat its FPS numbers as authoritative.
- Never compare Chromium and Electron results as if they were the same environment.
- Local Electron profiling keeps the GPU enabled (`enableGpu`); CI Electron smoke still uses `--disable-gpu`.
- A 60 Hz panel cannot report sustained 120+ FPS; use a high-refresh display for that class of measurement.

## Layout

| Path                                | Role                                                   |
| ----------------------------------- | ------------------------------------------------------ |
| `playwright.performance.config.ts`  | Headed Chromium (or Electron), port **4176**, 1 worker |
| `performance/`                      | Sampler, metrics, report, scenarios                    |
| `scripts/run-performance.mjs`       | CLI entry (`npm run perf`)                             |
| `tests/performance/metrics.test.ts` | Unit tests for metrics/compare/report math             |

Related: [PerformanceAudit.md](./Audits/PerformanceAudit.md) (when to change code), [CONTRIBUTING.md](../CONTRIBUTING.md) (E2E helpers / animation policy).
