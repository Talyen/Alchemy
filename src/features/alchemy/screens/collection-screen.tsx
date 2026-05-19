// Collection screen with tabs (cards / bestiary / trinkets) and paginated grid.
// All three tab grids are rendered simultaneously (preloaded) — only the active
// one is visible, so switching tabs is instant with no image re-loading.
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, House, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLayout, ScreenHeader } from "../ui/shared-ui";
import { CollectionGrid, CollectionTabs, getCollectionTotalPages } from "../ui/collection-ui";
import { useShimmerController } from "../hooks";
import type { CollectionTab } from "../types";
import { useBattleStore } from "../stores/battle-store";
import { useScreenStore } from "../stores/screen-store";

const COLLECTION_TABS: CollectionTab[] = ["cards", "bestiary", "trinkets"];

export function CollectionScreen({
  onMainMenu,
  onReturnToBattle,
  collectionTab,
  onSelectTab,
  discoveredCardIds,
  encounteredEnemyIds,
  discoveredTrinketIds,
  collectionPages,
  onPageChange,
  bondedCompanions,
}: {
  onMainMenu: () => void;
  onReturnToBattle: () => void;
  collectionTab: CollectionTab;
  onSelectTab: (tab: CollectionTab) => void;
  discoveredCardIds: string[];
  encounteredEnemyIds: string[];
  discoveredTrinketIds: string[];
  collectionPages: Record<CollectionTab, number>;
  onPageChange: (tab: CollectionTab, page: number) => void;
  bondedCompanions: Record<string, number>;
}) {
  const { shimmerState, maybeTriggerShimmer } = useShimmerController();
  const hoveredCardId = useScreenStore((s) => s.hoveredCardId);
  const setHoveredCardId = useScreenStore((s) => s.setHoveredCardId);
  const hasActiveBattle = useBattleStore((s) => s.hasActiveBattle);
  const totalPages = getCollectionTotalPages(collectionTab);
  const activePage = collectionPages[collectionTab];

  function handlePageChange(page: number) {
    onPageChange(collectionTab, page);
  }

  return (
    <PageLayout>
      <ScreenHeader title="Collection" />
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
                hoveredCardId={hoveredCardId}
                discoveredCardIds={discoveredCardIds}
                encounteredEnemyIds={encounteredEnemyIds}
                discoveredTrinketIds={discoveredTrinketIds}
                onHoverChange={setHoveredCardId}
                page={collectionPages[tab]}
                shimmerState={shimmerState}
                onHoverShimmer={maybeTriggerShimmer}
                bondedCompanions={bondedCompanions}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-2">
        {totalPages > 1 && (
          <Button
            aria-label="Previous page"
            variant="outline"
            size="icon"
            className="h-9 w-9"
            disabled={activePage === 0}
            onClick={() => handlePageChange(activePage - 1)}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}
        <Button variant="outline" onClick={onMainMenu}>
          <House className="h-4 w-4" /> Main Menu
        </Button>
        {hasActiveBattle && (
          <Button onClick={onReturnToBattle}>
            <Swords className="h-4 w-4" /> Return to Battle
          </Button>
        )}
        {totalPages > 1 && (
          <Button
            aria-label="Next page"
            variant="outline"
            size="icon"
            className="h-9 w-9"
            disabled={activePage >= totalPages - 1}
            onClick={() => handlePageChange(activePage + 1)}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        )}
      </div>
    </PageLayout>
  );
}
