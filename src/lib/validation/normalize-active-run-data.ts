import { repairShopOfferings } from "@/lib/active-run-session/shop-offering-repair";
import { createCampfirePotionOffers } from "@/lib/alchemist/brewing";
import { DRAFT_CHOICES, DRAFT_ROUNDS, MYSTERY_CARD_CHOICES } from "@/lib/game-constants";
import {
  cardHasKeyword,
  characters,
  cloneBattleCard,
  selectRewardCards,
  type BattleCard,
  type KeywordId,
} from "@/lib/game-data";
import { getOfferableCardPool, isStandardPotionCard } from "@/lib/game-data/cards/card-pools";
import { createRunStateRng, type RunRngState, type RunRngStream } from "@/lib/rng";
import { filterLiveCards, isRecoverableCard } from "./normalize-persisted-battle-state";
import type { ValidatedActiveRunData } from "./save-schemas/active-run";
import type { PersistedBattleCard } from "./save-schemas/battle-card-schemas";

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
      keyword,
    }: {
      canPick: boolean;
      stream: RunRngStream;
      seedKeywords?: KeywordId[];
      alreadyOwned?: BattleCard[];
      count?: number;
      keyword?: KeywordId;
    },
  ): PersistedBattleCard[] {
    const filtered = filterLiveCards(choices);
    if (filtered.length > 0 || !canPick) return filtered;
    const pool = getOfferableCardPool();
    const tagged = keyword ? pool.filter((card) => cardHasKeyword(card, keyword)) : [];
    return selectRewardCards(
      runDeck,
      tagged.length > 0 ? tagged : pool,
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
  const cardChoice = visit?.chosenChoice?.effects.find((effect) => effect.kind === "chooseCard");
  const mysteryVisit = visit && {
    ...visit,
    cardChoices:
      visit.chosenCardId == null && (visit.cardChoices !== null || cardChoice)
        ? repairChoices(visit.cardChoices ?? [], {
            canPick: visit.chosenCardId == null,
            stream: "events",
            alreadyOwned: [],
            count: MYSTERY_CARD_CHOICES,
            ...(cardChoice?.tag ? { keyword: cardChoice.tag as KeywordId } : {}),
          })
        : null,
  };
  let activity = data.activity;
  if (activity.kind === "battle")
    activity = {
      ...activity,
      data: {
        battleState: {
          ...activity.data.battleState,
          contentSystemType: data.contentSystemType,
          encounterBenefits: data.contentSystemType === "labyrinth" ? activity.data.battleState.encounterBenefits : [],
        },
      },
    };
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
  if (activity.kind === "campfire" && !activity.data.completed) {
    const offers = filterLiveCards(activity.data.offers).filter(isStandardPotionCard);
    activity = {
      ...activity,
      data: {
        ...activity.data,
        offers: offers.length ? offers : createCampfirePotionOffers(createRunStateRng(rngState, "events")),
      },
    };
  }
  if (
    activity.kind === "corruption" &&
    activity.data &&
    (!isRecoverableCard(activity.data.originalCard) || !isRecoverableCard(activity.data.corruptedCard))
  )
    activity = { ...activity, data: null };

  const rngCountersChanged = (Object.keys(rngState.counters) as RunRngStream[]).some(
    (stream) => rngState.counters[stream] !== data.rng.counters[stream],
  );
  return {
    ...data,
    rng: rngCountersChanged ? rngState : data.rng,
    runPlayerHealth: Math.min(data.runPlayerHealth, data.runMaxHealth),
    runMetaMaxHealth: data.runMetaMaxHealth > 0 ? data.runMetaMaxHealth : data.runMaxHealth,
    runDeck,
    labyrinthMap: data.contentSystemType === "labyrinth" ? data.labyrinthMap : null,
    labyrinthPendingNode:
      data.contentSystemType === "labyrinth" && activity.kind !== "labyrinth-map" ? data.labyrinthPendingNode : null,
    activeLabyrinthModifiers: data.contentSystemType === "labyrinth" ? data.activeLabyrinthModifiers : [],
    activeLabyrinthRewardModifiers: data.contentSystemType === "labyrinth" ? data.activeLabyrinthRewardModifiers : [],
    wildwoodDraft,
    starterDraftChoices,
    activity,
  };
}
