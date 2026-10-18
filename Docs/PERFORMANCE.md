# Performance profiling

FPS / hitch profiling for Alchemy. Seeded reachable battles provide discovery by default; fixed realistic journeys remain for same-machine comparisons. Nightly discovery spans all three modes. Performance targets are advisory and are not push gates.

For harness failures, the [failure-first triage guide](./REFERENCE.md#failure-first-triage) helps locate evidence; open a known relevant trace or per-run artifact directly when useful.

Use this when you are actively optimizing frame pacing and need repeatable numbers plus optional deep Chrome traces.

Reports capture the actual renderer viewport, including native Electron window dimensions, rather than assuming the requested browser size.

**Goal:** smooth locked **60 FPS** on a 60 Hz panel. Advisory bands and hitch/stall cutoffs are written for that; this harness does not measure sustained 120–144 FPS headroom (rAF is vsync-capped to the display).

## Quick start

```bash
npm run perf
npm run perf -- --all
npm run perf -- --suite synthetic --all
npm run perf -- --suite seeded --electron
npm run perf -- --suite seeded --seed 9 --electron
npm run perf -- --replay reports/performance/<run>/replay/seeded-discovery.json --electron
npm run perf:trace -- --scenario battle-effects
npm run perf -- --electron --scenario campaign-developed
npm run perf -- --electron --scenario campfire-brewing
npm run perf -- --electron --scenario transmutation-journey
npm run perf -- --electron --scenario crafting-journey
npm run perf -- --electron --cold --scenario startup-first-use
npm run perf:compare -- reports/performance/<before> reports/performance/<after>
npm run perf -- --help
```

`reports/current-run.md` and `reports/current-run.json` point to the latest
report-producing command. Use it to locate an unknown run; it is ephemeral — overwritten on the next
run — and is not a historical index. `reports/` is otherwise opt-in evidence, not committed history.

Start with the summary when the cause is unclear. Open a relevant result,
per-run file, or trace directly for a specific hypothesis. Choose evidence
that answers the question; ordinary FPS questions usually need only the summary.

Open a deep trace in Chrome: DevTools → Performance → Load profile → select the `.json` file.

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

Short smoke / harness iteration (not for baselines):

```bash
PERF_MEASURE_MS=8000 PERF_MIN_FRAMES=50 npm run perf -- --scenario battle-end-turn --skip-build
```

The default is one seeded reachable battle with a fresh recorded seed. Use `--scenario campaign-early` for the fixed Campaign opening battle. `--all` runs the fixed realistic suite; `--suite synthetic --all` runs the earlier isolated stress loops. `--suite seeded` generates one reachable case from the balance playthrough engine with a fresh random uint32 seed. The seed is printed before generation and retained in the case and replay bundle; pass `--seed <uint32>` to reproduce it. Every generated case includes a current-format save checkpoint, encounter provenance, and an inventory of available cards and declared card effect kinds. The checkpoint and replay preserve the complete randomized account. Fixed journeys use their existing fixtures. The developed Campaign and account journeys use a second career, after earning talents and other progression.

Discovery starts from the labeled `performance-random-account-v1` fixture: the seeded hero receives a random legal gear loadout across Basic, Astral, and Unique definitions, production affix rolls, one random permanent Trinket, and randomized talent trees and purchase depths. Talent choices obey row prerequisites and point budgets, with a mix of hero affinities and other keywords. Gear placement uses the normal equipment rules, including two-handed and Quiver restrictions. Heroes vary by seed; nightly rotation covers all eight in every mode over eight workflow runs.

The trinket journey starts from the labeled `trinket-v1` account fixture, which grants equipped Companion's Collar and owned Oathkeeper alongside the economy fixture's resources. Its battle checkpoint is reached through normal play; these starting items are fixture grants, not earned loot. The coverage inventory records the starting fixture name.

The realistic journeys run normal animations and production cards with authored costs and effects. Generated checkpoints disable the Auto End Turn preference because the harness explicitly records manual end-turn actions; `coverage.controls` retains this choice. Automatic turns would race card selection and mislabel enemy work. Dedicated automatic-turn timing remains unmeasured. Each measured run records actions, named segments, and a replay bundle under `replay/`. `--replay <bundle>` loads the same checkpoint and requires the same action sequence; divergence invalidates the run. The setup wall time is reported separately. Screen transitions, draft, combat, reward claims, shop purchases, account navigation, and resume have their own frame segments. Segment rows require completed actions and frames, so a skipped or stalled journey fails rather than reporting an easy FPS value.

Discovery samples reachable battle starts across both careers, balancing boss and ordinary encounter groups when both were reached. It does not fabricate battle decks, enemy stats, or combat effect manifests. The starting account gear, Trinket, and talents are fixture grants, not earned progression; `coverage.fixtureGrants` records their exact identities, affix rolls, placement, and talent allocation. Normal play reaches the battle checkpoint, and production battle setup computes the granted loadout effects. New discovery cases try up to six turns and eight legal card plays per turn, selecting reproducibly among cards and Wish choices and preferring choices not yet played in that measurement. Fixed journeys keep their existing control policy and turn limits. Older replay bundles retain their original three-turn limit.

The summary separates **checkpoint inventory** from **measured actions** (played card labels, Wish choice labels, card plays, and end-turn actions). A card click counts only after its hand identity leaves the hand. Inventory is not evidence that a mechanic triggered: conditional effects, gear procs, status combinations, and enemy abilities still need direct evidence before claiming coverage. A random burst may legally win before an enemy turn; discovery omits the enemy-turn segment only when the phase was never entered and no action was recorded. Entered phases must meet their action and frame requirements, so a stalled enemy turn cannot disappear from the report. Fixed battle journeys always require the enemy-turn segment.

Case IDs, defaults, and diagnostics are maintained by the CLI and `performance/catalog.json`; use `npm run perf -- --help` for the current list. Fixed case comparisons require the same checkpoint hash, action path, segment names and action counts, in addition to the environment checks below. Seeded sweeps are exploratory; replay an interesting case for a controlled before/after comparison.

Battle stage User Timing marks (`alchemy:battle:*`) accumulate within the current battle session for animation diagnostics. The battle session owner clears these marks when preparing or resetting a session, after cancelling old transfers; stale draw and discard completions must not add terminal marks. Startup and performance sampler marks have separate lifetimes.

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

The fixed suite covers Campaign, Labyrinth, Wildwood, rewards, shops, Campfire brewing, transmutation, Armory crafting and salvage, account screens, a battle with an equipped trinket and owned Unique in Armory, resume, and startup. Nightly discovery derives three seeds from the workflow run number: one per game mode, with each mode rotating through all eight heroes over eight workflow runs. Higher seed bits vary difficulty, reward policy, and the playthrough world. Each job retains its seed and replay artifacts; generated cases that cannot complete fail visibly rather than falling back to an easy fixture. `--seed` accepts any unsigned 32-bit seed locally. The older `battle-effects`, `battle-end-turn`, talents, collection, options, Labyrinth, Armory, and shop loops remain in the synthetic suite for isolated stress diagnosis. `startup-first-use` measures cold-start observations, not frame targets. `battle-art-diag` remains opt-in. Nightly also profiles one of the three fixed transaction journeys in each mode slot, covering Campfire brewing, transmutation, and crafting/salvage on every workflow run. Nightly runs one five-minute `memory-soak` in the existing discovery job, with at least 20 completed gameplay cycles; the manual soak defaults to thirty minutes.

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

The registry describes measured journeys, not all game features. Preparing a save through the playthrough engine happens outside renderer measurement and does not cover the screens visited during generation.

| Area                | Current measured coverage                                                                                                                          | Missing performance workload                                                                                                                                                         |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Combat              | Fixed battles plus seeded reachable encounters, card and Wish choices, enemy turns                                                                 | Guaranteed coverage of every effect, status interaction, companion, trinket, Unique proc, and boss mechanic; actual triggered-mechanic telemetry and dedicated automatic-turn pacing |
| Run destinations    | Reward claim, destination selection, card purchase, transmutation, Labyrinth inspection, Wildwood draft                                            | Alchemist Shop purchase/mixing/distilling, Mystery choices/deck pickers, Corruption, trinket/gear shop interactions, and Wildwood removal workloads                                  |
| Campfire            | Reachable brewing selection, saved result and departure; conditional Rest in the memory soak                                                       | Dedicated rest/healing and guaranteed mixed-Potion selection workloads                                                                                                               |
| Account progression | Armory equipment/inspection, 200-item filtering/paging, currency targeting, crafting and salvage; Homestead and Talent navigation, Collection tabs | Every currency transformation, Homestead purchases and bonds, Talent purchases, and large complete Collection inspection workloads                                                   |
| Run lifecycle       | Startup and checkpoint resume; incidental end states in the soak                                                                                   | Measured mode/hero/difficulty selection, victory/defeat rewards, hero unlock, and demo completion journeys                                                                           |
| Runtime             | Frame gaps, main-thread blocking, input timing, resource snapshots and gameplay soak                                                               | Performance-specific renderer error assertions, hardware GPU present timing, physical audio quality, suspend/resume, Proton, and Steam Deck acceptance                               |

The `campfire-brewing` and `transmutation-journey` cases capture reachable visits before selection. Their required segments measure selection, the saved result, and departure. `crafting-journey` captures an earned legal currency application between careers from the labeled `economy-v1` starting account. It records the exact currency and item identity, targets that item through normal Armory controls, requires currency consumption and a visible result, then salvages the item through its confirmation. These are short transactional journeys, not sustained stress loops; each runs once after warm-up. Replay bundles preserve the checkpoint and completed action path.

Prioritize Alchemist Shop services, progression purchases, and complete Collection inspection next. Use reachable checkpoints and required completed-action/frame segments, as for existing journeys. Keep fixed replay cases for comparing optimizations; use discovery to find new cases, not as evidence that every mechanic is covered.

Use `npm run perf -- --help` and `performance/catalog.json` for current scenario
durations and minimum samples rather than maintaining a second defaults table.

Override per-scenario defaults with `PERF_MEASURE_MS` / `PERF_MIN_FRAMES` for harness iteration only (not for baselines). Keep the default one measured run plus one unmeasured warm-up; use `--electron --cold` to measure first use. Each run writes `runs/<scenario>-<run>.json`, `runs/<scenario>-<run>-sample.json`, `aggregates/<scenario>.json`, plus `traces/` in trace mode, `display-env.json`, and `environment.json`.

Judge an optimization by a repeatable improvement in the targeted latency or hitch, compared with observed run-to-run variation. Check relevant neighboring scenarios for regressions; a fixed percentage alone cannot distinguish an improvement from noise.

Preserve player-facing visual fidelity, particle counts, animation timing, and
sound behavior when optimizing. For rendering changes, compare actual pixels
under identical inputs; deterministic geometry or draw-output comparisons can
also protect the affected calculation. Reuse existing parity checks where they
cover the change. A passing build or better FPS does not establish presentation
parity; report it as unverified when the necessary comparison is unavailable.

## Workflow

```text
Measure → identify failing scenario/phase → perf:trace that scenario → optimize → perf:compare before/after
```

`perf:compare` derives duration-normalized rates for hitches, stalls, and long tasks (per 30 s) so runs of unequal duration are compared fairly. Both reports must contain usable environment metadata and valid, complete metrics. Material environment differences (runtime, trace mode, cold mode, platform, CPU architecture, viewport, DPR, refresh rate, browser, target profile, runs per scenario) are rejected with clear compatibility errors. Optional display and browser metadata must be present on both sides when present on either. Duplicate scenario names and invalid measured runs or journey segments reject comparison.

Pooling preserves each run's minimum frame requirement and starts a new phase timeline for each run. An empty or short run cannot be hidden by a larger neighboring run. Invalid samples retain diagnostic numbers but receive red target bands; they never qualify as optimization evidence.

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
- Smooth rAF sampling can hide uneven updates inside a capped effect loop. Inspect actual draw cadence when an effect visibly jitters despite stable frame metrics.
- Trace mode adds overhead — do not treat its FPS numbers as authoritative.
- The nightly Xvfb Electron run validates seeded journeys and retains replay evidence, but its virtual display is not a GPU-enabled desktop baseline. Use a controlled local Electron machine for numeric comparisons.
- Never compare Chromium and Electron results as if they were the same environment.
- Local Electron profiling keeps the GPU enabled (`enableGpu`); CI Electron smoke still uses `--disable-gpu`. Never compare the two — same-machine, same-runtime comparisons only.
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

Run metric and comparison unit tests with `npm run test:full -- tests/performance`.
They also run in the full unit suite; `npm test` contains only fixed local smoke suites.

Related: [PerformanceAudit.md](./Audits/PerformanceAudit.md) (when to change code), [CONTRIBUTING.md](../CONTRIBUTING.md) (E2E helpers / animation policy).

## Eager bundle size

Bundle ceilings live with the bundle-budget owner (`scripts/lib/verification/bundle-budget.mjs`, `npm run check:bundle`), not this FPS harness. See that owner for ceilings, chunk policy, and history.

### Gameplay memory soak

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
