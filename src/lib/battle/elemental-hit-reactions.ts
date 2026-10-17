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
import { resolveNatureRestorationRewards } from "./resource-reward-resolution";

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
  nextState = resolveNatureRestorationRewards(
    nextState,
    facts,
    combatTexts,
    {
      chance: rollBattleChance,
      armor: applyArmorReward,
      status: (current, status, amount, texts) => addPlayerStatusWithCombatText(current, status, amount, texts),
      heal: (current, amount, texts) => applyHealingWithCombatText(current, amount, texts),
      leech: applyLeechHitHealing,
    },
    alreadyLeeches,
  );
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
