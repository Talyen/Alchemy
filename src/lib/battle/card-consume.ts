import { readCombatFlag } from "./action-context";
import { resolvePendingBattleReactions } from "./enemy-attack-damage";
import { drawFromState, applyDrawResult } from "./draw";
import { addGoldWithCombatText, applyHealingWithCombatText, gainManaWithCombatText } from "./player-rewards";
import { mergeCombatText } from "./combat-text-events";
import type { BattleCard } from "@/lib/game-data";
import { type BattleState, type CombatTextEvent, isPlayerDefeated, addEnemyStatus } from "./types";
import { detonateEnemyStatuses } from "./dot-resolve";
import { tickEnemyPoison } from "./status-ticks";
import { addForgeToPlayer, applyArmorReward } from "./status-player";
import { resolveFollowUpHit } from "./follow-up-hit-resolution";
import { rollTalentChance } from "./status-helpers";
import { cardHasKeyword } from "./card-classification";
import { REACTIVE_REWARD_CHANCES } from "../game-constants";

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
    nextState = applyDrawResult(nextState, drawFromState(nextState, talents.uncappedDrawOnConsume));
  }
  if (lastCardInHand && talents.forgeOnConsume > 0)
    nextState = addForgeToPlayer(nextState, talents.forgeOnConsume, combatTexts);
  if (
    talents.consumeDetonatesBurn ||
    (talents.consumeDetonatesBurnChance > 0 && rollTalentChance(talents.consumeDetonatesBurnChance, nextState))
  ) {
    nextState = detonateEnemyStatuses(nextState, ["burn"], combatTexts);
  }
  nextState = resolvePendingBattleReactions(nextState, combatTexts);
  if (isPlayerDefeated(nextState)) return nextState;
  if (talents.healOnConsume > 0) {
    nextState = applyHealingWithCombatText(nextState, talents.healOnConsume, combatTexts);
  }
  if (talents.goldOnConsume > 0 && rollTalentChance(REACTIVE_REWARD_CHANCES.leftovers, nextState)) {
    nextState = addGoldWithCombatText(nextState, talents.goldOnConsume, combatTexts);
  }
  if (talents.drawOnConsume > 0 && !readCombatFlag(nextState, "consumeDrawUsedThisTurn")) {
    const draw = drawFromState(nextState, talents.drawOnConsume);
    nextState = {
      ...applyDrawResult(nextState, draw),
      flags: { ...nextState.flags, consumeDrawUsedThisTurn: true },
    };
  }
  if (talents.poisonOnConsume > 0) {
    nextState = addEnemyStatus(nextState, "poison", talents.poisonOnConsume);
    if (combatTexts) {
      mergeCombatText(combatTexts, {
        target: "enemy",
        kind: "status",
        stat: "poison",
        amount: talents.poisonOnConsume,
      });
    }
  }
  return nextState;
}

function applyConsumeGearRiders(
  state: BattleState,
  card: BattleCard,
  combatTexts: CombatTextEvent[],
  lastCardInHand: boolean,
  manaSpent: number,
): BattleState {
  let nextState = state;
  if (state.gearEffects.armorOnConsume > 0) {
    nextState = applyArmorReward(nextState, state.gearEffects.armorOnConsume, combatTexts);
  }
  if (state.mana === 0 && state.gearEffects.holyOnConsumeWithoutMana > 0) {
    nextState = resolveFollowUpHit(
      nextState,
      { source: "player-follow-up", damageType: "holy", amount: state.gearEffects.holyOnConsumeWithoutMana },
      combatTexts,
    );
  }
  for (let tick = 0; tick < state.gearEffects.poisonTickOnConsume; tick += 1) {
    if (nextState.enemyHealth <= 0 || nextState.enemyStatuses.poison <= 0) break;
    nextState = resolvePendingBattleReactions(tickEnemyPoison(nextState, combatTexts), combatTexts);
    if (isPlayerDefeated(nextState)) return nextState;
  }
  if (cardHasKeyword(card, "burn") && nextState.gearEffects.forgeOnConsumeBurnCard > 0) {
    nextState = addForgeToPlayer(nextState, nextState.gearEffects.forgeOnConsumeBurnCard, combatTexts);
  }
  if (manaSpent > 0 && nextState.gearEffects.manaOnPaidConsume > 0) {
    nextState = gainManaWithCombatText(nextState, nextState.gearEffects.manaOnPaidConsume, combatTexts);
  }
  if (lastCardInHand && nextState.gearEffects.drawOnLastHandConsume > 0) {
    nextState = applyDrawResult(nextState, drawFromState(nextState, nextState.gearEffects.drawOnLastHandConsume));
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
  if (card.consume) {
    let nextState = { ...state, exhausted: [...state.exhausted, card] };
    if (triggerConsumeRiders) {
      if (state.trinketEffects.runicQuillDrawOnConsume > 0) {
        const draw = drawFromState(nextState, state.trinketEffects.runicQuillDrawOnConsume);
        nextState = applyDrawResult(nextState, draw);
      }
      nextState = applyConsumeGearRiders(nextState, card, combatTexts, lastCardInHand, manaSpent);
      if (isPlayerDefeated(nextState)) return nextState;
      nextState = applyConsumeTalentRiders(nextState, card, combatTexts, lastCardInHand);
    }
    return nextState;
  }
  return { ...state, discard: [...state.discard, card] };
}
