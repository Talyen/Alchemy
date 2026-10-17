import { readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { snapshotTransactionValue, type RunTransaction } from "@/features/alchemy/shared/stores/run-session-command";
import {
  createDraftRunRandomSource,
  deductGold,
  readDraftGold,
  setRunActivityData,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { readActivityData, type RunActivityData } from "@/lib/active-run-session";
import type { BattleCard } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear";
import type { ShopActivity, ShopRefreshModifiers } from "./shop-action-types";
import { getShopRefreshPrice, type ShopBuyPriceContext } from "./shop-pricing";
import {
  resolveDraftShopModifiers,
  resolveDraftShopEffects,
  resolveDraftShopPricingContext,
  resolveReadShopModifiers,
  resolveReadShopPricingContext,
} from "./shop-pricing-context";
import { shopItemSlotKey } from "./shop-slot-keys";
import { runShopTransaction } from "./shop-transactions";

export function createGetRefreshPrice(activity: ShopActivity, gameSession: GameSession): () => number {
  return () =>
    getShopRefreshPrice(
      activity,
      readActivityData(readRunSession(gameSession).activity, activity).refreshesLeft,
      resolveReadShopModifiers(gameSession),
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
      modifiers: ShopRefreshModifiers,
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
        const modifiers = resolveDraftShopModifiers(draft);
        const { talentEffects } = resolveDraftShopEffects(draft);
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

export function cardSlotKeyOf(card: BattleCard, index: number): string {
  return shopItemSlotKey(card.id, index);
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
    config.priceOf(item, resolveReadShopPricingContext(config.activity, gameSession));

  function buy(slotKey: string): boolean {
    return runShopTransaction(
      config.activity,
      (draft) => {
        const state = readActivityData(snapshotTransactionValue(draft.session.activity), config.activity);
        const offered = config.itemsOf(state).find((item, index) => config.slotKeyOf(item, index) === slotKey);
        if (!offered) {
          return { committed: false, price: 0, value: undefined };
        }
        const price = config.priceOf(offered, resolveDraftShopPricingContext(draft, state));
        if (
          (config.isAvailable && !config.isAvailable(draft, offered)) ||
          readDraftGold(draft) < price ||
          state.purchasedSlotKeys.includes(slotKey)
        ) {
          return { committed: false, price, value: undefined };
        }
        deductGold(draft, price);
        setRunActivityData(draft, config.activity, {
          ...state,
          firstPurchaseUsed: true,
          purchasedSlotKeys: [...state.purchasedSlotKeys, slotKey],
        });
        config.acquire(draft, offered);
        return { committed: true, price, value: undefined };
      },
      undefined,
      gameSession,
    ).committed;
  }

  return { buy, getBuyPrice };
}
