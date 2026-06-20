# Final Implementation Plan: Talent Shortlist (21 talents) + Tab Support

## Confirmed scope (locked in via user clarifications)

- 21 talents across 4 keyword pools
- 4 keywords get functional talent tree tabs
- Hail of Arrows simplified to "50% second hit"
- Tame simplified to "+1 companion damage of native type"
- Verdant Cycle reuses existing `natureLeechChance` field
- Longshot uses "above 75% Health" threshold
- Consume icon swapped to `Beaker`
- 14 new manifest fields (down from 16)
- 5 talents reuse existing fields

## Final talent list (21 total)

### Nature pool — currently 0 implemented, will be 6 implemented + 4 placeholders = 10 total

| # | Name | Description | Field | Reuse? |
|---|------|-------------|-------|--------|
| 1 | **Overgrowth** | "Increase Nature damage dealt by 1" | `addEffect("flatNatureDamage", 1)` | YES |
| 2 | **Toxic Pollen** | "Nature damage has a 10% chance to Poison" | `naturePoisonChance = 10` | NO |
| 3 | **Briar Patch** | "Nature damage has a 10% chance to Bleed" | `natureBleedChance = 10` | NO |
| 4 | **Verdant Cycle** | "Nature damage has a 10% chance to Leech" | `setEffect("natureLeechChance", 10)` | YES (reuses field from leech pool) |
| 5 | **Ecosystem** | "Deal +1 Nature damage against Poisoned enemies" | `natureBonusVsPoisoned = 1` | NO |
| 6 | **Natural Armor** | "Nature damage taken is reduced by half" | `receiveHalfNatureDamage = true` | NO |
| 7-10 | Placeholders | "Placeholder talent (NYI)" | (none) | — |

### Consume pool — currently 0 implemented, will be 5 implemented + 5 placeholders = 10 total

| # | Name | Description | Field | Reuse? |
|---|------|-------------|-------|--------|
| 1 | **Gourmand** | "Consume cards heal 20% more" | `consumeHealMultiplier = 0.2` | YES |
| 2 | **Last Supper** | "Your first Consume card each combat is free" | `firstConsumeCardFree = true` | NO |
| 3 | **Volatility** | "Consume cards deal 20% more damage" | `consumeDamageBonusPercent = 20` | NO |
| 4 | **Distillation** | "Potions are 20% more potent" | `addEffect("potionPotency", 0.2)` | YES |
| 5 | **Brewmaster** | "Mixed Potion potency is increased by 1" | `addEffect("potionMixPotency", 1)` | YES |
| 6-10 | Placeholders | "Placeholder talent (NYI)" | (none) | — |

### Archery pool — currently 1 implemented (Tripwire), will be 5 implemented + 5 placeholders = 10 total

| # | Name | Description | Field | Reuse? |
|---|------|-------------|-------|--------|
| 1 | **Tripwire** | "Increase damage dealt by Archery cards by 1" | `addEffect("flatArrowDamage", 1)` | YES (already exists) |
| 2 | **Quiver Mastery** | (alternate name) — same as Tripwire, swap name to avoid two "+1 archery" talents | (reuse Tripwire) | YES (re-skin) |
| 3 | **Hail of Arrows** | "Archery cards have a 10% chance to deal 50% of their damage a second time" | `archeryPlayTwiceChance = 10` | NO |
| 4 | **Eagle Eye** | "Archery cards deal double damage against Stunned enemies" | `archeryDoubledVsStunned = true` | NO |
| 5 | **Hawk Eye** | "Archery cards deal double damage against Frozen enemies" | `archeryDoubledVsFrozen = true` | NO |
| 6 | **Longshot** | "Archery cards deal double damage against enemies above 75% Health" | `archeryDoubledVsHighHealth = true` | NO |
| 7-10 | Placeholders | "Placeholder talent (NYI)" | (none) | — |

> **Note on Tripwire/Quiver Mastery:** I had "Quiver Mastery" as a separate talent, but it's literally the same effect as the existing Tripwire. Either (a) keep Tripwire and skip Quiver Mastery, or (b) rename Tripwire to Quiver Mastery (with same effect), or (c) leave both as separate placeholder→real transitions. **Recommendation: keep Tripwire, drop the redundant "Quiver Mastery" entry.** This gives 4 new archery talents instead of 5, plus the existing Tripwire, for 5 total.

### Companion pool — currently 2 implemented (Feral Strength, Scavenger), will be 7 implemented + 3 placeholders = 10 total

| # | Name | Description | Field | Reuse? |
|---|------|-------------|-------|--------|
| 1 | **Feral Strength** | "Increase Companion damage by 1" | `addEffect("companionDamage", 1)` | YES (already exists) |
| 2 | **Scavenger** | "Companions sometimes find Gold after combat" | `companionGoldFindActive = true` | YES (already exists) |
| 3 | **Leech Companion** | "Companions have a 10% chance to Leech" | `companionLeechChance = 10` | NO |
| 4 | **Hunter's Bond** | "When you play a Companion card, draw a card" | `drawOnCompanionCard = 1` | NO |
| 5 | **Predator's Instinct** | "Companions deal double damage against enemies below 30% Health" | `companionDoubledVsLowHealth = true` | NO |
| 6 | **Tame** | "Companions deal 1 additional damage of their native type each turn" | `addEffect("companionDamage", 1)` | YES (reuses field) |
| 7 | **Loyal** | "If you have a Companion, you take 1 less damage" | `damageReductionWithCompanion = 1` | NO |
| 8-10 | Placeholders | "Placeholder talent (NYI)" | (none) | — |

> **Note on Tame:** This is effectively a +1 to `companionDamage`, which is what Feral Strength already does. Tame becomes a second `addEffect("companionDamage", 1)` talent. Functionally distinct only by name/theme. This is fine — many pools have multiple "+1 to X" talents (e.g., physical has both "Brute Force" and the forge-multiplier version). Two +1 companion damage talents lets the player stack them.

## Field ownership summary

### New fields (14 total, all pool-owned per user rule)

| Field | Owner pool | Used by |
|-------|-----------|---------|
| `naturePoisonChance: number` | nature | Toxic Pollen |
| `natureBleedChance: number` | nature | Briar Patch |
| `natureBonusVsPoisoned: number` | nature | Ecosystem |
| `receiveHalfNatureDamage: boolean` | nature | Natural Armor |
| `firstConsumeCardFree: boolean` | consume | Last Supper |
| `consumeDamageBonusPercent: number` | consume | Volatility |
| `archeryPlayTwiceChance: number` | archery | Hail of Arrows |
| `archeryDoubledVsStunned: boolean` | archery | Eagle Eye |
| `archeryDoubledVsFrozen: boolean` | archery | Hawk Eye |
| `archeryDoubledVsHighHealth: boolean` | archery | Longshot |
| `companionLeechChance: number` | companion | Leech Companion |
| `drawOnCompanionCard: number` | companion | Hunter's Bond |
| `companionDoubledVsLowHealth: boolean` | companion | Predator's Instinct |
| `damageReductionWithCompanion: number` | companion | Loyal |

### Reused fields (5 total)

| Field | Already set by | New talent re-setting it |
|-------|---------------|--------------------------|
| `flatNatureDamage` | (none yet) | Overgrowth |
| `natureLeechChance` | "Carnivorous Nature" (leech pool) | Verdant Cycle |
| `consumeHealMultiplier` | homestead effects | Gourmand |
| `potionPotency` | homestead effects, potions | Distillation |
| `potionMixPotency` | (none yet) | Brewmaster |
| `flatArrowDamage` | Tripwire (archery), Hunter's Lodge (homestead) | (none new) |
| `companionDamage` | Feral Strength (companion) | Tame |

### New CombatFlags (1)

| Flag | Used by |
|------|---------|
| `firstConsumeCardFreeUsed: boolean` | Last Supper |

## Implementation phases (final, in order)

### Phase 1: Manifest layer
1. `src/lib/game-data/talent-effect-manifest.ts` — add 14 new fields with comments
2. `src/lib/game-data/talents/manifest-defaults.ts` — add defaults (0/false) for 14 new fields
3. `src/lib/homestead/defaults.ts` — add fields to merged defaults (so the merge doesn't fail)
4. `src/lib/homestead/types.ts` — add fields to `HomesteadEffectManifest` interface
5. `src/lib/battle/types.ts` — add `firstConsumeCardFreeUsed` to `CombatFlags`
6. `src/lib/battle/initial-state.ts` (or wherever flags initialize) — `firstConsumeCardFreeUsed: false`

### Phase 2: Battle engine wiring
7. `src/lib/battle/damage-calc.ts`:
   - Extend `applyNatureDamageModifiers` to add `natureBonusVsPoisoned` if enemy is poisoned
   - In `computeCardDamageToEnemy` or new helper: add archery-tag multiplier block (Eagle Eye, Hawk Eye, Longshot)
   - Hail of Arrows proc: in damage-calc or apply-effects, when an archery-tag card deals damage, roll `archeryPlayTwiceChance`; if hit, deal 50% of the damage a second time
   - In the "apply damage to player" step: subtract `damageReductionWithCompanion` if `activeCompanion !== null`
8. `src/lib/battle/effect-handlers/damage-handlers.ts` (or `status-damage-riders.ts`):
   - After Nature damage applied: roll `naturePoisonChance` → apply 1 Poison; roll `natureBleedChance` → apply 1 Bleed; roll `natureLeechChance` (reused field) → heal player
9. `src/lib/battle/effect-handlers/apply-effects.ts` (or damage-calc):
   - When Nature damage is taken by the player: if `receiveHalfNatureDamage`, halve the incoming damage
10. `src/lib/battle/card-play.ts`:
    - `resolveCardPlayCost` (or `computeEffectiveCost`): add `firstConsumeCardFree` check
11. `src/lib/battle/damage-calc.ts` (consume damage bonus):
    - In `computeBaseRawAmount` (or a new consume check): if `card?.consume`, multiply damage by `(1 + consumeDamageBonusPercent / 100)`
12. `src/lib/battle/companion.ts`:
    - `processCompanionTurnStart`: after companion deals damage, roll `companionLeechChance` → if hit, heal player for half the damage
    - In same function: if `companionDoubledVsLowHealth` and `enemyHealth / enemyMaxHealth < 0.3`, double the damage
    - `Tame` is already covered by the `addEffect("companionDamage", 1)` in the manifest (no new wiring needed)
13. `src/lib/battle/effect-handlers/companion-handlers.ts` (or wherever `summon-companion` resolves):
    - After summon: if `drawOnCompanionCard > 0`, draw 1 card

### Phase 3: Pool files (talent definitions)
14. `src/lib/game-data/talents/pool/nature.ts` — replace 10 placeholders with 6 real + 4 placeholders
15. `src/lib/game-data/talents/pool/consume.ts` — replace 10 placeholders with 5 real + 5 placeholders
16. `src/lib/game-data/talents/pool/archery.ts` — keep Tripwire, add 4 new (Hail, Eagle, Hawk, Longshot) + 5 placeholders
17. `src/lib/game-data/talents/pool/companion.ts` — keep Feral Strength + Scavenger, add 5 new (Leech, Hunter's Bond, Predator's, Tame, Loyal) + 3 placeholders

### Phase 4: Tab support (new phase from user request)
18. `src/lib/game-data/keywords.ts:107-115` — remove `hidden: true` from `consume` keyword
19. `src/features/alchemy/shared/config/metadata.ts`:
    - Add `Beaker` to lucide-react imports
    - Change `keywordIcons["consume"]` from `CircleOff` to `Beaker`
20. `src/features/alchemy/meta/talents/talent-tree.tsx:25-36` — add layout configs for `archery` and `consume`:
    - `archery: { radiusX: 36, radiusY: 28, rotate: -20 }`
    - `consume: { radiusX: 32, radiusY: 32 }`

### Phase 5: Tests
21. New file `tests/lib/battle/talent-shortlist.test.ts` (or split per pool):
    - One describe block per talent
    - Verify field propagation: talent unlocks → manifest has the right value
    - Verify each handler triggers correctly (with stub RNG for proc chances)
22. `tests/lib/game-data/descriptions-match-effects.test.ts` — add entries for the 16 new talents
23. `tests/lib/game-data/talent-pool.test.ts` — verify each pool has exactly 10 talents (the count test at line 63-71 must still pass — this is automatic with the placeholder plan)
24. Update `tests/lib/game-data/talent-pool.test.ts:105-108` test: the assertion that "nature is excluded from talent tree" will now fail. Either:
    - Remove that assertion (nature now has implemented talents, so the assumption is wrong)
    - Or update it to assert that nature IS in the talent tree now

### Phase 6: Verification
25. `npm run typecheck`
26. `npm run lint`
27. `npm test -- tests/lib/battle tests/lib/homestead tests/lib/game-data/descriptions-match-effects tests/lib/game-data/talent-pool`
28. `npm run test:e2e:prepush`

## Files touched: ~24 total

- 6 manifest files (Phase 1)
- 6 battle-engine files (Phase 2)
- 4 pool files (Phase 3)
- 3 tab-support files (Phase 4)
- 3-4 test files (Phase 5)
- 1-2 readme/changelog updates (CHANGELOG entry for the talent additions)

## Risks and mitigations

1. **Existing test that asserts `getTalentTreeKeywordIds()` excludes `nature`** (`tests/lib/game-data/talent-pool.test.ts:107`) — will fail after Phase 3. Mitigation: update the test in Phase 5 to assert the opposite.

2. **Hail of Arrows "50% second hit" wording vs "play twice"** — the 50% version is simpler but loses the "play all effects twice" semantics. If you want the full effect later, the field is named `archeryPlayTwiceChance` and can be repurposed.

3. **Tame reuses `companionDamage`** — this means it's a second +1 to companion damage. If you want it to do something distinct later (e.g., extra damage type), the wiring is in `companion.ts` and the field can be split.

4. **`receiveHalfNatureDamage` follows `receiveHalfBurnDamage` / `receiveHalfPoisonDamage` / `receiveHalfBleedDamage`** — the implementation pattern is well-established and should slot in cleanly.

5. **Worktree state** — 14 modified files and 14 untracked gear files from earlier sessions. Implementation will stage only the talent-related files.

## What I will NOT do

- Won't add background art files for archery or consume (per your instruction)
- Won't change the leech pool (Verdant Cycle reuses the existing field)
- Won't touch the homestead rename or the unrelated gear work
- Won't commit (per the AGENTS.md hard NO rule)

## What I'll need from you to proceed

A non-plan-mode command (or you can tell me to proceed and I'll defer to whatever mode switch you have configured). I will execute Phases 1-6 in order, run typecheck and tests between phases, and report back at the end.
