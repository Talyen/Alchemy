export function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

export function sampleItems<T>(items: T[], count: number): T[] {
  const shuffled = [...items].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, items.length));
}

// Samples from items ensuring none of the excluded values are chosen.
// Falls back to sampleItems if not enough unique items are available.
export function resampleItems<T>(items: T[], exclude: T[], count: number): T[] {
  const available = items.filter((item) => !exclude.includes(item));
  if (available.length < count) return sampleItems(items, count);
  return sampleItems(available, count);
}
