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

// Picks one item from a non-empty collection without each caller repeating random index math.
export function pickRandom<T>(items: readonly T[]): T | undefined {
  return items[Math.floor(Math.random() * items.length)];
}

// Appends a value immutably only when it is not already present.
export function appendUnique<T>(items: readonly T[], item: T): T[] {
  return items.includes(item) ? [...items] : [...items, item];
}

// Merges newly discovered IDs while preserving the original encounter order.
export function appendUniqueMany<T>(items: readonly T[], additions: readonly T[]): T[] {
  return Array.from(new Set([...items, ...additions]));
}
