// Shared run-gold spend helper used by shops, mystery, and other run-loop spenders.
import { playGoldSpend } from "@/lib/audio";

export function spendRunGold(price: number, setRunGold: (fn: (g: number) => number) => void): void {
  if (price > 0) playGoldSpend();
  setRunGold((g) => Math.max(0, g - price));
}
