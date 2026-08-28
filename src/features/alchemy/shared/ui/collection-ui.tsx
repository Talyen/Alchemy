/* eslint-disable react-refresh/only-export-components -- co-located collection subcomponents and search/zoom utilities */
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { PaginationControls } from "./navigation";
import { FadeSlot } from "./fade-slot";
import {
  collectionBestiaryGridClass,
  collectionCardGridClass,
  collectionCardGridTileWidthClass,
  collectionGridBestiaryWidthClass,
  collectionGridMinHeightClass,
  collectionTabMeta,
  collectionTrinketGridClass,
} from "../config";
import type { CharacterId } from "@/features/alchemy/shared/config/game-data-catalog";
import type { CollectionTab } from "../types";
import { TabBar } from "./tab-bar";
import { CompendiumTile } from "./collection-tile";
import { getCollectionFillerCount, getCollectionPageItems } from "./collection-items";

export { getCollectionTotalPages } from "./collection-items";

export function CollectionGrid({
  collectionTab,
  discoveredCardIds,
  encounteredEnemyIds,
  discoveredTrinketIds,
  discoveredUniqueIds,
  finishedRunCharacters,
  page,
  bondedCompanions,
}: {
  collectionTab: CollectionTab;
  discoveredCardIds: string[];
  encounteredEnemyIds: string[];
  discoveredTrinketIds: string[];
  discoveredUniqueIds: string[];
  finishedRunCharacters: CharacterId[];
  page: number;
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
    ],
  );

  const gridClass =
    collectionTab === "bestiary"
      ? collectionBestiaryGridClass
      : collectionTab === "trinkets" || collectionTab === "uniques"
        ? collectionTrinketGridClass
        : collectionCardGridClass;
  const fillerClass =
    collectionTab === "bestiary"
      ? cn(collectionGridBestiaryWidthClass, "aspect-[4/3]")
      : cn(collectionCardGridTileWidthClass, "aspect-[3/4]");

  return (
    <FadeSlot swapKey={`${collectionTab}-${page}`} className={cn("overflow-visible", collectionGridMinHeightClass)}>
      <div className={cn(gridClass, "grid-rows-2 gap-y-8")}>
        {pageItems.map((item) => (
          <div key={`${item.hoverScope}-${item.id}`} className="relative">
            <CompendiumTile item={item} />
          </div>
        ))}
        {Array.from({ length: getCollectionFillerCount(pageItems.length, collectionTab) }).map((_, index) => (
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
