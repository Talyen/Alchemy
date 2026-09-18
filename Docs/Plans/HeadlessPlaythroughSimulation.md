---
status: active
updated: 2026-09-18
---

# Headless Playthrough Progression Simulation

## Objective

Build an automated, headless playthrough simulation framework that exercises player-like decisions while progressing through Alchemy from a fresh save file across all heroes, abilities, talents, game modes, equipment, and homestead systems.

The simulator runs directly against the game engine and synchronous store command pipeline ([`dispatchRunSessionCommand`](../../src/features/alchemy/shared/stores/run-session-command.ts)) without mounting React, rendering DOM, compiling styles, or playing audio (presentation `afterCommit` effects stay stubbed). This targets high-speed execution to discover progression blockers, non-battle balance anomalies, economic deadlocks, illegal state transitions, and save corruption across diverse RNG seeds. Phase 0 measures feasibility and major costs; the first complete career provides the end-to-end throughput needed to set reliable sweep budgets.

---

## Core architecture invariant: zero rule duplication (the virtual controller)

To prevent code drift and perpetual maintenance, **the simulator must never duplicate or re-implement any game rules, formulas, or state transitions**. Harness-only code (decision heuristics, run isolation/reset, telemetry, invariant assertions) is explicitly allowed; rule ownership stays in production.

```text
Player-visible choices → Virtual player policy → Production action flow
                                                      ↓
                                            Game state and saves
                                                      ↓
                                       Observations and assertions
```

The production action flow includes combat and battle settlement, navigation claims, rewards, shops, mystery events, and between-run progression. The harness observes their results; it does not replace their orchestration.

1. **The Simulator is an Actor, not an Engine**: Real human players only supply inputs (which card to click, which shop item to buy, which talent to select). The simulator mirrors this exactly: it is purely a "Virtual Controller" that reads the production read ports and invokes the production commands. Reusing a low-level effect function is insufficient if it bypasses eligibility checks, costs, settlement, or required follow-up work. Drive the complete production action flow; where that flow is coupled to presentation, extract the smallest shared production operation instead of recreating its sequencing in the harness.
2. **Seamless Sync with Game Changes**:
   - Changes to card effects, prices, talent requirements, and drop tables flow through the production rules automatically. New choice types or flows can still require adapter and policy updates; report unsupported choices explicitly rather than silently skipping them.
   - Shared production code prevents rule drift, but can share the same bugs. Assert independent behavioral properties (for example, a reward cannot be granted twice) without implementing a second rules engine.
3. **Strict Separation of Concerns**:
   - **Production Engine Owns**: Game rules, validation, state mutations, RNG streams, loot tables, and save schemas.
   - **Simulator Owns**: Only decision heuristics ("if HP < 40%, choose Rest"), career isolation/reset (sequential execution initially; choose the isolation boundary in Phase 0), telemetry logging, and invariant assertions. The policy ranks choices offered by production; production owns eligibility and offer generation.

---

## First deliverable and expansion criteria

The first useful deliverable is a reproducible, bounded two-run Campaign career for one available hero, starting from a fresh save and using a simple legal-choice policy. It must settle each run, preserve earned progression, and exercise save/resume. Demonstrate both victory and defeat settlement with retained scenarios; a targeted fixture may cover victory if the initial policy cannot win a full run. Keep that evidence separate from fresh-save success so bot strength does not block lifecycle validation.

This is a correctness tool first. The full archetype catalog, all-hero coverage, long-term balance estimates, and interactive dashboard are later expansions, not prerequisites for using the first slice. After that slice works, exercise earned progression and between-run spending before multiplying heroes and modes; this tests the framework’s central career premise early. Expand when the existing slice completes without unsupported mandatory choices, reproduces failures in a fresh process, and fits a measured runtime budget. Do not make finding a genuine game bug a prerequisite for testing failure capture: a controlled harness test can prove that path.

## Working decisions

These defaults guide implementation; example counts and thresholds remain provisional:

### 1. Bot archetypes and heuristic profile selection

- **Status**: Aligned on keyword-driven heuristic archetypes.
- **Approach**: The virtual player uses a `PlayerArchetype` profile defined by primary/secondary keywords and playstyle parameters (risk tolerance, target deck size, removal aggressiveness).
- **Benefit**: Shares preferences across drafting, shops, removals, talents, gear, and combat. Each choice type still needs an evaluator; a shared profile does not make one scoring formula suitable for every subsystem.

### 2. CI integration and performance budget

- **Decision**: Use a small, fixed correctness suite on PRs and broader sampled sweeps on demand or nightly. Keep retained regression cases in the correctness suite; vary exploration seeds in broader sweeps and record the full scenario manifest.
- **Budget**: Use Phase 0 timings for an initial estimate, then size both suites from complete-career measurements, including decisions, persistence checks, and reporting. Begin with the one-hero slice; add scenarios for distinct risks rather than chasing a seed count.

### 3. Anomaly and balance alert thresholds

- **Question**: What constitutes a reportable balance anomaly versus normal roguelite variance?
- **Considerations**: While crashes, softlocks, and schema failures are unambiguous binary failures, economy and progression balance are continuous. Reuse the existing battle-sim owners where they apply (`findings-bands.ts` win-rate/length bands, `ANOMALY_THRESHOLD_BY_PRESET`, `DEFAULT_MAX_TURNS`) and calibrate every new threshold from a baseline run before gating CI. The examples below are provisional shapes, not gate values:
  - **Floor Failure Rate**: e.g., if a specific boss has > 85% death rate across 50 seeds on Novice.
  - **Resource Starvation / Surplus**: e.g., ending Act 1 with 0 crafting materials or > 1,500 unspendable gold.
  - **Deck Stagnation**: e.g., finishing a full run without drafting more than 2 non-starter cards.

### 4. Mystery event knowledge modeling

- **Question**: Should the bot have "omniscient" knowledge of hidden event consequences, or should it simulate player blind choices?
- **Decision**: Treat decision strategy and information access as separate settings. Both random and keyword-driven policies should normally use only information available to the player at that decision, never hidden future rolls or consequences. An explicitly labeled omniscient diagnostic policy may inspect more, but its results must stay separate from player-like balance reports. Random legal choices provide fuzz coverage; archetype choices measure coherent progression.
- **Boundary**: Give the policy a player-visible observation and available choices, rather than unrestricted state access. Assertions and failure reporting may inspect internal state separately. Reuse production read ports and eligibility checks; filtering policy inputs must not become a second implementation of game rules. Repeated observation and scoring must not mutate game state or advance gameplay RNG. Generate offers through the production action flow once, then rank the resulting choices; do not reroll offers while searching for a preferred choice.

### 5. Storage seam and state reset isolation

- **Decision**: Use an ephemeral in-memory storage adapter beneath the production save/load pipeline. Exercise the complete save, including permanent profile progression and the active run; `encodeRunResumeSnapshot` / `decodeRunResumeSnapshot` alone cover only the run. Preserve production save triggers, serialization, candidate selection, repair diagnostics, and hydration at the supported save points described below. A pure in-memory draft that skips encode/decode would hide the persistence bugs this framework exists to catch. Use the actual shipping storage adapter in a separate integration check where practical. A scratch-file adapter tests only its own I/O behavior and must not be treated as coverage of a different shipping storage backend.

Autosave currently starts in the React effect in [`use-app-save-state.ts`](../../src/app/use-app-save-state.ts), using [`autosave-scheduler.ts`](../../src/app/autosave-scheduler.ts). Importing stores and installing storage alone will not start it. Phase 0 must identify the shared production lifecycle needed to subscribe, schedule, acknowledge writes, and dispose without mounting React; extract that orchestration if necessary rather than copying it into the harness. Use controlled timers and await relevant write acknowledgements for deliberate save/resume checks. Crash scenarios instead interrupt at the declared boundary without draining pending work. A command commit and a completed storage write are distinct events.

### 6. Simulated time

- **Decision**: For time-dependent systems, use an injected clock and explicit elapsed-time steps; never let machine speed determine progression or wait in real time. Record those steps for replay and declare the play/session cadence used in pacing reports. Advance time through production behavior without directly granting completion or rewards. Add time-dependent scenarios only as the covered systems require them.

---

## Coverage and interpretation

Maintain two labeled suites: **fresh-save careers**, which earn unlocks through normal play, and **targeted scenarios**, which start from versioned, validated fixtures to reach late-game heroes, modes, and rare states affordably. Never count fixture-granted progress as evidence that fresh-save progression works.

Track reached choices, transitions, unlocks, and resume points, not just seed counts. Use a small representative matrix first, then add targeted scenarios for uncovered paths and retain reproducing cases as regressions. A large random sweep is not exhaustive coverage. Keep coverage-directed searches and retained failure cases labeled separately from the fixed sampling population used for balance estimates; deliberately oversampling troublesome states must not inflate reported player-like failure rates. Headless results cover domain behavior; they do not verify UI wiring, rendering, accessibility, or the shipping storage backend by themselves.

---

## Game-wide scope and behavioral requirements

### 1. Heroes and loadouts

- **All 8 Playable Heroes**: Knight, Ranger, Rogue, Wizard, Alchemist, Warlock, Druid, and Wildcard (including its distinct starter draft phase).
- **Hero-Specific Mechanics**: Starter decks, signature keyword mechanics (Block/Armor/Forge, Bleed/Poison/Gold, Wolf Companion/Arrows, Mana/Spells, etc.), and character unlock progression across runs.

### 2. Game modes and content systems

- **Campaign Progression**: Act progression, destination choices, and act bosses. Use Campaign for the first slice so both victory and defeat have defined run endings.
- **Wildwood Progression**: Starter drafting followed by boss encounters, reward/removal phases, and guarded phase transitions.
- **Labyrinth Mode**: Grid-based labyrinth floor navigation, room types, entry and exit criteria, labyrinth modifiers, and boss chambers.
- **Campaign Difficulties**: Novice, Adventurer, and Legend, validating scaling modifiers and unlock tracking against the production difficulty catalog.

### 3. In-run encounters and flow

- **Combat Resolution**: Integrates existing battle simulator policies (`greedy-damage`, `greedy-effective-damage`, `random-playable`, `defensive-random`) with full handling of wish cards, companion actions, status effects, and elite/boss modifiers. Combat tuning stays owned by game-design in `src/lib/battle/autoplay-policy.ts` (see `src/lib/balance/play-policy.ts`); the sim reuses those weights. If a distinct test strategy needs different tuning, prefer an explicit policy configuration or a separate decision policy that still uses production rules; avoid copying the existing implementation. Assign each archetype an explicit `combatPolicy`; current wish resolution is random and needs an explicit archetype-aware or fuzz policy decision during implementation. The existing isolated simulator in [`simulator.ts`](../../src/lib/balance/simulator.ts) consumes battle RNG for random card and Wish selections. Reuse its scoring helpers, but supply a separate recorded policy RNG for playthrough decisions; do not reuse its automated-turn loop unchanged or advance combat RNG while ranking choices.
- **Reward Flow**: Card draft picks, gold accumulation, material awards, item/relic claims, skip actions, and proper advancement of multi-part reward bundles.
- **Node Navigation**: Dynamic path selection across standard combat, elites, campfires, card shops, trinket shops, equipment shops, alchemist shops, mystery rooms, and corruption nodes.
- **Shop Economy**: Purchasing cards, relics, materials, and gear; purchasing card removals; handling insufficient gold and empty slots gracefully.
- **Campfires**: Health evaluation for resting vs. alternative campfire actions.
- **Mystery Events**: Evaluating choice branches, HP payment/costs, curse afflictions, card additions/removals, and ensuring events never crash on missing deck targets.

### 4. Meta-progression and between-run systems

- **Talent Trees**: Tracking XP gains per keyword tree, allocating earned points via `canUnlockTalent`, respecting row prerequisites, and testing tree resets.
- **Homestead**: Upgrading core buildings, upgrading farm plots, advancing research tiers, and advancing companion bond levels using in-run harvested materials.
- **Armory & Gear**: Receiving loot gear instances, evaluating stat upgrades, equipping weapons/armor/trinkets, crafting, salvaging, and verifying affix effects, hand-slot restrictions, and permanent Trinket ownership.
- **Profile Unlocks**: Verifying that run completions correctly unlock subsequent heroes, higher difficulties, and log discoveries in the collection catalog.

---

## Virtual player archetypes and decision heuristics

These profiles are test strategies, not validated models of human skill or preferences. Keyword affinity is a starting heuristic; it needs basic survival, affordability, and usable-deck fallbacks. Validate that each policy actually exercises its intended mechanic before attributing poor results to game balance.

To exercise varied progression strategies, the virtual player operates under a **Player Archetype Profile**. Because cards, talents, gear, and items in Alchemy are natively structured around **Keywords**, an archetype is defined as a keyword affinity profile paired with playstyle parameters.

```
                  ┌──────────────────────────────────────────────┐
                  │        Archetype: "Poison Rogue"             │
                  │  Primary: "poison"  |  Secondary: "gold"     │
                  └──────────────────────┬───────────────────────┘
                                         │
     ┌───────────────────┬───────────────┴───────────────┬───────────────────┐
     ▼                   ▼                               ▼                   ▼
Card Rewards         Shops & Removals                Talents             Armory / Gear
Drafts cards with    Buys poison trinkets;           Invests XP into     Equips gear with
"poison" keyword;    Removes non-poison              the "poison" tree   poison damage &
skips off-archetype. starter attacks.                first.              matching affinities.
```

### Illustrative archetype profile

Start with only the fields consumed by the first policies; extend this profile as demonstrated needs arise. A shared profile expresses preferences, while each choice type still needs a small evaluator. Keyword matches alone do not establish affordability, usefulness, or synergy.

```typescript
export interface PlayerArchetype {
  id: string;
  name: string;
  characterId: CharacterId;
  primaryKeywords: KeywordId[];
  secondaryKeywords: KeywordId[];
  combatPolicy: BalancePlayPolicy; // 'greedy-damage' | 'greedy-effective-damage' | 'defensive-random' | 'random-playable'
  riskTolerance: "conservative" | "balanced" | "aggressive" | "reckless";
  deckTargetSize: number; // e.g. 10 for thin decks, 25+ for fat decks
  cardRemovalAggression: "none" | "low" | "high";
  shopPriority: "cards" | "gear" | "trinkets" | "removals" | "balanced";
  mysteryRiskTolerance: "avoid-danger" | "balanced" | "always-gamble";
}
```

### Hero-specific archetypes catalog

This catalog is a set of candidate test strategies, not a content specification or a requirement to implement every profile. Card names, mechanics, and numerical targets below are illustrative; check them against available content when implementing each policy. Assert intended production behavior, including self-inflicted defeat where the rules permit it, rather than treating an archetype’s desired outcome as a game invariant.

#### Knight

1. **The Iron Fortress (Block & Armor)**:
   - _Keywords_: `block`, `armor`
   - _Strategy_: Drafts defensive cards (`plate-mail`, `shield-bash`, `spiked-shield`), armor scaling gear, and block talent tree. Plays defensively in combat, allowing thorns/counter damage to grind enemies down.
   - _Stress-Tests_: Combat turn limits (turn 20+), armor retention across turns, enemies with piercing damage or debuff scaling.
2. **The Master Smith (Forge & Physical)**:
   - _Keywords_: `forge`, `physical`
   - _Strategy_: Aggressively plays `forge` cards, buffs weapon scaling, prioritizes equipment shops and Armory upgrades.
   - _Stress-Tests_: Weapon damage buff ceilings, equipment stat interaction bugs, forge cost pacing.

#### Rogue

3. **The Venomous Stalker (Poison)**:
   - _Keywords_: `poison`, `gold`
   - _Strategy_: Stacks poison on turns 1–2 (`poison-dagger`, `deadly-poison`), then turtle-defends while DoT damages enemies.
   - _Stress-Tests_: DoT stacking caps, enemy phase transitions clearing debuffs, cleanse mechanics.
4. **The Bleed & Eviscerate Skirmisher (Bleed)**:
   - _Keywords_: `bleed`, `physical`
   - _Strategy_: Multi-hit attacks (`serrated-edge`, `hemorrhage`), gear with attack speed or on-hit bleed.
   - _Stress-Tests_: Multi-hit damage formulas, retaliatory thorns scaling against rapid light hits.
5. **The Greedy Cutpurse (Gold & Economy)**:
   - _Keywords_: `gold`
   - _Strategy_: Drafts `steal` and gold boons, hoards currency, buys out shops, prioritizes high-reward mystery gambles.
   - _Stress-Tests_: Gold carry caps, shop stock exhaustion, price inflation curves, out-gearing difficulty balance.

#### Ranger

6. **The Beastmaster (Companion)**:
   - _Keywords_: `companion`, `nature`
   - _Strategy_: Maximizes companion uptime and buffs (`wolf-companion`, `pack-tactics`); prioritizes Homestead companion bond upgrades.
   - _Stress-Tests_: Companion turn-start triggers, death/revive cycles, minion targeting logic.
7. **The Deadeye Marksman (Archery & Nature)**:
   - _Keywords_: `archery`, `nature`
   - _Strategy_: Elemental arrow synergy (`lightning-arrow`, `venom-arrow`, `ice-shot`); high single-target burst to eliminate elites by turn 3.
   - _Stress-Tests_: Burst scaling, turn-1 lethal spikes, high-armor encounter checks.

#### Wizard

8. **The Pyroclasm Mage (Burn)**:
   - _Keywords_: `burn`
   - _Strategy_: Heavy burn stacking with `fireball` and `meteor`; AoE damage and self-combustion synergies.
   - _Stress-Tests_: AoE resolution order, multi-enemy status application, burn decay arithmetic.
9. **The Frostbite Controller (Freeze & Mana)**:
   - _Keywords_: `freeze`, `mana`
   - _Strategy_: Stuns and slows with `frostbolt` and `ray-of-frost`; ramps max mana using `mana-crystals` for high-cost spells.
   - _Stress-Tests_: Stun-lock mechanics, boss CC immunities/diminishing returns, high mana overflow bugs.

#### Alchemist

10. **The Caustic Apothecary (Poison & Consume)**:
    - _Keywords_: `poison`, `consume`
    - _Strategy_: Cycles disposable potions (`acid-potion`, `health-potion`) using `consume` mechanics for persistent poison.
    - _Stress-Tests_: Card exhaust/consume pools, deck exhaustion recovery, potion generation limits.
11. **The Wish-Seeker (Wish)**:
    - _Keywords_: `wish`
    - _Strategy_: Drafts `wishing-potion` and wish generators; plays wish cards first to adaptively draft combat solutions.
    - _Stress-Tests_: Wish card generation pools, wish UI/state resolution, RNG seeds inside combat choices.

#### Warlock

12. **The Blood Leech (Leech & Bleed)**:
    - _Keywords_: `leech`, `bleed`
    - _Strategy_: Pays health with `blood-offering` and `dark-pact` for high damage, sustains via `leech` and `fangs`.
    - _Stress-Tests_: Low-HP cost payment and defeat settlement, lifesteal rounding, and risky healing or upgrade choices.

#### Druid

13. **The Thorns Warden (Nature & Companion)**:
    - _Keywords_: `nature`, `companion`
    - _Strategy_: High passive thorns with `bloodthorn` and `briar-shield`; upgrades garden nodes in the Homestead.
    - _Stress-Tests_: Thorns counter-attack resolution, retaliatory damage timing, passive victory without playing attack cards.

### Universal cross-cutting playstyle archetypes

These playstyle modifiers can be applied to any hero to test systemic edge cases:

1. **The Minimalist (Thin Deck)**: Aggressively skips non-essential card rewards; spends shop gold on card removals down to 8–10 cards.
   - _Catches_: Deadlocks when events force-add curses/unremovable cards; infinite draw loops; exhaustion softlocks.
2. **The Packrat (Fat Deck)**: Takes almost every card offered; never purchases removals; finishes runs with 30+ cards.
   - _Catches_: Hand overflow bugs, severe tempo/draw bricking, memory/performance in large decks.
3. **The Glass Cannon (Aggro & Danger)**: Never rests at campfires (always upgrades); drafts pure damage; ignores defense.
   - _Investigates_: Attrition and failure rates when a policy neglects defense; those losses alone do not establish that a run is unwinnable.
4. **The Cautious Turtle (Safe & Slow)**: Always rests if HP < 80%; prioritizes max HP relics, armor, and healing over damage.
   - _Catches_: Stalemates where neither player nor boss can defeat each other; excessive run duration.
5. **The Chaos Gambler (High-Risk Mystery)**: At every mystery event, always picks the riskiest gamble (curses, HP sacrifice).
   - _Catches_: Softlocks caused by compounding curse penalties, zero-stat edge cases, unexpected status interactions.

---

## Anomaly detection and invariant checks

The framework continuously monitors and reports across both non-battle progression and combat resolution:

### 1. Progression softlocks and state invariants

- **Deadlock Detection**: Unresolvable screens where no valid command can be dispatched; orphaned reward claim locks; unsolvable mystery choices; or unnavigable map states. Explicitly exercise claim/abandon/cancel paths (`begin/commitDestinationClaim`, reward claim locks, `interruptedFlow` resume, labyrinth pending nodes/modifiers, corruption/mystery abandon, Wildwood phase change with its double-complete guard), not just the happy path.
- **Rejected and Repeated Actions**: Legal-choice careers cannot test command rejection. Add a small targeted suite for stale choices, repeated claims, and purchases that are no longer affordable. Assert the production rejection contract and absence of unintended rewards, charges, or progression changes. Keep deliberately invalid requests out of player-like balance samples.
- **Post-Commit Failures**: Follow the [production command contract](../ARCHITECTURE.md#post-commit-behavior): an `afterCommit` exception can leave gameplay already committed. Record the attempted action, before/after revision, resulting state where readable, and failure stage; stop and preserve evidence rather than automatically retrying and risking a duplicate action. Prove this recorder behavior with a controlled post-commit failure alongside an execution failure that rolls back.
- **Bounded Execution**: Bound actions per decision, battle turns, and career steps; use an external wall-clock watchdog for synchronous hangs, even while careers execute sequentially. Persist a bounded action journal and checkpoints as execution proceeds so a killed runner leaves useful evidence. Record each attempted action before invoking it. Retain a restorable checkpoint and every action since that checkpoint; never truncate that suffix merely to meet the journal limit. If checkpointing is unavailable mid-flow, retain history back to the previous supported checkpoint. Start with a career-start snapshot and the journal; add intermediate checkpoints only when replay cost justifies them. If evidence reaches its storage budget before a safe checkpoint, stop as incomplete rather than deleting required replay history. Record budget exhaustion separately from defeat or a confirmed softlock. Distinguish a missing harness handler or a policy repeatedly choosing no-ops from a game state with no legal way forward.
- **Continuous Save Validation**: `SaveDataSchema` is load-tolerant (nearly every field has `.catch()` repair), so a passing `safeParse()` alone cannot prove hygiene. Check the production loader’s repair diagnostics: `safeParseWithErrors` collects nested card warnings, while [`evaluateSaveCandidates`](../../src/features/alchemy/shared/storage/save-candidates.ts) also detects top-level repairs. Newly produced saves must load without unexpected repairs. Compare saved and restored gameplay fields, allowing only documented load normalization (such as the live-combat gold override), and check revision / claim-lock behavior. Round-trip stability is an additional check, not proof of lossless persistence: repaired or dropped data can be stable on subsequent passes. Keep intentional corrupt-save recovery fixtures separate and assert their expected repairs. In the small correctness suite, validate every supported save point exercised by the scenario. Broader sweeps may sample expensive checks at a recorded interval, plus run/career boundaries and failures where possible; retain cheap invariants after each action. Performance budgets should reduce sweep size before weakening the correctness suite.
- **Resume Behavior**: Where the save contract promises exact continuation, compare uninterrupted play with save → fresh runtime/reset → production load → continued play under the same recorded decisions and controlled randomness. Compare meaningful gameplay state and rewards; exclude only documented transient fields. Where loading intentionally cancels or normalizes an interrupted flow, assert that recovery behavior and continue from the recovered choices instead of requiring the old action journal to remain valid. Cover interrupted flows and run-end rewards for lost or duplicated progress. Codec stability alone can miss consistently dropped state.
- **Crash Recovery**: Keep this separate from deliberate save/resume. At selected persistence boundaries, restart from the last bytes actually written through production persistence, without forcing a final save. Assert the documented recovery guarantee, including no duplicate grants; do not demand preservation of progress the game has not committed. An in-memory adapter can test write sequencing, but physical storage failure and durability require the shipping backend's integration checks.
- **Numerical Bounds**: Player/enemy health, gold, currencies, and item counts asserting `Number.isFinite()` and staying within legal bounds (`health >= 0`, `gold >= 0`).

### 2. Economy and meta balance curves

- **Resource Starvation / Surplus**: Flagging runs that end Act 1 with 0 crafting materials or large unspendable gold carry (example: > 1,500; finalize the number from a baseline calibration run, not from this example).
- **Talent Pacing**: Catching XP surpluses where players bank excessive unspent points or face talent prerequisite deadlocks.
- **Progression Milestones**: Record runs or relevant opportunities needed to earn each tracked unlock or upgrade, together with the fraction of careers that reach it within the configured horizon. Report unreached milestones explicitly; averaging only successful careers hides slow progression. A short career that misses an unlock is not proof of an economic deadlock. Track available purchases and policy spending to distinguish scarce resources from deliberate hoarding.
- **Deck Stagnation**: Completing runs without drafting more than 2 non-starter cards or failing to remove starter strikes. Distinguish policy-induced stagnation (a Minimalist bot told to skip drafts) from game-induced stagnation before flagging.

### 3. Combat & archetype battle anomalies (organic decks)

Unlike the standalone battle balance simulator (which evaluates synthetic, isolated presets), the playthrough simulator tests **organically drafted decks equipped with real relics, boons, mystery buffs, and homestead modifiers**:

- **Combat Duration Outliers** (reuse existing detection mechanisms, but calibrate thresholds for organic decks and career stages; isolated-battle preset thresholds need not transfer unchanged):
  - _Stalls / Stalemates_: Battles extending past the stall threshold without resolution (e.g. high-armor player vs high-regen enemy).
  - _Potential Runaway Damage_: Non-boss fights ending on Turn 1 with extreme overkill. Investigate frequency, setup cost, and career stage before calling the result overpowered; an earned late-game payoff may be intentional.
- **Archetype Win-Rate Cliffs** (provisional shape; confirm against baseline variance before gating):
  - Identifying situations where an archetype has a healthy overall win-rate but collapses against one specific elite or boss (hard-counter walls that ruin player runs).
- **Severe Attrition Spikes** (provisional shape; confirm against baseline variance before gating):
  - Standard hallway encounters dealing a large share of player max health in observed damage. Investigate across policies before calling the damage unavoidable or the transition unwinnable.
- **Compounded Status & Damage Anomalies**:
  - Reusing the anomaly tracking engine from [`anomalies.ts`](../../src/lib/balance/anomalies.ts) across playthrough battles to detect runaway compounding effects:
    - Unbounded status stacks (e.g. 5,000+ Poison, Burn, or Bleed).
    - Infinite Block / Armor accumulation.
    - Extreme single-hit damage spikes resulting from unintended multiplicative interactions between gear, talents, and boons.
- **Card Use and Policy Blind Spots**:
  - Report drawn, legally playable, and chosen counts separately. A card ignored by one policy may expose a policy blind spot rather than unusable content; compare another policy before drawing balance conclusions.

---

## Reporting & actionable insights architecture

Produce one structured result for terminal summaries, JSON comparisons, and a later HTML report. These are views of the same outcomes and metrics; keep calculations and failure classification shared.

```
                 Simulation Run (e.g. 50 Careers / 250 Runs)
                                      │
         ┌────────────────────────────┼────────────────────────────┐
         ▼                            ▼                            ▼
  [Tier 1: Terminal]          [Tier 2: Visual HTML]       [Tier 3: JSON Diff]
• Instant stdout summary    • reports/playthrough.html   • reports/playthrough.json
• Replay bundle command    • Red flag callout box       • Historical diffs
• Fast PASS/FAIL signal     • Mortality curves           • Balance regressions
• CI gate friendly          • Economy & pacing curves    • Machine readable
```

### Tier 1: Terminal instant-triage summary (CLI & CI)

- **Immediate Outcome**: Runs the fast smoke sweep, outputting a compact ASCII health dashboard to stdout.
- **One-Click Deterministic Repro Box**:
  When any blocker or critical anomaly occurs, it prints the exact command to replay that single run (proposed CLI follows the existing `balance:*` / `scripts/run-*.mjs` convention, not yet implemented):

  ```bash
  balance:playthrough:replay --bundle reports/repros/failure-48192.json
  ```

  Once implemented, print a copyable npm invocation of this proposed script, including the argument separator.

  A seed plus character alone cannot reproduce a run: run RNG is one seed plus counters for the `rewards` / `destinations` / `events` / `shops` / `world` streams, plus battle RNG and version drift (crafting uses injected randomness outside the run streams). The replay bundle must therefore contain the initial save or a known-good checkpoint, seed and RNG states/counters (including policy randomness), injected clock/ID inputs where relevant, policy/configuration versions, action journal, failing action, and code/content identity (including local changes). Preserve the last known-good checkpoint even if the failing state cannot serialize. A valid shipping save is not automatically an exact replay checkpoint: loading may abandon an interrupted choice or normalize transient state. Use a checkpoint only where restoration preserves the next recorded decision; otherwise replay from an earlier verified checkpoint or the career start. Do not change the shipping save contract merely to support harness checkpoints. Keep policy randomness separate from gameplay RNG so a heuristic change does not itself consume game rolls.
  Replay applies the recorded actions without asking the policy to choose again, checks the recorded transitions, and reports the first divergence. Exact reproduction requires the matching code/content and inputs; replay against changed code is a regression experiment. Prove reproduction in a fresh process before advertising the command as deterministic.

- **Hero & Economy Matrix**: Summarizes win rates, average floors reached, average combat turns, and net gold/materials.

### Tier 2: Interactive HTML progression report (`reports/playthrough.html`)

Leverages Alchemy's existing report layout utilities ([`report-layout.ts`](../../src/lib/balance/report-layout.ts)) and, where possible, the existing `report-model` / `report-rankings` / `findings` infrastructure instead of a from-scratch renderer, to render a shareable visual dashboard:

1. **Executive Red Flag Box**: Highlights top 3 balance or softlock concerns (e.g., _"Act 2 Boss kills 84% of Poison Rogues"_, _"Herb drops bottleneck Tier 2 Garden construction"_).
2. **Run Mortality Funnel**: Step-by-step survival drop-offs by floor and act, visualizing where player runs die.
3. **Archetype Performance Matrix**: Heatmap comparing implemented, exercised archetypes across win rate, combat turn length, peak status stacks, and deadlocks. Mark missing coverage explicitly.
4. **Economy & Pacing Curves**: Floor-by-floor graphs tracking gold carry balance, shop purchasing power, material accrual rates, and talent unlocking velocity.
5. **Card & Item Usage**: Shows opportunities versus actual use by policy. Track passive item triggers separately from card plays; low usage is an investigation lead, not proof of low value.

### Tier 3: Machine-readable JSON & regression baselines (`reports/playthrough.json`)

- Writes full structured metrics to `reports/playthrough.json`. Build stdout + JSON before the HTML dashboard; HTML comes last.
- Compare a fixed, versioned scenario manifest on both revisions: same initial saves, seeds, policies, modes, and career lengths. Report denominators, effect sizes, and uncertainty by cohort; treat careers as independent samples rather than counting their correlated floors/runs as independent evidence. Show boss results conditional on reaching that boss and overall reach rates to expose survivor bias. For balance comparisons, rerun the same policy against each revision and allow it to choose differently as gameplay changes; do not force the old action journal. Matching seeds do not guarantee matching encounters after paths or RNG consumption diverge.
- Use baseline distributions to estimate noise, but set acceptable pacing and difficulty from explicit design goals; the current baseline may already contain a balance problem. When exploring many hero/card/encounter combinations, confirm flagged patterns on additional seeds before treating them as reliable balance findings.
- Keep balance findings advisory until minimum sample sizes and meaningful regression thresholds are agreed. Deterministic crashes and invariant violations can gate the smoke suite immediately. A required smoke scenario that ends in a harness error, unsupported choice, or exhausted execution budget must also fail the check as incomplete, without being classified as a game bug or gameplay loss. Report planned, completed, and incomplete scenario counts so partial sweeps cannot appear successful.
- Supports comparison sweeps (proposed CLI follows the existing `balance:*` convention, e.g. `balance:playthrough:compare --baseline main`):
  - Flags balance regressions: _"PR increased Knight combat turn average from 5.2 to 9.8 turns (Stalemate risk!)"_.
  - Confirms balance buffs: _"Rogue win rate increased from 31% to 54% (+23 percentage points)"_.

---

## Phased implementation steps

- [ ] **Phase 0: Headless spike + benchmark (required before committing to budgets)**
  - Prove one complete battle action and settlement, one shop purchase, one mystery choice, and one homestead action run in plain Node/vitest with clocks/RNG injected. Prove that a production-triggered save is acknowledged and can be loaded by a fresh runtime without React starting the autosave lifecycle. Stub only presentation effects; preserve any deferred work required for gameplay or persistence, even if it shares an `afterCommit` boundary.
  - Choose the simplest reliable career isolation boundary. Try explicit reset against the global Zustand aggregate; run scenario A alone and after scenario B and require the same result. Reset must cover storage contents, subscriptions, pending work, and injected clocks/RNG/IDs, while preserving progression within each career. If complete reset needs invasive lifecycle changes or remains unreliable, use a fresh child process per career. Process isolation is a correctness option, independent of parallel execution; keep careers sequential initially and measure startup cost before optimizing.
  - Measure action execution and persistence-validation costs to estimate feasibility. Finalize sweep budgets only after Phase 1 measures a complete career.
  - Resolve the runner location through the `architect` skill: the proposed src/lib/simulation/playthrough/ path cannot drive feature commands as written (`src/lib` must stay React-free and must not import from `features/` per `LIB_NO_FEATURES`; only `shared/stores` may import the gameplay aggregate). Place the harness where feature-command imports are legal.
- [ ] **Phase 1: Core In-Run Flow & Invariant Harness**
  - Scaffold the playthrough simulation runner at the architect-approved location (not `src/lib` if it imports feature commands).
  - Implement one complete vertical slice: fresh save -> character select -> battle -> rewards -> map navigation -> campfires -> victory/defeat -> run-end settlement -> next run. Start with one hero in Campaign and a simple policy; expand breadth after this lifecycle works. Handle every mandatory choice reachable in that slice through production actions, including basic shop/event handling if encountered. Later phases add breadth and richer policies. Phase 1 must complete without bypassing encounters, directly mutating game state, or silently discarding inconvenient seeds.
  - Ship minimal CLI, action journal, replay bundle, bounded execution, and stdout/JSON outcomes with this first loop. Acceptance: reproduce a captured failure (a controlled test failure is sufficient) in a fresh process, retain victory and defeat settlement scenarios, and verify one save/resume continuation against uninterrupted play. Measure complete-career throughput and add the bounded correctness smoke to CI once these checks pass.
  - Assert save validity at the frequency defined in Anomaly §1 plus reward/destination claim-lock and `interruptedFlow` hygiene with reset between independent careers.
  - Retain focused rejection and duplicate-claim scenarios alongside the legal-choice career. Check recovery from the last persisted save at one run-settlement boundary; extend interruption coverage as additional flows are supported.
- [ ] **Phase 2: Earned Progression & Between-Run Decisions**
  - Extend the Phase 1 run-end coverage across material harvesting, XP/talent progression, and character/difficulty unlocking.
  - Build meta-agent heuristics: spending talent points, upgrading homestead structures, and equipping armory gear.
  - Acceptance: retain a fresh-save scenario that earns an affordable upgrade, purchases or equips it through production actions, saves/resumes, and verifies that its intended effect carries into the next run. Use targeted fixtures for later unlocks rather than requiring long careers to cover every branch.
  - Expand the basic career loop to longer careers on a single persistent save, checking unlock and spending milestones.
- [ ] **Phase 3: Comprehensive In-Run Encounters (Shops, Mystery, All Modes)**
  - Implement decision policies for all 4 shop types and card removal.
  - Implement both mystery policies: blind fuzz picks for crash-finding and keyword-driven archetype picks for balance.
  - Extend Campaign coverage with Wildwood drafting/phase transitions and Labyrinth navigation. Declare a finite observation horizon for endless modes. Reaching that planned horizon is a completed observation, not victory or an unexpected execution-budget failure; record any production End Run action separately from defeat and verify that it keeps earned progress without granting unclaimed choices.
  - Start with a small archetype subset (e.g. Block Knight, Poison Rogue, Burn Wizard, Companion Ranger plus Minimalist + Gambler fuzz) and add profiles only when they exercise a distinct mechanic or decision pattern. The full catalog is optional; avoid a Cartesian product of heroes, profiles, modes, and difficulties. Expand hero support to all 8 characters (including Wildcard starter draft) once the harness is stable.
- [ ] **Phase 4: Three-Tier Reporting, Anomaly Diagnostics, & CI Tooling**
  - Extend the Phase 1 failure recorder and replay bundles with richer anomaly diagnostics; preserve the reproduction contract above.
  - Build `progress-telemetry.ts`: aggregates mortality curves, economy pacing, card utility, and archetype performance. Calibrate alert thresholds from a baseline run; do not gate CI on the example numbers in this plan.
  - Build stdout + JSON reporting first; build the visual dashboard (`reports/playthrough.html`) last, reusing `report-model` / `report-rankings` / `findings` where possible.
  - Extend the Phase 1 CLI entry points following the existing `balance:*` / `scripts/run-*.mjs` convention (e.g. `balance:playthrough` and `balance:playthrough:replay`) with customizable seeds, heroes, and career lengths.
  - Implement baseline regression comparison (e.g. `balance:playthrough:compare`).

---

## Notes & Verification

Keep durable rules in their canonical owner. For test selection and task-owned handoff, follow [CONTRIBUTING](../../CONTRIBUTING.md#what-to-run-when-you-change) and [the plan lifecycle](./README.md#task-handoff).
