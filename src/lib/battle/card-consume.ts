import { rollBattleChance } from "./chance-roll";
import { readCombatFlag } from "./action-context";
import { resolvePendingBattleReactions } from "./enemy-attack-damage";
import { drawFromState, applyDrawResult } from "./draw";
import { addGoldWithCombatText, applyHealingWithCombatText, gainManaWithCombatText } from "./player-rewards";
import { mergeCombatText } from "./combat-text-events";
import type { BattleCard } from "@/lib/game-data";
import type { BattleState, CombatTextEvent } from "./types";
import { isPlayerDefeated } from "./health-state";
import { addEnemyStatus } from "./status-state";
import { detonateEnemyStatuses } from "./dot-resolve";
import { tickEnemyPoison } from "./status-ticks";
import { addForgeToPlayer, applyArmorReward } from "./status-player";
import { resolveFollowUpHit } from "./follow-up-hit-resolution";
import { cardHasKeyword } from "./card-classification";
import { REACTIVE_REWARD_CHANCES } from "../game-constants";
import { applyEmergencyWishForEmptyDraw } from "./wish";

function drawConsumeReward(state: BattleState, amount: number, combatTexts: CombatTextEvent[]): BattleState {
  const drawn = applyDrawResult(state, drawFromState(state, amount), combatTexts);
  const wished = applyEmergencyWishForEmptyDraw(drawn, amount, combatTexts);
  // A failed draw can now trigger Wish damage; settle its retaliation before another reward.
  return wished === drawn ? drawn : resolvePendingBattleReactions(wished, combatTexts);
}

function cardIsSummonCompanion(card: BattleCard): boolean {
  return card.effects.some((effect) => effect.kind === "summon-companion");
}

function applyConsumeTalentRiders(
  state: BattleState,
  card: BattleCard,
  combatTexts: CombatTextEvent[],
  lastCardInHand: boolean,
): BattleState {
  if (cardIsSummonCompanion(card)) return state;
  const talents = state.talentEffects;
  let nextState = state;

  if (talents.uncappedDrawOnConsume > 0) {
    nextState = drawConsumeReward(nextState, talents.uncappedDrawOnConsume, combatTexts);
    if (isPlayerDefeated(nextState)) return nextState;
  }
  if (lastCardInHand && talents.forgeOnConsume > 0)
    nextState = addForgeToPlayer(nextState, talents.forgeOnConsume, combatTexts);
  if (
    talents.consumeDetonatesBurn ||
    (talents.consumeDetonatesBurnChance > 0 && rollBattleChance(talents.consumeDetonatesBurnChance, nextState))
  ) {
    nextState = detonateEnemyStatuses(nextState, ["burn"], combatTexts);
  }
  nextState = resolvePendingBattleReactions(nextState, combatTexts);
  if (isPlayerDefeated(nextState)) return nextState;
  if (talents.healOnConsume > 0) {
    nextState = applyHealingWithCombatText(nextState, talents.healOnConsume, combatTexts);
  }
  if (talents.goldOnConsume > 0 && rollBattleChance(REACTIVE_REWARD_CHANCES.leftovers, nextState)) {
    nextState = addGoldWithCombatText(nextState, talents.goldOnConsume, combatTexts);
  }
  if (talents.drawOnConsume > 0 && !readCombatFlag(nextState, "consumeDrawUsedThisTurn")) {
    const drawn = drawConsumeReward(nextState, talents.drawOnConsume, combatTexts);
    nextState = {
      ...drawn,
      flags: { ...drawn.flags, consumeDrawUsedThisTurn: true },
    };
    if (isPlayerDefeated(nextState)) return nextState;
  }
  if (talents.poisonOnConsume > 0) {
    nextState = addEnemyStatus(nextState, "poison", talents.poisonOnConsume);
    mergeCombatText(combatTexts, {
      target: "enemy",
      kind: "status",
      stat: "poison",
      amount: talents.poisonOnConsume,
    });
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
  if (cardIsSummonCompanion(card)) return state;
  let nextState = state;
  if (state.gearEffects.armorOnConsume > 0) {
    nextState = applyArmorReward(nextState, state.gearEffects.armorOnConsume, combatTexts);
  }
  if (manaAtConsume === 0 && state.gearEffects.holyOnConsumeWithoutMana > 0) {
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
  if (cardHasKeyword(card, "burn") && nextState.gearEffects.forgeOnConsumeBurnCard > 0) {
    nextState = addForgeToPlayer(nextState, nextState.gearEffects.forgeOnConsumeBurnCard, combatTexts);
    nextState = resolvePendingBattleReactions(nextState, combatTexts);
    if (isPlayerDefeated(nextState)) return nextState;
  }
  if (manaSpent > 0 && nextState.gearEffects.manaOnPaidConsume > 0) {
    nextState = gainManaWithCombatText(nextState, nextState.gearEffects.manaOnPaidConsume, combatTexts);
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
  if (!card.consume) return { ...state, discard: [...state.discard, card] };
  let nextState = { ...state, exhausted: [...state.exhausted, card] };
  if (!triggerConsumeRiders) return nextState;
  if (state.trinketEffects.runicQuillDrawOnConsume > 0) {
    nextState = drawConsumeReward(nextState, state.trinketEffects.runicQuillDrawOnConsume, combatTexts);
    if (isPlayerDefeated(nextState)) return nextState;
  }
  nextState = applyConsumeGearRiders(nextState, card, combatTexts, lastCardInHand, manaSpent, state.mana);
  return isPlayerDefeated(nextState)
    ? nextState
    : applyConsumeTalentRiders(nextState, card, combatTexts, lastCardInHand);
}
