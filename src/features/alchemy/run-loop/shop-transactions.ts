// Shared merchant/alchemist refresh helpers.
import { selectRewardCards, type BattleCard } from "@/lib/game-data";
import { resampleItems } from "@/features/alchemy/shared/utils";
import { spendRunGold } from "./run-gold";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";

// Shared merchant/alchemist refresh helpers.

type StateUpdater<T> = (updater: (previous: T) => T) => void;

interface RefreshShopOfferingsInput<T, TItem> {
  price: number;
  refreshesLeft: number;
  runGold: number;
  setRunGold: StateUpdater<number>;
  setState: StateUpdater<T>;
  mapState: (prev: T, newItems: TItem[]) => T;
  resample: () => TItem[];
}

function refreshShopOfferings<T, TItem>(input: RefreshShopOfferingsInput<T, TItem>): boolean {
  return dispatchRunSessionCommand(() => {
    if (input.refreshesLeft <= 0 || input.runGold < input.price) return false;
    spendRunGold(input.price, input.setRunGold);
    const newItems = input.resample();
    input.setState((prev) => input.mapState(prev, newItems));
    return true;
  });
}

interface RefreshOfferingsInput<T> {
  price: number;
  refreshesLeft: number;
  runGold: number;
  pool: BattleCard[];
  currentItems: BattleCard[];
  count: number;
  setRunGold: StateUpdater<number>;
  setState: StateUpdater<T>;
  mapState: (prev: T, newItems: BattleCard[]) => T;
  deck?: BattleCard[];
  rng: () => number;
}

export function markSlotPurchased(keys: string[], slotKey: string): string[] {
  return keys.includes(slotKey) ? keys : [...keys, slotKey];
}

export function makeCardRefreshHandler<T>(config: {
  getPrice: () => number;
  getRefreshesLeft: () => number;
  getRunGold: () => number;
  setRunGold: StateUpdater<number>;
  getPool: () => BattleCard[];
  getCurrentItems: () => BattleCard[];
  count: number;
  setState: StateUpdater<T>;
  getDeck: () => BattleCard[];
  getMapState: (prev: T, items: BattleCard[]) => T;
  rng: () => number;
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
      rng: config.rng,
    });
}

export function makeShopRefreshHandler<TState, TItem>(config: {
  getPrice: () => number;
  getRefreshesLeft: () => number;
  getRunGold: () => number;
  setRunGold: StateUpdater<number>;
  setState: StateUpdater<TState>;
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
