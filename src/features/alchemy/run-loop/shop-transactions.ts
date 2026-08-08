// Shared merchant/alchemist refresh helpers.
import { selectRewardCards, type BattleCard } from "@/lib/game-data";
import { spendRunGold } from "./run-gold";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import type { GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";

type StateUpdater<T> = (updater: (previous: T) => T) => void;

interface RefreshShopOfferingsInput<T, TItem> {
  price: number;
  refreshesLeft: number;
  runGold: number;
  setRunGold: StateUpdater<number>;
  setState: StateUpdater<T>;
  mapState: (prev: T, newItems: TItem[]) => T;
  resample: (draft: GameplayDraft) => TItem[];
}

function refreshShopOfferings<T, TItem>(input: RefreshShopOfferingsInput<T, TItem>): boolean {
  return dispatchRunSessionCommand((draft) => {
    if (input.refreshesLeft <= 0 || input.runGold < input.price) return false;
    spendRunGold(input.price, (update) =>
      (input.setRunGold as unknown as (draft: GameplayDraft, value: (previous: number) => number) => void)(
        draft,
        update,
      ),
    );
    const newItems = input.resample(draft);
    (input.setState as unknown as (draft: GameplayDraft, value: (previous: T) => T) => void)(draft, (prev) =>
      input.mapState(prev, newItems),
    );
    return true;
  });
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
  rngForDraft?: (draft: GameplayDraft) => () => number;
}): () => boolean {
  return () =>
    refreshShopOfferings({
      price: config.getPrice(),
      refreshesLeft: config.getRefreshesLeft(),
      runGold: config.getRunGold(),
      setRunGold: config.setRunGold,
      setState: config.setState,
      mapState: config.getMapState,
      resample: (draft) =>
        selectRewardCards(
          config.getDeck(),
          config.getPool(),
          config.count,
          config.getCurrentItems(),
          config.rngForDraft?.(draft) ?? config.rng,
        ),
    });
}

export function makeShopRefreshHandler<TState, TItem>(config: {
  getPrice: () => number;
  getRefreshesLeft: () => number;
  getRunGold: () => number;
  setRunGold: StateUpdater<number>;
  setState: StateUpdater<TState>;
  resample: (draft: GameplayDraft) => TItem[];
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
      mapState: config.getMapState,
    });
}
