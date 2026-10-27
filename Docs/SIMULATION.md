# Gameplay simulation

Choose the runner for the question:

| Question                                                           | Runner                | Guide                                                |
| ------------------------------------------------------------------ | --------------------- | ---------------------------------------------------- |
| How does a card, loadout or enemy perform in isolated combat?      | `balance:sim`         | [Battle simulation](#balance-simulation)             |
| Can a career complete gameplay, progression and save/resume flows? | `balance:playthrough` | [Headless careers](#headless-careers)                |
| How do loot and material offers change with progression?           | `balance:loot`        | [Armory report](./ARMORY.md#loot-progression-report) |

Both combat runners use production gameplay. Their automated policies do not
establish human difficulty or rendered UI correctness. [Contributing](../CONTRIBUTING.md#what-to-run-when-you-change)
owns execution permissions and verification requirements; commands below describe
runner options.

## Balance simulation

Headless battle simulator for overpowered or underpowered cards, classes, enemies, talents, companions, trinkets, gear, and individual item affixes. It runs isolated fights through the real battle engine (no browser, no React) using simple play policies. Its results describe the selected automated play policy, not human skill or a full run/map/shop simulation. Skipped during normal `npm test` runs.

The simulator shares opening resolution and complete turn resolution with live
commands. Forced player skips count toward `maxTurns` and never grant an extra
Companion action. The optional simulator budget limits resolved frames, including
forced skips; live commands omit that limit. Combat uses the seeded `world` stream; card and Wish decisions
use a separate policy RNG. Replaying the same decisions from the same battle
inputs therefore preserves combat outcomes and RNG counters. Existing report
baselines may change when rerun with these lifecycle and RNG corrections.

```sh
npm run balance:sim

# Run the exhaustive comparison with the original sample counts
npm run balance:sim:full

# Process at most 10 scenario groups per invocation; repeat to resume.
ALCHEMY_BALANCE_MODE=full npm run balance:sim:batch

# Increase iterations per scenario
ALCHEMY_BALANCE_ITERATIONS=500 npm run balance:sim

# Increase independent class-deck seeds
ALCHEMY_BALANCE_DECK_SEEDS=5 npm run balance:sim

# Change the play policy (random-playable, greedy-damage, defensive-random, greedy-effective-damage)
ALCHEMY_BALANCE_POLICY=greedy-effective-damage npm run balance:sim

# Kit + tree-order talents + talent-point HP only (no homestead / gear / Vitality / core trinkets)
ALCHEMY_BALANCE_LOADOUT=bare npm run balance:sim

# Measure raw kit without hidden fight pacing
ALCHEMY_BALANCE_PACING=off npm run balance:sim

# Run the low-iteration, side-effect-free full-report check
npm run test:balance
```

`balance:sim` runs an exploratory sweep across heroes, enemies, cards, Talents,
Companions, Trinkets, Gear and affixes at Early/Mid/Late progression.
`balance:sim:full` uses larger samples for tuning decisions. Both write
`reports/balance-findings.*` and `reports/balance-full/`; small cells remain
exploratory. Exact sample counts belong to [the balance owner](../src/lib/balance/)
and the generated report's methodology.

For a resumable sweep, `balance:sim:batch` saves each completed core matchup or
paired group atomically under `reports/balance-batches/`. Repeat the command until
it writes the complete report in `reports/balance-batches/report/`. Set
`ALCHEMY_BALANCE_BATCH_GROUPS` to a positive group count (default 10) to bound each
invocation. A group is indivisible, so this is not a time guarantee. Set
`ALCHEMY_BALANCE_CHECKPOINT` to use a different directory. Checkpoints bind the
source, edition and report options; changed inputs require a fresh directory.
Interrupted groups are recomputed; completed groups remain usable. Existing
`balance:sim` and `balance:sim:full` behavior is unchanged. Heavy local runs still
require the admission and authorization described in Contributing.
Only one process may use a checkpoint at a time. A process killed without cleanup
can leave `.lock`; inspect the recorded PID and remove it only after confirming its
owner is no longer active. Never remove a live or ambiguous lock.

Live autoplay scoring lives in `src/lib/battle/autoplay-policy.ts` and is game-design owned; changing those weights changes autoplay and Wish picks in real runs. The balance simulator imports that policy directly so reports match the skill floor; independent scoring belongs in the simulator. `findings.ts` gathers ordered candidates from rate, equity, matchup, paired, and anomaly collectors in `findings-*.ts`; `findings-selection.ts` owns deduplication, ranking, matchup clustering, and bucket selection. `findings-collector.ts` attaches report identity separately from metric rules and shares one sampled-median evaluator between enemy-type and class equity; candidate order remains explicit in `collectBalanceFindings`. `report-methodology.ts` supplies shared HTML/JSON methodology without importing the simulation runner. Shared HTML shell, escaping, and JSON stringification live in `report-layout.ts`; gauntlet depths and typical gear-roll depth live in `report-catalog.ts` / `gear-preset.ts`.

Exact presets, finding bands, report grouping, pairing methodology, and measurement semantics are owned by `src/lib/balance/` and the generated report; use findings as review input rather than applying tunings automatically. The summary opens `reports/balance-findings.html` and writes a JSON companion.

Report measurements share `RateCell` in `simulator-types.ts` and an
extraction/aggregation record in `rate-statistics.ts`. Batch summaries and report
aggregation use that record: counts always sum; rates and averages weight by
battles or sampled enemy types. Adding a measurement to the contract and record
updates projections and weighting automatically.
Overgrowth and Regeneration count only successful Health restoration. Glacial
Surge is a flat damage modifier and has no scheduled growth activations.

Paired sweeps describe reference fights and variants in `report-sweeps.ts`.
`report-sweep-runner.ts` manages batch configuration, matched-fight checks, reference
simulations, and delta aggregation. A pair holds character, enemy, depth, tier,
seed, and iterations equal; only the tested deck, talent, Trinket, or Gear varies.
Either reference or variant may serve as baseline.

Numeric values must be positive integers. Policies and loadouts must match
supported choices; pacing accepts `on`/`1`/`true` or `off`/`0`/`false`. Invalid
settings fail fast before report writes. `ALCHEMY_BALANCE_FINDINGS_CAP` sets the
summary findings cap (default: 100).
`balance:sim` and `balance:sim:full` generate reports; `test:balance` verifies finite full-report
construction and render purity without touching `reports/`. Changed balance
implementation is protected by the focused unit suite and this report check;
[Contributing](../CONTRIBUTING.md#what-to-run-when-you-change) owns execution permissions.

## Headless careers

The Node runner acts through production battle commands, run navigation, rewards,
shops, mysteries, corruption, homestead, talents, and Armory operations. It never
mounts React or renders the game. Each career owns an independent game session,
including its settings, deterministic inputs, persistence, and subscriptions. The
CLI runs each career in a fresh child process;
progress persists between that career's runs. The parent watchdog also terminates
synchronous hangs.

### Commands

```bash
npm run balance:playthrough -- --seeds 1,2,3 --runs 2
npm run balance:playthrough -- --hero wildcard --mode wildwood --fixture unlocked-v1 --horizon 4 --runs 1
npm run balance:playthrough -- --hero wizard --difficulty difficulty-3 --fixture unlocked-v1 --runs 1
npm run balance:playthrough:replay -- --bundle reports/playthrough/career-0-1.json
npm run balance:playthrough:compare -- --manifest reports/baseline/playthrough.json --baseline reports/baseline/playthrough.json --out reports/comparison
npm run test:playthrough
```

`--out` defaults to `reports/playthrough`. The directory contains the agent-facing
`reports/playthrough/agent-summary.json` and `reports/playthrough/agent-summary.md`, the detailed JSON report, interactive
HTML details, individual career bundles, initial checkpoints, and append-only
attempted/completed action journals. Agents should read the summary first: it
contains actionable observations, supporting aggregate evidence, confidence and
limitations, recommended next experiments, and bounded selectors for retrieving
raw evidence. The journals and full career JSON remain forensic artifacts rather
than routine report output. `--save` accepts a shipping save;
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
The archetype policy combines hero keyword affinity with current-deck keyword
cohesion and lightweight immediate utility. Heroes with no fixed keywords, such
as Wildcard, use the deck-conditioned fallback without receiving an authored
starting deck or keyword catalog.

Wildcard starter drafting favors an initial reusable attack/defense base and one
useful Companion, then penalizes redundant summons because only one Companion can
be active. These are visible-card heuristics, not forecasts of future encounters
or actual healing. Exact weights belong to the policy in
[`draft-policy.ts`](../src/app/playthrough/draft-policy.ts). They never inspect hidden offers
or draw gameplay RNG. Other heroes, random/minimalist policies and retained legacy
careers keep their own scoring; production card rules and offers are unchanged.

### Combat policy

[Combat policy](../src/app/playthrough/combat-policy.ts) owns modern heuristic
preferences: preserve consumables without current benefit, avoid potentially
lethal self-costs, and prevent pure defense from indefinitely displacing attacks.
It reuses live autoplay's conservative self-cost check, not an enemy-damage or
healing forecast. Defensive history advances only on committed commands and
resets with attacks, damage-over-time progress, or battle departure. New actors
start without history; observation alone changes neither scores nor RNG.

Random-playable and legacy careers retain their original decisions; replay follows
the recorded journal. These career heuristics add no shipping-save fields and do
not change live autoplay or isolated-battle scoring.

### Brewing coverage and comparisons

New CLI careers default to `--brewing on`. Use `--brewing off` for a paired
ablation; both explicit settings use the same modern purchase, refresh, and
consumable-preservation policy. Missing settings in retained manifests and
bundles select the legacy actor, which cannot brew. Replay retains its recorded
setting; `--brewing` cannot override a replay bundle.

```bash
npm run balance:playthrough -- --hero alchemist --fixture unlocked-v1 --seeds 42,137 --runs 3 --brewing off --out reports/alchemist-off
npm run balance:playthrough -- --manifest reports/alchemist-off/playthrough.json --brewing on --baseline reports/alchemist-off/playthrough.json --comparison brewing --fixture unlocked-v1 --out reports/alchemist-on
```

The explicit `--comparison brewing` mode permits only the on/off setting to
differ. It requires the same code/content identity and ordered scenario manifest,
including starting saves, seeds, budgets and policies. Normal comparisons remain
strict. An incomplete career cannot enter a balance comparison. Results use
paired career means and standard errors; battles within careers are correlated.
The `firstVictoryRunCensored` metric records careers without a victory as
`runs + 1`, not as a measured later victory. Treatment decisions can change
routes, spending and RNG consumption: matched seeds do not guarantee matched
encounters. Fixture cohorts remain targeted evidence.

The actor exposes shop brewing, mixing, distilling, buying and refreshing, and
campfire new-potion or combining choices through production commands. Service
availability follows [brewing rules](./GAME_RULES.md#brewing-and-transmutation);
the actor checks each service’s spent flag independently. Observation previews
never advance RNG.

Preparation uses visible-effect estimates rather than combat forecasts. The
[brewing policy](../src/app/playthrough/brewing-policy.ts) owns utility weights,
compression scoring, purchase caps and inferior-copy filtering;
[brewing offers](../src/app/playthrough/brewing-offers.ts) owns affordability,
service reserves and bounded refresh choices. The heuristic favors Rest at low
Health and useful brewing otherwise. It never examines unseen stock. Its estimates
do not model every Talent/affix interaction or predict calibrated win rates.
Random noncombat policy ignores these rankings.

#### Service evidence

JSON, HTML and agent summaries report distinct shop/campfire visits, per-service
eligible/affordable/beneficial visits, committed uses, actual spending, result
descriptions, deck-size changes and reasons for declining or lacking a service.
Repeated observations update per-visit maxima rather than inflating visit counts.
Evidence is bounded to 512 visits and 32 decisions per visit, with truncation
reported. Disabled, unaffordable, unavailable and policy-declined services are
coverage distinctions, not evidence of hero weakness. Targeted fixtures prove
mechanics; earned progression requires an earned starting checkpoint.

Isolated battle presets remain synthetic: Alchemist receives two randomly mixed
Potions without paying or visiting shops. They also omit carryover Health and
run economics. Use career experiments to judge Alchemist progression before
proposing changes to globally available cards.

### Evidence and limits

Fresh saves must earn hero/mode unlocks. `unlocked-v1` grants access for targeted
coverage; `economy-v1` supplies resources, a discovered Companion, and a Knight weapon for homestead and Gear coverage; `victory-v1`
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

`createPlaythroughController(session)` binds production flows to the supplied
session. `runCareer` creates and disposes its own runtime by default. The worker
supplies a recorded runtime for checkpoint/replay evidence. Deterministic clocks,
Gear IDs, and new-run seeds are injected into that runtime; workers do not patch
process globals. In-process isolation tests interleave careers and compare their
journals and final saves with sequential execution. Fresh-process replay remains
separate protection for bootstrap and interruption behavior.

Replay uses recorded actions, canonical state hashes, command revisions, run RNG
in save/checkpoint data, deterministic ID/clock inputs, and code/content identity
(including untracked source and local edits). Changed code is explicitly labeled
a regression experiment. The runner preserves an attempted action before calling
it and does not retry a post-commit failure. A killed worker retains its initial
checkpoint and full journal suffix. Journals stop at their evidence budget rather
than discarding reproduction history. Save snapshots and journals contain game
state; use the bundle matching the source revision for exact reproduction.

JSON and HTML share career outcomes, reached choice counts, economy samples,
combat records and maxima, bounded run/deck keyword snapshots, battle-start and
pre-settlement state snapshots, and first reached spending milestones. The
agent-facing summary also reports first-victory timing, run-by-run victory rates,
hero variance when multiple cohorts are supplied, and deck/archetype cohesion.
Observed-card
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

### Owners and verification

The integration lives in `src/app/playthrough/`, where feature orchestration
imports are legal. It is loaded only by Node tooling, never by the application
entry point.

`actor.ts` owns observation lifecycle and routes to between-run and run-activity
offer builders. The choice catalog pairs each recorded choice with one command
for the current observation and rejects duplicate identities. Replay keeps the
same recorded choice shape.

`career.ts` owns the ordered observation, choice, journal, execution, and replay
loop. `career-evidence.ts` records battle, card, and run evidence and checks
committed gameplay state. `career-persistence.ts` owns the ephemeral save
transport, canonical state digest, save round trips, autosave acknowledgement,
and optional resume. The journal attempt is emitted before execution; save
validation follows a successful committed action.

Shared operations remain with their production owners:

- Battle start and card/Wish commands: `shared/stores/commands/battle-start-commands.ts`
  and `shared/stores/commands/battle-commands.ts` under `src/features/alchemy/`.
- Turn completion and outcome settlement: existing battle/run-flow owners.
- Autosave subscription, scheduling and acknowledgement: `src/app/autosave-lifecycle.ts`.
- Gear mutations and flushes: the Armory command owner.
- Save schemas and normalization: existing storage and validation owners.

`npm run test:playthrough` runs the retained correctness scenarios in plain Node.
The [PR/manual workflow](../.github/workflows/playthrough.yml) runs them plus a fixed
two-seed career sweep. The normal full Vitest suite excludes `tests/playthrough/`;
`vitest.playthrough.config.ts` owns their separate collection. Broader exploration uses the CLI and remains
separate from fixed-population balance comparisons.
