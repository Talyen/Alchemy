import { createStarterDraftChoices } from "../starter-draft";
import { createAlchemistBrewOffers, createCampfirePotionOffers } from "@/lib/alchemist/brewing";
import { DRAFT_CHOICES, DRAFT_ROUNDS, MYSTERY_CARD_CHOICES } from "@/lib/game-constants";
import {
  cardHasKeyword,
  characters,
  cloneBattleCard,
  getOfferableCardPool,
  isStandardPotionCard,
  selectRewardCards,
  type BattleCard,
  type KeywordId,
} from "@/lib/game-data";
import { createRunStateRng, type RunRngState, type RunRngStream } from "@/lib/rng";
import { filterLiveCards, isRecoverableCard } from "./normalize-persisted-battle-state";
import type { ValidatedActiveRunData } from "./save-schemas/active-run";
import type { PersistedBattleCard } from "./save-schemas/battle-card-schemas";

type WildwoodPhase = "draft" | "battle" | "reward" | "removal";

/** The saved activity is the player's resume screen; Wildwood phase must agree with it. */
function wildwoodPhaseForActivity(kind: ValidatedActiveRunData["activity"]["kind"]): WildwoodPhase | null {
  if (kind === "draft-deck") return "draft";
  if (kind === "battle") return "battle";
  if (kind === "rewards") return "reward";
  if (kind === "wildwood-removal") return "removal";
  return null;
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
  const wildwoodPhase = wildwood ? wildwoodPhaseForActivity(data.activity.kind) : null;
  const phase = wildwoodPhase ?? wildwood?.phase;
  const wildwoodDraft = wildwood && {
    ...wildwood,
    ...(wildwoodPhase
      ? {
          phase: wildwoodPhase,
          currentCombatTraitIds: wildwoodPhase === "battle" ? wildwood.currentCombatTraitIds : [],
          currentRewardTraitIds:
            wildwoodPhase === "battle" || wildwoodPhase === "reward" ? wildwood.currentRewardTraitIds : [],
        }
      : {}),
    draftChoices: repairChoices(wildwood.draftChoices, {
      canPick: phase === "draft" && drafting,
      stream: "world",
      seedKeywords: characters[data.characterId].keywords,
    }),
  };
  const starterDraftChoices =
    data.contentSystemType !== "wildwood" && data.starterDraftChoices
      ? (() => {
          const choices = filterLiveCards(data.starterDraftChoices);
          return choices.length > 0 || !drafting
            ? choices
            : createStarterDraftChoices(runDeck, createRunStateRng(rngState, "rewards")).map(cloneBattleCard);
        })()
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
            ...(cardChoice?.tag ? { keyword: cardChoice.tag } : {}),
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
  if (activity.kind === "alchemist") {
    const brewOffers = activity.data.brewOffers.filter((card) => isRecoverableCard(card) && isStandardPotionCard(card));
    activity = {
      ...activity,
      data: {
        ...activity.data,
        brewOffers:
          brewOffers.length > 0 || activity.data.brewUsed
            ? brewOffers
            : createAlchemistBrewOffers(
                createRunStateRng(rngState, "shops"),
                data.contentSystemType === "labyrinth" ? data.activeLabyrinthRewardModifiers : [],
              ),
      },
    };
  }
  if (activity.kind === "mystery" && mysteryVisit) activity = { ...activity, data: mysteryVisit };
  if (activity.kind === "campfire" && !activity.data.completed) {
    const offers = activity.data.offers.filter((card) => isRecoverableCard(card) && isStandardPotionCard(card));
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
    // A saved active run at 0 Health is corruption, not defeat: defeat tears
    // the run down, so resume repair keeps the run alive at full Health.
    runPlayerHealth: data.runPlayerHealth > 0 ? Math.min(data.runPlayerHealth, data.runMaxHealth) : data.runMaxHealth,
    runMetaMaxHealth: data.runMetaMaxHealth > 0 ? data.runMetaMaxHealth : data.runMaxHealth,
    runDeck,
    labyrinthMap: data.contentSystemType === "labyrinth" ? data.labyrinthMap : null,
    // A pending lock for a removed room cannot be entered: clear it so the
    // map does not stay blocked. The map-screen case already clears above.
    labyrinthPendingNode:
      data.contentSystemType === "labyrinth" &&
      activity.kind !== "labyrinth-map" &&
      data.labyrinthPendingNode !== null &&
      data.labyrinthMap !== null &&
      Object.hasOwn(data.labyrinthMap.nodes, data.labyrinthPendingNode)
        ? data.labyrinthPendingNode
        : null,
    activeLabyrinthModifiers: data.contentSystemType === "labyrinth" ? data.activeLabyrinthModifiers : [],
    activeLabyrinthRewardModifiers: data.contentSystemType === "labyrinth" ? data.activeLabyrinthRewardModifiers : [],
    wildwoodDraft,
    starterDraftChoices,
    activity,
  };
}
