# Performance profiling

FPS / hitch profiling for Alchemy. Seeded reachable battles provide discovery by default; fixed realistic journeys remain for same-machine comparisons. Nightly discovery spans all three modes. Performance targets are advisory and are not push gates.

For harness failures, the [failure-first triage guide](./REFERENCE.md#failure-first-triage) helps locate evidence; open a known relevant trace or per-run artifact directly when useful.

Use this when you are actively optimizing frame pacing and need repeatable numbers plus optional deep Chrome traces.

Reports capture the actual renderer viewport, including native Electron window dimensions, rather than assuming the requested browser size.

**Goal:** smooth locked **60 FPS** on a 60 Hz panel. Advisory bands and hitch/stall cutoffs are written for that; this harness does not measure sustained 120–144 FPS headroom (rAF is vsync-capped to the display).

## Workflow

```text
Measure → identify failing scenario/phase → perf:trace that scenario → optimize → perf:compare before/after
```

Compare identical workloads and environments, inspect the targeted cost, and
preserve visual/audio behavior. [Comparison validity](#comparison-validity) defines
which reports can establish an improvement.

## Quick start

```bash
npm run perf -- --electron --seed 9
npm run perf -- --all
npm run perf -- --replay reports/performance/<run>/replay/seeded-discovery.json --electron
npm run perf:trace -- --scenario battle-effects
npm run perf:compare -- reports/performance/<before> reports/performance/<after>
npm run perf -- --help
```

Read the summary first, then follow its evidence for a specific hypothesis.
`reports/current-run.md` / `.json` locate the latest report-producing command;
they are overwritten pointers, not history. Reports are ignored, opt-in evidence.
Load deep-trace JSON through Chrome DevTools → Performance → Load profile.

[Measurement setup](#measurement-setup) covers builds, warm-up and repetition;
[scenarios and replay](#scenarios-and-replay) covers workload selection.

## Measurement setup

Ordinary runs rebuild the renderer so a clean Git checkout cannot silently reuse an older build.
Reuse an existing renderer with `--skip-build` only when intentionally profiling that build, such as when iterating on the harness itself. Keep `ALCHEMY_EDITION` consistent: the [edition contract](./STEAM_DEMO.md#edition-contract) selects `dist/` for full and `dist-demo/` for demo.

Keep ordinary profiling at the default **one measured run per scenario** to limit
local CPU/GPU use. The harness also performs one unmeasured warm-up so cold JIT,
layout, and asset initialization do not contaminate the recorded sample. Pass
`--electron --cold` to intentionally measure first use; each repetition launches a
fresh Electron process and skips warm-up. When noise prevents a reliable conclusion,
use a bounded set of additional runs for the affected scenario under the same
conditions. Report the repetitions and observed variation; do not select only the
best sample or repeat the full scenario suite unnecessarily.

Use `PERF_MEASURE_MS` / `PERF_MIN_FRAMES` overrides only for harness iteration,
not baselines. For a short smoke run:

```bash
PERF_MEASURE_MS=8000 PERF_MIN_FRAMES=50 npm run perf -- --scenario battle-end-turn --skip-build
```

## Scenarios and replay

| Selection                   | Workload                                                                                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Default / `--suite seeded`  | One reachable battle generated through the playthrough engine; fresh uint32 seed printed before generation and retained in case/replay artifacts. Use `--seed <uint32>` to reproduce |
| `--scenario campaign-early` | Fixed Campaign opening battle                                                                                                                                                        |
| `--all`                     | Fixed realistic journeys, using their recorded fixtures                                                                                                                              |
| `--suite synthetic --all`   | Isolated stress loops, including the older battle, account, map and shop loops                                                                                                       |
| `startup-first-use`         | Cold-start observations, separate from frame targets                                                                                                                                 |
| `battle-art-diag`           | Opt-in artwork diagnosis                                                                                                                                                             |

The [scenario catalog](../performance/catalog.json) and `npm run perf -- --help`
own IDs, defaults and sample requirements. Seeded sweeps discover cases; replay
an interesting case for controlled comparison.

### Checkpoints and fixture grants

Generated cases retain a current-format save, encounter provenance, available-card
and effect-kind inventory, and the complete randomized account. Discovery starts
from `performance-random-account-v1`: legal Basic/Astral/Unique equipment with
production affix rolls, one permanent Trinket, and talent allocations respecting
row prerequisites and point budgets, mixing hero affinities and other keywords.
Normal placement rules include two-handed/Quiver restrictions. Grants are labeled
in `coverage.fixtureGrants` with identities, rolls, placement and talents; they
are not earned progression. Normal play reaches the battle, and production setup
computes its effects without fabricated decks, enemy stats or manifests.

Discovery samples starts across both careers, balancing boss/ordinary groups
when both were reached. Fixed developed Campaign/account journeys use a second
career after earned progression. The fixed `trinket-v1` journey starts with
Companion's Collar equipped, Oathkeeper owned and economy resources; its reached
battle and starting fixture remain labeled separately from earned loot.

### Actions and replay validity

Realistic journeys use normal animation and authored cards/costs. Generated cases
disable Auto End Turn because manual actions are recorded; `coverage.controls`
retains this choice. Dedicated automatic-turn pacing remains unmeasured.
Discovery reproducibly chooses legal cards/Wishes, preferring previously unplayed
choices, for up to six turns/eight plays per turn. Fixed policies retain their
limits; older replay bundles retain three turns.

Measured actions, named frame segments and replay bundles are recorded separately
from setup wall time. Replay requires the same checkpoint and action sequence;
divergence fails. Segments cover transitions, draft, combat, rewards, purchases,
account navigation and resume. Each requires completed actions and frames.
A card click counts only after its hand identity leaves the hand.

The summary separates checkpoint inventory from measured card/Wish labels and
play/end-turn counts. Inventory never proves a mechanic triggered; conditional effects, procs,
status combinations and abilities need direct evidence. Discovery may omit enemy-turn
measurement only after a win before entering that phase with no recorded enemy action.
Entered phases cannot disappear when stalled; fixed battles always require that segment.
Fixed comparisons additionally match checkpoint hash, action path, segment names and
counts under [comparison validity](#comparison-validity).

### Nightly and diagnostics

[Nightly](../.github/workflows/nightly.yml) owns mode/hero rotation and profiling
budgets. Reports retain seeds and replays; incomplete generated cases fail without
easier fallbacks. The [scenario catalog](../performance/catalog.json) owns fixed
transaction journeys; the [memory soak](#gameplay-memory-soak) has a separate budget.

Battle `alchemy:battle:*` User Timing marks last for one session. Preparation/reset
cancels old transfers before clearing them; stale draw/discard callbacks cannot
append terminal marks. Startup and sampler marks have separate lifetimes.

## Metrics

Collected via `requestAnimationFrame` timestamps and `PerformanceObserver` long tasks, Long Animation Frames (when supported), and input events:

| Metric                             | Meaning                                                                                  |
| ---------------------------------- | ---------------------------------------------------------------------------------------- |
| Average FPS                        | Sampled gap rate (`frameCount / sampledDuration`)                                        |
| p50 / p95 / p99 / p99.9 frame time | Cadence and tail stalls                                                                  |
| **1% low FPS**                     | `1000 / mean(slowest 1% frame times)`                                                    |
| **0.1% low FPS**                   | `1000 / mean(slowest 0.1% frame times)`                                                  |
| Frames >20 ms / >33.3 ms           | Clear single miss / double miss vs a 60 FPS budget                                       |
| ≥50 ms hitches / ≥100 ms stalls    | Perceptible stutters                                                                     |
| ≥50 ms long tasks                  | Main-thread blocking                                                                     |
| ≥50 ms Long Animation Frames       | Diagnostic script and rendering timing for slow frames, even when no single task is long |
| Max / worst frame gaps             | Largest individual stalls                                                                |
| Event duration / input delay       | Browser Event Timing for sampled user interactions                                       |
| Before/after runtime snapshot      | Heap, DOM/media nodes, and Electron working set                                          |
| Startup observations               | Renderer-ready and Electron launch-to-ready time                                         |

Phases (`play-card`, `damage-feedback`, `enemy-turn`, `draw-hand`) label hitches, long tasks, and input events based on their exact recorded start timestamps against the phase timeline. Observers drain pending records (`takeRecords()`) at shutdown before disconnection to preserve terminal events.

The sampler waits for its first frame callback before scenario actions begin, so immediate interaction stalls have a baseline. Long Animation Frames are diagnostic only: the raw sample and summary retain their phase, blocking duration, rendering tail, and top scripts. They do not change advisory target classification. An unsupported runtime is reported as unavailable rather than as zero frames.

Average FPS is computed strictly across sampled frame gaps, avoiding distortion from unsampled window edges, while total measured duration is retained for rate budgets.

Invalid runs (too few frames, empty samples, or missing/non-positive startup observations) **fail the harness**. Setup or warm-up failures that produce no metrics are listed as incomplete scenario coverage in the summary. Measured interaction failures and replay divergence are also labeled as failures, even when their frame samples are long enough. Failed or incomplete reports cannot be compared as optimization evidence. Missing an advisory target does **not**.

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

### Extreme player workloads and RAM

`npm run perf -- --suite extreme --all --electron` profiles constructed stress
fixtures separately from earned journey checkpoints. Reuse a current build with
`--skip-build`. Nightly runs one extreme in each existing discovery slot:

- `inventory-200`: 200 owned Basic/Astral drops with legal affix counts, affinities
  and roll values; 20 cycles of typing a search, filtering, sorting, paging,
  equipping and returning through the menu. The acknowledged native/browser save
  must contain all 200 items. Armory renders a page, not 200 simultaneous tiles.
- `large-deck`: a 60-card deck representing a long run, with authored effects and
  art; 20 inspections traverse several pages, hover cards, close and reopen the
  dialog. The UI must report 60 cards. Pagination bounds simultaneous rendering.
- `combat-feedback-burst`: a full seven-card hand plus Burn, Poison and Bleed on
  both actors. Normal card and end-turn controls resolve authored cards and status
  ticks. A renderer observer must capture at least six concurrent numeric texts
  and two bursts; an idle battle cannot satisfy the workload.

Every measured scenario records RAM about once per second plus endpoints.
V8's CDP heap reading supplies live renderer JS usage without the bucketed
`performance.memory` estimate. Electron's process metrics supply working sets for
the browser process, renderers, GPU and utilities, retaining process IDs in raw
JSON. Reports show first, sampled peak, last and change for the heap, combined
working set and each process type. Browser runs have no Electron RAM measurement;
unavailable metrics are never reported as zero.

Inventory/deck loops and the gameplay soak also retain snapshots at the same
settled screen after each cycle. Use these to distinguish rising retention from
temporary allocation and normal garbage collection. There are no reloads between
measured cycles and no forced GC, playback suppression or animation shortcuts.
Periodic samples and settled samples are reported separately; sampling stops and
drains before teardown. Performance launches disable the automation host flag so
the app creates normal music, ambience and SFX resources. Chromium mutes speaker
output; playback and completion events still run. The soak requires completed
SFX to increase during measurement, preventing silent-host runs from passing as
audio cleanup evidence. Functional E2E retains its silent-host policy.
Reports record this audio mode and reject comparisons against earlier reports
that did not declare normal playback.
These journeys protect real renderer allocation and
cleanup behavior, which unit/DOM tests cannot measure.

Combined working sets include shared pages, so they are not unique physical RAM.
One-second sampling can miss short peaks. New art and gameplay can populate
legitimate caches; growth alone does not prove a leak, and there is no arbitrary
universal RAM limit. Investigate persistent growth after repeated identical
cycles, retained action resources, or a large process-specific peak. Long sessions
and target-device RAM budgets still need separate acceptance.

### Coverage gaps

The [catalog](../performance/catalog.json) describes available workloads; each
report records what actually completed. Checkpoint generation happens outside
renderer measurement. Inventory, an available scenario or a reached screen does
not prove an effect triggered or an interaction was measured.

Important limits remain:

- Combat discovery does not guarantee every mechanic or automatic-turn pacing.
- Transaction journeys and the soak cover selected services, purchases and end
  states; they do not establish every destination, account action or demo ending.
- Frame, input and memory probes do not qualify physical audio, GPU presentation,
  OS suspend, minimum-spec hardware, Proton or Deck behavior.

When extending coverage, require reachable checkpoints and completed-action/frame
segments. Fixed replays preserve checkpoint and action identity for comparison;
discovery finds candidates. Durations and minimum samples belong to the catalog
and `npm run perf -- --help`.

Reports retain per-run samples, aggregates, environment/display metadata and,
when requested, traces. Follow summary links to the exact evidence rather than
inferring coverage from a fixture or a report filename.

Judge an optimization by repeatable improvement in the targeted cost relative to
run-to-run variation, then check affected neighboring scenarios. Preserve visuals,
particle counts, animation timing and sound. Rendering changes need matched pixel
comparison or existing parity checks for the affected calculation; better FPS
and passing builds alone leave presentation parity unverified.

## Comparison validity

`perf:compare` derives duration-normalized rates for hitches, stalls, and long tasks (per 30 s) so runs of unequal duration are compared fairly. Both reports must contain usable environment metadata and valid, complete metrics. Material environment differences (runtime, trace mode, cold mode, platform, CPU architecture, viewport, DPR, refresh rate, browser, target profile, runs per scenario) are rejected with clear compatibility errors. Optional display and browser metadata must be present on both sides when present on either. Duplicate scenario names and invalid measured runs or journey segments reject comparison.

Pooling preserves each run's minimum frame requirement and starts a new phase timeline for each run. An empty or short run cannot be hidden by a larger neighboring run. Invalid samples retain diagnostic numbers but receive red target bands; they never qualify as optimization evidence.

## Finding the work behind a slow frame

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
- Smooth rAF sampling can hide uneven updates inside a capped effect loop. Inspect actual draw cadence when an effect visibly jitters despite stable frame metrics.
- Trace mode adds overhead — do not treat its FPS numbers as authoritative.
- The nightly Xvfb Electron run validates seeded journeys and retains replay evidence, but its virtual display is not a GPU-enabled desktop baseline. Use a controlled local Electron machine for numeric comparisons.
- Never compare Chromium and Electron results as if they were the same environment.
- Local Electron profiling keeps the GPU enabled (`enableGpu`); CI Electron uses explicit SwiftShader software WebGL (with `--disable-gpu` for ordinary smoke). Never compare the two — same-machine, same-runtime comparisons only.
- Electron profiling uses a visible window so focus-gated canvas effects run. Keep it focused during measurement; older hidden-window reports omit that work and are not comparable.
- Runtime deltas are diagnostic signals, not automatic leak verdicts. Allow for garbage collection and confirm suspicious monotonic growth across repeated runs.
- A 60 Hz panel cannot report sustained 120+ FPS; use a high-refresh display for that class of measurement.

## Layout

| Path                                                    | Role                                               |
| ------------------------------------------------------- | -------------------------------------------------- |
| `playwright.performance.config.ts`                      | Performance test runtime configuration             |
| `performance/frame-sampler.ts`                          | In-page rAF / longtask / event collector           |
| `performance/metrics.ts`                                | Pure aggregation, targets, and classification      |
| `performance/report.ts`                                 | Filesystem output and summary markdown             |
| `performance/fixtures.ts`                               | Playwright fixtures: warm-up, runs, aggregates     |
| `performance/compare-model.mjs` + `compare-model.d.mts` | Before/after diff and compatibility gates          |
| `performance/cdp-trace.ts` + `trace-insights.ts`        | Deep-trace capture and slow-frame evidence         |
| `performance/battle-setup.ts` + `battle-helpers.ts`     | Deterministic battle bootstrap and interactions    |
| `performance/battle-art-diagnostics.ts`                 | Art failure diagnostics (`MIN_PAINT_PX`)           |
| `performance/scenario-data.ts`                          | Decks and inventories for scenarios                |
| `performance/catalog.json`                              | Scenario and metric registry                       |
| `scripts/run-performance.mjs`                           | CLI entry (`npm run perf`, `npm run perf:compare`) |
| `tests/performance/`                                    | Metrics, compare, and report unit tests (Node)     |

Run metric and comparison unit tests with `npm run test:unit -- tests/performance`.
They also run in the full unit suite; `npm test` contains only fixed local smoke suites.

Related: [PerformanceAudit.md](./Audits/PerformanceAudit.md) (when to change code), [CONTRIBUTING.md](../CONTRIBUTING.md) (E2E helpers / animation policy).

## Eager bundle size

Bundle ceilings live with the bundle-budget owner (`scripts/lib/verification/bundle-budget.mjs`, `npm run check:bundle`), not this FPS harness. See that owner for ceilings, chunk policy, and history.

## Gameplay memory soak

`npm run perf -- --scenario memory-soak --electron --skip-build` uses the existing
developed `meta-journey` checkpoint, with its fixture provenance retained in the
case artifacts. It runs one process/profile with one initial injection. Normal
battle, reward, shop, inspection, Armory, and menu controls advance the account;
there are no reloads or resets between cycles. A cycle performs gameplay and a
meta excursion, returning to the same settled menu for sampling. Legal gear moves
are conditional on current ownership and combat reservations.

`PERF_MEASURE_MS=300000 PERF_SOAK_MIN_CYCLES=20 PERF_RUNS=1` is the nightly setting;
the default measurement is thirty minutes. Setup warms meta routes and an initial
gameplay cycle. Samples record cycle/time, renderer heap when available, Electron
working set, DOM nodes, canvases, detached active and retained SFX, overdue SFX, and owned action
animation elements. The probe observes actual media lifecycle without shortening
or replacing playback; speaker output is muted by the launcher. DOM audio-element count is separate from SFX
ownership and cannot establish that detached cues were released.

Stalled controls, overdue finite-duration cues, and unreleased
card/Armory transfers fail the journey. A minimum cycle count prevents an idle
renderer from passing the soak. Heap growth remains diagnostic because new gameplay
content can legitimately populate caches; there is no invented memory threshold.
The existing replay file retains the starting checkpoint and cycle log. Soak
replay repeats the recorded number of cycles with the same control policy; real
renderer timing remains observational. Existing frame and input targets remain
in the report. Physical audio quality,
OS suspend, Proton, and Deck performance require external acceptance.
