import { repairShopOfferings } from "@/lib/active-run-session/shop-offering-repair";
import type { BattleSnapshot } from "@/lib/battle";
import type { ContentSystemId } from "@/lib/content-systems/types";
import { DRAFT_CHOICES, DRAFT_ROUNDS, MYSTERY_CARD_CHOICES } from "@/lib/game-constants";
import {
  cardById,
  characters,
  cloneBattleCard,
  isMixedPotionCard,
  selectRewardCards,
  type BattleCard,
  type KeywordId,
} from "@/lib/game-data";
import { getOfferableCardPool } from "@/lib/game-data/cards/card-pools";
import { createRunStateRng, type RunRngState, type RunRngStream } from "@/lib/rng";
import type { ActiveCombatData, ValidatedActiveRunData } from "./save-schemas/active-run";
import type { PersistedBattleCard } from "./save-schemas/battle-card-schemas";

// Deliberate removals are recorded in TOMBSTONED_CARD_IDS for explicit
// fixtures; load drops every non-live id identically via this single check.
function isRecoverableCard(card: Pick<BattleCard, "id" | "cost" | "effects" | "descriptionLines">): boolean {
  if (Object.hasOwn(cardById, card.id)) return true;
  return (
    isMixedPotionCard(card) &&
    Number.isInteger(card.cost) &&
    card.cost >= 0 &&
    card.effects.length > 0 &&
    card.descriptionLines.length > 0
  );
}

function filterLiveCards<T extends Pick<BattleCard, "id" | "cost" | "effects" | "descriptionLines">>(cards: T[]): T[] {
  return cards.filter(isRecoverableCard);
}

function filterLiveBattleState(state: BattleSnapshot): BattleSnapshot {
  let wishOptions = state.wishOptions ? filterLiveCards(state.wishOptions) : null;
  const wishQueue = state.wishQueue.map((queue) => filterLiveCards(queue)).filter((queue) => queue.length > 0);
  // An empty Wish prompt blocks card play. Advance to the next valid queued
  // choice after malformed or removed cards are dropped, or close the prompt.
  if (!wishOptions?.length) wishOptions = wishQueue.shift() ?? null;
  return {
    ...state,
    deck: filterLiveCards(state.deck),
    hand: filterLiveCards(state.hand),
    pendingHandCards: filterLiveCards(state.pendingHandCards),
    discard: filterLiveCards(state.discard),
    exhausted: filterLiveCards(state.exhausted),
    wishOptions,
    wishQueue,
  };
}

function normalizeActiveCombat(combat: ActiveCombatData, contentSystemType: ContentSystemId): ActiveCombatData {
  const isLabyrinth = contentSystemType === "labyrinth";
  return {
    ...combat,
    activeLabyrinthModifiers: isLabyrinth ? combat.activeLabyrinthModifiers : [],
    activeLabyrinthRewardModifiers: isLabyrinth ? combat.activeLabyrinthRewardModifiers : [],
    battleState: filterLiveBattleState(combat.battleState),
    pendingBattleTransition: filterLiveTransition(combat.pendingBattleTransition),
  };
}

function filterLiveTransition(transition: ActiveCombatData["pendingBattleTransition"]) {
  if (!transition || (transition.kind !== "enemy-turn" && transition.kind !== "opening-draw")) return transition;
  return { ...transition, resultState: filterLiveBattleState(transition.resultState) };
}

function normalizeLabyrinthModifiers(
  data: ValidatedActiveRunData,
): Pick<ValidatedActiveRunData, "activeLabyrinthModifiers" | "activeLabyrinthRewardModifiers"> {
  if (data.contentSystemType !== "labyrinth") {
    return { activeLabyrinthModifiers: [], activeLabyrinthRewardModifiers: [] };
  }
  return {
    activeLabyrinthModifiers:
      data.activeLabyrinthModifiers.length > 0
        ? data.activeLabyrinthModifiers
        : (data.activeCombat?.activeLabyrinthModifiers ?? []),
    activeLabyrinthRewardModifiers:
      data.activeLabyrinthRewardModifiers.length > 0
        ? data.activeLabyrinthRewardModifiers
        : (data.activeCombat?.activeLabyrinthRewardModifiers ?? []),
  };
}

function normalizeCorruptionResult(
  result: ValidatedActiveRunData["corruptionResult"],
): ValidatedActiveRunData["corruptionResult"] {
  if (!result) return result;
  if (!isRecoverableCard(result.originalCard) || !isRecoverableCard(result.corruptedCard)) return null;
  return result;
}

export function normalizeActiveRunData(data: ValidatedActiveRunData): ValidatedActiveRunData {
  const runDeck = filterLiveCards(data.runDeck);
  const rngState: RunRngState = { seed: data.rng.seed, counters: { ...data.rng.counters } };
  function repairChoices(
    choices: PersistedBattleCard[],
    {
      canPick,
      stream,
      seedKeywords = [],
      alreadyOwned = runDeck,
      count = DRAFT_CHOICES,
    }: {
      canPick: boolean;
      stream: RunRngStream;
      seedKeywords?: KeywordId[];
      alreadyOwned?: BattleCard[];
      count?: number;
    },
  ): PersistedBattleCard[] {
    const filtered = filterLiveCards(choices);
    if (filtered.length > 0 || !canPick) return filtered;
    return selectRewardCards(
      runDeck,
      getOfferableCardPool(),
      count,
      alreadyOwned,
      createRunStateRng(rngState, stream),
      seedKeywords,
    ).map(cloneBattleCard);
  }

  const drafting = runDeck.length < DRAFT_ROUNDS;
  const wildwood = data.contentSystemType === "wildwood" ? data.wildwoodDraft : null;
  const wildwoodDraft = wildwood && {
    ...wildwood,
    draftChoices: repairChoices(wildwood.draftChoices, {
      canPick: wildwood.phase === "draft" && drafting,
      stream: "world",
      seedKeywords: characters[data.characterId].keywords,
    }),
  };
  const starterDraftChoices =
    data.contentSystemType !== "wildwood" && data.starterDraftChoices
      ? repairChoices(data.starterDraftChoices, { canPick: drafting, stream: "rewards" })
      : null;
  const visit = data.currentScreen == null || data.currentScreen === "mystery" ? data.mysteryVisit : null;
  const mysteryVisit = visit && {
    ...visit,
    cardChoices: visit.cardChoices
      ? repairChoices(visit.cardChoices, {
          canPick: visit.chosenCardId == null,
          stream: "events",
          alreadyOwned: [],
          count: MYSTERY_CARD_CHOICES,
        })
      : null,
  };
  const rngCountersChanged = (Object.keys(rngState.counters) as RunRngStream[]).some(
    (stream) => rngState.counters[stream] !== data.rng.counters[stream],
  );

  const shop =
    data.shopState && repairShopOfferings(data.shopState.cards, data.shopState.purchasedSlotKeys, isRecoverableCard);
  const alchemist =
    data.alchemistState &&
    repairShopOfferings(data.alchemistState.potions, data.alchemistState.purchasedSlotKeys, isRecoverableCard);

  return {
    ...data,
    rng: rngCountersChanged ? rngState : data.rng,
    runPlayerHealth: Math.min(data.runPlayerHealth, data.runMaxHealth),
    runMetaMaxHealth: data.runMetaMaxHealth > 0 ? data.runMetaMaxHealth : data.runMaxHealth,
    runDeck,
    labyrinthMap: data.contentSystemType === "labyrinth" ? data.labyrinthMap : null,
    labyrinthPendingNode: data.contentSystemType === "labyrinth" ? data.labyrinthPendingNode : null,
    ...normalizeLabyrinthModifiers(data),
    wildwoodDraft,
    starterDraftChoices,
    activeCombat: data.activeCombat ? normalizeActiveCombat(data.activeCombat, data.contentSystemType) : null,
    shopState:
      data.shopState && shop
        ? { ...data.shopState, cards: shop.items, purchasedSlotKeys: shop.purchasedSlotKeys }
        : null,
    alchemistState:
      data.alchemistState && alchemist
        ? { ...data.alchemistState, potions: alchemist.items, purchasedSlotKeys: alchemist.purchasedSlotKeys }
        : null,
    corruptionResult: normalizeCorruptionResult(data.corruptionResult),
    mysteryVisit,
  };
}
