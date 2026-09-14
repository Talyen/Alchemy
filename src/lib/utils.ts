export { cn } from "./cn";
export { clamp, clamp01, lerp } from "./math";

export function capitalizeWord(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatLargeAmount(amount: number): string {
  if (!Number.isFinite(amount)) return "0";
  return amount >= 100000 ? `${(amount / 1000).toFixed(1)}k` : amount.toLocaleString();
}

export { createSeededRng, shuffle, sampleItems, pickRandom, takeRandomItem } from "./rng";

export function isValidDeckIndex(index: number, deckLength: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < deckLength;
}

export function appendUnique<T>(items: readonly T[], item: T): T[] {
  return appendUniqueMany(items, [item]);
}

let fallbackInstanceCounter = 0;

export function createInstanceId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  // Last-resort fallback for non-secure contexts without WebCrypto. The
  // monotonic counter keeps bulk generation within the same millisecond unique.
  fallbackInstanceCounter += 1;
  return `id-${Date.now()}-${fallbackInstanceCounter}-${Math.random().toString(36).slice(2) || "0"}`;
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
