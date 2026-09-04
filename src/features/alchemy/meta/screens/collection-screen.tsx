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
}) {
  const totalPages = getCollectionTotalPages(collectionTab);
  const activePage = Math.min(Math.max(0, collectionPages[collectionTab] ?? 0), totalPages - 1);

  function handlePageChange(page: number) {
    onPageChange(collectionTab, page);
  }

  return (
    <PageLayout>
      <ScreenShell maxWidthClass={collectionShellWidthClass}>
        <ScreenHeaderRow title="Collection" />
        <CollectionTabs collectionTab={collectionTab} onSelectTab={onSelectTab} />

        <div className="mt-6 flex flex-col items-center gap-4 overflow-visible">
          <div className="w-full overflow-visible">
            <CollectionGrid
              collectionTab={collectionTab}
              discoveredCardIds={discoveredCardIds}
              encounteredEnemyIds={encounteredEnemyIds}
              discoveredTrinketIds={discoveredTrinketIds}
              discoveredUniqueIds={discoveredUniqueIds}
              finishedRunCharacters={finishedRunCharacters}
              page={activePage}
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
