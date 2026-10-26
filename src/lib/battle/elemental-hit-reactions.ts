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
import { applyHolyBlockChance, applyHolyLifesteal, applyHolyTithe, applyLeechHitHealing } from "./damage-rider-leech";
import { applyBrassCenser, applyTalentHitConversions, resolveFollowUpHit } from "./follow-up-hit-resolution";
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
  const rewardState = nextState;
  const { healthDamage, eligibility } = facts;
  if (rollBattleChance(rewardState.talentEffects.armorOnNatureDamageChance, rewardState))
    nextState = applyArmorReward(nextState, modifiedDamage, combatTexts);
  if (rollBattleChance(rewardState.talentEffects.thornsOnNatureDamageChance, rewardState))
    nextState = addPlayerStatusWithCombatText(nextState, "thorns", modifiedDamage, combatTexts);
  if (rollBattleChance(rewardState.talentEffects.healOnNatureDamageChance, rewardState))
    nextState = applyHealingWithCombatText(nextState, modifiedDamage, combatTexts);
  const guaranteed =
    !alreadyLeeches && rewardState.gearEffects.natureLeechVsPoisoned > 0 && eligibility.enemyStatuses.poison > 0;
  const chance = rewardState.talentEffects.natureLeechChance + rewardState.gearEffects.natureLeechChance;
  if (guaranteed || (chance > 0 && rollBattleChance(chance, nextState)))
    nextState = applyLeechHitHealing(nextState, guaranteed ? healthDamage : modifiedDamage, combatTexts);
  nextState = applyTalentHitConversions(nextState, "nature", modifiedDamage, combatTexts);
  if (nextState.enemyHealth > 0 && rollBattleChance(state.talentEffects.natureStunChance, nextState)) {
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
  forgeTriggers?: Set<string>,
  alreadyLeeches = false,
) {
  const { resolvedDamage: damage, eligibility } = facts;
  if (damage <= 0) return state;
  let nextState = alreadyLeeches ? state : applyHolyLifesteal(state, damage, combatTexts, eligibility);
  if (state.gearEffects.oathkeeperHolyAndBlock > 0 && !forgeTriggers?.has("oathkeeper")) {
    forgeTriggers?.add("oathkeeper");
    nextState = applyBlockReward(nextState, 1, combatTexts);
  }
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
  nextState = applyHolyTithe(nextState, facts.healthDamage, combatTexts);

  nextState = applyTalentHitConversions(nextState, "holy", damage, combatTexts);

  if (rollBattleChance(nextState.talentEffects.holyWishChance, nextState)) {
    nextState = applyWishEffect(nextState, card, 1, combatTexts, { kind: "enclosing-action" });
  }

  return applyBrassCenser(nextState, damage, combatTexts);
}
