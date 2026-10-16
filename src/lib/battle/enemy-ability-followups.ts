import { resolveSecondaryAction } from "./action-context";
import { BRAWLER_PENALTY_MULTIPLIER, ENEMY_ABILITY_TRAIT_REWARD, VAMPIRE_BLOOD_SCENT_DAMAGE } from "../game-constants";
import { recordEnemyAbilityActivation } from "./battle-metrics";
import { recordEnemyAbilityHit, type EnemyAbilityContext } from "./enemy-ability-context";
import { applyArmorReward, applyHealingWithCombatText } from "./player-rewards";
import { resolveEnemyAttackHit } from "./enemy-attack-hit";
import { resolvePendingBattleReactions } from "./enemy-attack-damage";
import { resolveFollowUpHit } from "./follow-up-hit-resolution";
import { applyPlayerStatusFromAttack } from "./status-player";
import { purgeOnePlayerBenefit } from "./player-purge";
import type { BattleState, CombatTextEvent } from "./types";
import { hasEnemyTrait } from "./encounter-trait-state";
import { getBattleOutcome } from "./battle-outcome";
import { setEnemyStatus, setPlayerStatus } from "./status-state";

export function applyAbilityFollowups(
  state: BattleState,
  context: EnemyAbilityContext,
  combatTexts: CombatTextEvent[],
): BattleState {
  let nextState = state;
  if (context.vampireBonus) {
    nextState = recordEnemyAbilityActivation(nextState, "vampire");
    const result = resolveEnemyAttackHit(
      nextState,
      { kind: "damage", damageType: "bleed", amount: VAMPIRE_BLOOD_SCENT_DAMAGE },
      combatTexts,
      {
        canDodge: true,
        skipTraitReactions: true,
        traitSet: context.traitSet,
        amountMultiplier: context.brawlerPenalty ? BRAWLER_PENALTY_MULTIPLIER : 1,
      },
    );
    nextState = result.state;
    recordEnemyAbilityHit(context, result);
  }
  for (const [traitId, status] of [
    ["fire-imp", "burn"],
    ["giant-spider", "poison"],
  ] as const) {
    if (getBattleOutcome(nextState) !== null) return nextState;
    if (context.healthDamage > 0 && hasEnemyTrait(nextState, traitId, context.traitSet)) {
      nextState = applyPlayerStatusFromAttack(
        recordEnemyAbilityActivation(nextState, traitId),
        {
          kind: "player-status",
          status,
          amount: ENEMY_ABILITY_TRAIT_REWARD,
        },
        combatTexts,
      );
    }
  }
  if (getBattleOutcome(nextState) !== null) return nextState;
  if (context.healthDamage > 0 && hasEnemyTrait(nextState, "winter-wolf", context.traitSet)) {
    nextState = resolveEnemyAttackHit(
      recordEnemyAbilityActivation(nextState, "winter-wolf"),
      {
        kind: "damage",
        damageType: "freeze",
        amount: ENEMY_ABILITY_TRAIT_REWARD,
      },
      combatTexts,
      { canDodge: false, traitSet: context.traitSet },
    ).state;
  }
  if (getBattleOutcome(nextState) !== null) return nextState;
  if (context.landed && hasEnemyTrait(nextState, "banshee", context.traitSet)) {
    const purged = purgeOnePlayerBenefit(nextState, combatTexts);
    if (purged.purged) nextState = recordEnemyAbilityActivation(purged.state, "banshee");
  }
  if (nextState.enemyStatuses.onAttackBleed > 0) {
    const amount = nextState.enemyStatuses.onAttackBleed;
    nextState = resolveFollowUpHit(
      setEnemyStatus(nextState, "onAttackBleed", 0),
      { source: "player-follow-up", damageType: "bleed", amount },
      combatTexts,
    );
  }
  if (getBattleOutcome(nextState) !== null) return nextState;
  // Purged Thorns stay purged: the retaliation check below sees zero stacks, so no Nature damage fires.
  if (context.landed && nextState.playerStatuses.thorns > 0) {
    const amount =
      nextState.playerStatuses.thorns +
      nextState.gearEffects.flatThornsDamage +
      (nextState.playerStatuses.block > 0 ? nextState.gearEffects.thornsDamageWhileBlocked : 0);
    let thornsHealthDamage = 0;
    nextState = resolveSecondaryAction(setPlayerStatus(nextState, "thorns", 0), "retaliation", (current) =>
      resolveFollowUpHit(
        current,
        {
          source: "player-follow-up",
          damageType: "nature",
          amount,
          onDamageDealt: (damage) => {
            thornsHealthDamage = damage;
          },
        },
        combatTexts,
      ),
    );
    nextState = resolvePendingBattleReactions(nextState, combatTexts);
    if (getBattleOutcome(nextState) === "defeat") return nextState;
    if (thornsHealthDamage > 0 && nextState.gearEffects.armorOnThornsDamage > 0) {
      nextState = applyArmorReward(nextState, nextState.gearEffects.armorOnThornsDamage, combatTexts);
    }
    if (
      thornsHealthDamage > 0 &&
      nextState.gearEffects.healOnFirstThornsDamageEachTurn > 0 &&
      !nextState.flags.spitefulHealedThisTurn
    ) {
      nextState = applyHealingWithCombatText(
        nextState,
        nextState.gearEffects.healOnFirstThornsDamageEachTurn,
        combatTexts,
      );
      nextState = { ...nextState, flags: { ...nextState.flags, spitefulHealedThisTurn: true } };
    }
    if (thornsHealthDamage > 0 && nextState.gearEffects.poisonOnThornsDamage > 0) {
      nextState = resolveFollowUpHit(
        nextState,
        { source: "player-follow-up", damageType: "poison", amount: nextState.gearEffects.poisonOnThornsDamage },
        combatTexts,
      );
    }
  }
  return nextState;
}
