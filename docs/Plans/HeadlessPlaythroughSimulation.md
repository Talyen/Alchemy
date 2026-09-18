---
status: active
updated: 2026-09-18
---

# Headless Playthrough Progression Simulation

## Objective

Build an automated, headless playthrough simulation framework that emulates real players progressing through Alchemy from a fresh save file across all heroes, abilities, talents, game modes, equipment, and homestead systems.

The simulator runs directly against the game engine and synchronous store command pipeline ([`dispatchRunSessionCommand`](../../src/features/alchemy/shared/stores/run-session-command.ts)) without mounting React, rendering DOM, compiling styles, or playing audio. This enables high-speed execution (hundreds of floors per second) to discover progression blockers, non-battle balance anomalies, economic deadlocks, illegal state transitions, and save corruption across diverse RNG seeds.

---

## Core architecture invariant: zero mechanic duplication (the virtual controller)

To prevent code drift and perpetual maintenance, **the simulator must never duplicate or re-implement any game logic, formulas, or state transitions**.

```
                               ┌────────────────────────────────────────┐
                               │       Virtual Player (Simulator)       │
                               │  - Only owns: DECISIONS (Which choice?)│
                               └──────────────────┬─────────────────────┘
                                                  │
                                                  ▼
                        Dispatches the exact same production commands as the UI
                                                  │
┌─────────────────────────────────────────────────┴───────────────────────────────────────────────┐
│                                 Alchemy Production Domain                                       │
│                                                                                                 │
│   • Combat: playBattleCardResolved(), endPlayerTurn()                                           │
│   • Navigation: resolveAvailableDestinations(), navigateToDestination()                        │
│   • Rewards: reward-commands.ts, selectRewardCard(), claimRewardBundle()                        │
│   • Shops: createShopActions(), buyShopSlot(), purchaseCardRemoval()                            │
│   • Events: mystery-flow.ts, executeMysteryEffect()                                             │
│   • Meta: canUnlockTalent(), unlockTalent(), upgradeHomesteadBuilding(), equipGearInstance()   │
│   • State & Persistence: gameplay-state-store.ts, SaveDataSchema, snapshotRun()                │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

1. **The Simulator is an Actor, not an Engine**: Real human players only supply inputs (which card to click, which shop item to buy, which talent to select). The simulator mirrors this exactly: it is purely a "Virtual Controller" that reads the production read ports and invokes the production commands.
2. **Seamless Sync with Game Changes**:
   - When a designer modifies card effects, shop price scaling, talent requirements, or drop tables, the simulator automatically inherits the changes without a single line of simulator maintenance.
   - If a refactor breaks a command or save schema, the simulator fails immediately because it runs the real production code.
3. **Strict Separation of Concerns**:
   - **Production Engine Owns**: Game rules, validation, state mutations, RNG streams, loot tables, and save schemas.
   - **Simulator Owns**: Only decision heuristics ("if HP < 40%, choose Rest"), iteration harnesses, telemetry logging, and invariant assertions.

---

## Open questions and decisions

The following decisions should be aligned before or during implementation:

### 1. Bot archetypes and heuristic profile selection

- **Status**: Aligned on keyword-driven heuristic archetypes.
- **Approach**: The virtual player uses a `PlayerArchetype` profile defined by primary/secondary keywords and playstyle parameters (risk tolerance, target deck size, removal aggressiveness).
- **Benefit**: Drives unified, coherent decisions across all subsystems (drafting, shops, removals, talents, gear, combat) without maintaining separate rule trees per screen.

### 2. CI integration and performance budget

- **Question**: How should this simulation fit into CI and developer workflows?
- **Options**:
  - **Option A (Gate on PRs)**: Run a short, fast smoke sweep (e.g., 3 seeds across 2 heroes, ~3–5 seconds) on PR verification.
  - **Option B (Scheduled / Nightly Sweep)**: Run a massive Monte Carlo sweep (e.g., 100 seeds across all 8 heroes, full 5-run careers, ~2–3 minutes) via nightly workflow or manual trigger.
  - **Option C (Both)**: A micro-smoke for PRs and an exhaustive sweep on a nightly schedule.

### 3. Anomaly and balance alert thresholds

- **Question**: What constitutes a reportable balance anomaly versus normal roguelite variance?
- **Considerations**: While crashes, softlocks, and schema failures are unambiguous binary failures, economy and progression balance are continuous. Clear thresholds should be established for:
  - **Floor Failure Rate**: e.g., if a specific boss has > 85% death rate across 50 seeds on Novice.
  - **Resource Starvation / Surplus**: e.g., ending Act 1 with 0 crafting materials or > 1,500 unspendable gold.
  - **Deck Stagnation**: e.g., finishing a full run without drafting more than 2 non-starter cards.

### 4. Mystery event knowledge modeling

- **Question**: Should the bot have "omniscient" knowledge of hidden event consequences, or should it simulate player blind choices?
- **Considerations**: Real players don't know the exact outcome of unfamiliar mystery nodes on a fresh save. A blind or probabilistic policy tests unexpected consequences better (such as accidentally reducing HP to near zero before an elite room).

### 5. Storage seam and state reset isolation

- **Question**: Should the multi-run career runner write to an ephemeral in-memory storage adapter or use a sandboxed temporary file?
- **Considerations**: In-memory execution using Alchemy's save serialization codecs is fastest and avoids filesystem I/O locks, while writing to a scratch file tests literal disk persistence and file locking.

---

## Game-wide scope and behavioral requirements

### 1. Heroes and loadouts

- **All 8 Playable Heroes**: Knight, Ranger, Rogue, Wizard, Alchemist, Warlock, Druid, and Wildcard (including its distinct starter draft phase).
- **Hero-Specific Mechanics**: Starter decks, signature keyword mechanics (Block/Armor/Forge, Bleed/Poison/Gold, Wolf Companion/Arrows, Mana/Spells, etc.), and character unlock progression across runs.

### 2. Game modes and content systems

- **Wildwood Progression**: Linear and branching act layouts, phase transitions, and act bosses.
- **Labyrinth Mode**: Grid-based labyrinth floor navigation, room types, entry and exit criteria, labyrinth modifiers, and boss chambers.
- **Campaign Difficulties**: Novice, Adept, Master, and beyond, validating scaling modifiers and unlock tracking.

### 3. In-run encounters and flow

- **Combat Resolution**: Integrates existing battle simulator policies (`greedy-damage`, `random-playable`, `defensive-random`) with full handling of wish cards, companion actions, status effects, and elite/boss modifiers.
- **Reward Flow**: Card draft picks, gold accumulation, material awards, item/relic claims, skip actions, and proper advancement of multi-part reward bundles.
- **Node Navigation**: Dynamic path selection across standard combat, elites, campfires, card shops, trinket shops, equipment shops, alchemist shops, mystery rooms, and corruption nodes.
- **Shop Economy**: Purchasing cards, relics, materials, and gear; purchasing card removals; handling insufficient gold and empty slots gracefully.
- **Campfires**: Health evaluation for resting vs. alternative campfire actions.
- **Mystery Events**: Evaluating choice branches, HP payment/costs, curse afflictions, card additions/removals, and ensuring events never crash on missing deck targets.

### 4. Meta-progression and between-run systems

- **Talent Trees**: Tracking XP gains per keyword tree, allocating earned points via `canUnlockTalent`, respecting row prerequisites, and testing tree resets.
- **Homestead**: Upgrading core buildings, tending farm plots, advancing research tiers, and advancing companion bond levels using in-run harvested materials.
- **Armory & Gear**: Receiving loot gear instances, evaluating stat upgrades, equipping weapons/armor/trinkets, crafting, dismantling, and verifying set bonuses.
- **Profile Unlocks**: Verifying that run completions correctly unlock subsequent heroes, higher difficulties, and log discoveries in the collection catalog.

---

## Virtual player archetypes and decision heuristics

To simulate realistic human progression, the virtual player operates under a **Player Archetype Profile**. Because cards, talents, gear, and items in Alchemy are natively structured around **Keywords**, an archetype is defined as a keyword affinity profile paired with playstyle parameters.

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

### Archetype profile schema

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
    - _Stress-Tests_: Low-HP edge cases (preventing self-inflicted defeat on cost payment), lifesteal rounding, suicide prevention at campfires.

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
   - _Catches_: Hand overflow bugs, deck scrolling issues, severe tempo/draw bricking, memory/performance in large decks.
3. **The Glass Cannon (Aggro & Danger)**: Never rests at campfires (always upgrades); drafts pure damage; ignores defense.
   - _Catches_: Mathematical breakpoints where the game becomes unwinnable without defensive mitigation.
4. **The Cautious Turtle (Safe & Slow)**: Always rests if HP < 80%; prioritizes max HP relics, armor, and healing over damage.
   - _Catches_: Stalemates where neither player nor boss can defeat each other; excessive run duration.
5. **The Chaos Gambler (High-Risk Mystery)**: At every mystery event, always picks the riskiest gamble (curses, HP sacrifice).
   - _Catches_: Softlocks caused by compounding curse penalties, zero-stat edge cases, unexpected status interactions.

---

## Anomaly detection and invariant guarantees

The framework continuously monitors and reports across both non-battle progression and combat resolution:

### 1. Progression softlocks and state invariants

- **Deadlock Detection**: Unresolvable screens where no valid command can be dispatched; orphaned reward claim locks; unsolvable mystery choices; or unnavigable map states.
- **Continuous Save Schema Validation**: Serializing and parsing via `SaveDataSchema.safeParse()` at every floor transition to guarantee 100% save-compatibility and schema hygiene.
- **Numerical Bounds**: Player/enemy health, gold, currencies, and item counts asserting `!isNaN()` and staying within legal bounds (`health >= 0`, `gold >= 0`).

### 2. Economy and meta balance curves

- **Resource Starvation / Surplus**: Flagging runs that end Act 1 with 0 crafting materials or > 1,500 unspendable gold.
- **Talent Pacing**: Catching XP surpluses where players bank excessive unspent points or face talent prerequisite deadlocks.
- **Deck Stagnation**: Completing runs without drafting more than 2 non-starter cards or failing to remove starter strikes.

### 3. Combat & archetype battle anomalies (organic decks)

Unlike the standalone battle balance simulator (which evaluates synthetic, isolated presets), the playthrough simulator tests **organically drafted decks equipped with real relics, boons, mystery buffs, and homestead modifiers**:

- **Combat Duration Outliers**:
  - _Stalls / Stalemates_: Battles extending past 25 turns without resolution (e.g. high-armor player vs high-regen enemy).
  - _Degenerate One-Shots_: Non-boss fights ending on Turn 1 with extreme overkill, indicating an overpowered runaway loop.
- **Archetype Win-Rate Cliffs**:
  - Identifying situations where an archetype has a healthy 70%+ win-rate overall, but drops to < 10% against one specific elite or boss (hard-counter walls that ruin player runs).
- **Severe Attrition Spikes**:
  - Standard hallway encounters dealing > 50–60% of player max health in unavoidable damage, creating unwinnable act transitions.
- **Compounded Status & Damage Anomalies**:
  - Reusing the anomaly tracking engine from [`anomalies.ts`](../../src/lib/balance/anomalies.ts) across playthrough battles to detect runaway compounding effects:
    - Unbounded status stacks (e.g. 5,000+ Poison, Burn, or Bleed).
    - Infinite Block / Armor accumulation.
    - Extreme single-hit damage spikes resulting from unintended multiplicative interactions between gear, talents, and boons.
- **Dead Card Inutility**:
  - Identifying cards drafted into the deck that are drawn 5+ times across a run but played 0 times (unusable deck clutter).

---

## Reporting & actionable insights architecture

To translate simulation data into immediate developer productivity and designer balance insight, the simulator implements a **three-tier reporting architecture**:

```
                 Simulation Run (e.g. 50 Careers / 250 Runs)
                                      │
         ┌────────────────────────────┼────────────────────────────┐
         ▼                            ▼                            ▼
  [Tier 1: Terminal]          [Tier 2: Visual HTML]       [Tier 3: JSON Diff]
• Instant stdout summary    • reports/playthrough.html   • reports/playthrough.json
• 1-Click seed replay box   • Red flag callout box       • Historical diffs
• Fast PASS/FAIL signal     • Mortality curves           • Balance regressions
• CI gate friendly          • Economy & pacing curves    • Machine readable
```

### Tier 1: Terminal instant-triage summary (CLI & CI)

- **Immediate Outcome**: Runs in 5–10 seconds, outputting a compact ASCII health dashboard to stdout.
- **One-Click Deterministic Repro Box**:
  When any blocker or critical anomaly occurs, it prints the exact command to replay that single run in ~50ms (proposed CLI, not yet implemented):
  ```bash
  sim:replay --seed 48192 --character rogue
  ```
  This immediately dumps the step-by-step action journal leading up to the exact failed state.
- **Hero & Economy Matrix**: Summarizes win rates, average floors reached, average combat turns, and net gold/materials.

### Tier 2: Interactive HTML progression report (`reports/playthrough.html`)

Leverages Alchemy's existing report layout utilities ([`report-layout.ts`](../../src/lib/balance/report-layout.ts)) to render a shareable visual dashboard:

1. **Executive Red Flag Box**: Highlights top 3 balance or softlock concerns (e.g., _"Act 2 Boss kills 84% of Poison Rogues"_, _"Herb drops bottleneck Tier 2 Garden construction"_).
2. **Run Mortality Funnel**: Step-by-step survival drop-offs by floor and act, visualizing where player runs die.
3. **Archetype Performance Matrix**: Heatmap comparing all 13 hero archetypes across win rate, combat turn length, peak status stacks, and deadlocks.
4. **Economy & Pacing Curves**: Floor-by-floor graphs tracking gold carry balance, shop purchasing power, material accrual rates, and talent unlocking velocity.
5. **Dead Card & Item Cemetery**: Highlights cards and items with high draft/purchase rates but < 5% actual play utility in combat.

### Tier 3: Machine-readable JSON & regression baselines (`reports/playthrough.json`)

- Writes full structured metrics to `reports/playthrough.json`.
- Supports comparison sweeps (proposed CLI `sim:playthrough:compare --baseline main`):
  - Flags balance regressions: _"PR increased Knight combat turn average from 5.2 to 9.8 turns (Stalemate risk!)"_.
  - Confirms balance buffs: _"Rogue win rate increased from 31% to 54% (+23%)"_.

---

## Phased implementation steps

- [ ] **Phase 1: Core In-Run Flow & Invariant Harness**
  - Scaffold the playthrough simulation runner (proposed location: src/lib/simulation/playthrough/).
  - Implement the floor-stepping loop: character select -> battle -> rewards -> map navigation -> campfires.
  - Assert save schema validity and lock hygiene after every action.
- [ ] **Phase 2: Comprehensive In-Run Encounters (Shops, Mystery, All Modes)**
  - Implement decision policies for all 4 shop types and card removal.
  - Implement mystery event evaluation policies.
  - Support both Wildwood and Labyrinth navigation.
  - Expand hero support to all 8 characters (including Wildcard starter draft).
- [ ] **Phase 3: Meta-Progression & Fresh-Save Career Harness**
  - Implement run-end resolution: material harvesting, XP-to-talent conversion, character/difficulty unlocking.
  - Build meta-agent heuristics: spending talent points, upgrading homestead structures, and equipping armory gear.
  - Enable multi-run career loops on a single persistent save.
- [ ] **Phase 4: Three-Tier Reporting, Anomaly Diagnostics, & CI Tooling**
  - Build `anomaly-recorder.ts`: outputs deterministic reproduction bundles (seed, action journal, pre-failure snapshot diff).
  - Build `progress-telemetry.ts`: aggregates mortality curves, economy pacing, card utility, and archetype performance.
  - Build `playthrough-report-html.ts`: renders visual dashboard (`reports/playthrough.html`).
  - Implement CLI entry points (proposed `sim:playthrough` and `sim:replay`) with customizable seeds, heroes, and career lengths.
  - Implement baseline regression comparison (proposed `sim:playthrough:compare`).

---

## Notes & Verification

Keep durable rules in their canonical owner. For test selection and task-owned handoff, follow [CONTRIBUTING](../../CONTRIBUTING.md#what-to-run-when-you-change) and [the plan lifecycle](./README.md#task-handoff).
