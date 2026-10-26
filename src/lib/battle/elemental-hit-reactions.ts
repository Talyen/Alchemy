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
import {
  applyHolyBlockChance,
  applyHolyLifesteal,
  applyHolyTithe,
  applyLeechHitHealing,
} from "./stun-leech-resolution";
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
  nextState = resolveNatureRestorationRewards(nextState, facts, combatTexts, alreadyLeeches);
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

function resolveNatureRestorationRewards(
  state: BattleState,
  facts: Pick<HitFacts, "resolvedDamage" | "healthDamage" | "eligibility">,
  texts: CombatTextEvent[],
  alreadyLeeches = false,
): BattleState {
  const { resolvedDamage: damage, healthDamage, eligibility } = facts;
  if (damage <= 0) return state;
  let next = state;
  if (rollBattleChance(state.talentEffects.armorOnNatureDamageChance, state))
    next = applyArmorReward(next, damage, texts);
  if (rollBattleChance(state.talentEffects.thornsOnNatureDamageChance, state))
    next = addPlayerStatusWithCombatText(next, "thorns", damage, texts);
  if (rollBattleChance(state.talentEffects.healOnNatureDamageChance, state))
    next = applyHealingWithCombatText(next, damage, texts);
  const guaranteed =
    !alreadyLeeches && state.gearEffects.natureLeechVsPoisoned > 0 && eligibility.enemyStatuses.poison > 0;
  const chance = state.talentEffects.natureLeechChance + state.gearEffects.natureLeechChance;
  if (guaranteed || (chance > 0 && rollBattleChance(chance, next)))
    next = applyLeechHitHealing(next, guaranteed ? healthDamage : damage, texts);
  return next;
}
