import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function capitalizeWord(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatLargeAmount(amount: number): string {
  return amount >= 100000 ? `${(amount / 1000).toFixed(1)}k` : amount.toLocaleString();
}

export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.min(index, Math.floor(rng() * (index + 1)));

    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!];
  }
  return shuffled;
}

export function sampleItems<T>(items: readonly T[], count: number, rng: () => number): T[] {
  return shuffle(items, rng).slice(0, Math.min(count, items.length));
}

export function pickRandom<T>(items: readonly T[], rng: () => number = Math.random): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}

export function takeRandomItem<T>(items: T[], rng: () => number = Math.random): T | undefined {
  if (items.length === 0) return undefined;
  const index = Math.min(items.length - 1, Math.floor(rng() * items.length));
  const [removed] = items.splice(index, 1);
  return removed;
}

export function isValidDeckIndex(index: number, deckLength: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < deckLength;
}

export function createSeededRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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
