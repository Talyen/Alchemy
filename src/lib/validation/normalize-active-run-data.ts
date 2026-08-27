// Save-load normalization during Zod ActiveRunDataSchema.transform only.
// Content-system field isolation mirrors the encode-time guards in run-resume-codec.
// Scalar defaults and contentSystemType are owned by the Zod schema (.catch / .default).
// Tombstoned card stripping lives here so every parse path (active run, parked runs)
// drops removed content before it can reach runtime state.
import { repairShopOfferings, shopItemSlotKey } from "@/lib/active-run-session/shop-offering-repair";
import type { ContentSystemId } from "@/lib/content-systems/types";
import { isTombstonedCardId } from "./migration/tombstoned-content-ids";

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

  const wildwoodDraft =
    contentSystemType === "wildwood" && data.wildwoodDraft && typeof data.wildwoodDraft === "object"
      ? {
          ...(data.wildwoodDraft as Record<string, unknown>),
          draftChoices: nullableCardArray((data.wildwoodDraft as Record<string, unknown>).draftChoices),
        }
      : contentSystemType === "wildwood"
        ? data.wildwoodDraft
        : null;

  return {
    ...data,
    runPlayerHealth,
    runMetaMaxHealth,
    runDeck: nullableCardArray(data.runDeck),
    labyrinthMap: contentSystemType === "labyrinth" ? data.labyrinthMap : null,
    labyrinthPendingNode: contentSystemType === "labyrinth" ? data.labyrinthPendingNode : null,
    wildwoodDraft,
    starterDraftChoices: contentSystemType === "wildwood" ? null : nullableCardArray(data.starterDraftChoices),
    activeCombat: normalizeActiveCombat(data, contentSystemType),
    shopState: normalizeOptionalShopInventory(data.shopState, "cards"),
    alchemistState: normalizeOptionalShopInventory(data.alchemistState, "potions"),
    mysteryVisit:
      data.currentScreen != null && data.currentScreen !== "mystery"
        ? null
        : data.mysteryVisit && typeof data.mysteryVisit === "object"
          ? {
              ...(data.mysteryVisit as Record<string, unknown>),
              cardChoices: nullableCardArray((data.mysteryVisit as Record<string, unknown>).cardChoices),
            }
          : data.mysteryVisit,
  };
}
