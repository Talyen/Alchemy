// Discovery pack row layout — uses the same grid classes as CollectionGrid.
import { collectionCardGridClass, collectionBoonGridClass } from "../config";

export type DiscoveryPackGridLayout = {
  gridClass: string;
  columnCount: number;
};

export function getDiscoveryPackGridLayout(isBoon: boolean): DiscoveryPackGridLayout {
  return isBoon
    ? { gridClass: collectionBoonGridClass, columnCount: 3 }
    : { gridClass: collectionCardGridClass, columnCount: 4 };
}

export function isSingleDiscoveryRow(items: readonly unknown[]): boolean {
  return items.length === 1;
}

export function getCenteredGridSlots<T>(items: readonly T[], columnCount: number): (T | null)[] {
  if (items.length === 0) {
    return Array.from({ length: columnCount }, () => null);
  }
  const startCol = Math.floor((columnCount - items.length) / 2);
  return Array.from({ length: columnCount }, (_, col) => {
    const itemIndex = col - startCol;
    if (itemIndex < 0 || itemIndex >= items.length) return null;
    return items[itemIndex] ?? null;
  });
}
