// Save-load normalization during Zod ActiveRunDataSchema.transform only.
// Content-system field isolation mirrors the encode-time guards in run-resume-codec.
// Scalar defaults and contentSystemType are owned by the Zod schema (.catch / .default).
// Tombstoned card stripping lives here so every parse path (active run, parked runs)
// drops removed content before it can reach runtime state.
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

/** Strips tombstoned cards from every BattleCard pile of a persisted battle snapshot. */
function filterLiveBattleState(state: Record<string, unknown>): Record<string, unknown> {
  const next = { ...state };
  for (const pile of ["deck", "hand", "discard", "exhausted", "wishOptions"] as const) {
    const pileValue = next[pile];
    if (Array.isArray(pileValue)) next[pile] = filterLiveCards(pileValue as SavedCard[]);
  }
  if (Array.isArray(next.wishQueue)) {
    // wishQueue is not typed by the wire schema, so drop malformed queue entries
    // here — a throwing transform would abort the whole save parse and skip
    // backup candidates in io.ts.
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

function createRepairRng(rngState: RunRngState | null | undefined, stream: RunRngStream): (() => number) | null {
  if (
    !rngState ||
    typeof rngState.seed !== "number" ||
    !rngState.counters ||
    typeof rngState.counters[stream] !== "number"
  ) {
    return null;
  }
  return () => {
    const draw = nextRunRngValue(rngState, stream);
    rngState.counters[stream] = draw.nextCounter;
    return draw.value;
  };
}

function sanitizeDeckForRepair(cards: BattleCard[]): BattleCard[] {
  return cards.map((card) =>
    Array.isArray((card as unknown as { effects?: unknown }).effects) ? card : ({ ...card, effects: [] } as BattleCard),
  );
}

function toPersistedCard(card: BattleCard): Record<string, unknown> {
  return {
    id: card.id,
    title: card.title,
    descriptionLines: card.descriptionLines,
    art: card.art,
    cost: card.cost,
    effects: card.effects,
    ...(card.uid !== undefined ? { uid: card.uid } : {}),
    ...(card.consume ? { consume: true } : {}),
    ...(card.corrupted ? { corrupted: true } : {}),
    ...(card.baseTitle ? { baseTitle: card.baseTitle } : {}),
    ...((card as unknown as { corruptedValuePositions?: unknown }).corruptedValuePositions
      ? { corruptedValuePositions: (card as unknown as { corruptedValuePositions: unknown }).corruptedValuePositions }
      : {}),
  };
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
  const runDeckLength = Array.isArray(runDeck) ? runDeck.length : 0;
  const rngState = data.rng as RunRngState | undefined;
  const characterId = data.characterId as string | undefined;

  // --- Wildwood draftChoices repair (re-offer once with world stream) ---
  let wildwoodDraft: unknown;
  if (contentSystemType === "wildwood" && data.wildwoodDraft && typeof data.wildwoodDraft === "object") {
    const raw = data.wildwoodDraft as Record<string, unknown>;
    const filtered = nullableCardArray(raw.draftChoices) as BattleCard[] | null;
    let draftChoices: unknown = filtered;
    const phase = raw.phase as string | undefined;
    if (
      Array.isArray(filtered) &&
      filtered.length === 0 &&
      phase === "draft" &&
      runDeckLength < DRAFT_ROUNDS &&
      rngState
    ) {
      const rng = createRepairRng(rngState, "world");
      if (rng) {
        const pool = getOfferableCardPool();
        const deckForAffinity = sanitizeDeckForRepair((runDeck ?? []) as BattleCard[]);
        const keywords =
          (characterId ? (characters as Record<string, { keywords: string[] }>)[characterId]?.keywords : undefined) ??
          [];
        const repaired = selectRewardCards(
          deckForAffinity,
          pool,
          DRAFT_CHOICES,
          deckForAffinity,
          rng,
          keywords as never[],
        ).map(toPersistedCard);
        if (repaired.length > 0) draftChoices = repaired;
      }
    }
    wildwoodDraft = { ...raw, draftChoices };
  } else if (contentSystemType === "wildwood") {
    wildwoodDraft = data.wildwoodDraft;
  } else {
    wildwoodDraft = null;
  }

  // --- Starter draftChoices repair (re-offer once with rewards stream) ---
  let starterDraftChoices: unknown;
  if (contentSystemType === "wildwood") {
    starterDraftChoices = null;
  } else {
    const filtered = nullableCardArray(data.starterDraftChoices) as BattleCard[] | null;
    if (Array.isArray(filtered) && filtered.length === 0 && runDeckLength < DRAFT_ROUNDS && rngState) {
      // Only repair if the original save had a pending draft (non-null before filtering).
      // An intentional null means no draft in progress.
      const hadDraft = data.starterDraftChoices != null;
      if (hadDraft) {
        const rng = createRepairRng(rngState, "rewards");
        if (rng) {
          const deckForAffinity = sanitizeDeckForRepair((runDeck ?? []) as BattleCard[]);
          const repaired = selectRewardCards(
            deckForAffinity,
            getOfferableCardPool(),
            DRAFT_CHOICES,
            deckForAffinity,
            rng,
          ).map(toPersistedCard);
          if (repaired.length > 0) starterDraftChoices = repaired;
          else starterDraftChoices = filtered;
        } else {
          starterDraftChoices = filtered;
        }
      } else {
        starterDraftChoices = filtered;
      }
    } else {
      starterDraftChoices = filtered;
    }
    // Preserve null vs [] distinction for completed drafts handled above; normalize keeps [] if repair produced empty.
    // If filtered was null, nullableCardArray returns null, so we keep null.
    if (filtered === null) starterDraftChoices = null;
  }

  // --- Mystery cardChoices repair (re-offer once with events stream) ---
  let mysteryVisit: unknown;
  if (data.currentScreen != null && data.currentScreen !== "mystery") {
    mysteryVisit = null;
  } else if (data.mysteryVisit && typeof data.mysteryVisit === "object") {
    const rawVisit = data.mysteryVisit as Record<string, unknown>;
    const filtered = nullableCardArray(rawVisit.cardChoices) as BattleCard[] | null;
    let cardChoices: unknown = filtered;
    const chosenCardId = rawVisit.chosenCardId as string | null | undefined;
    const hadChoices = rawVisit.cardChoices != null;
    if (Array.isArray(filtered) && filtered.length === 0 && hadChoices && chosenCardId == null && rngState) {
      const rng = createRepairRng(rngState, "events");
      if (rng) {
        const deckForAffinity = sanitizeDeckForRepair((runDeck ?? []) as BattleCard[]);
        const repaired = selectRewardCards(deckForAffinity, getOfferableCardPool(), MYSTERY_CARD_CHOICES, [], rng).map(
          toPersistedCard,
        );
        if (repaired.length > 0) cardChoices = repaired;
      }
    }
    // Keep null distinction: if original was null, filtered is null
    if (filtered === null && rawVisit.cardChoices == null) cardChoices = null;
    mysteryVisit = { ...rawVisit, cardChoices };
  } else {
    mysteryVisit = data.mysteryVisit;
  }

  return {
    ...data,
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
