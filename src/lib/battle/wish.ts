import { getBattleOutcome } from "./battle-outcome";
import { applyDamageStatuses } from "./damage-status-riders";
import { rollBattleChance } from "./chance-roll";
import type { ReactionBoundary } from "./battle-sequence";
import { resolveWishRewards, type WishRewardPort } from "./wish-rewards";
import { resolveFollowUpHit } from "./follow-up-hit-resolution";
import { hasEncounterBenefit } from "./encounter-trait-state";
import { selectRewardCards } from "@/lib/game-data";
import { getOfferableCardPool } from "@/lib/game-data/cards/card-pools";
import type { BattleCard } from "@/lib/game-data";
import { getEditableCorruptionTargets, updateCardNumericValue } from "@/lib/corruption";
import { getCorruptionTargetEffect } from "@/lib/corruption/numeric";
import { addCardToHandOrQueue, applyDrawResult, drawFromState } from "./draw";
import type { BattleState, CombatTextEvent } from "./types";
import {
  addGoldWithCombatText,
  applyHealingWithCombatText,
  applyHitEpilogue,
  gainManaWithCombatText,
} from "./player-rewards";
import {
  removeHarmfulPlayerStatuses,
  applyPlayerStatusEffect,
  applyArmorReward,
  applyBlockReward,
} from "./status-player";
import { getEnemyDamageMultiplier } from "./status-helpers";
import { getBattleRng, pickRandom } from "@/lib/rng";
import { WISH_CHOICE_COUNT } from "../game-constants";
import { dealEnemyScaledDamage, gearFrozenDamageMultiplier } from "./scaled-damage";
import { appendUniqueMany } from "@/lib/utils";

export function upgradeWishCard(card: BattleCard): BattleCard {
  return getEditableCorruptionTargets(card).reduce((next, target) => {
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
    (candidate) =>
      candidate.id !== card?.id &&
      (!companionOnly || candidate.effects.some((effect) => effect.kind === "summon-companion")),
  );
  const fullDeck = [...state.deck, ...state.hand, ...state.pendingHandCards, ...state.discard, ...state.exhausted];
  const undiscovered = state.talentEffects.wishUndiscoveredCards
    ? candidates.filter((candidate) => !state.discoveredCardIds.includes(candidate.id))
    : [];
  const guaranteed =
    undiscovered.length > 0 ? selectRewardCards(fullDeck, undiscovered, 1, [], getBattleRng(state)) : [];
  const selected = [
    ...guaranteed,
    // Selection cannot offer more cards than the eligible pool.
    ...selectRewardCards(
      fullDeck,
      candidates,
      Math.min(baseCount, candidates.length) - guaranteed.length,
      guaranteed,
      getBattleRng(state),
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
    nextWishOptions.push(buildWishOptions(state, card, companionOnly));
    if (hasEncounterBenefit(state, "wishful")) state = { ...state, flags: { ...state.flags, encounterWishUsed: true } };
  }
  const queuedOptions = nextWishOptions.filter((options) => options.length > 0);
  const nextState: BattleState =
    state.wishOptions || queuedOptions.length === 0
      ? { ...state, wishQueue: [...state.wishQueue, ...queuedOptions] }
      : {
          ...state,
          wishOptions: queuedOptions[0] ?? [],
          wishQueue: [...state.wishQueue, ...queuedOptions.slice(1)],
        };

  return resolveWishRewards(nextState, wishCount, combatTexts, wishRewardPort, reactions);
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

const wishRewardPort: WishRewardPort = {
  chance: (chance, state) => rollBattleChance(chance, state),
  gold: addGoldWithCombatText,
  heal: applyHealingWithCombatText,
  cleanse: removeHarmfulPlayerStatuses,
  block: applyBlockReward,
  mana: (state, amount, texts) => gainManaWithCombatText(state, amount, texts, { skipFightPacing: true }),
  draw: (state, amount, texts) => applyDrawResult(state, drawFromState(state, amount), texts),
  forge: (state, amount, texts) =>
    applyPlayerStatusEffect(state, { kind: "player-status", status: "forge", amount }, texts),
  armor: applyArmorReward,
  hit: resolveFollowUpHit,
  burningEnemyHit: (state, amount, texts) =>
    dealEnemyScaledDamage(state, amount, "burn", texts, {
      multiplier: getEnemyDamageMultiplier(state, "burn") * gearFrozenDamageMultiplier(state),
      riders: (damagedState, damage, events) =>
        applyHitEpilogue(
          applyDamageStatuses(
            damagedState,
            { kind: "damage", damageType: "burn", amount },
            damage,
            events,
            state.enemyHealth,
          ),
          state.enemyHealth,
          state.enemyHealth > 0,
          events,
          undefined,
          state.playerStatuses.forge >= 5,
        ),
    }),
};

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
