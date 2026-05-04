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
      <div className="alchemy-shell flex h-[calc(100%-64px)] w-[calc(100%-32px)] max-w-[1620px] flex-col items-center justify-start overflow-visible rounded-[30px] border border-border/80 px-8 py-8 text-center">
        <h1 className="min-h-[44px] text-4xl font-semibold text-foreground">Collection</h1>
        <CollectionTabs collectionTab={collectionTab} onSelectTab={onSelectTab} />

        <div className="mt-12 flex min-h-[640px] flex-col items-center overflow-visible">
          <CollectionGrid collectionTab={collectionTab} hoveredCardId={hoveredCardId} discoveredCardIds={discoveredCardIds} encounteredEnemyIds={encounteredEnemyIds} discoveredTrinketIds={discoveredTrinketIds} onHoverChange={onHoverChange} page={page} shimmerState={shimmerState} onHoverShimmer={maybeTriggerShimmer} />
          <CollectionPagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="outline" onClick={onMainMenu}><House className="h-4 w-4" /> Main Menu</Button>
        {hasActiveBattle ? <Button onClick={onReturnToBattle}><Swords className="h-4 w-4" /> Return to Battle</Button> : null}
      </div>
    </PageLayout>
  );
}
