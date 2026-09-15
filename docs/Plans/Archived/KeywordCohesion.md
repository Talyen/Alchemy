---
status: complete
updated: 2026-09-15
---

# Keyword Cohesion in Alchemy

## Objective

Ensure every card ability, talent, enemy trait, and item affix in Alchemy features at least one meaningful, recognized keyword in its player-facing description, while preserving established combat mechanics, class archetypes, and balance.

This plan reviews the keyword cohesion proposals from our sibling repository, Trinket (`/Users/ryanmcintire/Documents/Trinket/Docs/Plans/KeywordCohesion.md`), evaluates the architectural and content differences between the two games, and specifies which changes should be adopted, adapted, or intentionally excluded in Alchemy.

---

## Architectural Comparison: Alchemy vs. Trinket

While Alchemy and Trinket share core vocabulary, their design contracts diverge in critical ways:

1. **Keywords:**
   - Trinket operates on 17 keywords.
   - Alchemy defines 22 recognized keywords in [`keywordDefinitions`](../../../src/lib/game-data/keywords.ts), including game-defining mechanics such as **Forge**, **Archery**, **Nature**, **Thorns**, and **Wish**.

2. **Talent Architecture:**
   - Trinket organizes talents under character and companion classes (Wizard, Bear, Panther, Golden Retriever, Risen Skeleton, Pixie).
   - Alchemy organizes talents into **22 modular Keyword Talent Pools** ([`talent-pool-definitions.ts`](../../../src/lib/game-data/talents/talent-pool-definitions.ts)). Companions in Alchemy have bond levels and turn-start effects, but no independent talent trees.

3. **Gear Affixes & Unique Items:**
   - Trinket audited 94 standard affixes and 5 bespoke Unique items that lacked keywords.
   - Alchemy requires all gear affixes to bind to a primary `keywordId` and optional `secondaryKeywordId` in [`affix-catalog.ts`](../../../src/lib/gear/affix-catalog.ts). An audit confirmed that **100% of Alchemy's 101 affixes already feature recognized keywords**.
   - The 5 Unique items Trinket redesigned (_Everkeen_, _The Patient Edge_, _The Returning Gale_, _The Returning Flight_, _Huntsmaster's Call_) were designed specifically for Alchemy's **Forge**, **Archery**, and **Companion** systems, and already contain recognized keywords.

4. **Alchemy Catalog Audit Findings (`extractKeywordIds`):**
   - **Cards (105 total):** Only 2 cards lack keywords: `predators-focus` ("Your next damaging card is a critical strike") and `cleanse` ("Cleanse 1 harmful status effect").
   - **Talents (200 total):** Only 4 talents lack keywords in their descriptions despite belonging to keyword pools: `Restock` (Gold pool), `Distillation` (Consume pool), `Brewmaster` (Consume pool), and `Will to Live` (Health pool).
   - **Enemy Traits (49 total):** Only 2 bestiary traits lack keywords: `bandit`'s _Ambush_ ("Deals double damage on its first attack") and `banshee`'s _Dread Wail_ ("Attacks Purge one beneficial effect").
   - **Affixes (101 total):** 0 affixes lack keywords.

---

## Content Evaluation and Decisions

### 1. Abilities and Cards

| Ability / Card                           | Trinket Proposal                                             | Alchemy Current State                                                                                       | Decision for Alchemy                                                                                                                                                                                                        |
| :--------------------------------------- | :----------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Predator's Focus**                     | Guaranteed Critical Hit + **Leech**.                         | Cost 1. `next-hit-crit`. Description: _"Your next damaging card is a critical strike"_. (0 keywords)        | **ADAPT & ADOPT**. Add **Leech** to the effect and description (_"Your next damaging card is a critical strike and has Leech"_). Resolves one of Alchemy's only two missing card keywords.                                  |
| **Maul**                                 | _"Deal 2 Stun or Bleed damage at random."_                   | Cost 1. 50% Stun 3, 50% Bleed 3. Description: _"Deal 3 Stun or Bleed damage"_.                              | **ADOPT (Wording)**. Clarify to _"Deal 3 Stun or Bleed damage at random"_ to make the 50/50 outcome explicit.                                                                                                               |
| **Bounty Shot**                          | _"Deal 3 Physical damage and Steal 2 Gold."_                 | Cost 1 Archery. Deals 2 Physical + 2 Gold. Description: _"Deal 2 Physical damage / Gain 2 Gold / Archery"_. | **NO CHANGE (Already Aligned)**. Alchemy already has unconditional Physical damage and Gold without branching.                                                                                                              |
| **Sniff Out**                            | Replaced Mark with +3 Physical damage preparation.           | Cost 1 Archery, Consume. _"Draw a card / Your next Archery card is free / Consume"_.                        | **EXCLUDE**. Core Archery combo card with two recognized keywords (**Archery**, **Consume**).                                                                                                                               |
| **Sap Arrow → Bandit's Arrow**           | Renamed to Bandit's Arrow. Deal 3 Stun + Steal 2 Gold.       | Cost 1 Archery. Deals 2 Nature damage + Leech. Description: _"Deal 2 Nature damage / Leech / Archery"_.     | **EXCLUDE**. In Alchemy, Sap Arrow represents tree sap (Nature + Leech). Renaming to Bandit's Arrow does not fit.                                                                                                           |
| **Cinderbloom**                          | Deal 3 Burn or Poison damage at random.                      | Cost 1. Dual damage: 2 Nature + 1 Burn. Description: _"Deal 2 Nature damage / Deal 1 Burn damage"_.         | **EXCLUDE**. Alchemy card is deterministic dual-element (Nature + Burn) and already keyword-rich.                                                                                                                           |
| **Tithe**                                | Deal 2 Holy damage and Steal 2 Gold.                         | Cost 1. Deals Holy damage equal to 10% of player Gold stash.                                                | **EXCLUDE**. Alchemy's card scales dynamically with player wealth and already has Holy and Gold keywords.                                                                                                                   |
| **Avatar**                               | Deal 6 Holy damage now and for 2 more turns. (Removed Block) | Cost 1, Consume. Gain 4 Block + Deal 4 Holy now and next turn.                                              | **EXCLUDE**. Alchemy's Avatar features Block, Holy, and Consume keywords. Removing Block alters balanced paladin identity.                                                                                                  |
| **Cleanse**                              | N/A                                                          | Cost 1. `remove-harmful-status`. Description: _"Cleanse 1 harmful status effect"_. (0 keywords)             | **SYSTEM CLARIFICATION**. Cleanse is a recognized core action in Alchemy's card parity rules, but is omitted from `keywordAliases`. Consider adding "Cleanse" to `keywordAliases` or referencing harmful statuses directly. |
| **Ray of Frost / Blizzard / Earthquake** | 3-turn recurring ticks.                                      | 2-turn delays with Freeze/Stun keywords.                                                                    | **EXCLUDE**. Different turn-delay mechanics; all already have Freeze/Stun keywords.                                                                                                                                         |
| **Sunburst**                             | Restore 3 Health to each ally + 6 Holy.                      | Cost 1. Restore 2 Health + Deal 1 Burn.                                                                     | **EXCLUDE**. Alchemy's card is an early-game hybrid heal/burn card with both Health and Burn keywords.                                                                                                                      |
| **Pounce**                               | Deal 3 Stun, doubled on first turn.                          | Cost 1. Deals 2 Physical and 2 Stun.                                                                        | **EXCLUDE**. Unconditional dual Physical/Stun strike with both keywords present.                                                                                                                                            |
| **Golden Plate**                         | Gain 8 Block and 5 Gold.                                     | Does not exist in Alchemy.                                                                                  | **N/A**.                                                                                                                                                                                                                    |

### 2. Talents

Trinket modified 11 character- or companion-specific talents (Wizard, Bear, Panther, Golden Retriever, Risen Skeleton, Pixie). Alchemy does not use companion-specific talent trees, so those specific modifications do not apply.

However, Alchemy should apply the keyword cohesion principle to its 4 keyword-pool outlier talents:

- **`gold-shop-refresh` (Restock, Gold Pool):**
  - Current: _"Shop refreshes are free"_
  - Proposed: _"Shop refreshes cost 0 Gold"_
- **`consume-distillation` (Distillation, Consume Pool):**
  - Current: _"Potions are 20% more potent"_
  - Proposed: _"Consumed Potions are 20% more potent"_
- **`consume-brewmaster` (Brewmaster, Consume Pool):**
  - Current: _"Mixed Potion potency is increased by 1"_
  - Proposed: _"Consumed Mixed Potions have +1 potency"_
- **`health-max-4` (Will to Live, Health Pool):**
  - Current: _"Death's Door lasts 1 turn longer"_
  - Proposed: Retain as is or clarify Health connection if desired.

### 3. Enemy Traits

Trinket updated 1 enemy trait (Mimic first-attack damage doubling).

- In Alchemy, the Mimic has _Gold Trove_ (Drops Double Gold on Defeat), which already has the **Gold** keyword.
- However, Alchemy's **Bandit** enemy has the exact first-attack doubling trait (_Ambush_: _"Deals double damage on its first attack"_).
  - Proposed: Clarify to _"Deals double Physical damage on its first attack"_ to incorporate the **Physical** keyword while preserving combat balance.
- Alchemy's **Banshee** enemy has _Dread Wail_ (_"Attacks Purge one beneficial effect"_).
  - Proposed: Clarify to _"Attacks Purge one beneficial effect (Block, Armor, or Forge)"_, matching the engine's exact purge list and adding three recognized keywords.

### 4. Standard Affixes & Unique Items

- **Standard Affixes:** Alchemy's 101 affixes already require a `keywordId` and all contain keywords in their descriptions. Do not import Trinket's 5 affixes.
- **Unique Items:**
  - _Everkeen_ (Greatsword) uses **Forge** to repeat **Physical** cards.
  - _Huntsmaster's Call_ (Longbow) triggers on **Archery** cards to repeat **Companion** attacks.
  - _The Patient Edge_ (Shortsword) recovers spent **Forge**.
  - _The Returning Gale_ (Recurve-bow) repeats **Archery** damage next turn.
  - _The Returning Flight_ (Quiver) recovers the last **Archery** card with a **Mana** discount.
  - **Verdict:** DO NOT IMPORT Trinket's Unique redesigns. All 5 are core to Alchemy's Forge and Archery identities and already feature keywords.

---

## Plan

- [x] **Predator's Focus Update:**
  - Update `src/lib/game-data/cards/library/core.ts` to grant Leech alongside critical strike on the next damaging hit.
  - Update combat handlers in `src/lib/battle/damage-calc.ts` or effect registry to resolve Leech when consuming `nextHitCrit` (or pair with `nextHitLeech`).
  - Update `descriptionLines` and card parity validation.
- [x] **Maul Description Clarification:**
  - Update `src/lib/game-data/cards/library/core.ts` description to _"Deal 3 Stun or Bleed damage at random"_.
  - Update card parity helpers if needed.
- [x] **Talent Description Cohesion:**
  - Update `src/lib/game-data/talents/talent-pool-definitions.ts` for `Restock`, `Distillation`, and `Brewmaster` to explicitly include **Gold** and **Consume**.
- [x] **Enemy Trait Clarifications:**
  - Update `src/lib/game-data/compendium/enemies.ts` for Bandit (_Ambush_) and Banshee (_Dread Wail_).
- [x] **Verification:**
  - Run `npm test -- tests/lib/content-validation/` to ensure card parity and content rules pass.
  - Run `npm test -- tests/architecture/` for affix and catalog guards.
  - Run `npm test -- tests/lib/battle/` for battle engine regression coverage.
  - Run `npm run content:audit` to verify keyword coverage.

---

## Design Decisions & Resolution

1. **Predator's Focus Mechanic (Resolved - Option A):**
   - Grant **Leech** on the next critical hit (_"Your next damaging card is a critical strike and has Leech"_). Directly mirrors Trinket's thematic hunter direction, grants a recognized keyword, and fits the predator theme.
2. **Bandit Ambush (Resolved - Option A):**
   - Keep existing first-attack damage doubling logic and clarify the text to `"Deals double Physical damage on its first attack"`. Preserves current encounter balance sweeps while incorporating the **Physical** keyword.
3. **Cleanse Card & Keyword Matcher (Resolved - Option A):**
   - Keep `Cleanse` text as-is (_"Cleanse 1 harmful status effect"_). It is enforced by `card-parity` rules and is intuitive as an action verb.

---

## Notes

Implemented 2026-09-15: Predator's Focus grants Leech via a new paired `next-hit-leech` effect (`nextHitLeech` flag, consumed in `damage.ts` by injecting `lifesteal` into the next damage packet; dodge preserves it, companions and delayed pulses cannot consume it). Maul's shared-damage corruption helper in `src/lib/corruption/numeric.ts` now accepts the " at random" suffix so upgrades still touch both alternatives. Regression tests added for arming, healing/consumption, dodge preservation, companion preservation, and status chips.

Keep durable rules in their canonical owner. For test selection and task-owned handoff, follow [CONTRIBUTING](../../../CONTRIBUTING.md#what-to-run-when-you-change) and [the plan lifecycle](../README.md#task-handoff).
