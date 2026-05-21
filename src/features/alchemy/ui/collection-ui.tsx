// Collection grid, tab, and pagination layout widgets.
// Depends on shaped collection items, tile rendering, collection metadata, and pagination UI.
// Used by CollectionScreen to render encyclopedia-style grids without owning screen routing.
/* eslint-disable react-refresh/only-export-components */
import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

import { PaginationControls } from "./shared-ui";
import { collectionTabMeta, collectionTileWidthClass, trinketCardWidthClass } from "../config";
import type { CollectionTab } from "../types";
import { getHoverId } from "../utils";
import { PressableMotion } from "./pressable-motion";
import { CompendiumTile } from "./collection-tile";
import { getCollectionFillerCount, getCollectionPageItems } from "./collection-items";

export { getCollectionTotalPages } from "./collection-items";

export function CollectionGrid({
  collectionTab,
  hoveredCardId,
  discoveredCardIds,
  encounteredEnemyIds,
  discoveredTrinketIds,
  onHoverChange,
  page,
  shimmerState,
  onHoverShimmer,
  bondedCompanions,
}: {
  collectionTab: CollectionTab;
  hoveredCardId: string | null;
  discoveredCardIds: string[];
  encounteredEnemyIds: string[];
  discoveredTrinketIds: string[];
  onHoverChange: (nextHoverId: string | null | ((current: string | null) => string | null)) => void;
  page: number;
  shimmerState: { cardId: string; token: number } | null;
  onHoverShimmer: (cardId: string) => void;
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
      className="state-swap grid min-h-[50cqh] grid-cols-4 grid-rows-2 justify-items-center gap-x-6 gap-y-7 overflow-visible"
    >
      {pageItems.map((item, index) => {
        const hoverId = getHoverId(item.hoverScope, item.id);

        return (
          <CompendiumTile
            key={`${item.hoverScope}-${item.id}`}
            item={item}
            hovered={hoveredCardId === hoverId}
            onHoverStart={() => {
              onHoverChange(hoverId);
              onHoverShimmer(hoverId);
            }}
            onHoverEnd={() => onHoverChange((current) => (current === hoverId ? null : current))}
            shimmerActive={shimmerState?.cardId === hoverId}
            shimmerToken={shimmerState?.token}
            wrapperStyle={{ "--stagger-index": index } as CSSProperties}
          />
        );
      })}
      {Array.from({ length: getCollectionFillerCount(pageItems.length) }).map((_, index) => (
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
    <div className="mt-6 flex flex-wrap justify-center gap-3">
      {collectionTabMeta.map((tab) => {
        const Icon = tab.icon;

        return (
          <PressableMotion key={tab.id}>
            <button
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={cn(
                "inline-flex min-h-[4.07cqh] items-center gap-2 rounded-full bg-card px-4 py-2 text-sm font-semibold text-foreground ring-1 ring-offset-1 ring-offset-card transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                collectionTab === tab.id ? "ring-primary/70" : "ring-border/30 hover:ring-border/50",
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          </PressableMotion>
        );
      })}
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
