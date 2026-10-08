import { repairShopOfferings } from "@/lib/active-run-session/shop-offering-repair";
import type { BattleSnapshot } from "@/lib/battle";
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
import type { ValidatedActiveRunData } from "./save-schemas/active-run";
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
  const visit = data.activity.kind === "mystery" ? data.activity.data : null;
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

  let activity = data.activity;
  if (activity.kind === "battle")
    activity = { ...activity, data: { battleState: filterLiveBattleState(activity.data.battleState) } };
  if (activity.kind === "shop") {
    const repaired = repairShopOfferings(activity.data.cards, activity.data.purchasedSlotKeys, isRecoverableCard);
    activity = {
      ...activity,
      data: { ...activity.data, cards: repaired.items, purchasedSlotKeys: repaired.purchasedSlotKeys },
    };
  }
  if (activity.kind === "alchemist") {
    const repaired = repairShopOfferings(activity.data.potions, activity.data.purchasedSlotKeys, isRecoverableCard);
    activity = {
      ...activity,
      data: { ...activity.data, potions: repaired.items, purchasedSlotKeys: repaired.purchasedSlotKeys },
    };
  }
  if (activity.kind === "mystery" && mysteryVisit) activity = { ...activity, data: mysteryVisit };
  if (
    activity.kind === "corruption" &&
    activity.data &&
    (!isRecoverableCard(activity.data.originalCard) || !isRecoverableCard(activity.data.corruptedCard))
  )
    activity = { ...activity, data: null };

  return {
    ...data,
    rng: rngCountersChanged ? rngState : data.rng,
    runPlayerHealth: Math.min(data.runPlayerHealth, data.runMaxHealth),
    runMetaMaxHealth: data.runMetaMaxHealth > 0 ? data.runMetaMaxHealth : data.runMaxHealth,
    runDeck,
    labyrinthMap: data.contentSystemType === "labyrinth" ? data.labyrinthMap : null,
    labyrinthPendingNode: data.contentSystemType === "labyrinth" ? data.labyrinthPendingNode : null,
    activeLabyrinthModifiers: data.contentSystemType === "labyrinth" ? data.activeLabyrinthModifiers : [],
    activeLabyrinthRewardModifiers: data.contentSystemType === "labyrinth" ? data.activeLabyrinthRewardModifiers : [],
    wildwoodDraft,
    starterDraftChoices,
    activity,
  };
}
