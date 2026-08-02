// Random sampling helpers for rewards, shops, routes, and mystery outcomes.
// Depends on lib/utils shuffle for unbiased ordering.
// Callers provide the owning run or test RNG explicitly.
import { shuffle } from "@/lib/utils";

export function sampleItems<T>(items: T[], count: number, rng: () => number): T[] {
  return shuffle(items, rng).slice(0, Math.min(count, items.length));
}

// Samples from items ensuring none of the excluded values are chosen.
// Returns as many unique items as are available up to count.
export function resampleItems<T>(items: T[], exclude: T[], count: number, rng: () => number): T[] {
  const available = items.filter((item) => !exclude.includes(item));
  const pool = available.length > 0 ? available : items;
  return sampleItems(pool, Math.min(count, pool.length), rng);
}
