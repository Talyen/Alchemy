// Collection screen with tabs (cards / bestiary / trinkets) and paginated grid.
// All three tab grids are rendered simultaneously (preloaded) — only the active
// one is visible, so switching tabs is instant with no image re-loading.
import { cn } from "@/lib/utils";
import { House, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLayout } from "../ui/shared-ui";
import { CollectionGrid, CollectionPagination, CollectionTabs, getCollectionTotalPages } from "../ui/collection-ui";
import { useShimmerController } from "../hooks";
import type { CollectionTab } from "../types";

const COLLECTION_TABS: CollectionTab[] = ["cards", "bestiary", "trinkets"];

export function CollectionScreen({
  hasActiveBattle, onMainMenu, onReturnToBattle, collectionTab, onSelectTab,
  hoveredCardId, onHoverChange, discoveredCardIds, encounteredEnemyIds,
  discoveredTrinketIds, collectionPages, onPageChange,
}: {
  hasActiveBattle: boolean; onMainMenu: () => void; onReturnToBattle: () => void;
  collectionTab: CollectionTab; onSelectTab: (tab: CollectionTab) => void;
  hoveredCardId: string | null;
  onHoverChange: (value: string | null | ((current: string | null) => string | null)) => void;
  discoveredCardIds: string[]; encounteredEnemyIds: string[]; discoveredTrinketIds: string[];
  collectionPages: Record<CollectionTab, number>;
  onPageChange: (tab: CollectionTab, page: number) => void;
}) {
  const { shimmerState, maybeTriggerShimmer } = useShimmerController();
  const totalPages = getCollectionTotalPages(collectionTab);
  const activePage = collectionPages[collectionTab];

  function handlePageChange(page: number) {
    onPageChange(collectionTab, page);
  }

  return (
    <PageLayout>
      <h1 className="text-4xl text-foreground">Collection</h1>
      <CollectionTabs collectionTab={collectionTab} onSelectTab={onSelectTab} />

      <div className="mt-6 flex min-h-[640px] flex-col items-center overflow-visible">
        <div className="grid min-h-[540px] w-full grid-cols-1 overflow-visible">
          {COLLECTION_TABS.map((tab) => (
            <div
              key={tab}
              className={cn(
                "col-start-1 row-start-1 overflow-visible",
                collectionTab !== tab && "invisible pointer-events-none",
              )}
            >
              <CollectionGrid
                collectionTab={tab}
                hoveredCardId={hoveredCardId}
                discoveredCardIds={discoveredCardIds}
                encounteredEnemyIds={encounteredEnemyIds}
                discoveredTrinketIds={discoveredTrinketIds}
                onHoverChange={onHoverChange}
                page={collectionPages[tab]}
                shimmerState={shimmerState}
                onHoverShimmer={maybeTriggerShimmer}
              />
            </div>
          ))}
        </div>
        <div className="min-h-[48px]"><CollectionPagination page={activePage} totalPages={totalPages} onPageChange={handlePageChange} /></div>
      </div>

      <div className="mt-6 grid w-full max-w-md grid-cols-[1fr_auto_1fr] items-center gap-3">
        <span aria-hidden="true" />
        <Button variant="outline" onClick={onMainMenu}><House className="h-4 w-4" /> Main Menu</Button>
        {hasActiveBattle ? <Button className="justify-self-start" onClick={onReturnToBattle}><Swords className="h-4 w-4" /> Return to Battle</Button> : <span aria-hidden="true" />}
      </div>
    </PageLayout>
  );
}
