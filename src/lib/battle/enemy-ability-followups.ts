import { resolveSecondaryAction } from "./action-context";
import { BRAWLER_PENALTY_MULTIPLIER, ENEMY_ABILITY_TRAIT_REWARD, VAMPIRE_BLOOD_SCENT_DAMAGE } from "../game-constants";
import { recordEnemyAbilityActivation } from "./battle-metrics";
import { type EnemyAbilityContext } from "./enemy-ability-damage";
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
import { emitStatusText } from "./combat-text-events";
import { addEnemyMitigation } from "./enemy-mitigation-state";

const NATIVE_STATUS_TRAITS = [
  ["fire-imp", "burn"],
  ["giant-spider", "poison"],
] as const;

export function applyNativeHitFollowups(
  state: BattleState,
  context: EnemyAbilityContext,
  landed: boolean,
  combatTexts: CombatTextEvent[],
): BattleState {
  let nextState = state;
  if (!landed) return nextState;
  if (context.vampireBonus) {
    nextState = recordEnemyAbilityActivation(nextState, "vampire");
    const result = resolveEnemyAttackHit(
      nextState,
      { kind: "damage", damageType: "bleed", amount: VAMPIRE_BLOOD_SCENT_DAMAGE },
      combatTexts,
      {
        canDodge: false,
        skipTraitReactions: true,
        amountMultiplier: context.brawlerPenalty ? BRAWLER_PENALTY_MULTIPLIER : 1,
      },
    );
    nextState = result.state;
  }
  for (const [traitId, status] of NATIVE_STATUS_TRAITS) {
    if (getBattleOutcome(nextState) !== null) return nextState;
    if (hasEnemyTrait(nextState, traitId)) {
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
  if (hasEnemyTrait(nextState, "winter-wolf")) {
    nextState = resolveEnemyAttackHit(
      recordEnemyAbilityActivation(nextState, "winter-wolf"),
      {
        kind: "damage",
        damageType: "freeze",
        amount: ENEMY_ABILITY_TRAIT_REWARD,
      },
      combatTexts,
      { canDodge: false },
    ).state;
  }
  if (getBattleOutcome(nextState) !== null) return nextState;
  if (hasEnemyTrait(nextState, "banshee")) {
    const purged = purgeOnePlayerBenefit(nextState, combatTexts);
    if (purged.purged)
      nextState = resolvePendingBattleReactions(recordEnemyAbilityActivation(purged.state, "banshee"), combatTexts);
  }
  if (getBattleOutcome(nextState) !== null) return nextState;
  if (context.soulHarvest === "purge") {
    const purged = purgeOnePlayerBenefit(nextState, combatTexts);
    if (purged.purged)
      nextState = resolvePendingBattleReactions(
        recordEnemyAbilityActivation(purged.state, "soul-harvest"),
        combatTexts,
      );
  }
  if (getBattleOutcome(nextState) !== null) return nextState;
  if (hasEnemyTrait(nextState, "snap-shut")) {
    nextState = recordEnemyAbilityActivation(nextState, "snap-shut");
    emitStatusText(combatTexts, "enemy", "block", 1);
    nextState = addEnemyMitigation(nextState, "block", 1);
  }
  if (getBattleOutcome(nextState) !== null) return nextState;
  return nextState;
}

export function applyAbilityFollowups(
  state: BattleState,
  context: EnemyAbilityContext,
  combatTexts: CombatTextEvent[],
): BattleState {
  let nextState = state;
  if (nextState.enemyStatuses.onAttackBleed > 0) {
    const amount = nextState.enemyStatuses.onAttackBleed;
    nextState = resolvePendingBattleReactions(
      resolveFollowUpHit(
        setEnemyStatus(nextState, "onAttackBleed", 0),
        { source: "player-follow-up", damageType: "bleed", amount },
        combatTexts,
      ),
      combatTexts,
    );
  }
  if (getBattleOutcome(nextState) !== null) return nextState;
  return applyThornsRetaliation(nextState, context, combatTexts);
}

function applyThornsRetaliation(
  state: BattleState,
  context: EnemyAbilityContext,
  combatTexts: CombatTextEvent[],
): BattleState {
  // Purged Thorns stay purged: the retaliation check below sees zero stacks, so no Nature damage fires.
  if (!context.landed || state.playerStatuses.thorns <= 0) return state;
  let nextState = state;
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
  if (getBattleOutcome(nextState) === "defeat" || thornsHealthDamage <= 0) return nextState;
  if (nextState.gearEffects.armorOnThornsDamage > 0) {
    nextState = applyArmorReward(nextState, nextState.gearEffects.armorOnThornsDamage, combatTexts);
  }
  if (nextState.gearEffects.healOnFirstThornsDamageEachTurn > 0 && !nextState.flags.spitefulHealedThisTurn) {
    nextState = applyHealingWithCombatText(
      nextState,
      nextState.gearEffects.healOnFirstThornsDamageEachTurn,
      combatTexts,
    );
    nextState = { ...nextState, flags: { ...nextState.flags, spitefulHealedThisTurn: true } };
  }
  if (nextState.gearEffects.poisonOnThornsDamage > 0) {
    nextState = resolveFollowUpHit(
      nextState,
      { source: "player-follow-up", damageType: "poison", amount: nextState.gearEffects.poisonOnThornsDamage },
      combatTexts,
    );
  }
  return nextState;
}
