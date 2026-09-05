import { useState } from "react";
import { anchoredPage, useAdaptiveGrid } from "../../shared/ui/adaptive-grid";
import { GridMeasurement } from "../../shared/ui/grid-measurement";
import { getCollectionLibraryLength } from "../../shared/ui/collection-items";
import { collectionShellWidthClass } from "../../shared/config";
import { PageLayout, ScreenHeaderRow, ScreenShell } from "../../shared/ui/shared-ui";
import {
  CollectionGrid,
  CollectionTabs,
  getCollectionTotalPages,
  CollectionPagination,
} from "../../shared/ui/collection-ui";
import type { CharacterId } from "../../shared/config/game-data-catalog";
import type { CollectionTab } from "../../shared/types";

export function CollectionScreen({
  collectionTab,
  onSelectTab,
  discoveredCardIds,
  encounteredEnemyIds,
  discoveredTrinketIds,
  discoveredUniqueIds,
  finishedRunCharacters,
  collectionPages,
  onPageChange,
  bondedCompanions,
  onBack,
  onMenu,
}: {
  collectionTab: CollectionTab;
  onSelectTab: (tab: CollectionTab) => void;
  discoveredCardIds: string[];
  encounteredEnemyIds: string[];
  discoveredTrinketIds: string[];
  discoveredUniqueIds: string[];
  finishedRunCharacters: CharacterId[];
  collectionPages: Record<CollectionTab, number>;
  onPageChange: (tab: CollectionTab, page: number) => void;
  bondedCompanions: Record<string, number>;
  onBack?: (() => void) | undefined;
  onMenu?: ((rect: DOMRect) => void) | undefined;
}) {
  const { onContainer, onMeasure, referenceTileWidth, pageSize, columns } = useAdaptiveGrid(
    collectionTab === "bestiary" ? 390 : 244.512,
    collectionTab === "bestiary" ? 3 : 4,
    collectionTab === "bestiary" ? 6 : 8,
  );
  const [paging, setPaging] = useState({
    tab: collectionTab,
    pageSize: pageSize,
    page: collectionPages[collectionTab] ?? 0,
  });
  let activePage = paging.page;
  if (paging.tab !== collectionTab || paging.pageSize !== pageSize) {
    activePage =
      paging.tab !== collectionTab
        ? (collectionPages[collectionTab] ?? 0)
        : anchoredPage(paging.page, paging.pageSize, pageSize, getCollectionLibraryLength(collectionTab));
    setPaging({ tab: collectionTab, pageSize: pageSize, page: activePage });
  }
  const totalPages = getCollectionTotalPages(collectionTab, pageSize);
  activePage = Math.min(Math.max(0, activePage), totalPages - 1);

  function handlePageChange(page: number) {
    setPaging({ tab: collectionTab, pageSize: pageSize, page });
    onPageChange(collectionTab, page);
  }

  return (
    <PageLayout>
      <ScreenShell maxWidthClass={collectionShellWidthClass}>
        <ScreenHeaderRow title="Collection" onBack={onBack} onMenu={onMenu} />
        <CollectionTabs collectionTab={collectionTab} onSelectTab={onSelectTab} />

        <div className="mt-6 flex flex-col items-center gap-4 overflow-visible">
          <div ref={onContainer} className="relative w-full overflow-visible">
            <GridMeasurement onMeasure={onMeasure} referenceTileWidth={referenceTileWidth} />
            <CollectionGrid
              collectionTab={collectionTab}
              discoveredCardIds={discoveredCardIds}
              encounteredEnemyIds={encounteredEnemyIds}
              discoveredTrinketIds={discoveredTrinketIds}
              discoveredUniqueIds={discoveredUniqueIds}
              finishedRunCharacters={finishedRunCharacters}
              page={activePage}
              pageSize={pageSize}
              columns={columns}
              bondedCompanions={bondedCompanions}
            />
          </div>
          <div className="flex flex-wrap items-center justify-center">
            <CollectionPagination page={activePage} totalPages={totalPages} onPageChange={handlePageChange} />
          </div>
        </div>
      </ScreenShell>
    </PageLayout>
  );
}
