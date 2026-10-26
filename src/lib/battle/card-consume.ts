import { rollBattleChance } from "./chance-roll";
import { resolvePendingBattleReactions } from "./enemy-attack-damage";
import { drawFromState, applyDrawResult, refillEmptyDrawPile } from "./draw";
import { addGoldWithCombatText, applyHealingWithCombatText, gainManaWithCombatText } from "./player-rewards";
import { isCompanionSummonCard, type BattleCard } from "@/lib/game-data";
import type { BattleState, CombatTextEvent } from "./types";
import { isPlayerDefeated } from "./battle-outcome";
import { detonateEnemyStatuses } from "./dot-resolve";
import { tickEnemyPoison } from "./status-ticks";
import { rollForgeAffixAwards, addForgeToPlayer, applyArmorReward } from "./status-player";
import { resolveFollowUpHit } from "./follow-up-hit-resolution";
import { cardHasKeyword } from "./card-classification";
import { applyEmergencyWishForEmptyDraw } from "./wish";

function drawConsumeReward(state: BattleState, amount: number, combatTexts: CombatTextEvent[]): BattleState {
  const drawn = applyDrawResult(state, drawFromState(state, amount), combatTexts);
  const wished = applyEmergencyWishForEmptyDraw(drawn, amount, combatTexts);
  // A failed draw can now trigger Wish damage; settle its retaliation before another reward.
  return wished === drawn ? drawn : resolvePendingBattleReactions(wished, combatTexts);
}

function applyConsumeTalentRiders(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  const talents = state.talentEffects;
  let nextState = state;

  if (talents.drawOnConsume > 0 && rollBattleChance(talents.drawOnConsumeChance, nextState)) {
    nextState = drawConsumeReward(nextState, talents.drawOnConsume, combatTexts);
    if (isPlayerDefeated(nextState)) return nextState;
  }
  if (talents.forgeOnConsume > 0 && rollBattleChance(talents.forgeOnConsumeChance, nextState))
    nextState = addForgeToPlayer(nextState, talents.forgeOnConsume, combatTexts);
  if (talents.consumeDetonatesBurnChance > 0 && rollBattleChance(talents.consumeDetonatesBurnChance, nextState)) {
    nextState = detonateEnemyStatuses(nextState, ["burn"], combatTexts);
  }
  nextState = resolvePendingBattleReactions(nextState, combatTexts);
  if (isPlayerDefeated(nextState)) return nextState;
  if (talents.healOnConsume > 0) {
    nextState = resolvePendingBattleReactions(
      applyHealingWithCombatText(nextState, talents.healOnConsume, combatTexts),
      combatTexts,
    );
    if (isPlayerDefeated(nextState)) return nextState;
  }
  if (talents.goldOnConsume > 0 && rollBattleChance(talents.goldOnConsumeChance, nextState)) {
    nextState = resolvePendingBattleReactions(
      addGoldWithCombatText(nextState, talents.goldOnConsume, combatTexts),
      combatTexts,
    );
    if (isPlayerDefeated(nextState)) return nextState;
  }
  return nextState;
}

function applyConsumeGearRiders(
  state: BattleState,
  card: BattleCard,
  combatTexts: CombatTextEvent[],
  lastCardInHand: boolean,
  manaSpent: number,
  manaAtConsume: number,
): BattleState {
  let nextState = state;
  if (state.gearEffects.armorOnConsume > 0) {
    nextState = resolvePendingBattleReactions(
      applyArmorReward(nextState, state.gearEffects.armorOnConsume, combatTexts),
      combatTexts,
    );
    if (isPlayerDefeated(nextState)) return nextState;
  }
  if (nextState.enemyHealth > 0 && manaAtConsume === 0 && state.gearEffects.holyOnConsumeWithoutMana > 0) {
    nextState = resolvePendingBattleReactions(
      resolveFollowUpHit(
        nextState,
        { source: "player-follow-up", damageType: "holy", amount: state.gearEffects.holyOnConsumeWithoutMana },
        combatTexts,
      ),
      combatTexts,
    );
    if (isPlayerDefeated(nextState)) return nextState;
  }
  for (let tick = 0; tick < state.gearEffects.poisonTickOnConsume; tick += 1) {
    if (nextState.enemyHealth <= 0 || nextState.enemyStatuses.poison <= 0) break;
    nextState = resolvePendingBattleReactions(tickEnemyPoison(nextState, combatTexts), combatTexts);
    if (isPlayerDefeated(nextState)) return nextState;
  }
  if (cardHasKeyword(card, "burn")) {
    nextState = addForgeToPlayer(
      nextState,
      rollForgeAffixAwards(nextState, nextState.gearEffects.forgeOnConsumeBurnCardChances),
      combatTexts,
    );
    nextState = resolvePendingBattleReactions(nextState, combatTexts);
    if (isPlayerDefeated(nextState)) return nextState;
  }
  if (manaSpent > 0 && nextState.gearEffects.manaOnPaidConsume > 0) {
    nextState = resolvePendingBattleReactions(
      gainManaWithCombatText(nextState, nextState.gearEffects.manaOnPaidConsume, combatTexts),
      combatTexts,
    );
    if (isPlayerDefeated(nextState)) return nextState;
  }
  if (lastCardInHand && nextState.gearEffects.drawOnLastHandConsume > 0) {
    nextState = drawConsumeReward(nextState, nextState.gearEffects.drawOnLastHandConsume, combatTexts);
  }
  return nextState;
}

interface CardDestinationContext {
  triggerConsumeRiders?: boolean;
  combatTexts?: CombatTextEvent[];
  lastCardInHand?: boolean;
  manaSpent?: number;
}

export function handlePostPlayCardDestination(
  state: BattleState,
  card: BattleCard,
  { triggerConsumeRiders = true, combatTexts = [], lastCardInHand = false, manaSpent = 0 }: CardDestinationContext = {},
): BattleState {
  if (!card.consume) {
    return isCompanionSummonCard(card)
      ? { ...state, exhausted: [...state.exhausted, card] }
      : refillEmptyDrawPile({ ...state, discard: [...state.discard, card] });
  }
  let nextState = { ...state, exhausted: [...state.exhausted, card] };
  if (!triggerConsumeRiders) return nextState;
  if (state.trinketEffects.runicQuillDrawOnConsume > 0) {
    nextState = drawConsumeReward(nextState, state.trinketEffects.runicQuillDrawOnConsume, combatTexts);
    if (isPlayerDefeated(nextState)) return nextState;
  }
  nextState = applyConsumeGearRiders(nextState, card, combatTexts, lastCardInHand, manaSpent, state.mana);
  return isPlayerDefeated(nextState) ? nextState : applyConsumeTalentRiders(nextState, combatTexts);
}
