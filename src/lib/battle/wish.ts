import { getBattleOutcome } from "./battle-outcome";
import { rollBattleChance } from "./chance-roll";
import type { ReactionBoundary } from "./battle-sequence";
import { resolveWishRewards } from "./wish-rewards";
import { hasEncounterBenefit } from "./encounter-trait-state";
import { getOfferableCardPool, isCompanionSummonCard, selectRewardCards, type BattleCard } from "@/lib/game-data";
import { getEditableCorruptionTargets, updateCardNumericValue } from "@/lib/corruption";
import { getCorruptionTargetEffect } from "@/lib/corruption/numeric";
import { addCardToHandOrQueue } from "./draw";
import type { BattleState, CombatTextEvent } from "./types";
import { getBattleRng, pickRandom } from "@/lib/rng";
import { WISH_CHOICE_COUNT } from "../game-constants";
import { appendUniqueMany } from "@/lib/utils";

export function upgradeWishCard(card: BattleCard): BattleCard {
  // Widen upper bounds before raising lower bounds: intermediate cards must
  // remain valid even when an authored random range starts with equal bounds.
  const targets = getEditableCorruptionTargets(card).toSorted(
    (a, b) => Number(b.field === "maxAmount") - Number(a.field === "maxAmount"),
  );
  return targets.reduce((next, target) => {
    const effect = getCorruptionTargetEffect(next, target);
    // An upgrade must not raise a cost, including a shared Deal/Receive amount.
    if (!effect || target.affectsCost) return next;
    return updateCardNumericValue(next, target, target.value + 1);
  }, card);
}

export function buildWishOptions(
  state: BattleState,
  card: Pick<BattleCard, "id"> | undefined,
  companionOnly = false,
): BattleCard[] {
  const baseCount =
    WISH_CHOICE_COUNT +
    (hasEncounterBenefit(state, "wishful") && !state.flags.encounterWishUsed ? 1 : 0) +
    (rollBattleChance(state.talentEffects.wishExtraChoiceChance, state) ? 1 : 0);

  const candidates = getOfferableCardPool().filter(
    (candidate) => candidate.id !== card?.id && (!companionOnly || isCompanionSummonCard(candidate)),
  );
  const fullDeck = [...state.deck, ...state.hand, ...state.pendingHandCards, ...state.discard, ...state.exhausted];
  const discovered = new Set(state.discoveredCardIds);
  const battleRng = getBattleRng(state);
  const undiscovered = state.talentEffects.wishUndiscoveredCards
    ? candidates.filter((candidate) => !discovered.has(candidate.id))
    : [];
  const guaranteed = undiscovered.length > 0 ? selectRewardCards(fullDeck, undiscovered, 1, [], battleRng) : [];
  const selected = [
    ...guaranteed,
    // Selection cannot offer more cards than the eligible pool.
    ...selectRewardCards(
      fullDeck,
      candidates,
      Math.min(baseCount, candidates.length) - guaranteed.length,
      guaranteed,
      battleRng,
    ),
  ];

  if (state.talentEffects.wishCardsUpgraded) {
    return selected.map((c) => upgradeWishCard(c));
  }
  return selected;
}

export function applyWishEffect(
  state: BattleState,
  card: Pick<BattleCard, "id"> | undefined,
  amount: number,
  combatTexts: CombatTextEvent[],
  reactions: ReactionBoundary = { kind: "enclosing-action" },
  companionOnly = false,
) {
  const wishCount = Math.max(0, Math.round(amount));
  if (wishCount <= 0) return state;

  const nextWishOptions: BattleCard[][] = [];
  for (let index = 0; index < wishCount; index += 1) {
    const sample = () => buildWishOptions(state, card, companionOnly);
    const options = state.sampleWishOptions?.(sample) ?? { cards: sample(), deferred: false };
    // During hypothetical resolution the offer remains pending without picking
    // card identities. Immediate Wish rewards still use their production order.
    if (options.deferred || options.cards.length > 0) nextWishOptions.push(options.cards);
    if (hasEncounterBenefit(state, "wishful")) state = { ...state, flags: { ...state.flags, encounterWishUsed: true } };
  }
  const queuedOptions = nextWishOptions;
  const nextState: BattleState =
    state.wishOptions || queuedOptions.length === 0
      ? { ...state, wishQueue: [...state.wishQueue, ...queuedOptions] }
      : {
          ...state,
          wishOptions: queuedOptions[0] ?? [],
          wishQueue: [...state.wishQueue, ...queuedOptions.slice(1)],
        };

  return resolveWishRewards(nextState, wishCount, combatTexts, reactions);
}

/**
 * Empty draw piles are a player-facing emergency, not a new card source.
 * Reuse the normal Wish pipeline so existing rewards and random offer rules
 * apply consistently; an absent source leaves every real card eligible.
 */
export function applyEmergencyWish(state: BattleState, combatTexts: CombatTextEvent[] = []) {
  return applyWishEffect(state, undefined, 1, combatTexts, { kind: "enclosing-action" });
}

export function applyEmergencyWishForEmptyDraw(state: BattleState, amount: number, combatTexts: CombatTextEvent[]) {
  return amount > 0 &&
    state.turnPhase === "player" &&
    getBattleOutcome(state) === null &&
    !state.wishOptions &&
    state.hand.length === 0 &&
    state.pendingHandCards.length === 0 &&
    state.deck.length === 0 &&
    state.discard.length === 0
    ? applyEmergencyWish(state, combatTexts)
    : state;
}

export function chooseWishCard(state: BattleState, cardId: string) {
  const [nextWishOptions = null, ...wishQueue] = state.wishQueue;

  const chosenCard = state.wishOptions?.find((card) => card.id === cardId);
  if (!chosenCard) {
    return state;
  }

  const declinedCards = (state.wishOptions ?? []).filter((card) => card.id !== chosenCard.id);
  let nextState = addCardToHandOrQueue({ ...state, wishOptions: nextWishOptions, wishQueue }, chosenCard);
  const acquiredIds = [chosenCard.id];
  if (declinedCards.length > 0 && rollBattleChance(nextState.talentEffects.declinedWishCardChance, nextState)) {
    const bonusCard = pickRandom(declinedCards, getBattleRng(nextState));
    if (bonusCard) {
      nextState = addCardToHandOrQueue(nextState, bonusCard);
      acquiredIds.push(bonusCard.id);
    }
  }
  return { ...nextState, discoveredCardIds: appendUniqueMany(nextState.discoveredCardIds, acquiredIds) };
}
