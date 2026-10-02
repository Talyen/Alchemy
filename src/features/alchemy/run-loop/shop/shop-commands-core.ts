import { readActivityData, type RunActivityData } from "@/lib/active-run-session";
import type { BattleCard, TalentEffectManifest, TrinketEntry } from "@/lib/game-data";
import type { ShopRefreshModifiers } from "./shop-action-types";
import type { GearInstance } from "@/lib/gear";
import { dispatchRunSessionCommand, type GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import {
  createDraftRunRandomSource,
  deductGold,
  readDraftGold,
  setRunActivityData,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { getShopBuyPrice, getShopRefreshPrice, type ShopBuyKind, type ShopRefreshKind } from "./shop-pricing";
import {
  resolveDraftShopModifiers,
  resolveDraftShopPricingContext,
  resolveReadShopModifiers,
} from "./shop-pricing-context";
import { shopItemSlotKey, findShopOffering } from "./shop-slot-keys";
import { runShopTransaction, type ShopTransactionResult } from "./shop-transactions";

type ShopActivity = Parameters<typeof runShopTransaction>[0];
const REFRESH_KIND: Record<ShopActivity, ShopRefreshKind> = {
  shop: "merchant",
  alchemist: "alchemist",
  "trinket-shop": "trinket",
  "equipment-shop": "equipment",
};
const BUY_KIND: Record<ShopActivity, ShopBuyKind> = {
  shop: "merchantCard",
  alchemist: "alchemistPotion",
  "trinket-shop": "trinket",
  "equipment-shop": "gear",
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

interface SlotPurchaseConfig<TItem extends BattleCard | GearInstance | TrinketEntry> {
  talentEffects: TalentEffectManifest;
  activity: ShopActivity;
  draft: GameplayDraft;
  items: readonly TItem[];
  requestedId: string;
  slotKey: string;
  slotKeyOf: (item: TItem, index: number) => string;
  idOf: (item: TItem) => string;
  isAvailable?: (draft: GameplayDraft, offered: TItem) => boolean;
  acquire: (draft: GameplayDraft, offered: TItem) => void;
}

export function purchaseSlotOffering<TItem extends BattleCard | GearInstance | TrinketEntry>(
  config: SlotPurchaseConfig<TItem>,
): ShopTransactionResult {
  const state = readActivityData(config.draft.session.activity, config.activity);
  const buyKind = BUY_KIND[config.activity];
  const atSlot = findShopOffering(config.items, config.slotKey, config.slotKeyOf);
  const offered = atSlot !== undefined && config.idOf(atSlot) === config.requestedId ? atSlot : undefined;
  const draftContext = resolveDraftShopPricingContext(config.talentEffects, config.draft, state);
  if (!offered) {
    if (buyKind === "trinket") {
      const price = getShopBuyPrice(buyKind, null, draftContext);
      return { committed: false, price, value: undefined };
    }
    return { committed: false, price: 0, value: undefined };
  }
  const price =
    buyKind === "trinket"
      ? getShopBuyPrice(buyKind, null, draftContext)
      : getShopBuyPrice(buyKind, offered, draftContext);
  if (
    (config.isAvailable && !config.isAvailable(config.draft, offered)) ||
    readDraftGold(config.draft) < price ||
    state.purchasedSlotKeys.includes(config.slotKey)
  ) {
    return { committed: false, price, value: undefined };
  }
  deductGold(config.draft, price);
  setRunActivityData(config.draft, config.activity, {
    ...state,
    firstPurchaseUsed: true,
    purchasedSlotKeys: [...state.purchasedSlotKeys, config.slotKey],
  });
  config.acquire(config.draft, offered);
  return { committed: true, price, value: undefined };
}
