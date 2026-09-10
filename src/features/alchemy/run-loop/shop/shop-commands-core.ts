import type { BattleCard, TalentEffectManifest, TrinketEntry } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear";
import type { GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import { getShopBuyPrice, getShopRefreshPrice, type ShopBuyKind, type ShopRefreshKind } from "./shop-pricing";
import { resolveDraftShopPricingContext, resolveReadShopModifiers } from "./shop-pricing-context";
import { shopItemSlotKey, findShopOffering } from "./shop-slot-keys";
import {
  commitShopInitialize,
  purchaseShopOffering,
  type DraftStateWriter,
  type ShopTransactionResult,
} from "./shop-transactions";

export function initializeShop<T>(
  setState: DraftStateWriter<T>,
  createInitial: (draft: GameplayDraft) => T,
): () => void {
  return () => commitShopInitialize(setState, createInitial);
}

export function readRefreshPrice(
  kind: ShopRefreshKind,
  talentEffects: TalentEffectManifest,
  refreshesLeft: number,
): number {
  return getShopRefreshPrice(kind, talentEffects, refreshesLeft, resolveReadShopModifiers());
}

export function cardSlotKeyOf(card: BattleCard, index: number): string {
  return shopItemSlotKey(card.id, index);
}

export function gearSlotKeyOf(instance: GearInstance): string {
  return instance.instanceId;
}

interface SlotPurchaseConfig<
  TState extends { firstPurchaseUsed: boolean; purchasedSlotKeys: string[] },
  TItem extends BattleCard | GearInstance | TrinketEntry,
> {
  talentEffects: TalentEffectManifest;
  state: TState;
  setState: DraftStateWriter<TState>;
  draft: GameplayDraft;
  items: readonly TItem[];
  requestedId: string;
  slotKey: string;
  buyKind: ShopBuyKind;
  slotKeyOf: (item: TItem, index: number) => string;
  idOf: (item: TItem) => string;
  isAvailable?: (draft: GameplayDraft, offered: TItem) => boolean;
  acquire: (draft: GameplayDraft, offered: TItem) => void;
}

export function purchaseSlotOffering<
  TState extends { firstPurchaseUsed: boolean; purchasedSlotKeys: string[] },
  TItem extends BattleCard | GearInstance | TrinketEntry,
>(config: SlotPurchaseConfig<TState, TItem>): ShopTransactionResult {
  const atSlot = findShopOffering(config.items, config.slotKey, config.slotKeyOf);
  const offered = atSlot !== undefined && config.idOf(atSlot) === config.requestedId ? atSlot : undefined;
  const draftContext = resolveDraftShopPricingContext(config.talentEffects, config.draft, config.state);
  if (!offered) {
    if (config.buyKind === "trinket") {
      const price = getShopBuyPrice(config.buyKind, null, draftContext);
      return { committed: false, price, value: undefined };
    }
    return { committed: false, price: 0, value: undefined };
  }
  const price =
    config.buyKind === "trinket"
      ? getShopBuyPrice(config.buyKind, null, draftContext)
      : getShopBuyPrice(config.buyKind, offered, draftContext);
  return purchaseShopOffering({
    draft: config.draft,
    price,
    state: config.state,
    setState: config.setState,
    slotKey: config.slotKey,
    offeringMatches: config.isAvailable ? config.isAvailable(config.draft, offered) : true,
    acquire: () => config.acquire(config.draft, offered),
  });
}
