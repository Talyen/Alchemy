import { hasEncounterBenefit } from "./types";
import { selectRewardCards } from "@/lib/game-data";
import { getOfferableCardPool } from "@/lib/game-data/cards/card-pools";
import type { BattleCard, BattleCardEffect } from "@/lib/game-data";
import { applyDrawResult, drawFromState } from "./draw";
import { type BattleState, type CombatTextEvent } from "./types";
import {
  addGoldWithCombatText,
  applyHealingWithCombatText,
  gainManaWithCombatText,
  mergeCombatText,
  payKillPayouts,
} from "./combat-text";
import { removeHarmfulPlayerStatuses, applyPlayerStatusEffect } from "./status-player";
import { getEnemyDamageMultiplier } from "./status-helpers";
import { getBattleRng, rollPercent } from "@/lib/rng";
import { getEditableCorruptionTargets, replaceNumberAt } from "@/lib/corruption";
import {
  PERCENT_DENOMINATOR,
  WISH_CHOICE_COUNT,
  WISH_CRYSTAL_GOLD_PERCENT,
  WISH_TRINKET_FORK_PERCENT,
  MAX_HAND_SIZE,
} from "../game-constants";
import { shouldConvertCrystalWishToGold } from "@/lib/content-systems/battle-content";
import { dealEnemyScaledDamage, gearFrozenDamageMultiplier } from "./gear-effects";
import { processEncounterTraitHealthThreshold } from "./encounter-trait-health-threshold";

function upgradeRepeatedWishEffects(
  effect: BattleCardEffect,
  original: BattleCard,
  upgraded: BattleCard,
): BattleCardEffect {
  if (effect.kind !== "repeat-over-turns") return effect;
  return {
    ...effect,
    effects: effect.effects.map((child) => {
      const index = original.effects.findIndex((source) => JSON.stringify(source) === JSON.stringify(child));
      return index >= 0 ? upgraded.effects[index]! : upgradeRepeatedWishEffects(child, original, upgraded);
    }),
  };
}

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
    const effect = nextCard.effects[target.effectIndex] as Record<string, unknown> | undefined;
    if (effect && effect[target.field] === target.value) {
      effect[target.field] = nextValue;
    }
    nextCard.descriptionLines[target.lineIndex] = replaceNumberAt(
      nextCard.descriptionLines[target.lineIndex]!,
      target.matchIndex,
      nextValue,
    );
  }

  nextCard.effects = nextCard.effects.map((effect) => upgradeRepeatedWishEffects(effect, card, nextCard));
  return nextCard;
}

export function buildWishOptions(state: BattleState, card: BattleCard): BattleCard[] {
  const baseCount =
    WISH_CHOICE_COUNT +
    state.talentEffects.wishExtraChoices +
    (hasEncounterBenefit(state, "wishful") && !state.flags.encounterWishUsed ? 1 : 0) +
    (rollPercent(state.talentEffects.wishExtraChoiceChance, getBattleRng(state)) ? 1 : 0);

  const candidates = getOfferableCardPool().filter((candidate) => candidate.id !== card.id);
  const fullDeck = [...state.deck, ...state.hand, ...state.discard, ...state.exhausted];
  const undiscovered = state.talentEffects.wishUndiscoveredCards
    ? candidates.filter((candidate) => !state.discoveredCardIds.includes(candidate.id))
    : [];
  const guaranteed =
    undiscovered.length > 0 ? selectRewardCards(fullDeck, undiscovered, 1, [], getBattleRng(state)) : [];
  const selected = [
    ...guaranteed,
    ...selectRewardCards(fullDeck, candidates, baseCount - guaranteed.length, guaranteed, getBattleRng(state)),
  ];

  if (state.talentEffects.wishCardsUpgraded) {
    return selected.map((c) => upgradeWishCard(c));
  }
  return selected;
}

function applyWishGoldTriggers(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  let nextState = state;
  const goldAmount = nextState.talentEffects.goldOnWish + nextState.gearEffects.goldOnWish;
  if (goldAmount > 0) {
    nextState = addGoldWithCombatText(nextState, goldAmount, combatTexts);
  }
  if (nextState.trinketEffects.wishingWellGoldOnWish > 0) {
    nextState = addGoldWithCombatText(nextState, nextState.trinketEffects.wishingWellGoldOnWish, combatTexts);
  }
  return nextState;
}

function applyWishCrystalGoldTrigger(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  const amount = state.talentEffects.wishCrystalGold;
  if (amount <= 0) return state;
  if (rollPercent(WISH_CRYSTAL_GOLD_PERCENT, getBattleRng(state))) {
    return addGoldWithCombatText(state, amount, combatTexts);
  }
  if (shouldConvertCrystalWishToGold(state.contentSystemType)) {
    return addGoldWithCombatText(state, amount, combatTexts);
  }
  mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "gems", amount });
  return {
    ...state,
    pendingMaterials: { ...state.pendingMaterials, gems: state.pendingMaterials.gems + amount },
  };
}

function applyWishHealthAndStatusTriggers(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  let nextState = state;
  const healthGain = nextState.talentEffects.healthOnWish + nextState.gearEffects.healthOnWish;
  if (healthGain > 0) {
    nextState = applyHealingWithCombatText(nextState, healthGain, combatTexts);
  }
  if (nextState.talentEffects.removeHarmfulStatusOnWish) {
    nextState = removeHarmfulPlayerStatuses(nextState, 1, combatTexts);
  }
  return nextState;
}

function applyWishDrawTriggers(state: BattleState): BattleState {
  const drawCount = (state.talentEffects.wishDrawsCard ? 1 : 0) + state.gearEffects.drawOnWish;
  if (drawCount <= 0) return state;
  return applyDrawResult(state, drawFromState(state, drawCount));
}

export function applyWishEffect(state: BattleState, card: BattleCard, amount: number, combatTexts: CombatTextEvent[]) {
  const wishCount = Math.max(0, Math.round(amount));
  if (wishCount <= 0) return state;

  const nextWishOptions: BattleCard[][] = [];
  for (let index = 0; index < wishCount; index += 1) {
    nextWishOptions.push(buildWishOptions(state, card));
    if (hasEncounterBenefit(state, "wishful")) state = { ...state, flags: { ...state.flags, encounterWishUsed: true } };
  }
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
  const afterThreshold = dealEnemyScaledDamage(state, burnAmount, "burn", combatTexts, {
    multiplier,
    riders: (damagedState) => processEncounterTraitHealthThreshold(state.enemyHealth, damagedState, combatTexts),
  });
  return payKillPayouts(afterThreshold, enemyWasAlive, combatTexts);
}

function applyWishTrinketTrigger(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  if (!state.talentEffects.wishTrinketChoice) return state;
  const isForge = rollPercent(WISH_TRINKET_FORK_PERCENT, getBattleRng(state));
  const status = isForge ? ("forge" as const) : ("armor" as const);
  return applyPlayerStatusEffect(state, { kind: "player-status", status, amount: 1 }, combatTexts);
}

function applyWishDesperateTrigger(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  const thresholdPct = state.talentEffects.wishBlockBelowHealthPct;
  const blockAmount = state.talentEffects.wishBlockAmount;
  if (thresholdPct <= 0 || blockAmount <= 0) return state;
  const thresholdHp = (state.playerMaxHealth * thresholdPct) / PERCENT_DENOMINATOR;
  if (state.playerHealth < thresholdHp) {
    return applyPlayerStatusEffect(
      state,
      { kind: "player-status", status: "block" as const, amount: blockAmount },
      combatTexts,
    );
  }
  return state;
}

function applyWishManaTrigger(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  if (state.talentEffects.manaNextTurnOnWish > 0) {
    state = {
      ...state,
      flags: {
        ...state.flags,
        pendingWishMana: state.flags.pendingWishMana + state.talentEffects.manaNextTurnOnWish,
      },
    };
  }
  const manaGain = state.talentEffects.manaOnWish + state.gearEffects.manaOnWish;
  if (manaGain <= 0) return state;
  return gainManaWithCombatText(state, manaGain, combatTexts, { skipFightPacing: true });
}

export function chooseWishCard(state: BattleState, cardId: string, combatTexts: CombatTextEvent[] = []) {
  const [nextWishOptions = null, ...wishQueue] = state.wishQueue;

  const chosenCard = state.wishOptions?.find((card) => card.id === cardId);
  if (!chosenCard) {
    return state;
  }

  const declined = Math.max(0, (state.wishOptions?.length ?? 0) - 1);
  const blockAmount = declined * state.talentEffects.blockPerDeclinedWishCard;
  const rewarded =
    blockAmount > 0
      ? applyPlayerStatusEffect(state, { kind: "player-status", status: "block", amount: blockAmount }, combatTexts)
      : state;
  const cardWithUid = { ...chosenCard, uid: state.nextCardUid };
  const nextCardUid = state.nextCardUid + 1;

  if (state.hand.length < MAX_HAND_SIZE) {
    return { ...rewarded, hand: [...state.hand, cardWithUid], nextCardUid, wishOptions: nextWishOptions, wishQueue };
  }

  return {
    ...rewarded,
    discard: [...state.discard, cardWithUid],
    nextCardUid,
    wishOptions: nextWishOptions,
    wishQueue,
  };
}
