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
import type {
  ActiveCombatData,
  MysteryVisitState,
  ValidatedActiveRunData,
  WildwoodDraftState,
} from "./save-schemas/active-run";
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

function repairCardChoices(
  choices: PersistedBattleCard[],
  args: {
    canPick: boolean;
    runDeck: BattleCard[];
    rngState: RunRngState;
    stream: RunRngStream;
    count: number;
    seedKeywords: KeywordId[];
    alreadyOwned?: BattleCard[];
  },
): PersistedBattleCard[] {
  const filtered = filterLiveCards(choices);
  if (filtered.length > 0 || !args.canPick) return filtered;
  const repaired = selectRewardCards(
    args.runDeck,
    getOfferableCardPool(),
    args.count,
    args.alreadyOwned ?? args.runDeck,
    createRunStateRng(args.rngState, args.stream),
    args.seedKeywords,
  ).map(cloneBattleCard);
  return repaired;
}

function repairWildwoodDraft(
  data: ValidatedActiveRunData,
  runDeck: BattleCard[],
  rngState: RunRngState,
): WildwoodDraftState | null {
  if (data.contentSystemType !== "wildwood") return null;
  const draft = data.wildwoodDraft;
  if (!draft) return null;
  return {
    ...draft,
    draftChoices: repairCardChoices(draft.draftChoices, {
      canPick: draft.phase === "draft" && runDeck.length < DRAFT_ROUNDS,
      runDeck,
      rngState,
      stream: "world",
      count: DRAFT_CHOICES,
      seedKeywords: characters[data.characterId].keywords,
    }),
  };
}

function repairStarterDraft(
  data: ValidatedActiveRunData,
  runDeck: BattleCard[],
  rngState: RunRngState,
): PersistedBattleCard[] | null {
  if (data.contentSystemType === "wildwood") return null;
  if (!data.starterDraftChoices) return null;
  return repairCardChoices(data.starterDraftChoices, {
    canPick: runDeck.length < DRAFT_ROUNDS,
    runDeck,
    rngState,
    stream: "rewards",
    count: DRAFT_CHOICES,
    seedKeywords: [],
  });
}

function repairMysteryVisit(
  data: ValidatedActiveRunData,
  runDeck: BattleCard[],
  rngState: RunRngState,
): MysteryVisitState | null {
  if (data.currentScreen != null && data.currentScreen !== "mystery") return null;
  const visit = data.mysteryVisit;
  if (!visit) return null;
  if (!visit.cardChoices) return { ...visit, cardChoices: null };
  return {
    ...visit,
    cardChoices: repairCardChoices(visit.cardChoices, {
      canPick: visit.chosenCardId == null,
      runDeck,
      rngState,
      stream: "events",
      count: MYSTERY_CARD_CHOICES,
      seedKeywords: [],
      alreadyOwned: [],
    }),
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
  const wildwoodDraft = repairWildwoodDraft(data, runDeck, rngState);
  const starterDraftChoices = repairStarterDraft(data, runDeck, rngState);
  const mysteryVisit = repairMysteryVisit(data, runDeck, rngState);
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
