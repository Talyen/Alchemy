// Collection screen with tabs (cards / bestiary / trinkets) and paginated grid.
import { House, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLayout } from "../ui/shared-ui";
import { CollectionGrid, CollectionPagination, CollectionTabs, getCollectionTotalPages } from "../ui/collection-ui";
import { useShimmerController } from "../hooks";
import type { CollectionTab } from "../types";

export function CollectionScreen({
  hasActiveBattle, onMainMenu, onReturnToBattle, collectionTab, onSelectTab,
  hoveredCardId, onHoverChange, discoveredCardIds, encounteredEnemyIds,
  discoveredTrinketIds, page, onPageChange,
}: {
  hasActiveBattle: boolean; onMainMenu: () => void; onReturnToBattle: () => void;
  collectionTab: CollectionTab; onSelectTab: (tab: CollectionTab) => void;
  hoveredCardId: string | null;
  onHoverChange: (value: string | null | ((current: string | null) => string | null)) => void;
  discoveredCardIds: string[]; encounteredEnemyIds: string[]; discoveredTrinketIds: string[];
  page: number; onPageChange: (page: number) => void;
}) {
  const { shimmerState, maybeTriggerShimmer } = useShimmerController();
  const totalPages = getCollectionTotalPages(collectionTab);

  return (
    <PageLayout>
      <h1 className="text-4xl font-semibold text-foreground">Collection</h1>
      <CollectionTabs collectionTab={collectionTab} onSelectTab={onSelectTab} />

      <div className="mt-6 flex min-h-[640px] flex-col items-center overflow-visible">
        <CollectionGrid collectionTab={collectionTab} hoveredCardId={hoveredCardId} discoveredCardIds={discoveredCardIds} encounteredEnemyIds={encounteredEnemyIds} discoveredTrinketIds={discoveredTrinketIds} onHoverChange={onHoverChange} page={page} shimmerState={shimmerState} onHoverShimmer={maybeTriggerShimmer} />
        <CollectionPagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="outline" onClick={onMainMenu}><House className="h-4 w-4" /> Main Menu</Button>
        {hasActiveBattle ? <Button onClick={onReturnToBattle}><Swords className="h-4 w-4" /> Return to Battle</Button> : null}
      </div>
    </PageLayout>
  );
}
