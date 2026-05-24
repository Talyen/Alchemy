// Random sampling helpers for rewards, shops, routes, and mystery outcomes.
// Depends only on Math.random.
// Used by controllers/config where deterministic ordering is not required.
export function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

export function sampleItems<T>(items: T[], count: number, rng?: () => number): T[] {
  const rand = rng ?? Math.random;
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, Math.min(count, arr.length));
}

// Samples from items ensuring none of the excluded values are chosen.
// Returns as many unique items as are available up to count.
export function resampleItems<T>(items: T[], exclude: T[], count: number): T[] {
  const available = items.filter((item) => !exclude.includes(item));
  const pool = available.length > 0 ? available : items;
  return sampleItems(pool, Math.min(count, pool.length));
}
