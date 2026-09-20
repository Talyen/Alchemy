# Headless playthrough testing

The Node runner acts through production battle commands, run navigation, rewards,
shops, mysteries, corruption, homestead, talents, and Armory operations. It never
mounts React or renders the game. Each career runs in a fresh child process;
progress persists between that career's runs. The parent watchdog also terminates
synchronous hangs.

## Commands

```bash
npm run balance:playthrough -- --seeds 1,2,3 --runs 2
npm run balance:playthrough -- --hero wildcard --mode wildwood --fixture unlocked-v1 --horizon 4 --runs 1
npm run balance:playthrough -- --hero wizard --difficulty difficulty-3 --fixture unlocked-v1 --runs 1
npm run balance:playthrough:replay -- --bundle reports/playthrough/career-0-1.json
npm run balance:playthrough:compare -- --manifest reports/baseline/playthrough.json --baseline reports/baseline/playthrough.json --out reports/comparison
npm run test:playthrough
```

`--out` defaults to `reports/playthrough`. The directory contains the JSON report,
interactive HTML details, individual career bundles, initial checkpoints, and
append-only attempted/completed action journals. `--save` accepts a shipping save;
`--manifest` reruns the exact configuration list in a prior report. Comparison
accepts a previously generated report, rather than checking out a Git revision.
Run that baseline in the desired checkout first. This keeps checkout management
independent of simulation and preserves local work.

Options include `--hero`, `--mode` (campaign, labyrinth, wildwood), `--difficulty`
(difficulty-1/2/3), `--runs`, `--seeds` (comma-separated unsigned integers),
`--horizon` (rooms for endless modes), `--max-steps`, `--max-turns`, `--timeout`
(seconds per child), and `--resume-at` (load acknowledged bytes after this action).
Default budgets are two runs, 12 rooms for endless observations, 10,000 actions,
100 battle turns, a 120-second external watchdog, and 32 MiB of journal evidence.
Budget exhaustion and unsupported decisions fail as incomplete; neither counts
as a gameplay defeat. Reaching an endless horizon invokes production End Run
and is recorded separately from defeat and victory.

`--policy` accepts `archetype`, `random`, and `minimalist`. Archetype drafting,
shop purchases, and talent choices favor the hero's production keyword catalog;
Minimalist favors a small deck. Blind mystery choices rank visible labels only,
not hidden effects. `--combat-policy` accepts `greedy-effective-damage` (default),
`greedy-damage`, `defensive-random`, and `random-playable`, using the existing
battle scoring owners. Combat policy remains explicit even with a random
non-combat policy. Policy randomness and injected crafting randomness have
separate seeded streams. Scoring cannot advance gameplay RNG. Wish selection
uses visible offered cards and keyword/effective-damage preferences.

## Evidence and limits

Fresh saves must earn hero/mode unlocks. `unlocked-v1` grants access for targeted
coverage; `economy-v1` supplies resources for homestead coverage; `victory-v1`
starts at a defeated final boss to exercise complete victory settlement. Fixture
results are labeled **targeted**, never evidence of earned fresh-save success.
The fixed suite covers all eight heroes, all three modes and difficulties,
retained victory/defeat, affordable earned equipment/talent spending, and
homestead building/farm/research/companion actions.

Every action validates resource bounds, claim release, production loader repair
diagnostics, and acknowledged save bytes at supported save points. Autosave uses the same
completion gate as the UI; run-end fast-path writes are awaited independently. Save/load goes through the shipping
serialization, candidate selection, hydration, and shared autosave lifecycle,
using an ephemeral transport. The suite compares an uninterrupted career with
save/resume and also resumes a combat checkpoint in a fresh process under its
recorded actions. Rejection tests cover stale cards, duplicate rewards/purchases,
unaffordable purchases, repeated mystery outcomes, and interruption without a
forced final write. Controlled execution and post-commit failures prove rollback
versus committed-state failure capture and fresh-process replay.

Replay uses recorded actions, canonical state hashes, command revisions, run RNG
in save/checkpoint data, deterministic ID/clock inputs, and code/content identity
(including untracked source and local edits). Changed code is explicitly labeled
a regression experiment. The runner preserves an attempted action before calling
it and does not retry a post-commit failure. A killed worker retains its initial
checkpoint and full journal suffix. Journals stop at their evidence budget rather
than discarding reproduction history. Save snapshots and journals contain game
state; use the bundle matching the source revision for exact reproduction.

JSON and HTML share career outcomes, reached choice counts, economy samples,
combat records and maxima, and first reached spending milestones. Observed-card
and playable-card counters count **decision opportunities**, not distinct draws.
Exact draw and passive-item-trigger telemetry are intentionally not claimed:
those require an engine-owned event stream before they can be measured reliably.
Unreached mechanics are missing coverage, not successful tests. Balance comparisons
use paired career means and standard errors within hero/mode/difficulty/policy
cohorts. There are no uncalibrated balance gates; tiny targeted samples cannot
establish mortality rates or economic deadlocks.

Headless checks do not establish UI wiring, animation, accessibility, or physical
storage durability. Shipping storage transport and UI integration retain their
existing tests. Current homestead upgrades have no elapsed-time completion;
the harness freezes wall-clock inputs and does not simulate real-time pacing.
Add an explicit recorded clock cadence when a covered system requires it.

## Owners and verification

The integration lives in `src/app/playthrough/`, where feature orchestration
imports are legal. It is loaded only by Node tooling, never by the application
entry point. Shared operations remain with their production owners:

- Battle start and card/Wish commands: `run-loop/battle/`.
- Turn completion and outcome settlement: existing battle/run-flow owners.
- Autosave subscription, scheduling and acknowledgement: `src/app/autosave-lifecycle.ts`.
- Gear mutations and flushes: the Armory command owner.
- Save schemas and normalization: existing storage and validation owners.

`npm run test:playthrough` runs the retained correctness scenarios in plain Node.
The PR/manual workflow runs them plus a fixed two-seed career sweep. The normal
full Vitest suite also includes them. Broader exploration uses the CLI and remains
separate from fixed-population balance comparisons.
