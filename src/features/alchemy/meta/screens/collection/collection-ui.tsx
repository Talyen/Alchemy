import { useMemo } from "react";
import { PaginationControls } from "../../../shared/ui/navigation";
import { FadeSlot } from "../../../shared/ui/use-fade";
import {
  collectionTabMeta,
  COLLECTION_BESTIARY_REFERENCE_WIDTH,
  COLLECTION_CARD_REFERENCE_WIDTH,
} from "../../../shared/config";
import type { CharacterId } from "@/features/alchemy/shared/config/game-data-catalog";
import type { CollectionTab } from "../../../shared/types";
import { TabBar } from "../../../shared/ui/tab-bar";
import { CollectionTile } from "./collection-tile";
import { getCollectionPageItems } from "./collection-items";

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
  onEnemyActivate,
  inspectionOpen = false,
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
  onEnemyActivate?: (enemyId: string, trigger: HTMLButtonElement) => void;
  inspectionOpen?: boolean;
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

  const referenceWidth =
    collectionTab === "bestiary" ? COLLECTION_BESTIARY_REFERENCE_WIDTH : COLLECTION_CARD_REFERENCE_WIDTH;
  // Fractional scaling must not wrap the final tile solely because of CSS rounding.
  const rowWidth = columns * referenceWidth + (columns - 1) * 20 + 0.5;

  return (
    <FadeSlot swapKey={`${collectionTab}-${page}`} className="w-full overflow-visible">
      <div
        className="mx-auto flex max-w-full flex-wrap justify-center gap-x-5 gap-y-8"
        style={{ width: `calc(${rowWidth}px * var(--content-scale, 1))` }}
      >
        {pageItems.map((item) => (
          <div
            key={`${item.hoverScope}-${item.id}`}
            className="relative max-w-full shrink-0"
            style={{ width: `calc(${referenceWidth}px * var(--content-scale, 1))` }}
          >
            <CollectionTile item={item} onEnemyActivate={onEnemyActivate} inspectionOpen={inspectionOpen} />
          </div>
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
      className="mt-0"
    />
  );
}
