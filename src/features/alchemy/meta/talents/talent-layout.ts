export function chunkIntoRows<T>(items: T[], sizes: readonly number[] | number): T[][] {
  if (typeof sizes === "number") {
    const rows: T[][] = [];
    for (let i = 0; i < items.length; i += sizes) {
      rows.push(items.slice(i, i + sizes));
    }
    return rows;
  }
  const rows: T[][] = [];
  let index = 0;
  for (const size of sizes) {
    rows.push(items.slice(index, index + size));
    index += size;
  }
  return rows;
}
