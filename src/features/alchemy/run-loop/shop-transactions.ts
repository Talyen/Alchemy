// Shared merchant/alchemist gold spend and refresh helpers.
import { playGoldSpend } from "@/lib/audio";
import { selectRewardCards, type BattleCard } from "@/lib/game-data";
import { resampleItems } from "@/features/alchemy/shared/utils";

export function spendRunGold(price: number, setRunGold: (fn: (g: number) => number) => void): void {
  if (price > 0) playGoldSpend();
  setRunGold((g) => Math.max(0, g - price));
}

type RefreshOfferingsInput<T> = {
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
};

export function refreshOfferings<T>(input: RefreshOfferingsInput<T>): boolean {
  if (input.refreshesLeft <= 0 || input.runGold < input.price) return false;
  spendRunGold(input.price, input.setRunGold);
  const newItems = input.deck
    ? selectRewardCards(input.deck, input.pool, input.count, input.currentItems)
    : resampleItems(input.pool, input.currentItems, input.count);
  input.setState((prev) => input.mapState(prev, newItems));
  return true;
}
