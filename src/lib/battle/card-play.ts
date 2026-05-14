// Card playing logic: cost resolution, free-card rules, and playing a card from hand.
// Depends on draw/effect helpers, game-data card shapes, and combat constants.
import { drawCards } from "./draw";
import { applyCardEffects } from "./apply-effects";
import { mergeCombatText } from "./combat-text";
import { POTION_CARD_ID_FRAGMENT } from "../game-constants";
import { type BattleCard } from "@/lib/game-data";
import {
  type BattleResolution,
  type BattleState,
  type CombatFlags,
  type CombatTextEvent,
} from "./types";

export function cardHasDamageType(card: BattleCard, damageType: string): boolean {
  return card.effects.some((e) => e.kind === "damage" && e.damageType === damageType);
}

const FIRST_CARD_FREE_RULES: { flag: keyof CombatFlags; condition: (state: BattleState, card: BattleCard) => boolean }[] = [
  { flag: "firstPhysicalCardFreeUsed", condition: (state, card) => state.talentEffects.firstPhysicalCardFree && cardHasDamageType(card, "physical") },
  { flag: "firstHolyCardFreeUsed", condition: (state, card) => state.talentEffects.firstHolyCardFree && cardHasDamageType(card, "holy") },
  { flag: "firstPoisonCardFreeUsed", condition: (state, card) => state.talentEffects.firstPoisonCardFree && cardHasDamageType(card, "poison") },
  { flag: "firstBleedCardFreeUsed", condition: (state, card) => state.talentEffects.firstBleedCardFree && cardHasDamageType(card, "bleed") },
];

function resolveCardPlayCost(state: BattleState, card: BattleCard) {
  let effectiveCost = card.cost;
  let nextState = state;

  if (nextState.flags.nextCardCostReduction > 0) {
    effectiveCost = Math.max(0, effectiveCost - nextState.flags.nextCardCostReduction);
  }

  for (const rule of FIRST_CARD_FREE_RULES) {
    if (!(nextState.flags[rule.flag] as boolean) && rule.condition(nextState, card)) {
      effectiveCost = 0;
      nextState = { ...nextState, flags: { ...nextState.flags, [rule.flag]: true } as CombatFlags };
    }
  }

  if (!nextState.flags.firstPotionFreeUsed && nextState.trinketEffects.mortarPestleFreeFirstPotion && card.id.includes(POTION_CARD_ID_FRAGMENT)) {
    effectiveCost = 0;
    nextState = { ...nextState, flags: { ...nextState.flags, firstPotionFreeUsed: true } };
  }

  return { state: nextState, effectiveCost };
}

export function playBattleCardResolved(state: BattleState, cardId: string, index: number): BattleResolution {
  const combatTexts: CombatTextEvent[] = [];

  if (state.wishOptions) {
    return { state, combatTexts };
  }

  const card = state.hand[index];
  if (!card || card.id !== cardId) {
    return { state, combatTexts };
  }

  const costResolution = resolveCardPlayCost(state, card);
  state = costResolution.state;
  const effectiveCost = costResolution.effectiveCost;

  if (state.mana < effectiveCost) {
    return { state, combatTexts };
  }

  let nextState: BattleState = {
    ...state,
    hand: state.hand.filter((_, i) => i !== index),
    flags: { ...state.flags, nextCardCostReduction: 0 },
    cardsPlayedThisTurn: state.cardsPlayedThisTurn + 1,
  };

  nextState = applyCardEffects(nextState, card, combatTexts);

  nextState = { ...nextState, mana: Math.max(0, nextState.mana - effectiveCost) };

  if (nextState.trinketEffects.resonantChimeCardsRequired > 0 && nextState.trinketEffects.resonantChimeMana > 0 && !nextState.flags.resonantChimeUsedThisTurn && nextState.cardsPlayedThisTurn >= nextState.trinketEffects.resonantChimeCardsRequired) {
    nextState = {
      ...nextState,
      mana: nextState.mana + nextState.trinketEffects.resonantChimeMana,
      flags: { ...nextState.flags, resonantChimeUsedThisTurn: true },
    };
    mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "mana", amount: nextState.trinketEffects.resonantChimeMana });
  }

  if (card.consume) {
    if (nextState.trinketEffects.runicQuillDrawOnConsume > 0) {
      const draw = drawCards(nextState.deck, nextState.discard, nextState.hand, nextState.trinketEffects.runicQuillDrawOnConsume, nextState.nextCardUid);
      nextState = { ...nextState, deck: draw.deck, discard: draw.discard, hand: draw.hand, nextCardUid: draw.nextCardUid };
    }
    return { state: { ...nextState, exhausted: [...nextState.exhausted, card] }, combatTexts };
  }

  return { state: { ...nextState, discard: [...nextState.discard, card] }, combatTexts };
}
