import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { PaginationControls } from "./navigation";
import { FadeSlot } from "./use-fade";
import {
  artTileGridRowsClass,
  collectionCardGridTileWidthClass,
  collectionGridBestiaryWidthClass,
  collectionGridMinHeightClass,
  collectionTabMeta,
} from "../config";
import type { CharacterId } from "@/features/alchemy/shared/config/game-data-catalog";
import type { CollectionTab } from "../types";
import { TabBar } from "./tab-bar";
import { CollectionTile } from "./collection-tile";
import { getCollectionPageItems } from "./collection-items";

export { getCollectionTotalPages } from "./collection-items";

export function CollectionGrid({
  collectionTab,
  discoveredCardIds,
  encounteredEnemyIds,
  discoveredTrinketIds,
  discoveredUniqueIds,
  finishedRunCharacters,
  page,
  pageSize,
  columns,
  bondedCompanions,
}: {
  collectionTab: CollectionTab;
  discoveredCardIds: string[];
  encounteredEnemyIds: string[];
  discoveredTrinketIds: string[];
  discoveredUniqueIds: string[];
  finishedRunCharacters: CharacterId[];
  page: number;
  pageSize: number;
  columns: number;
  bondedCompanions: Record<string, number>;
}) {
  const pageItems = useMemo(
    () =>
      getCollectionPageItems({
        collectionTab,
        discoveredCardIds,
        encounteredEnemyIds,
        discoveredTrinketIds,
        discoveredUniqueIds,
        finishedRunCharacters,
        bondedCompanions,
        page,
        pageSize,
      }),
    [
      collectionTab,
      discoveredCardIds,
      encounteredEnemyIds,
      discoveredTrinketIds,
      discoveredUniqueIds,
      finishedRunCharacters,
      bondedCompanions,
      page,
      pageSize,
    ],
  );

  const fillerClass =
    collectionTab === "bestiary"
      ? cn(collectionGridBestiaryWidthClass, "aspect-[4/3]")
      : cn(collectionCardGridTileWidthClass, "aspect-[3/4]");

  return (
    <FadeSlot swapKey={`${collectionTab}-${page}`} className={cn("overflow-visible", collectionGridMinHeightClass)}>
      <div
        className={cn("grid w-full gap-x-5", artTileGridRowsClass)}
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, calc(${collectionTab === "bestiary" ? 390 : 244.512}px * var(--content-scale, 1))))`,
          justifyContent: "center",
        }}
      >
        {pageItems.map((item) => (
          <div key={`${item.hoverScope}-${item.id}`} className="relative">
            <CollectionTile item={item} />
          </div>
        ))}
        {Array.from({ length: Math.max(0, pageSize - pageItems.length) }).map((_, index) => (
          <div key={`collection-filler-${index}`} className={fillerClass} />
        ))}
      </div>
    </FadeSlot>
  );
}

export function CollectionTabs({
  collectionTab,
  onSelectTab,
}: {
  collectionTab: CollectionTab;
  onSelectTab: (tab: CollectionTab) => void;
}) {
  return (
    <div className="mt-6">
      <TabBar tabs={collectionTabMeta} activeTab={collectionTab} onSelectTab={onSelectTab} />
    </div>
  );
}

export function CollectionPagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <PaginationControls
      page={page}
      totalPages={totalPages}
      onPageChange={onPageChange}
      size="default"
      reserveSpace
      className="mt-0"
    />
  );
}
