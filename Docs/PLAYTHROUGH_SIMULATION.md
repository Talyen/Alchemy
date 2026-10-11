# Headless playthrough testing

The Node runner acts through production battle commands, run navigation, rewards,
shops, mysteries, corruption, homestead, talents, and Armory operations. It never
mounts React or renders the game. Each career owns an independent game session,
including its settings, deterministic inputs, persistence, and subscriptions. The
CLI runs each career in a fresh child process;
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

## Brewing coverage and comparisons

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

The actor exposes shop mixing, distilling, buying and refreshing, and campfire
new-potion or combining choices through production commands. Shop mixing and
distilling share the production once-per-visit service limit. Campfire brewing
and resting are mutually exclusive. Observation previews never advance RNG.

The preparation heuristic estimates visible effects: Poison damage times three,
other direct damage times two, healing times 0.75, Mana/draw times two, maximum
Mana times five, Wish times four, Gold times 0.25, and status grants at their
amount. Chance branches use expected value. Scores divide by at least one Mana.
A mix compares its result with the better ingredient and adds one compression
point; distilling compares the strengthened result with its input. These values
are explainable policy estimates, not calibrated win-rate predictions. They do
not model every talent/affix interaction or future combat sequence.

Below half Health, the heuristic prefers campfire rest. Otherwise it favors
positive brewing improvements. Purchases stop at four brewable Potions, and
reserve the current service price while useful brewing remains. A weaker copy
of a Potion already owned in stronger form is declined; novel Potion roles and
equal-strength ingredients remain eligible. Only visible
shop prices inform refresh decisions; a refresh requires no useful affordable
option, room below the four-Potion policy cap, and enough Gold left to buy the
cheapest visible Potion after reserving service Gold. Inferior stock can prompt
one bounded search; unseen replacement stock is never examined. Evidence
separates the potion cap, an available option, and reserved purchase Gold from
an attempt to seek better stock. Production refresh limits apply. Alchemist destinations receive
priority when current Gold and ingredients support a useful service; unseen
stock is never inspected. Random noncombat policy ignores these score rankings.

Heuristic combat policies may end a turn rather than consume a card with no
current direct benefit and no recognized active Consume reward. This preserves
full-Health healing and unnecessary cleanses. Random-playable and legacy careers
retain their dump-hand behavior. Modern heuristic policies prefer an available
attack before pure defense that would spend all remaining Mana when at or above
half Health. Initial emergency defense retains its priority. After two completed
turns without an attack card or enemy Health reduction, an available attack
outranks such defense even below half Health. Defense with spare Mana, attack
cards that also defend, and hands with no scored attack keep their existing
scores. This is a progress heuristic, not a forecast of the next enemy action.

The actor tracks these defensive turns only after committed commands; repeated
observation does not change scores. Attack cards, damage-over-time progress, and
leaving battle reset the counter. History starts empty in a new actor; recorded
replay still follows the journal's decisions. It adds no shipping-save fields or
RNG draws. Live autoplay and isolated-battle scoring are unchanged.

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

## Evidence and limits

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

## Owners and verification

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

- Battle start and card/Wish commands: `shared/stores/battle-start-commands.ts`
  and `shared/stores/battle-commands.ts` under `src/features/alchemy/`.
- Turn completion and outcome settlement: existing battle/run-flow owners.
- Autosave subscription, scheduling and acknowledgement: `src/app/autosave-lifecycle.ts`.
- Gear mutations and flushes: the Armory command owner.
- Save schemas and normalization: existing storage and validation owners.

`npm run test:playthrough` runs the retained correctness scenarios in plain Node.
The [PR/manual workflow](../.github/workflows/playthrough.yml) runs them plus a fixed
two-seed career sweep. The normal full Vitest suite excludes `tests/playthrough/`;
`vitest.playthrough.config.ts` owns their separate collection. Broader exploration uses the CLI and remains
separate from fixed-population balance comparisons.
