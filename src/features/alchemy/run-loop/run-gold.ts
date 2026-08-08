// Pure run-gold spend helper used by shops, mystery, and other run-loop spenders.
export function spendRunGold(price: number, setRunGold: (fn: (g: number) => number) => void): void {
  setRunGold((g) => Math.max(0, g - price));
}
