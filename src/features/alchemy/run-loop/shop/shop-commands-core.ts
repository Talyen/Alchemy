import { readRunSession } from "@/features/alchemy/shared/stores/session/run-reads";
import { type GameSession } from "@/features/alchemy/shared/stores/session/game-session-types";
import {
  snapshotTransactionValue,
  type RunTransaction,
} from "@/features/alchemy/shared/stores/commands/run-session-command";
import {
  createDraftRunRandomSource,
  deductGold,
  readDraftGold,
  setRunActivityData,
} from "@/features/alchemy/shared/stores/commands/run-session-write-port";
import { readActivityData, type RunActivityData, type ShopActivity } from "@/lib/active-run-session";
import type { GearInstance } from "@/lib/gear";
import type { EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";
import {
  draftShopDiscounts,
  draftShopPricingContext,
  getShopRefreshPrice,
  readShopDiscounts,
  readShopPricingContext,
  type ShopBuyPriceContext,
} from "./shop-pricing";
import { shopItemSlotKey } from "@/lib/active-run-session";
import { runShopTransaction } from "./shop-transactions";

export function createGetRefreshPrice(activity: ShopActivity, gameSession: GameSession): () => number {
  return () =>
    getShopRefreshPrice(
      activity,
      readActivityData(readRunSession(gameSession).activity, activity).refreshesLeft,
      readShopDiscounts(gameSession).modifiers,
    );
}

export function createShopRefreshAction<K extends ShopActivity>(
  {
    activity,
    resample,
    guard,
  }: {
    activity: K;
    resample: (
      draft: RunTransaction,
      state: RunActivityData[NoInfer<K>],
      modifiers: readonly EncounterRewardTraitId[],
    ) => RunActivityData[NoInfer<K>];
    guard?: (draft: RunTransaction, state: RunActivityData[NoInfer<K>]) => boolean;
  },
  gameSession: GameSession,
): () => boolean {
  return () =>
    runShopTransaction(
      activity,
      (draft) => {
        const state = readActivityData(snapshotTransactionValue(draft.session.activity), activity);
        if (guard && !guard(draft, state)) return { committed: false, price: 0, value: null };
        const { talentEffects, modifiers } = draftShopDiscounts(draft);
        const quotedPrice = getShopRefreshPrice(activity, state.refreshesLeft, modifiers);
        // Match the displayed affordability guard before consuming persisted RNG.
        if (state.refreshesLeft <= 0 || readDraftGold(draft) < quotedPrice) {
          return { committed: false, price: quotedPrice, value: null };
        }
        const restockRoll =
          quotedPrice > 0 &&
          !state.freeRefreshUsed &&
          talentEffects.shopFreeRefreshChance > 0 &&
          createDraftRunRandomSource(draft, "shops")() < talentEffects.shopFreeRefreshChance / 100;
        const price = restockRoll ? 0 : quotedPrice;
        deductGold(draft, price);
        const refreshed = resample(draft, state, modifiers);
        setRunActivityData(draft, activity, {
          ...refreshed,
          refreshesLeft: state.refreshesLeft - 1,
          freeRefreshUsed: state.freeRefreshUsed || restockRoll,
          purchasedSlotKeys: [],
        });
        return { committed: true, price, value: null };
      },
      "shopRefresh",
      gameSession,
    ).committed;
}

export function cardSlotKeyOf(item: { id: string }, index: number): string {
  return shopItemSlotKey(item.id, index);
}

export function gearSlotKeyOf(instance: GearInstance): string {
  return instance.instanceId;
}

interface ShopItemByActivity {
  shop: RunActivityData["shop"]["cards"][number];
  alchemist: RunActivityData["alchemist"]["potions"][number];
  "trinket-shop": RunActivityData["trinket-shop"]["trinkets"][number];
  "equipment-shop": RunActivityData["equipment-shop"]["gear"][number];
}

interface ShopPurchaseConfig<K extends ShopActivity> {
  activity: K;
  itemsOf: (state: RunActivityData[NoInfer<K>]) => ReadonlyArray<ShopItemByActivity[NoInfer<K>]>;
  slotKeyOf: (item: ShopItemByActivity[NoInfer<K>], index: number) => string;
  priceOf: (item: ShopItemByActivity[NoInfer<K>], context: ShopBuyPriceContext) => number;
  isAvailable?: (draft: RunTransaction, offered: ShopItemByActivity[NoInfer<K>]) => boolean;
  acquire: (draft: RunTransaction, offered: ShopItemByActivity[NoInfer<K>]) => void;
}

export function createShopPurchaseActions<K extends ShopActivity>(
  config: ShopPurchaseConfig<K>,
  gameSession: GameSession,
): {
  buy: (slotKey: string) => boolean;
  getBuyPrice: (item: ShopItemByActivity[K]) => number;
} {
  const getBuyPrice = (item: ShopItemByActivity[K]) =>
    config.priceOf(item, readShopPricingContext(config.activity, gameSession));

  function buy(slotKey: string): boolean {
    return runShopTransaction(
      config.activity,
      (draft) => {
        const state = readActivityData(snapshotTransactionValue(draft.session.activity), config.activity);
        const offered = config.itemsOf(state).find((item, index) => config.slotKeyOf(item, index) === slotKey);
        if (!offered) {
          return { committed: false, price: 0, value: null };
        }
        const price = config.priceOf(offered, draftShopPricingContext(draft, state.firstPurchaseUsed));
        if (
          (config.isAvailable && !config.isAvailable(draft, offered)) ||
          readDraftGold(draft) < price ||
          state.purchasedSlotKeys.includes(slotKey)
        ) {
          return { committed: false, price, value: null };
        }
        deductGold(draft, price);
        setRunActivityData(draft, config.activity, {
          ...state,
          firstPurchaseUsed: true,
          purchasedSlotKeys: [...state.purchasedSlotKeys, slotKey],
        });
        config.acquire(draft, offered);
        return { committed: true, price, value: null };
      },
      undefined,
      gameSession,
    ).committed;
  }

  return { buy, getBuyPrice };
}
