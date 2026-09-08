import type { BattleCard, TalentEffectManifest, TrinketEntry } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear";
import type { GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import {
  getShopBuyPrice,
  getShopBuyPrices,
  getShopRefreshPrice,
  type ShopBuyKind,
  type ShopRefreshKind,
} from "./shop-pricing";
import {
  resolveDraftShopModifiers,
  resolveDraftShopPricingContext,
  resolveReadShopModifiers,
  resolveReadShopPricingContext,
  type ShopSessionStateKey,
} from "./shop-pricing-context";
import { shopItemSlotKey, findShopOffering } from "./shop-slot-keys";
import {
  commitShopInitialize,
  mapRefreshedShopOfferings,
  purchaseShopOffering,
  refreshCardShopOfferings,
  refreshShopOfferings,
  type DraftStateWriter,
  type ShopTransactionResult,
} from "./shop-transactions";

export function initializeShop<T>(
  setState: DraftStateWriter<T>,
  createInitial: (draft: GameplayDraft) => T,
): () => void {
  return () => commitShopInitialize(setState, createInitial);
}

export function readBuyPrices(
  kind: ShopBuyKind,
  items: ReadonlyArray<BattleCard | GearInstance | TrinketEntry>,
  talentEffects: TalentEffectManifest,
  shopKey: ShopSessionStateKey,
): number[] {
  return getShopBuyPrices(
    kind,
    items as ReadonlyArray<BattleCard | GearInstance>,
    resolveReadShopPricingContext(talentEffects, shopKey),
  );
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

interface SlotPurchaseConfig<TState extends { firstPurchaseUsed: boolean; purchasedSlotKeys: string[] }, TItem> {
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

export function purchaseSlotOffering<TState extends { firstPurchaseUsed: boolean; purchasedSlotKeys: string[] }, TItem>(
  config: SlotPurchaseConfig<TState, TItem>,
): ShopTransactionResult {
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
      : getShopBuyPrice(config.buyKind, offered as unknown as BattleCard | GearInstance, draftContext);
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

interface CardRefreshConfig<TState extends { refreshesLeft: number; purchasedSlotKeys: string[] }> {
  talentEffects: TalentEffectManifest;
  draft: GameplayDraft;
  state: TState;
  setState: DraftStateWriter<TState>;
  itemsKey: keyof TState;
  pool: BattleCard[];
  currentItems: BattleCard[];
  count: number;
  rng: () => number;
  refreshKind: ShopRefreshKind;
  postSample?: (cards: BattleCard[]) => BattleCard[];
}

export function refreshCardOfferings<TState extends { refreshesLeft: number; purchasedSlotKeys: string[] }>(
  config: CardRefreshConfig<TState>,
): ShopTransactionResult<BattleCard[] | null> {
  return refreshCardShopOfferings<TState>({
    draft: config.draft,
    price: getShopRefreshPrice(
      config.refreshKind,
      config.talentEffects,
      config.state.refreshesLeft,
      resolveDraftShopModifiers(config.draft),
    ),
    refreshesLeft: config.state.refreshesLeft,
    pool: config.pool,
    currentItems: config.currentItems,
    count: config.count,
    setState: config.setState,
    rng: config.rng,
    mapState: (previous, cards) =>
      mapRefreshedShopOfferings(
        previous,
        config.itemsKey,
        (config.postSample?.(cards) ?? cards) as TState[keyof TState],
      ),
  });
}

interface CatalogRefreshConfig<TState extends { refreshesLeft: number; purchasedSlotKeys: string[] }, TItem> {
  talentEffects: TalentEffectManifest;
  draft: GameplayDraft;
  state: TState & { refreshesLeft: number };
  setState: DraftStateWriter<TState>;
  itemsKey: keyof TState;
  refreshKind: ShopRefreshKind;
  resample: () => TItem[];
}

export function refreshCatalogOfferings<TState extends { refreshesLeft: number; purchasedSlotKeys: string[] }, TItem>(
  config: CatalogRefreshConfig<TState, TItem>,
): ShopTransactionResult<TItem[] | null> {
  return refreshShopOfferings<TState, TItem>({
    draft: config.draft,
    price: getShopRefreshPrice(
      config.refreshKind,
      config.talentEffects,
      config.state.refreshesLeft,
      resolveDraftShopModifiers(config.draft),
    ),
    refreshesLeft: config.state.refreshesLeft,
    setState: config.setState,
    resample: config.resample,
    mapState: (previous, items) => mapRefreshedShopOfferings(previous, config.itemsKey, items as never),
  });
}
