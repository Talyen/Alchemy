export function spendRunGold(price: number, setGold: (fn: (g: number) => number) => void): void {
  setGold((g) => Math.max(0, g - price));
}
