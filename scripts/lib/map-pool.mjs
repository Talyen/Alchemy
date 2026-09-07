/**
 * Run an async mapper over items with bounded concurrency.
 * Results preserve input order.
 *
 * @template T, R
 * @param {readonly T[]} items
 * @param {number} concurrency
 * @param {(item: T, index: number) => Promise<R>} mapper
 * @returns {Promise<R[]>}
 */
export async function mapPool(items, concurrency, mapper) {
  const limit = Math.max(1, Math.min(concurrency, items.length || 1));
  /** @type {R[]} */
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  const settled = await Promise.allSettled(workers);
  const failures = settled.filter((result) => result.status === "rejected").map((result) => result.reason);
  if (failures.length > 0) {
    throw new AggregateError(failures, failures.map(String).join(" "));
  }
  return results;
}
