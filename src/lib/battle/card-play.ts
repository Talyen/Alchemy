/**
 * Resolves card play validation, cost reduction, and effect application during combat.
 * Depends on: ./draw, ./apply-effects, ./combat-text, ../game-constants, @/lib/game-data, ./types.
 * Depended on by: ./cost, features/alchemy controllers.
 */
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
  isPlayerDefeated,
} from "./types";

/**
 * Checks if a card contains a specific damage type effect.
 * Used for determining keyword affinity and applying first-card-free rules.
 */
export function cardHasDamageType(card: BattleCard, damageType: string): boolean {
  return card.effects.some((e) => e.kind === "damage" && e.damageType === damageType);
}

type CardCostState = Pick<BattleState, "flags" | "talentEffects" | "trinketEffects">;

const FIRST_CARD_FREE_RULES: {
  flag: keyof CombatFlags;
  condition: (state: CardCostState, card: BattleCard) => boolean;
}[] = [
  {
    flag: "firstPhysicalCardFreeUsed",
    condition: (state, card) => state.talentEffects.firstPhysicalCardFree && cardHasDamageType(card, "physical"),
  },
  {
    flag: "firstHolyCardFreeUsed",
    condition: (state, card) => state.talentEffects.firstHolyCardFree && cardHasDamageType(card, "holy"),
  },
  {
    flag: "firstPoisonCardFreeUsed",
    condition: (state, card) => state.talentEffects.firstPoisonCardFree && cardHasDamageType(card, "poison"),
  },
  {
    flag: "firstBleedCardFreeUsed",
    condition: (state, card) => state.talentEffects.firstBleedCardFree && cardHasDamageType(card, "bleed"),
  },
];

/**
 * Applies temporary mana discounts to compute effective card cost.
 */
function applyCostReduction(cost: number, reduction: number): number {
  return reduction > 0 ? Math.max(0, cost - reduction) : cost;
}

/**
 * Checks if a trinket discount applies to the first potion played.
 */
function checkTrinketFreePotion(state: CardCostState, card: BattleCard): boolean {
  return (
    !state.flags.firstPotionFreeUsed &&
    !!state.trinketEffects.mortarPestleFreeFirstPotion &&
    card.id.includes(POTION_CARD_ID_FRAGMENT)
  );
}

/**
 * Pure cost computation shared by UI (getEffectiveCost) and card play (resolveCardPlayCost).
 * Returns the effective cost and which one-shot free-card flags were consumed.
 */
export function computeEffectiveCost(
  state: CardCostState,
  card: BattleCard,
): { effectiveCost: number; consumedFlags: Partial<CombatFlags> } {
  let effectiveCost = applyCostReduction(card.cost, state.flags.nextCardCostReduction);
  const consumedFlags: Partial<CombatFlags> = {};

  if (effectiveCost === 0) return { effectiveCost, consumedFlags };

  for (const rule of FIRST_CARD_FREE_RULES) {
    if (!(state.flags[rule.flag] as boolean) && rule.condition(state, card)) {
      effectiveCost = 0;
      consumedFlags[rule.flag] = true as never;
      break;
    }
  }
  if (effectiveCost === 0) return { effectiveCost, consumedFlags };

  if (checkTrinketFreePotion(state, card)) {
    effectiveCost = 0;
    consumedFlags.firstPotionFreeUsed = true;
  }

  return { effectiveCost, consumedFlags };
}

/**
 * Resolves the final state and cost for a played card, modifying flags if discounts were used.
 */
function resolveCardPlayCost(state: BattleState, card: BattleCard) {
  const { effectiveCost, consumedFlags } = computeEffectiveCost(state, card);
  const hasChanges = Object.keys(consumedFlags).length > 0;
  return {
    state: hasChanges ? { ...state, flags: { ...state.flags, ...consumedFlags } as CombatFlags } : state,
    effectiveCost,
  };
}

/**
 * Validates whether a card in the player's hand can currently be played.
 */
function getPlayableCard(state: BattleState, cardId: string, index: number): BattleCard | null {
  if (state.wishOptions) return null;
  const card = state.hand[index];
  if (!card || card.id !== cardId) return null;
  return card;
}

/**
 * Executes state changes directly related to removing a card from hand and applying its effects.
 */
function executeCardPlayState(
  state: BattleState,
  card: BattleCard,
  index: number,
  effectiveCost: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  let nextState: BattleState = {
    ...state,
    hand: state.hand.filter((_, i) => i !== index),
    // Reset the temporary single-use card cost reduction after playing the card
    flags: { ...state.flags, nextCardCostReduction: 0 },
    cardsPlayedThisTurn: state.cardsPlayedThisTurn + 1,
  };

  nextState = applyCardEffects(nextState, card, combatTexts);
  return { ...nextState, mana: Math.max(0, nextState.mana - effectiveCost) };
}

/**
 * Applies the Resonant Chime trinket effect if cards played trigger criteria.
 */
function applyResonantChimeTrinket(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  const { resonantChimeCardsRequired, resonantChimeMana } = state.trinketEffects;
  if (
    resonantChimeCardsRequired > 0 &&
    resonantChimeMana > 0 &&
    // Ensure the chime triggers at most once per player turn
    !state.flags.resonantChimeUsedThisTurn &&
    state.cardsPlayedThisTurn >= resonantChimeCardsRequired
  ) {
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "status",
      stat: "mana",
      amount: resonantChimeMana,
    });
    return {
      ...state,
      mana: state.mana + resonantChimeMana,
      flags: { ...state.flags, resonantChimeUsedThisTurn: true },
    };
  }
  return state;
}

/**
 * Resolves post-play destination (exhausted/discard pile) and triggers consume riders.
 */
function handlePostPlayCardDestination(state: BattleState, card: BattleCard): BattleState {
  if (card.consume) {
    let nextState = state;
    if (state.trinketEffects.runicQuillDrawOnConsume > 0) {
      const draw = drawCards(
        state.deck,
        state.discard,
        state.hand,
        state.trinketEffects.runicQuillDrawOnConsume,
        state.nextCardUid,
      );
      nextState = {
        ...state,
        deck: draw.deck,
        discard: draw.discard,
        hand: draw.hand,
        nextCardUid: draw.nextCardUid,
      };
    }
    return { ...nextState, exhausted: [...nextState.exhausted, card] };
  }
  return { ...state, discard: [...state.discard, card] };
}

/**
 * Coordinates cost checks, play validation, effect dispatching, and deck movement.
 */
export function playBattleCardResolved(state: BattleState, cardId: string, index: number): BattleResolution {
  const combatTexts: CombatTextEvent[] = [];

  if (state.enemyHealth <= 0 || isPlayerDefeated(state)) {
    return { state, combatTexts };
  }

  const card = getPlayableCard(state, cardId, index);
  if (!card) return { state, combatTexts };

  const { state: costState, effectiveCost } = resolveCardPlayCost(state, card);
  if (costState.mana < effectiveCost) {
    return { state, combatTexts };
  }

  let nextState = executeCardPlayState(costState, card, index, effectiveCost, combatTexts);
  nextState = applyResonantChimeTrinket(nextState, combatTexts);
  nextState = handlePostPlayCardDestination(nextState, card);

  return { state: nextState, combatTexts };
}
