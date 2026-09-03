---
status: complete
updated: 2026-08-24
implementation: f07bbb72
---

# Boss traits and HP scaling

## Objective

Replace Alchemy’s four innate boss trait kits with the exact Trinket trait descriptions and corresponding combat behavior, while changing enemy-type HP multipliers to Normal 1.0×, Elite 1.5×, and Boss 2.0×. The result should preserve the one-enemy battle model, deterministic RNG, mid-combat resume safety, content validation, and balance-report accuracy.

## Baseline and constraints

- Boss content is authored in `src/lib/game-data/compendium/enemies.ts`; the existing hover tooltip already renders trait descriptions verbatim (split on newlines).
- Alchemy is one-on-one. Trinket’s “all enemies” wording therefore maps to the current player target at runtime; the requested Trinket wording remains unchanged in the UI.
- Recurring encounter damage already has a shared path in `src/lib/battle/encounter-trait-events.ts`, including player mitigation, typed-status riders, crowd-control thresholds, Death’s Door, combat text, and room-depth scaling. Reuse that pipeline rather than adding a second damage resolver.
- Battle RNG must come from `state.rng`; no `Math.random()` or render-time randomness.
- Existing persisted battle snapshots include `currentEnemy.traits`, `enemyRegeneration`, accumulated enemy mitigation/status fields, and pending transition result states. Trait IDs and meanings are changing, so this is a content remap, not just a description edit.
- Existing `docs/REFERENCE.md` describes enemy attack effects as static/no-random-intent. The new randomized boss auras require that rule to be clarified without changing the static authored attack-effect contract.

## Target boss content

Each boss will have exactly one new, stable boss-specific trait ID and the following exact visible text:

| Boss              | Trait title       | Description                                                                                    | Runtime behavior                                                                                                                  |
| ----------------- | ----------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| The Forge Golem   | The Forge Golem   | `Deals 1 Stun or Burn damage each turn to all enemies.`                                        | Once per enemy action, roll Stun or Burn and deal one base typed hit to the player.                                               |
| The Frostwarden   | The Frostwarden   | `Deals 1 Freeze damage every other turn to all enemies. Burn damage taken increased by 30%.`   | On even enemy turns (2, 4, …), deal one base Freeze hit; incoming Burn damage to this boss is multiplied by 1.3.                  |
| The Blight Treant | The Blight Treant | `Holy damage taken increased by 30%. Deals 1 Poison or Bleed damage each turn to all enemies.` | Incoming Holy damage is multiplied by 1.3; once per enemy action, roll Poison or Bleed and deal one base typed hit to the player. |
| The Iron Bear     | The Iron Bear     | `Deals 1 Physical or Stun damage each turn to all enemies.`                                    | Once per enemy action, roll Physical or Stun and deal one base typed hit to the player.                                           |

The authored amount remains `1`; recurring action damage follows Alchemy’s existing `scaleByRoomMultiplier` convention, so the description communicates the base amount while deeper rooms scale the resolved value consistently with other encounter traits. This convention should be called out in tests and documentation rather than silently introducing an exception.

## Implementation sequence

1. **Author the replacement content.**
   - Replace each boss’s current trait array with the single boss-specific trait object and exact Trinket title/description above.
   - Remove Forge Golem’s `starting-block`, Blight Treant’s regeneration trait, and all old boss-only trait IDs from the live boss catalog.
   - Keep non-boss uses of shared traits unchanged (for example, Burn Vulnerability on Frost Elemental and Regeneration on Mud Elemental).
   - Add the new IDs to the enemy trait identity/validation tables so every boss trait is recognized and no retired ID is silently accepted.

2. **Move boss aura actions into the shared action-phase dispatcher.**
   - Extend the encounter action-damage dispatcher with the four boss IDs.
   - Use the existing typed-hit helper so block/armor, damage resistance, status riders, CC triggers, gear interactions, combat text, and Death’s Door behave exactly like other incoming typed damage.
   - Use one deterministic `state.rng()` roll per random aura; test both branches for Forge, Blight, and Iron Bear.
   - Gate Frostwarden’s aura with `isEveryOtherTurnScalingTurn` so it fires on turns 2, 4, … and not on odd turns.
   - Preserve the current rule that recurring action traits do not fire when the enemy action is skipped by Stun/Freeze; add explicit tests for the new boss auras.
   - Register action-phase boss IDs separately from truly passive traits (or otherwise extend the coverage registry) so startup validation does not misclassify them as missing handlers.

3. **Implement vulnerability math without changing unrelated enemies.**
   - Add a 1.3× damage multiplier constant in the enemy-trait constants file.
   - Add rules for the new Frostwarden Burn vulnerability and Blight Treant Holy vulnerability.
   - Remove the retired Glacial Shell damage rules; keep the existing 1.5× shared Burn Vulnerability and 2× Holy Vulnerability rules for enemies that still use them.
   - Cover rounding and typed damage in focused damage/status tests.

4. **Retire obsolete boss mechanics cleanly.**
   - Remove old Rusting Carapace/Iron Hide/Glacial Shell turn-start handlers and their boss-only tuning constants once no live content or tests reference them.
   - Remove the boss-specific starting-block and regeneration consequences from setup by virtue of the new trait arrays; keep generic starting-block/regeneration support for any remaining content or difficulty paths.
   - Update comments and state documentation that currently describe boss Forge/Armor/Burn/Freeze bonus accumulation.
   - Keep generic `burnBonus`/`freezeBonus` state fields only if other systems still depend on them; remove only dead writers/constants, not unrelated state contracts.

5. **Change HP scaling.**
   - Set `ELITE_HP_MULTIPLIER` to `1.5` and `BOSS_HEALTH_MULTIPLIER` to `2.0`.
   - Leave `BASE_ENEMY_HEALTH` at 30, Normal’s implicit multiplier at 1.0, room scaling at +7% per additional room, and difficulty HP multipliers (Novice 1.0×, Adventurer 1.3×, Legend 2.8×) unchanged.
   - Do not change `HOMESTEAD_LOOT_CONFIG.enemyTypeMultipliers`; its Boss 3× value is loot scaling, not combat HP.
   - Preserve the existing calculation order: base HP × room multiplier × enemy-type multiplier, then difficulty HP multiplier, with final rounding.

6. **Make mid-combat saves content-safe.**
   - Bump `CURRENT_CONTENT_VERSION` from 2 to 3 and add a chained `migrateContentV2ToV3` step.
   - For `activeRun` and every parked run, remap boss traits inside `activeCombat.battleState.currentEnemy` and any `pendingBattleTransition.resultState` using the live boss definitions, keyed by enemy ID.
   - Preserve current in-progress `enemyHealth`, `enemyMaxHealth`, scaled attack effects, and unrelated status/mitigation values so an update does not jump a fight’s HP bar mid-battle. Reset only directly derived obsolete Blight regeneration if present; do not erase unrelated difficulty/encounter buffs that share a state field.
   - Add migration fixtures covering active and parked runs, a pending enemy-turn result, and idempotence. New battles use the new HP multipliers; already-running battles finish with their persisted HP snapshot.

7. **Refresh balance and documentation surfaces.**
   - Update `src/lib/balance/findings.ts` and `src/lib/balance/report-run.ts` cause hints/methodology so reports no longer describe Iron Hide, Rusting Carapace, Glacial Shell, or Blight regeneration.
   - Clarify `docs/REFERENCE.md` that authored enemy attacks remain static while boss trait auras may make deterministic per-turn type rolls; document the one-on-one interpretation of Trinket’s “all enemies” wording and the HP multiplier table.
   - Leave the tooltip component unchanged unless visual verification finds a formatting issue; the new descriptions should flow through the existing keyword coloring and boss-shine keyword extraction.

## Coverage and verification

- **Content:** exact boss count, one trait per boss, exact title/description strings, no retired boss IDs, and description/effect parity.
- **Trait actions:** Forge/Blight/Iron random branches; Frost even-turn cadence; base amount and room scaling; skipped enemy action; block/armor mitigation; typed status buildup; Death’s Door; deterministic RNG.
- **Vulnerabilities:** 1.3× Burn for Frostwarden and 1.3× Holy for Blight Treant; existing shared vulnerabilities remain unchanged.
- **Setup/scaling:** Normal/Elite/Boss type multipliers (1.0/1.5/2.0), room scaling, difficulty stacking, and rounding in both `initializeEnemyState` and `createBattleState` paths.
- **Persistence:** content-version migration for active/parked/pending battle snapshots and idempotent normalization.
- **Balance/docs:** updated cause hints, report methodology, and reference rules.

Implementation was completed in `f07bbb72`. Current plan lifecycle and
verification commands are owned by [the plans guide](../README.md); this
archived record is not an operational checklist.

## Acceptance criteria

- Every boss displays exactly the Trinket wording above in the existing UI.
- Every aura resolves through the normal Alchemy incoming-damage pipeline and is deterministic/reproducible from battle RNG.
- HP multipliers are exactly Normal 1.0×, Elite 1.5×, Boss 2.0×, with room/difficulty behavior unchanged otherwise.
- Existing non-boss traits, loot multipliers, and supported mid-combat progress remain intact.
- No content-validation, typecheck, lint, focused test, migration, or routed verification failures remain.
