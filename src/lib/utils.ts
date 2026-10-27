export { cn } from "./cn";
export { clamp, clamp01 } from "./math";

export function capitalizeWord(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** True only for plain object records; arrays, null and primitives are rejected. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value) as object | null;
  return prototype === Object.prototype || prototype === null;
}

const amountFormatters = new Map<string, Intl.NumberFormat>();
// Locales are effectively bounded (a handful of supported languages), but the
// locale argument is caller-controlled: cap the cache so adversarial or
// synthetic locales cannot grow it without bound. Hits refresh recency so the
// two hot entries (standard/compact per active locale) are never evicted.
const MAX_CACHED_FORMATTERS = 32;
const COMPACT_AMOUNT_THRESHOLD = 100_000;

export function formatLargeAmount(amount: number, locale = "en"): string {
  const value = Number.isFinite(amount) ? amount : 0;
  const language = locale === "en-XA" ? "en" : locale;
  const compact = Math.abs(value) >= COMPACT_AMOUNT_THRESHOLD;
  const key = `${language}:${compact}`;
  const cached = amountFormatters.get(key);
  if (cached) {
    amountFormatters.delete(key);
    amountFormatters.set(key, cached);
    return cached.format(value);
  }
  const formatter = new Intl.NumberFormat(language, compact ? { notation: "compact", maximumFractionDigits: 1 } : {});
  if (amountFormatters.size >= MAX_CACHED_FORMATTERS) amountFormatters.delete(amountFormatters.keys().next().value!);
  amountFormatters.set(key, formatter);
  return formatter.format(value);
}

/** Deterministic JSON for digests and snapshot keys; object keys sort recursively. */
export function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, entry: unknown) =>
    typeof entry === "object" && entry !== null && !Array.isArray(entry)
      ? Object.fromEntries(Object.entries(entry).sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)))
      : entry,
  );
}

export function isValidDeckIndex(index: number, deckLength: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < deckLength;
}

export function appendUnique<T>(items: T[], item: T): T[];
export function appendUnique<T>(items: readonly T[], item: T): readonly T[];
export function appendUnique<T>(items: readonly T[], item: T): readonly T[] {
  if (items.includes(item)) return items;
  const unique = new Set(items);
  unique.add(item);
  return [...unique];
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
  return `id-${Date.now().toString(36)}-${fallbackInstanceCounter.toString(36)}`;
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
