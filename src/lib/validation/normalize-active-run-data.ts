import { repairShopOfferings, shopItemSlotKey } from "@/lib/active-run-session/shop-offering-repair";
import type { BattleSnapshot } from "@/lib/battle";
import type { ContentSystemId } from "@/lib/content-systems/types";
import { DRAFT_CHOICES, DRAFT_ROUNDS, MYSTERY_CARD_CHOICES } from "@/lib/game-constants";
import { cardById, characters, selectRewardCards, type BattleCard, type KeywordId } from "@/lib/game-data";
import { getOfferableCardPool } from "@/lib/game-data/cards/card-pools";
import { stepRunRng, type RunRngState, type RunRngStream } from "@/lib/rng";
import type {
  ActiveCombatData,
  AlchemistState,
  MysteryVisitState,
  ShopState,
  ValidatedActiveRunData,
  WildwoodDraftState,
} from "./save-schemas/active-run";
import type { PersistedBattleCard } from "./save-schemas/battle-card-schemas";

function isLiveCardId(id: string): boolean {
  return cardById[id] !== undefined;
}

// Deliberate removals are recorded in TOMBSTONED_CARD_IDS for explicit
// fixtures; load drops every non-live id identically via this single check.
function filterLiveCards<T extends { id: string }>(cards: T[]): T[] {
  return cards.filter((card) => isLiveCardId(card.id));
}

function filterLiveBattleState(state: BattleSnapshot): BattleSnapshot {
  const wishOptions = state.wishOptions ? filterLiveCards(state.wishOptions) : null;
  const wishQueue = state.wishQueue.map((queue) => filterLiveCards(queue)).filter((queue) => queue.length > 0);
  // An empty Wish prompt blocks card play. Advance to the next valid queued
  // choice after malformed or removed cards are dropped, or close the prompt.
  const [nextWishOptions, ...remainingWishQueue] = wishOptions?.length ? [] : wishQueue;
  return {
    ...state,
    deck: filterLiveCards(state.deck),
    hand: filterLiveCards(state.hand),
    pendingHandCards: filterLiveCards(state.pendingHandCards),
    discard: filterLiveCards(state.discard),
    exhausted: filterLiveCards(state.exhausted),
    wishOptions: wishOptions?.length ? wishOptions : (nextWishOptions ?? null),
    wishQueue: wishOptions?.length ? wishQueue : remainingWishQueue,
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

function normalizeShopState(state: ShopState | null): ShopState | null {
  if (!state) return null;
  const repaired = repairShopOfferings(
    state.cards,
    state.purchasedSlotKeys,
    (card) => isLiveCardId(card.id),
    (card, index) => shopItemSlotKey(card.id, index),
  );
  return { ...state, cards: repaired.items, purchasedSlotKeys: repaired.purchasedSlotKeys };
}

function normalizeAlchemistState(state: AlchemistState | null): AlchemistState | null {
  if (!state) return null;
  const repaired = repairShopOfferings(
    state.potions,
    state.purchasedSlotKeys,
    (potion) => isLiveCardId(potion.id),
    (potion, index) => shopItemSlotKey(potion.id, index),
  );
  return { ...state, potions: repaired.items, purchasedSlotKeys: repaired.purchasedSlotKeys };
}

function toPersistedCard(card: BattleCard): PersistedBattleCard {
  const base: PersistedBattleCard = {
    id: card.id,
    title: card.title,
    descriptionLines: card.descriptionLines,
    art: card.art,
    cost: card.cost,
    effects: card.effects,
  };
  if (card.uid !== undefined) base.uid = card.uid;
  if (card.consume !== undefined) base.consume = card.consume;
  if (card.corrupted) base.corrupted = true;
  if (card.baseTitle) base.baseTitle = card.baseTitle;
  if (card.corruptedValuePositions) base.corruptedValuePositions = card.corruptedValuePositions;
  return base;
}

function createRepairRng(rngState: RunRngState, stream: RunRngStream): () => number {
  return () => stepRunRng(rngState, stream);
}

function repairEmptyCardChoices(
  rngState: RunRngState,
  stream: RunRngStream,
  count: number,
  deckForAffinity: BattleCard[],
  seedKeywords: KeywordId[],
  alreadyOwned: BattleCard[] = deckForAffinity,
): PersistedBattleCard[] | null {
  const repaired = selectRewardCards(
    deckForAffinity,
    getOfferableCardPool(),
    count,
    alreadyOwned,
    createRepairRng(rngState, stream),
    seedKeywords,
  ).map(toPersistedCard);
  return repaired.length > 0 ? repaired : null;
}

function reDealEmptiedChoices(
  choices: PersistedBattleCard[],
  args: {
    awaitPick: boolean;
    checkDeckSize: boolean;
    runDeck: BattleCard[];
    rngState: RunRngState | null;
    stream: RunRngStream;
    count: number;
    seedKeywords: KeywordId[];
    alreadyOwned?: BattleCard[];
  },
): PersistedBattleCard[] {
  const filtered = filterLiveCards(choices);
  if (
    filtered.length > 0 ||
    !args.awaitPick ||
    (args.checkDeckSize && args.runDeck.length >= DRAFT_ROUNDS) ||
    !args.rngState
  ) {
    return filtered;
  }
  return (
    repairEmptyCardChoices(
      args.rngState,
      args.stream,
      args.count,
      args.runDeck,
      args.seedKeywords,
      args.alreadyOwned,
    ) ?? filtered
  );
}

function repairWildwoodDraft(
  data: ValidatedActiveRunData,
  runDeck: BattleCard[],
  rngState: RunRngState | null,
): WildwoodDraftState | null {
  if (data.contentSystemType !== "wildwood") return null;
  const draft = data.wildwoodDraft;
  if (!draft) return null;
  return {
    ...draft,
    draftChoices: reDealEmptiedChoices(draft.draftChoices, {
      awaitPick: draft.phase === "draft",
      checkDeckSize: true,
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
  rngState: RunRngState | null,
): PersistedBattleCard[] | null {
  if (data.contentSystemType === "wildwood") return null;
  if (!data.starterDraftChoices) return null;
  return reDealEmptiedChoices(data.starterDraftChoices, {
    awaitPick: true,
    checkDeckSize: true,
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
  rngState: RunRngState | null,
): MysteryVisitState | null {
  if (data.currentScreen != null && data.currentScreen !== "mystery") return null;
  const visit = data.mysteryVisit;
  if (!visit) return null;
  if (!visit.cardChoices) return { ...visit, cardChoices: null };
  return {
    ...visit,
    cardChoices: reDealEmptiedChoices(visit.cardChoices, {
      awaitPick: visit.chosenCardId == null,
      checkDeckSize: false,
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
  if (!isLiveCardId(result.originalCard.id) || !isLiveCardId(result.corruptedCard.id)) return null;
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
    shopState: normalizeShopState(data.shopState),
    alchemistState: normalizeAlchemistState(data.alchemistState),
    corruptionResult: normalizeCorruptionResult(data.corruptionResult),
    mysteryVisit,
  };
}
