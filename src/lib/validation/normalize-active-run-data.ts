import { repairShopOfferings, shopItemSlotKey } from "@/lib/active-run-session/shop-offering-repair";
import type { BattleState } from "@/lib/battle";
import type { ContentSystemId } from "@/lib/content-systems/types";
import { DRAFT_CHOICES, DRAFT_ROUNDS, MYSTERY_CARD_CHOICES } from "@/lib/game-constants";
import { cardById, characters, selectRewardCards, type BattleCard, type KeywordId } from "@/lib/game-data";
import { getOfferableCardPool } from "@/lib/game-data/cards/card-pools";
import { nextRunRngValue, type RunRngState, type RunRngStream } from "@/lib/rng";
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

function filterLiveCards<T extends { id: string }>(cards: T[]): T[] {
  return cards.filter((card) => isLiveCardId(card.id));
}

function filterLiveBattleState(state: BattleState): BattleState {
  return {
    ...state,
    deck: filterLiveCards(state.deck),
    hand: filterLiveCards(state.hand),
    discard: filterLiveCards(state.discard),
    exhausted: filterLiveCards(state.exhausted),
    wishOptions: Array.isArray(state.wishOptions) ? filterLiveCards(state.wishOptions) : state.wishOptions,
    wishQueue: state.wishQueue
      .filter((queue): queue is BattleCard[] => Array.isArray(queue))
      .map((queue) => filterLiveCards(queue)),
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

const keepLiveCard = (card: { id: string }) => isLiveCardId(card.id);
const shopCardSlotKey = (card: { id: string }, index: number) => shopItemSlotKey(card.id, index);

function normalizeShopState(state: ShopState | null): ShopState | null {
  if (!state) return null;
  const repaired = repairShopOfferings(state.cards, state.purchasedSlotKeys, keepLiveCard, shopCardSlotKey);
  return { ...state, cards: repaired.items, purchasedSlotKeys: repaired.purchasedSlotKeys };
}

function normalizeAlchemistState(state: AlchemistState | null): AlchemistState | null {
  if (!state) return null;
  const repaired = repairShopOfferings(state.potions, state.purchasedSlotKeys, keepLiveCard, shopCardSlotKey);
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
  if (card.consume) base.consume = true;
  if (card.corrupted) base.corrupted = true;
  if (card.baseTitle) base.baseTitle = card.baseTitle;
  if (card.corruptedValuePositions) base.corruptedValuePositions = card.corruptedValuePositions;
  return base;
}

function createRepairRng(rngState: RunRngState, stream: RunRngStream): () => number {
  return () => {
    const draw = nextRunRngValue(rngState, stream);
    rngState.counters[stream] = draw.nextCounter;
    return draw.value;
  };
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

function repairWildwoodDraft(
  data: ValidatedActiveRunData,
  runDeck: BattleCard[],
  rngState: RunRngState | null,
): WildwoodDraftState | null {
  if (data.contentSystemType !== "wildwood") return null;
  const draft = data.wildwoodDraft;
  if (!draft) return null;
  let draftChoices = filterLiveCards(draft.draftChoices);
  if (draftChoices.length === 0 && draft.phase === "draft" && runDeck.length < DRAFT_ROUNDS && rngState) {
    const repaired = repairEmptyCardChoices(
      rngState,
      "world",
      DRAFT_CHOICES,
      runDeck,
      characters[data.characterId].keywords,
    );
    if (repaired) draftChoices = repaired;
  }
  return { ...draft, draftChoices };
}

function repairStarterDraft(
  data: ValidatedActiveRunData,
  runDeck: BattleCard[],
  rngState: RunRngState | null,
): PersistedBattleCard[] | null {
  if (data.contentSystemType === "wildwood") return null;
  const filtered = data.starterDraftChoices ? filterLiveCards(data.starterDraftChoices) : null;
  if (filtered !== null && filtered.length === 0 && runDeck.length < DRAFT_ROUNDS && rngState) {
    const repaired = repairEmptyCardChoices(rngState, "rewards", DRAFT_CHOICES, runDeck, []);
    if (repaired) return repaired;
  }
  return filtered;
}

function repairMysteryVisit(
  data: ValidatedActiveRunData,
  runDeck: BattleCard[],
  rngState: RunRngState | null,
): MysteryVisitState | null {
  if (data.currentScreen != null && data.currentScreen !== "mystery") return null;
  const visit = data.mysteryVisit;
  if (!visit) return null;
  let cardChoices = visit.cardChoices ? filterLiveCards(visit.cardChoices) : null;
  if (cardChoices !== null && cardChoices.length === 0 && visit.chosenCardId == null && rngState) {
    const repaired = repairEmptyCardChoices(rngState, "events", MYSTERY_CARD_CHOICES, runDeck, [], []);
    if (repaired) cardChoices = repaired;
  }
  return { ...visit, cardChoices };
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
