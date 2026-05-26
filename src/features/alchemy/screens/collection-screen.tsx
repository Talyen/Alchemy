// Collection screen with tabs (cards / bestiary / trinkets) and paginated grid.
// All three tab grids are rendered simultaneously (preloaded) — only the active
// one is visible, so switching tabs is instant with no image re-loading.
import { cn } from "@/lib/utils";
import { HamburgerTrigger, PageLayout, ScreenHeader } from "../ui/shared-ui";
import { CollectionGrid, CollectionTabs, getCollectionTotalPages, CollectionPagination } from "../ui/collection-ui";
import type { CollectionTab } from "../types";

const COLLECTION_TABS: CollectionTab[] = ["cards", "bestiary", "trinkets"];

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
      <div className="alchemy-shell flex min-h-[48.15cqh] w-full max-w-6xl flex-col rounded-[28px] p-7">
        <div className="relative flex w-full items-center justify-center">
          <ScreenHeader title="Collection" />
          <div className="absolute right-0 top-1/2 -translate-y-1/2">
            <HamburgerTrigger onClick={onOpenMenu} label="Open collection menu" />
          </div>
        </div>
        <CollectionTabs collectionTab={collectionTab} onSelectTab={onSelectTab} />

        <div className="mt-6 flex min-h-[59.26cqh] flex-col items-center overflow-visible">
          <div className="grid min-h-[50cqh] w-full grid-cols-1 overflow-visible">
            {COLLECTION_TABS.map((tab) => (
              <div
                key={tab}
                className={cn(
                  "motion-crossfade col-start-1 row-start-1 overflow-visible",
                  collectionTab === tab ? "opacity-100" : "motion-crossfade-hidden pointer-events-none opacity-0",
                )}
              >
                <CollectionGrid
                  collectionTab={tab}
                  discoveredCardIds={discoveredCardIds}
                  encounteredEnemyIds={encounteredEnemyIds}
                  discoveredTrinketIds={discoveredTrinketIds}
                  page={collectionPages[tab]}
                  bondedCompanions={bondedCompanions}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-2">
          <CollectionPagination page={activePage} totalPages={totalPages} onPageChange={handlePageChange} />
        </div>
      </div>
    </PageLayout>
  );
}
