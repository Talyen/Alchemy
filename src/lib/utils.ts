export { cn } from "./cn";
export { clamp, clamp01 } from "./math";

export function capitalizeWord(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const amountFormatters = new Map<string, Intl.NumberFormat>();

export function formatLargeAmount(amount: number, locale = "en"): string {
  const value = Number.isFinite(amount) ? amount : 0;
  const language = locale === "en-XA" ? "en" : locale;
  const compact = Math.abs(value) >= 100000;
  const key = `${language}:${compact}`;
  let formatter = amountFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(language, compact ? { notation: "compact", maximumFractionDigits: 1 } : {});
    amountFormatters.set(key, formatter);
  }
  return formatter.format(value);
}

export function isValidDeckIndex(index: number, deckLength: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < deckLength;
}

export function appendUnique<T>(items: T[], item: T): T[];
export function appendUnique<T>(items: readonly T[], item: T): readonly T[];
export function appendUnique<T>(items: readonly T[], item: T): readonly T[] {
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

// No-op merges retain the original reference and its mutability contract.
export function appendUniqueMany<T>(items: T[], additions: readonly T[]): T[];
export function appendUniqueMany<T>(items: readonly T[], additions: readonly T[]): readonly T[];
export function appendUniqueMany<T>(items: readonly T[], additions: readonly T[]): readonly T[] {
  if (additions.length === 0 || (additions.length === 1 && items.includes(additions[0]!))) return items;
  const set = new Set(items);
  const originalSize = set.size;
  for (const add of additions) set.add(add);
  return set.size === originalSize ? items : [...set];
}
