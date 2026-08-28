import { selectRewardCards, type BattleCard } from "@/lib/game-data";
import { playGoldSpend } from "@/lib/audio";
import type { GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { setRunGold } from "@/features/alchemy/shared/stores/run-session-write-port";
import { readDraftGold } from "@/features/alchemy/shared/stores/gold-purse";
import { spendRunGold } from "../run-gold";

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
  recipe: (draft: GameplayDraft) => ShopTransactionResult<T>,
): ShopTransactionResult<T> {
  const result = dispatchRunSessionCommand(recipe);
  playShopSpendFeedback(result);
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

export function mapRefreshedShopOfferings<TState extends { refreshesLeft: number; purchasedSlotKeys: string[] }>(
  previous: TState,
  itemsKey: keyof TState,
  items: TState[keyof TState],
): TState {
  return {
    ...previous,
    [itemsKey]: items,
    refreshesLeft: previous.refreshesLeft - 1,
    purchasedSlotKeys: [],
  };
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

  spendRunGold(input.price, (update) => setRunGold(input.draft, update));
  input.setState(input.draft, (previous) => ({
    ...previous,
    firstPurchaseUsed: true,
    purchasedSlotKeys: [...previous.purchasedSlotKeys, input.slotKey],
  }));
  input.acquire();
  return { committed: true, price: input.price, value: undefined };
}

interface RefreshShopOfferingsInput<T, TItem> {
  draft: GameplayDraft;
  price: number;
  refreshesLeft: number;
  setState: DraftStateWriter<T>;
  mapState: (previous: T, newItems: TItem[]) => T;
  resample: () => TItem[];
}

export function refreshShopOfferings<T, TItem>(
  input: RefreshShopOfferingsInput<T, TItem>,
): ShopTransactionResult<TItem[] | null> {
  if (input.refreshesLeft <= 0 || readDraftGold(input.draft) < input.price) {
    return { committed: false, price: input.price, value: null };
  }

  spendRunGold(input.price, (update) => setRunGold(input.draft, update));
  const newItems = input.resample();
  input.setState(input.draft, (previous) => input.mapState(previous, newItems));
  return { committed: true, price: input.price, value: newItems };
}

export function refreshCardShopOfferings<T>(config: {
  draft: GameplayDraft;
  price: number;
  refreshesLeft: number;
  pool: BattleCard[];
  currentItems: BattleCard[];
  count: number;
  setState: DraftStateWriter<T>;
  mapState: (previous: T, items: BattleCard[]) => T;
  rng: () => number;
}): ShopTransactionResult<BattleCard[] | null> {
  return refreshShopOfferings({
    draft: config.draft,
    price: config.price,
    refreshesLeft: config.refreshesLeft,
    setState: config.setState,
    mapState: config.mapState,
    resample: () =>
      selectRewardCards(config.draft.run.activeRun.runDeck, config.pool, config.count, config.currentItems, config.rng),
  });
}
