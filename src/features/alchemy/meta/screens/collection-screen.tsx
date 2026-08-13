// Collection screen with tabs (cards / bestiary / boons) and paginated grid.
// The active grid alone is mounted. Art remains globally predecoded at boot, so
// tab switches stay instant without retaining three grids of interactive DOM.
import { collectionShellWidthClass } from "../../shared/config";
import { HamburgerTrigger, PageLayout, ScreenHeaderRow, ScreenShell } from "../../shared/ui/shared-ui";
import {
  CollectionGrid,
  CollectionTabs,
  getCollectionTotalPages,
  CollectionPagination,
} from "../../shared/ui/collection-ui";
import type { CollectionTab } from "../../shared/types";

export function CollectionScreen({
  onOpenMenu,
  collectionTab,
  onSelectTab,
  discoveredCardIds,
  encounteredEnemyIds,
  discoveredTrinketIds,
  collectionPages,
  onPageChange,
  bondedCompanions,
}: {
  onOpenMenu: (rect?: DOMRect) => void;
  collectionTab: CollectionTab;
  onSelectTab: (tab: CollectionTab) => void;
  discoveredCardIds: string[];
  encounteredEnemyIds: string[];
  discoveredTrinketIds: string[];
  collectionPages: Record<CollectionTab, number>;
  onPageChange: (tab: CollectionTab, page: number) => void;
  bondedCompanions: Record<string, number>;
}) {
  const totalPages = getCollectionTotalPages(collectionTab);
  const activePage = collectionPages[collectionTab];

  function handlePageChange(page: number) {
    onPageChange(collectionTab, page);
  }

  return (
    <PageLayout>
      <ScreenShell maxWidthClass={collectionShellWidthClass}>
        <ScreenHeaderRow
          title="Collection"
          trailing={<HamburgerTrigger onClick={onOpenMenu} label="Open collection menu" />}
        />
        <CollectionTabs collectionTab={collectionTab} onSelectTab={onSelectTab} />

        <div className="mt-6 flex flex-col items-center gap-4 overflow-visible">
          <div className="w-full overflow-visible">
            <CollectionGrid
              collectionTab={collectionTab}
              discoveredCardIds={discoveredCardIds}
              encounteredEnemyIds={encounteredEnemyIds}
              discoveredTrinketIds={discoveredTrinketIds}
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
