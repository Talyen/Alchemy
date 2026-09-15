import { readActivityData } from "@/lib/active-run-session";
import type { BattleCard, TalentEffectManifest, TrinketEntry } from "@/lib/game-data";
import type { ShopRefreshModifiers } from "./shop-action-types";
import type { GearInstance } from "@/lib/gear";
import type { GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import { getShopBuyPrice, getShopRefreshPrice, type ShopBuyKind, type ShopRefreshKind } from "./shop-pricing";
import {
  resolveDraftShopModifiers,
  resolveDraftShopPricingContext,
  resolveReadShopModifiers,
} from "./shop-pricing-context";
import { shopItemSlotKey, findShopOffering } from "./shop-slot-keys";
import {
  commitShopInitialize,
  purchaseShopOffering,
  refreshShopOfferings,
  runShopTransaction,
  type DraftStateWriter,
  type ShopTransactionResult,
} from "./shop-transactions";

export function initializeShop<T>(
  setState: DraftStateWriter<T>,
  createInitial: (draft: GameplayDraft) => T,
): () => void {
  return () => commitShopInitialize(setState, createInitial);
}

function readRefreshPrice(
  kind: ShopRefreshKind,
  talentEffects: TalentEffectManifest,
  refreshesLeft: number,
  modifiers: ShopRefreshModifiers = resolveReadShopModifiers(),
): number {
  return getShopRefreshPrice(kind, talentEffects, refreshesLeft, modifiers);
}

export function createGetRefreshPrice(
  kind: ShopRefreshKind,
  talentEffects: TalentEffectManifest,
): (refreshesLeft: number, modifiers?: ShopRefreshModifiers) => number {
  return (refreshesLeft: number, modifiers?: ShopRefreshModifiers) =>
    readRefreshPrice(kind, talentEffects, refreshesLeft, modifiers ?? resolveReadShopModifiers());
}

export function createShopRefreshAction<TState extends { refreshesLeft: number; purchasedSlotKeys: string[] }, TItem>({
  activity,
  kind,
  talentEffects,
  setState,
  mapState,
  resample,
  guard,
}: {
  activity: "shop" | "alchemist" | "trinket-shop" | "equipment-shop";
  kind: ShopRefreshKind;
  talentEffects: TalentEffectManifest;
  setState: DraftStateWriter<TState>;
  mapState: (previous: TState, newItems: TItem[]) => TState;
  resample: (draft: GameplayDraft, state: TState, modifiers: ShopRefreshModifiers) => TItem[];
  guard?: (draft: GameplayDraft, state: TState) => boolean;
}): () => boolean {
  return () =>
    runShopTransaction(
      activity,
      (draft) => {
        const state = readActivityData(draft.session.activity, activity) as unknown as TState;
        if (guard && !guard(draft, state)) return { committed: false, price: 0, value: null };
        const modifiers = resolveDraftShopModifiers(draft);
        const price = getShopRefreshPrice(kind, talentEffects, state.refreshesLeft, modifiers);
        return refreshShopOfferings({
          draft,
          price,
          refreshesLeft: state.refreshesLeft,
          setState,
          mapState,
          resample: () => resample(draft, state, modifiers),
        });
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
