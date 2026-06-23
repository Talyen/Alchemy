/**
 * Wish card generation and wish effect resolution.
 * Depends on: @/lib/game-data, ../game-constants, ./draw, ./types, ./combat-text, ./status-effects.
 * Depended on by: ./apply-effects.
 */
import { getOfferableCardPool, selectRewardCards } from "@/lib/game-data";
import type { BattleCard } from "@/lib/game-data";
import { drawFromState } from "./draw";
import { addGold, applyPlayerHealing, clampHealth, type BattleState, type CombatTextEvent } from "./types";
import { emitOverhealBlockText, mergeCombatText } from "./combat-text";
import { removeHarmfulPlayerStatuses, applyPlayerStatusEffect, getEnemyDamageMultiplier } from "./status-effects";
import { getEditableCorruptionTargets, replaceNumberAt } from "@/lib/corruption";
import { PERCENT_DENOMINATOR, WISH_CHOICE_COUNT, WISH_CRYSTAL_GOLD_CHANCE, MAX_HAND_SIZE } from "../game-constants";
import { applyGearKillRewards, gearFrozenDamageMultiplier } from "./gear-effects";
import { scaleGoldReward } from "./types";
import { processEncounterTraitHealthThreshold } from "./encounter-trait-events";

function upgradeWishCard(card: BattleCard): BattleCard {
  const targets = getEditableCorruptionTargets(card);
  if (targets.length === 0) return card;

  const nextCard: BattleCard = {
    ...card,
    descriptionLines: [...card.descriptionLines],
    effects: card.effects.map((effect) => ({ ...effect })),
  };

  const sortedTargets = [...targets].sort((a, b) => {
    if (a.lineIndex !== b.lineIndex) {
      return b.lineIndex - a.lineIndex;
    }
    return b.matchIndex - a.matchIndex;
  });

  for (const target of sortedTargets) {
    const nextValue = target.value + 1;
    const effect = nextCard.effects[target.effectIndex];
    if (effect && "amount" in effect) {
      (effect as { amount: number }).amount = nextValue;
    }
    nextCard.descriptionLines[target.lineIndex] = replaceNumberAt(
      nextCard.descriptionLines[target.lineIndex]!,
      target.matchIndex,
      nextValue,
    );
  }

  return nextCard;
}

export function buildWishOptions(state: BattleState, card: BattleCard): BattleCard[] {
  const baseCount =
    WISH_CHOICE_COUNT + (state.rng() * PERCENT_DENOMINATOR < state.talentEffects.wishExtraChoiceChance ? 1 : 0);

  let candidates = getOfferableCardPool().filter((candidate) => candidate.id !== card.id);

  if (state.talentEffects.wishUndiscoveredCards && state.discoveredCardIds.length > 0) {
    const undiscovered = candidates.filter((c) => !state.discoveredCardIds.includes(c.id));
    if (undiscovered.length >= baseCount) {
      candidates = undiscovered;
    }
  }

  // Concatenate draw pile, hand, discard, and consumed cards to represent the player's full deck
  const fullDeck = [...state.deck, ...state.hand, ...state.discard, ...state.exhausted];
  const selected = selectRewardCards(fullDeck, candidates, baseCount, [], state.rng);

  if (state.talentEffects.wishCardsUpgraded) {
    return selected.map((c) => upgradeWishCard(c));
  }
  return selected;
}

function applyWishGoldTriggers(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  let nextState = state;
  const goldAmount =
    nextState.talentEffects.goldOnWish + nextState.talentEffects.goldOnWishAmount + nextState.gearEffects.goldOnWish;
  if (goldAmount > 0) {
    const scaledGold = scaleGoldReward(goldAmount, nextState.gearEffects);
    nextState = addGold(nextState, goldAmount);
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "status",
      stat: "gold",
      amount: scaledGold,
    });
  }
  if (nextState.trinketEffects.wishingWellGoldOnWish > 0) {
    nextState = addGold(nextState, nextState.trinketEffects.wishingWellGoldOnWish);
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "status",
      stat: "gold",
      amount: nextState.trinketEffects.wishingWellGoldOnWish,
    });
  }
  return nextState;
}

function applyWishCrystalGoldTrigger(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  const amount = state.talentEffects.wishCrystalGold;
  if (amount <= 0) return state;
  if (state.rng() < WISH_CRYSTAL_GOLD_CHANCE) {
    mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "gold", amount });
    return addGold(state, amount);
  }
  mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "crystal", amount });
  return {
    ...state,
    pendingMaterials: { ...state.pendingMaterials, crystal: state.pendingMaterials.crystal + amount },
  };
}

function applyWishHealthAndStatusTriggers(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  let nextState = state;
  const healthGain = nextState.talentEffects.healthOnWish + nextState.gearEffects.healthOnWish;
  if (healthGain > 0) {
    const prevState = nextState;
    nextState = applyPlayerHealing(nextState, healthGain);
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "heal",
      stat: "health",
      amount: healthGain,
    });
    emitOverhealBlockText(prevState, nextState, combatTexts);
  }
  if (nextState.talentEffects.removeHarmfulStatusOnWish) {
    nextState = removeHarmfulPlayerStatuses(nextState, 1, combatTexts);
  }
  return nextState;
}

function applyWishDrawTriggers(state: BattleState): BattleState {
  const nextState = state;
  const drawCount = (nextState.talentEffects.wishDrawsCard ? 1 : 0) + nextState.gearEffects.drawOnWish;
  if (drawCount <= 0) return nextState;
  const draw = drawFromState(nextState, drawCount);
  return {
    ...nextState,
    deck: draw.deck,
    discard: draw.discard,
    hand: draw.hand,
    nextCardUid: draw.nextCardUid,
  };
}

export function applyWishEffect(state: BattleState, card: BattleCard, amount: number, combatTexts: CombatTextEvent[]) {
  const wishCount = Math.max(0, Math.round(amount));
  if (wishCount <= 0) return state;

  const nextWishOptions = Array.from({ length: wishCount }, () => buildWishOptions(state, card));
  let nextState: BattleState = state.wishOptions
    ? { ...state, wishQueue: [...state.wishQueue, ...nextWishOptions] }
    : { ...state, wishOptions: nextWishOptions[0]!, wishQueue: [...state.wishQueue, ...nextWishOptions.slice(1)] };

  for (let i = 0; i < wishCount; i += 1) {
    nextState = applyWishGoldTriggers(nextState, combatTexts);
    nextState = applyWishCrystalGoldTrigger(nextState, combatTexts);
    nextState = applyWishHealthAndStatusTriggers(nextState, combatTexts);
    nextState = applyWishDrawTriggers(nextState);
    nextState = applyWishBurnTrigger(nextState, combatTexts);
    nextState = applyWishManaTrigger(nextState, combatTexts);
    nextState = applyWishTrinketTrigger(nextState, combatTexts);
    nextState = applyWishDesperateTrigger(nextState, combatTexts);
  }

  return nextState;
}

function applyWishBurnTrigger(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  const burnAmount = state.talentEffects.burnOnWish + state.gearEffects.burnOnWish;
  if (burnAmount <= 0 || state.enemyHealth <= 0) return state;
  const enemyWasAlive = state.enemyHealth > 0;
  const multiplier = getEnemyDamageMultiplier(state, "burn") * gearFrozenDamageMultiplier(state);
  const finalDamage = Math.round(burnAmount * multiplier);
  if (finalDamage > 0) {
    mergeCombatText(combatTexts, {
      target: "enemy",
      kind: "damage",
      stat: "burn",
      amount: finalDamage,
    });
  }
  const nextState = {
    ...state,
    enemyHealth: clampHealth(state.enemyHealth, -finalDamage, state.enemyMaxHealth),
  };
  const afterThreshold = processEncounterTraitHealthThreshold(state.enemyHealth, nextState, combatTexts);
  return applyGearKillRewards(afterThreshold, enemyWasAlive, combatTexts);
}

function applyWishTrinketTrigger(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  if (!state.talentEffects.wishTrinketChoice) return state;
  const isForge = state.rng() < 0.5;
  const status = isForge ? ("forge" as const) : ("armor" as const);
  return applyPlayerStatusEffect(state, { kind: "player-status", status, amount: 1 }, combatTexts);
}

function applyWishDesperateTrigger(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  const thresholdPct = state.talentEffects.wishBlockBelowHealthPct;
  if (thresholdPct <= 0) return state;
  const thresholdHp = (state.playerMaxHealth * thresholdPct) / PERCENT_DENOMINATOR;
  if (state.playerHealth <= thresholdHp) {
    return applyPlayerStatusEffect(state, { kind: "player-status", status: "block" as const, amount: 6 }, combatTexts);
  }
  return state;
}

function applyWishManaTrigger(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  const manaGain = state.talentEffects.manaOnWish + state.gearEffects.manaOnWish;
  if (manaGain <= 0) return state;
  mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "mana", amount: manaGain });
  return { ...state, mana: state.mana + manaGain };
}

export function chooseWishCard(state: BattleState, cardId: string | null) {
  const [nextWishOptions = null, ...wishQueue] = state.wishQueue;

  if (cardId === null) {
    return { ...state, wishOptions: nextWishOptions, wishQueue };
  }

  const chosenCard = state.wishOptions?.find((card) => card.id === cardId);
  if (!chosenCard) {
    return state;
  }

  const cardWithUid = { ...chosenCard, uid: state.nextCardUid };
  const nextCardUid = state.nextCardUid + 1;

  if (state.hand.length < MAX_HAND_SIZE) {
    return { ...state, hand: [...state.hand, cardWithUid], nextCardUid, wishOptions: nextWishOptions, wishQueue };
  }

  return { ...state, discard: [...state.discard, cardWithUid], nextCardUid, wishOptions: nextWishOptions, wishQueue };
}
