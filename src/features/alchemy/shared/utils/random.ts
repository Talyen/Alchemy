// Random sampling helpers for rewards, shops, routes, and mystery outcomes.
// Depends on lib/utils shuffle for unbiased ordering.
// Callers provide the owning run or test RNG explicitly.
import { shuffle } from "@/lib/utils";

export function sampleItems<T>(items: T[], count: number, rng: () => number): T[] {
  return shuffle(items, rng).slice(0, Math.min(count, items.length));
}
