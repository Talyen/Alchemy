// Collection grid, tab, and pagination layout widgets.
// Depends on shaped collection items, tile rendering, collection metadata, and pagination UI.
// Used by CollectionScreen to render encyclopedia-style grids without owning screen routing.
/* eslint-disable react-refresh/only-export-components */
import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

import { PaginationControls } from "./shared-ui";
import { collectionTabMeta, collectionTileWidthClass, trinketCardWidthClass } from "../config";
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
  const pageItems = getCollectionPageItems({
    collectionTab,
    discoveredCardIds,
    encounteredEnemyIds,
    discoveredTrinketIds,
    bondedCompanions,
    page,
  });

  return (
    <div
      key={`${collectionTab}-${page}`}
      className={cn(
        "state-swap grid min-h-[50cqh] justify-items-center gap-x-3 gap-y-7 overflow-visible",
        collectionTab === "trinkets" ? "grid-cols-3 grid-rows-2" : "grid-cols-4 grid-rows-2",
      )}
    >
      {pageItems.map((item, index) => (
        <CompendiumTile
          key={`${item.hoverScope}-${item.id}`}
          item={item}
          wrapperStyle={{ "--stagger-index": index } as CSSProperties}
        />
      ))}
      {Array.from({ length: getCollectionFillerCount(pageItems.length, collectionTab) }).map((_, index) => (
        <div
          key={`collection-filler-${index}`}
          className={collectionTab === "trinkets" ? trinketCardWidthClass : collectionTileWidthClass}
          aria-hidden="true"
        />
      ))}
    </div>
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
    <PaginationControls page={page} totalPages={totalPages} onPageChange={onPageChange} size="default" reserveSpace />
  );
}
