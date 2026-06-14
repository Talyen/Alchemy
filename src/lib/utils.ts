// Shared low-level helpers for class names, numeric bounds, random selection, and immutable lists.
// Depends on clsx and tailwind-merge.
// Used across UI and controller modules to avoid repeating tiny utility patterns.
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Keeps conditional Tailwind classes deterministic by resolving conflicts after clsx flattens input.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Centralizes numeric bounds so volume and percentage-style controls clamp consistently.
export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

// Inclusive integer in [min, max].
export function randomInt(min: number, max: number, rng: () => number = Math.random) {
  return Math.floor(rng() * (max - min + 1) + min);
}

// First character uppercased for display labels (damage types, statuses, etc.).
export function capitalizeWord(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// Fisher-Yates shuffle — O(n), unbiased, in-place on a clone.
export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

// Picks one item from a non-empty collection without each caller repeating random index math.
export function pickRandom<T>(items: readonly T[], rng: () => number = Math.random): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(rng() * items.length)];
}

// Mulberry32 seeded PRNG — returns a function that produces deterministic
// values in [0, 1) for a given integer seed.
export function createSeededRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Appends a value immutably only when it is not already present.
export function appendUnique<T>(items: readonly T[], item: T): T[] {
  return items.includes(item) ? [...items] : [...items, item];
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

// Merges newly discovered IDs while preserving the original encounter order.
export function appendUniqueMany<T>(items: readonly T[], additions: readonly T[]): T[] {
  return Array.from(new Set([...items, ...additions]));
}

export type Setter<T> = (action: T | ((prev: T) => T)) => void;

// Adapts Zustand setters to React Dispatch<SetStateAction> call sites.
export function wrapStoreSetter<T>(getCurrent: () => T, setter: (value: T) => void): Setter<T> {
  return (action) => {
    const nextVal = typeof action === "function" ? (action as (prev: T) => T)(getCurrent()) : action;
    setter(nextVal);
  };
}
