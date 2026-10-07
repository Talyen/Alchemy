import { rollBattleChance } from "./chance-roll";
import type { BattleCard } from "@/lib/game-data";
import type { HitFacts } from "./player-hit-core";
import {
  addPlayerStatusWithCombatText,
  applyHealingWithCombatText,
  applyBlockReward,
  applyArmorReward,
} from "./player-rewards";
import { applyLuckyCloverGold, applyNatureGoldReward, applyNatureManaRefund } from "./bonus-effects";
import { applyDamageBlock, applyHolyBlockChance, applyHolyLifesteal, applyHolyTithe } from "./damage-rider-leech";
import {
  applyBrassCenser,
  applyNatureLeech,
  applyTalentHitConversions,
  resolveFollowUpHit,
} from "./follow-up-hit-resolution";
import type { BattleState, CombatTextEvent } from "./types";
import { applyWishEffect } from "./wish";

export function applyNatureDamageRiders(
  state: BattleState,
  facts: HitFacts,
  combatTexts: CombatTextEvent[],
  alreadyLeeches = false,
): BattleState {
  const { resolvedDamage: modifiedDamage } = facts;
  if (modifiedDamage <= 0) return state;
  let nextState = applyLuckyCloverGold(state, facts.healthDamage, combatTexts);
  nextState = applyNatureGoldReward(nextState, facts.healthDamage, combatTexts);
  nextState = applyNatureManaRefund(nextState, modifiedDamage, combatTexts);
  if (rollBattleChance(state.talentEffects.armorOnNatureDamageChance, state)) {
    nextState = applyArmorReward(nextState, modifiedDamage, combatTexts);
  }
  if (rollBattleChance(state.talentEffects.thornsOnNatureDamageChance, state)) {
    nextState = addPlayerStatusWithCombatText(nextState, "thorns", modifiedDamage, combatTexts);
  }
  if (rollBattleChance(state.talentEffects.healOnNatureDamageChance, state)) {
    nextState = applyHealingWithCombatText(nextState, modifiedDamage, combatTexts);
  }
  const guaranteedLeech =
    !alreadyLeeches && state.gearEffects.natureLeechVsPoisoned > 0 && facts.eligibility.enemyStatuses.poison > 0;
  if (guaranteedLeech || state.talentEffects.natureLeechChance > 0 || state.gearEffects.natureLeechChance > 0) {
    nextState = applyNatureLeech(
      nextState,
      guaranteedLeech ? facts.healthDamage : modifiedDamage,
      combatTexts,
      guaranteedLeech,
    );
  }
  nextState = applyTalentHitConversions(nextState, "nature", modifiedDamage, combatTexts);
  if (rollBattleChance(state.talentEffects.natureStunChance, state)) {
    nextState = resolveFollowUpHit(
      nextState,
      { source: "talent-derived", damageType: "stun", amount: modifiedDamage },
      combatTexts,
    );
  }
  return nextState;
}

export function applyHolyDamageRiders(
  state: BattleState,
  card: BattleCard | undefined,
  facts: HitFacts,
  combatTexts: CombatTextEvent[],
  heroAttack = true,
) {
  const { resolvedDamage: damage, eligibility } = facts;
  if (damage <= 0) return state;
  let nextState = applyHolyLifesteal(state, damage, combatTexts, eligibility);
  if (
    heroAttack &&
    card &&
    facts.healthDamage > 0 &&
    eligibility.playerStatuses.block === 0 &&
    state.gearEffects.blockOnHolyHitWithoutBlock > 0
  ) {
    nextState = applyBlockReward(nextState, state.gearEffects.blockOnHolyHitWithoutBlock, combatTexts);
  }
  nextState = applyHolyBlockChance(nextState, facts.healthDamage, combatTexts);
  nextState = applyDamageBlock(nextState, damage, combatTexts, eligibility);
  nextState = applyHolyTithe(nextState, facts.healthDamage, combatTexts);

  nextState = applyTalentHitConversions(nextState, "holy", damage, combatTexts);

  if (rollBattleChance(nextState.talentEffects.holyWishChance, nextState)) {
    nextState = applyWishEffect(nextState, card, 1, combatTexts, { kind: "enclosing-action" });
  }

  return applyBrassCenser(nextState, damage, combatTexts);
}
