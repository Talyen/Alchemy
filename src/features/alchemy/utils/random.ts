// Random sampling helpers for rewards, shops, routes, and mystery outcomes.
// Depends only on Math.random.
// Used by controllers/config where deterministic ordering is not required.
import { shuffle } from "@/lib/utils";

export function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

export function sampleItems<T>(items: T[], count: number): T[] {
  return shuffle(items).slice(0, Math.min(count, items.length));
}

// Samples from items ensuring none of the excluded values are chosen.
// Returns as many unique items as are available up to count.
export function resampleItems<T>(items: T[], exclude: T[], count: number): T[] {
  const available = items.filter((item) => !exclude.includes(item));
  const pool = available.length > 0 ? available : items;
  return sampleItems(pool, Math.min(count, pool.length));
}
