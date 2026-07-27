// Shared merchant/alchemist gold spend and refresh helpers.
import { playGoldSpend } from "@/lib/audio";
import { selectRewardCards, type BattleCard } from "@/lib/game-data";
import { resampleItems } from "@/features/alchemy/shared/utils";

export function spendRunGold(price: number, setRunGold: (fn: (g: number) => number) => void): void {
  if (price > 0) playGoldSpend();
  setRunGold((g) => Math.max(0, g - price));
}

interface RefreshShopOfferingsInput<T, TItem> {
  price: number;
  refreshesLeft: number;
  runGold: number;
  setRunGold: (fn: (g: number) => number) => void;
  setState: (fn: (prev: T) => T) => void;
  mapState: (prev: T, newItems: TItem[]) => T;
  resample: () => TItem[];
}

function refreshShopOfferings<T, TItem>(input: RefreshShopOfferingsInput<T, TItem>): boolean {
  if (input.refreshesLeft <= 0 || input.runGold < input.price) return false;
  spendRunGold(input.price, input.setRunGold);
  const newItems = input.resample();
  input.setState((prev) => input.mapState(prev, newItems));
  return true;
}

interface RefreshOfferingsInput<T> {
  price: number;
  refreshesLeft: number;
  runGold: number;
  pool: BattleCard[];
  currentItems: BattleCard[];
  count: number;
  setRunGold: (fn: (g: number) => number) => void;
  setState: (fn: (prev: T) => T) => void;
  mapState: (prev: T, newItems: BattleCard[]) => T;
  deck?: BattleCard[];
  rng?: () => number;
}

export function markSlotPurchased(keys: string[], slotKey: string): string[] {
  return keys.includes(slotKey) ? keys : [...keys, slotKey];
}

export function makeCardRefreshHandler<T>(config: {
  getPrice: () => number;
  getRefreshesLeft: () => number;
  getRunGold: () => number;
  setRunGold: (fn: (g: number) => number) => void;
  getPool: () => BattleCard[];
  getCurrentItems: () => BattleCard[];
  count: number;
  setState: (fn: (prev: T) => T) => void;
  getDeck: () => BattleCard[];
  getMapState: (prev: T, items: BattleCard[]) => T;
  rng?: () => number;
}): () => boolean {
  return () =>
    refreshOfferings({
      price: config.getPrice(),
      refreshesLeft: config.getRefreshesLeft(),
      runGold: config.getRunGold(),
      pool: config.getPool(),
      currentItems: config.getCurrentItems(),
      count: config.count,
      setRunGold: config.setRunGold,
      setState: config.setState,
      mapState: (prev, items) => config.getMapState(prev, items),
      deck: config.getDeck(),
      ...(config.rng ? { rng: config.rng } : {}),
    });
}

export function makeShopRefreshHandler<TState, TItem>(config: {
  getPrice: () => number;
  getRefreshesLeft: () => number;
  getRunGold: () => number;
  setRunGold: (fn: (g: number) => number) => void;
  setState: (fn: (prev: TState) => TState) => void;
  resample: () => TItem[];
  getMapState: (prev: TState, items: TItem[]) => TState;
}): () => boolean {
  return () =>
    refreshShopOfferings({
      price: config.getPrice(),
      refreshesLeft: config.getRefreshesLeft(),
      runGold: config.getRunGold(),
      setRunGold: config.setRunGold,
      setState: config.setState,
      resample: config.resample,
      mapState: (prev, items) => config.getMapState(prev, items),
    });
}

export function refreshOfferings<T>(input: RefreshOfferingsInput<T>): boolean {
  return refreshShopOfferings<T, BattleCard>({
    price: input.price,
    refreshesLeft: input.refreshesLeft,
    runGold: input.runGold,
    setRunGold: input.setRunGold,
    setState: input.setState,
    mapState: input.mapState,
    resample: () =>
      input.deck
        ? selectRewardCards(input.deck, input.pool, input.count, input.currentItems, input.rng)
        : resampleItems(input.pool, input.currentItems, input.count, input.rng),
  });
}
