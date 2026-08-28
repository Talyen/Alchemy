import { repairShopOfferings, shopItemSlotKey } from "@/lib/active-run-session/shop-offering-repair";
import type { ContentSystemId } from "@/lib/content-systems/types";
import { isTombstonedCardId } from "./migration/tombstoned-content-ids";
import { DRAFT_CHOICES, DRAFT_ROUNDS, MYSTERY_CARD_CHOICES } from "@/lib/game-constants";
import { characters, selectRewardCards, type BattleCard } from "@/lib/game-data";
import { getOfferableCardPool } from "@/lib/game-data/cards/card-pools";
import { nextRunRngValue, type RunRngState, type RunRngStream } from "@/lib/run-rng";

interface SavedCard {
  id: string;
}

function filterLiveCards<T extends SavedCard>(cards: T[]): T[] {
  return cards.filter((card) => !isTombstonedCardId(card.id));
}

function filterLiveBattleState(state: Record<string, unknown>): Record<string, unknown> {
  const next = { ...state };
  for (const pile of ["deck", "hand", "discard", "exhausted", "wishOptions"] as const) {
    const pileValue = next[pile];
    if (Array.isArray(pileValue)) next[pile] = filterLiveCards(pileValue as SavedCard[]);
  }
  if (Array.isArray(next.wishQueue)) {
    next.wishQueue = (next.wishQueue as unknown[])
      .filter(Array.isArray)
      .map((queue) => filterLiveCards(queue as SavedCard[]));
  }
  return next;
}

function normalizeActiveCombat(
  data: Record<string, unknown>,
  contentSystemType: ContentSystemId,
): Record<string, unknown> | null {
  if (!data.activeCombat) return null;
  const combat = data.activeCombat as Record<string, unknown>;
  const next = { ...combat };
  if (contentSystemType !== "labyrinth") {
    next.activeLabyrinthModifiers = [];
    next.activeLabyrinthRewardModifiers = [];
  } else {
    next.activeLabyrinthModifiers = combat.activeLabyrinthModifiers ?? [];
    next.activeLabyrinthRewardModifiers = combat.activeLabyrinthRewardModifiers ?? [];
  }
  if (next.battleState && typeof next.battleState === "object") {
    next.battleState = filterLiveBattleState(next.battleState as Record<string, unknown>);
  }
  const transition = next.pendingBattleTransition;
  if (
    transition &&
    typeof transition === "object" &&
    !Array.isArray(transition) &&
    (transition as Record<string, unknown>).kind === "enemy-turn"
  ) {
    const resultState = (transition as Record<string, unknown>).resultState;
    if (resultState && typeof resultState === "object") {
      next.pendingBattleTransition = {
        ...(transition as Record<string, unknown>),
        resultState: filterLiveBattleState(resultState as Record<string, unknown>),
      };
    }
  }
  return next;
}

function nullableCardArray(cards: unknown): unknown {
  if (Array.isArray(cards)) return filterLiveCards(cards as SavedCard[]);
  return cards ?? null;
}

function cloneRngForRepair(rngState: RunRngState | null | undefined): RunRngState | null {
  if (
    !rngState ||
    typeof rngState.seed !== "number" ||
    !rngState.counters ||
    typeof rngState.counters.rewards !== "number" ||
    typeof rngState.counters.world !== "number" ||
    typeof rngState.counters.events !== "number"
  ) {
    return null;
  }
  return { seed: rngState.seed, counters: { ...rngState.counters } };
}

function createRepairRng(rngState: RunRngState, stream: RunRngStream): () => number {
  return () => {
    const draw = nextRunRngValue(rngState, stream);
    rngState.counters[stream] = draw.nextCounter;
    return draw.value;
  };
}

function sanitizeDeckForRepair(cards: BattleCard[]): BattleCard[] {
  return cards.map((card) =>
    Array.isArray((card as unknown as { effects?: unknown }).effects) ? card : { ...card, effects: [] },
  );
}

function repairEmptyCardChoices(
  rngState: RunRngState,
  stream: RunRngStream,
  count: number,
  pool: BattleCard[],
  deckForAffinity: BattleCard[],
  extraKeywords: string[] = [],
  alreadyOwned: BattleCard[] = deckForAffinity,
): Array<Record<string, unknown>> | null {
  const rng = createRepairRng(rngState, stream);
  const repaired = selectRewardCards(deckForAffinity, pool, count, alreadyOwned, rng, extraKeywords as never[]).map(
    toPersistedCard,
  );
  return repaired.length > 0 ? repaired : null;
}

function toPersistedCard(card: BattleCard): Record<string, unknown> {
  const base: Record<string, unknown> = {
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
  const corruptedPositions = (card as unknown as { corruptedValuePositions?: unknown }).corruptedValuePositions;
  if (corruptedPositions) base.corruptedValuePositions = corruptedPositions;

  return base;
}

function normalizeOptionalShopInventory(inventory: unknown, cardKey: string): Record<string, unknown> | null {
  if (!inventory || typeof inventory !== "object") return null;
  const record = inventory as Record<string, unknown>;
  const cards = record[cardKey];
  if (!Array.isArray(cards)) {
    return { ...record, [cardKey]: cards ?? null };
  }
  const purchased = Array.isArray(record.purchasedSlotKeys) ? (record.purchasedSlotKeys as string[]) : [];
  const repaired = repairShopOfferings(
    cards as SavedCard[],
    purchased,
    (card) => !isTombstonedCardId(card.id),
    (card, index) => shopItemSlotKey(card.id, index),
  );
  return {
    ...record,
    [cardKey]: repaired.items,
    purchasedSlotKeys: repaired.purchasedSlotKeys,
  };
}

function repairWildwoodDraft(
  data: Record<string, unknown>,
  runDeck: BattleCard[] | null,
  rngState: RunRngState | null,
  characterId: string | undefined,
): unknown {
  const contentSystemType = data.contentSystemType as ContentSystemId;
  if (contentSystemType !== "wildwood") return null;
  if (!data.wildwoodDraft || typeof data.wildwoodDraft !== "object") return data.wildwoodDraft;
  const raw = data.wildwoodDraft as Record<string, unknown>;
  const filtered = nullableCardArray(raw.draftChoices) as BattleCard[] | null;
  let draftChoices: unknown = filtered;
  const phase = raw.phase as string | undefined;
  const runDeckLength = Array.isArray(runDeck) ? runDeck.length : 0;
  if (
    Array.isArray(filtered) &&
    filtered.length === 0 &&
    phase === "draft" &&
    runDeckLength < DRAFT_ROUNDS &&
    rngState
  ) {
    const deckForAffinity = sanitizeDeckForRepair(runDeck ?? []);
    const keywords =
      (characterId ? (characters as Record<string, { keywords: string[] }>)[characterId]?.keywords : undefined) ?? [];
    const repaired = repairEmptyCardChoices(
      rngState,
      "world",
      DRAFT_CHOICES,
      getOfferableCardPool(),
      deckForAffinity,
      keywords,
    );
    if (repaired) draftChoices = repaired;
  }
  return { ...raw, draftChoices };
}

function repairStarterDraft(
  data: Record<string, unknown>,
  runDeck: BattleCard[] | null,
  rngState: RunRngState | null,
): unknown {
  const contentSystemType = data.contentSystemType as ContentSystemId;
  if (contentSystemType === "wildwood") return null;
  const filtered = nullableCardArray(data.starterDraftChoices) as BattleCard[] | null;
  if (
    Array.isArray(filtered) &&
    filtered.length === 0 &&
    Array.isArray(runDeck) &&
    runDeck.length < DRAFT_ROUNDS &&
    rngState
  ) {
    const hadDraft = data.starterDraftChoices != null;
    if (hadDraft) {
      const deckForAffinity = sanitizeDeckForRepair(runDeck ?? []);
      const repaired = repairEmptyCardChoices(
        rngState,
        "rewards",
        DRAFT_CHOICES,
        getOfferableCardPool(),
        deckForAffinity,
      );
      if (repaired) return repaired;
    }
  }
  if (filtered === null) return null;
  return filtered;
}

function repairMysteryVisit(
  data: Record<string, unknown>,
  runDeck: BattleCard[] | null,
  rngState: RunRngState | null,
): unknown {
  if (data.currentScreen != null && data.currentScreen !== "mystery") return null;
  if (!data.mysteryVisit || typeof data.mysteryVisit !== "object") return data.mysteryVisit;
  const rawVisit = data.mysteryVisit as Record<string, unknown>;
  const filtered = nullableCardArray(rawVisit.cardChoices) as BattleCard[] | null;
  let cardChoices: unknown = filtered;
  const chosenCardId = rawVisit.chosenCardId as string | null | undefined;
  const hadChoices = rawVisit.cardChoices != null;
  if (Array.isArray(filtered) && filtered.length === 0 && hadChoices && chosenCardId == null && rngState) {
    const deckForAffinity = sanitizeDeckForRepair(runDeck ?? []);

    const repaired = repairEmptyCardChoices(
      rngState,
      "events",
      MYSTERY_CARD_CHOICES,
      getOfferableCardPool(),
      deckForAffinity,
      [],
      [],
    );
    if (repaired) cardChoices = repaired;
  }
  if (filtered === null && rawVisit.cardChoices == null) cardChoices = null;
  return { ...rawVisit, cardChoices };
}

export function normalizeActiveRunData<T extends Record<string, unknown>>(
  data: T,
): T & {
  runPlayerHealth: number;
  labyrinthMap: unknown;
  labyrinthPendingNode: unknown;
  wildwoodDraft: unknown;
  starterDraftChoices: unknown;
  activeCombat: unknown;
} {
  const contentSystemType = data.contentSystemType as ContentSystemId;
  const runMaxHealth = data.runMaxHealth as number;
  const runPlayerHealth = Math.min(data.runPlayerHealth as number, runMaxHealth);
  const runMetaMaxHealth =
    typeof data.runMetaMaxHealth === "number" && data.runMetaMaxHealth > 0 ? data.runMetaMaxHealth : runMaxHealth;

  const runDeck = nullableCardArray(data.runDeck) as BattleCard[] | null;

  const rawRngState = data.rng as RunRngState | null | undefined;
  const rngState = cloneRngForRepair(rawRngState);
  const characterId = data.characterId as string | undefined;

  const wildwoodDraft = repairWildwoodDraft(data, runDeck, rngState, characterId);
  const starterDraftChoices = repairStarterDraft(data, runDeck, rngState);
  const mysteryVisit = repairMysteryVisit(data, runDeck, rngState);

  const nextRng = rngState ?? (data.rng as RunRngState | null | undefined) ?? null;

  return {
    ...data,
    ...(nextRng ? { rng: nextRng } : {}),
    runPlayerHealth,
    runMetaMaxHealth,
    runDeck,
    labyrinthMap: contentSystemType === "labyrinth" ? data.labyrinthMap : null,
    labyrinthPendingNode: contentSystemType === "labyrinth" ? data.labyrinthPendingNode : null,
    wildwoodDraft,
    starterDraftChoices,
    activeCombat: normalizeActiveCombat(data, contentSystemType),
    shopState: normalizeOptionalShopInventory(data.shopState, "cards"),
    alchemistState: normalizeOptionalShopInventory(data.alchemistState, "potions"),
    mysteryVisit,
  };
}
