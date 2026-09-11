import type { GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { deductGold, readDraftGold } from "@/features/alchemy/shared/stores/run-session-write-port";
import { playGoldSpend, playUISound } from "@/lib/audio";

type StateUpdate<T> = T | ((previous: T) => T);
export type DraftStateWriter<T> = (draft: GameplayDraft, value: StateUpdate<T>) => void;

export interface ShopTransactionResult<T = undefined> {
  committed: boolean;
  price: number;
  value: T;
}

function playShopSpendFeedback(result: Pick<ShopTransactionResult<unknown>, "committed" | "price">): void {
  if (result.committed && result.price > 0) playGoldSpend();
}

export function runShopTransaction<T>(
  activity: "shop" | "alchemist" | "trinket-shop" | "equipment-shop",
  recipe: (draft: GameplayDraft) => ShopTransactionResult<T>,
  successSound?: Parameters<typeof playUISound>[0],
): ShopTransactionResult<T | undefined> {
  const result = dispatchRunSessionCommand((draft) =>
    draft.session.activity.kind === activity ? recipe(draft) : null,
  );
  if (!result) return { committed: false, price: 0, value: undefined };
  playShopSpendFeedback(result);
  if (result.committed && successSound) playUISound(successSound);
  return result;
}

export function commitShopInitialize<T>(
  setState: DraftStateWriter<T>,
  createInitial: (draft: GameplayDraft) => T,
): void {
  dispatchRunSessionCommand((draft) => {
    setState(draft, createInitial(draft));
  });
}

interface PurchaseShopOfferingInput<TState extends { firstPurchaseUsed: boolean; purchasedSlotKeys: string[] }> {
  draft: GameplayDraft;
  price: number;
  state: TState;
  setState: DraftStateWriter<TState>;
  slotKey: string;
  offeringMatches: boolean;
  acquire: () => void;
}

export function purchaseShopOffering<TState extends { firstPurchaseUsed: boolean; purchasedSlotKeys: string[] }>(
  input: PurchaseShopOfferingInput<TState>,
): ShopTransactionResult {
  if (
    !input.offeringMatches ||
    readDraftGold(input.draft) < input.price ||
    input.state.purchasedSlotKeys.includes(input.slotKey)
  ) {
    return { committed: false, price: input.price, value: undefined };
  }

  deductGold(input.draft, input.price);
  input.setState(input.draft, (previous) => ({
    ...previous,
    firstPurchaseUsed: true,
    purchasedSlotKeys: [...previous.purchasedSlotKeys, input.slotKey],
  }));
  input.acquire();
  return { committed: true, price: input.price, value: undefined };
}

interface CommitShopServiceInput<T> {
  draft: GameplayDraft;
  price: number;
  guard: boolean;
  failureValue: T;
  apply: () => T;
}

export function commitShopService<T>(input: CommitShopServiceInput<T>): ShopTransactionResult<T> {
  if (!input.guard || readDraftGold(input.draft) < input.price) {
    return { committed: false, price: input.price, value: input.failureValue };
  }
  deductGold(input.draft, input.price);
  const value = input.apply();
  return { committed: true, price: input.price, value };
}

interface RefreshShopOfferingsInput<T, TItem> {
  draft: GameplayDraft;
  price: number;
  refreshesLeft: number;
  setState: DraftStateWriter<T>;
  mapState: (previous: T, newItems: TItem[]) => T;
  resample: () => TItem[];
}

export function refreshShopOfferings<T extends { refreshesLeft: number; purchasedSlotKeys: string[] }, TItem>(
  input: RefreshShopOfferingsInput<T, TItem>,
): ShopTransactionResult<TItem[] | null> {
  if (input.refreshesLeft <= 0 || readDraftGold(input.draft) < input.price) {
    return { committed: false, price: input.price, value: null };
  }

  deductGold(input.draft, input.price);
  const newItems = input.resample();
  input.setState(input.draft, (previous) => ({
    ...input.mapState(previous, newItems),
    refreshesLeft: previous.refreshesLeft - 1,
    purchasedSlotKeys: [],
  }));
  return { committed: true, price: input.price, value: newItems };
}
