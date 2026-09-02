export { cn } from "./cn";
export { clamp, clamp01, lerp, clampNonNegative } from "./math";

export function capitalizeWord(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatLargeAmount(amount: number): string {
  return amount >= 100000 ? `${(amount / 1000).toFixed(1)}k` : amount.toLocaleString();
}

export {
  createSeededRng,
  createRunRngState,
  createRunStreamRng,
  nextRunRngValue,
  rngInt,
  placeholderRng,
  rollPercent,
  rollChance,
  getBattleRng,
  shuffle,
  sampleItems,
  pickRandom,
  takeRandomItem,
  shuffleUnsafe,
  pickRandomUnsafe,
  takeRandomItemUnsafe,
} from "./rng";
export type { Rng, RunRngState, RunRngStream } from "./rng";

export function isValidDeckIndex(index: number, deckLength: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < deckLength;
}

export function appendUnique<T>(items: readonly T[], item: T): T[] {
  return items.includes(item) ? (items as T[]) : [...items, item];
}

export function createInstanceId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function appendUniqueMany<T>(items: readonly T[], additions: readonly T[]): T[] {
  if (additions.length === 0) return items as T[];
  const set = new Set(items);
  let changed = false;
  for (const add of additions) {
    if (!set.has(add)) {
      set.add(add);
      changed = true;
    }
  }
  return changed ? Array.from(set) : (items as T[]);
}
