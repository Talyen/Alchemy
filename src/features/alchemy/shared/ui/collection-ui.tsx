// Collection grid, tab, and pagination layout widgets.
// Depends on shaped collection items, tile rendering, collection metadata, and pagination UI.
// Used by CollectionScreen to render encyclopedia-style grids without owning screen routing.
/* eslint-disable react-refresh/only-export-components -- co-located collection subcomponents and search/zoom utilities */
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { PaginationControls } from "./shared-ui";
import { FadeSlot } from "./fade-slot";
import {
  collectionBestiaryGridClass,
  collectionCardGridClass,
  collectionGridBestiaryWidthClass,
  collectionGridTileWidthClass,
  collectionGridTrinketWidthClass,
  collectionTabMeta,
  collectionTrinketGridClass,
} from "../config";
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
  page,
  bondedCompanions,
}: {
  collectionTab: CollectionTab;
  discoveredCardIds: string[];
  encounteredEnemyIds: string[];
  discoveredTrinketIds: string[];
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
        bondedCompanions,
        page,
      }),
    [collectionTab, discoveredCardIds, encounteredEnemyIds, discoveredTrinketIds, bondedCompanions, page],
  );

  return (
    <FadeSlot
      swapKey={`${collectionTab}-${page}`}
      className={cn(
        "gap-y-8 overflow-visible",
        collectionTab === "trinkets"
          ? collectionTrinketGridClass
          : collectionTab === "bestiary"
            ? collectionBestiaryGridClass
            : collectionCardGridClass,
        "grid-rows-2",
      )}
    >
      {pageItems.map((item) => (
        <div key={`${item.hoverScope}-${item.id}`} className="relative">
          <CompendiumTile item={item} />
        </div>
      ))}
      {Array.from({ length: getCollectionFillerCount(pageItems.length, collectionTab) }).map((_, index) => (
        <div
          key={`collection-filler-${index}`}
          className={cn(
            collectionTab === "trinkets"
              ? collectionGridTrinketWidthClass
              : collectionTab === "bestiary"
                ? collectionGridBestiaryWidthClass
                : collectionGridTileWidthClass,
          )}
          aria-hidden="true"
        />
      ))}
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
