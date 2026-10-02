import { readActivityData, type RunActivityData } from "@/lib/active-run-session";
import type { BattleCard, TalentEffectManifest } from "@/lib/game-data";
import type { ShopRefreshModifiers } from "./shop-action-types";
import type { GearInstance } from "@/lib/gear";
import { dispatchRunSessionCommand, type GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import {
  createDraftRunRandomSource,
  deductGold,
  readDraftGold,
  setRunActivityData,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { getShopRefreshPrice, type ShopBuyPriceContext, type ShopRefreshKind } from "./shop-pricing";
import {
  resolveDraftShopModifiers,
  resolveDraftShopPricingContext,
  resolveReadShopModifiers,
  resolveReadShopPricingContext,
  type ShopSessionStateKey,
} from "./shop-pricing-context";
import { shopItemSlotKey, findShopOffering } from "./shop-slot-keys";
import { runShopTransaction } from "./shop-transactions";

type ShopActivity = Parameters<typeof runShopTransaction>[0];
const REFRESH_KIND: Record<ShopActivity, ShopRefreshKind> = {
  shop: "merchant",
  alchemist: "alchemist",
  "trinket-shop": "trinket",
  "equipment-shop": "equipment",
};
const SHOP_STATE_KEY: Record<ShopActivity, ShopSessionStateKey> = {
  shop: "shopState",
  alchemist: "alchemistState",
  "trinket-shop": "trinketShopState",
  "equipment-shop": "equipmentShopState",
};

export function initializeShop<K extends ShopActivity>(
  activity: K,
  createInitial: (draft: GameplayDraft) => RunActivityData[NoInfer<K>],
): () => void {
  return () => dispatchRunSessionCommand((draft) => setRunActivityData(draft, activity, createInitial(draft)));
}

export function createGetRefreshPrice(
  activity: ShopActivity,
  talentEffects: TalentEffectManifest,
): (refreshesLeft: number, modifiers?: ShopRefreshModifiers, freeRefreshUsed?: boolean) => number {
  return (refreshesLeft, modifiers = resolveReadShopModifiers(), freeRefreshUsed = false) =>
    getShopRefreshPrice(REFRESH_KIND[activity], talentEffects, refreshesLeft, modifiers, freeRefreshUsed);
}

export function createShopRefreshAction<K extends ShopActivity>({
  activity,
  talentEffects,
  resample,
  guard,
}: {
  activity: K;
  talentEffects: TalentEffectManifest;
  resample: (
    draft: GameplayDraft,
    state: RunActivityData[NoInfer<K>],
    modifiers: ShopRefreshModifiers,
  ) => RunActivityData[NoInfer<K>];
  guard?: (draft: GameplayDraft, state: RunActivityData[NoInfer<K>]) => boolean;
}): () => boolean {
  return () =>
    runShopTransaction(
      activity,
      (draft) => {
        const state = readActivityData(draft.session.activity, activity);
        if (guard && !guard(draft, state)) return { committed: false, price: 0, value: null };
        const modifiers = resolveDraftShopModifiers(draft);
        const quotedPrice = getShopRefreshPrice(
          REFRESH_KIND[activity],
          talentEffects,
          state.refreshesLeft,
          modifiers,
          state.freeRefreshUsed,
        );
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
          freeRefreshUsed: state.freeRefreshUsed || restockRoll || (talentEffects.shopFreeRefresh && quotedPrice === 0),
          purchasedSlotKeys: [],
        });
        return { committed: true, price, value: null };
      },
      "shopRefresh",
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
  talentEffects: TalentEffectManifest;
  activity: K;
  itemsOf: (state: RunActivityData[NoInfer<K>]) => ReadonlyArray<ShopItemByActivity[NoInfer<K>]>;
  slotKeyOf: (item: ShopItemByActivity[NoInfer<K>], index: number) => string;
  idOf: (item: ShopItemByActivity[NoInfer<K>]) => string;
  priceOf: (item: ShopItemByActivity[NoInfer<K>], context: ShopBuyPriceContext) => number;
  isAvailable?: (draft: GameplayDraft, offered: ShopItemByActivity[NoInfer<K>]) => boolean;
  acquire: (draft: GameplayDraft, offered: ShopItemByActivity[NoInfer<K>]) => void;
}

export function createShopPurchaseActions<K extends ShopActivity>(
  config: ShopPurchaseConfig<K>,
): {
  buy: (requested: ShopItemByActivity[K], slotKey: string) => boolean;
  getBuyPrice: (item: ShopItemByActivity[K]) => number;
} {
  const getBuyPrice = (item: ShopItemByActivity[K]) =>
    config.priceOf(item, resolveReadShopPricingContext(config.talentEffects, SHOP_STATE_KEY[config.activity]));

  function buy(requested: ShopItemByActivity[K], slotKey: string): boolean {
    return runShopTransaction(config.activity, (draft) => {
      const state = readActivityData(draft.session.activity, config.activity);
      const offered = findShopOffering(config.itemsOf(state), slotKey, config.slotKeyOf);
      if (!offered || config.idOf(offered) !== config.idOf(requested)) {
        return { committed: false, price: 0, value: undefined };
      }
      // Price and acquire the live shelf item; callers may hold an older copy.
      const price = config.priceOf(offered, resolveDraftShopPricingContext(config.talentEffects, draft, state));
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
    }).committed;
  }

  return { buy, getBuyPrice };
}
