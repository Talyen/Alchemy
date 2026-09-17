import { useCallback, useEffect, useRef, useState } from "react";
import { endBossPreview, getBossMusicKey, previewBossMusic } from "@/lib/audio";
import { useControlledPagination } from "../../shared/ui/use-pagination";
import { useAdaptiveGrid } from "../../shared/ui/adaptive-grid";
import { GridMeasurement } from "../../shared/ui/grid-measurement";
import { getCollectionLibraryLength } from "./collection/collection-items";
import {
  collectionShellWidthClass,
  COLLECTION_BESTIARY_MAX_COLUMNS,
  COLLECTION_BESTIARY_REFERENCE_WIDTH,
  COLLECTION_CARD_MAX_COLUMNS,
  COLLECTION_CARD_REFERENCE_WIDTH,
} from "../../shared/config";
import { PageLayout, ScreenHeaderRow, ScreenShell } from "../../shared/ui/layout-components";
import { CollectionGrid, CollectionTabs, CollectionPagination } from "./collection/collection-ui";
import { enemyById, type CharacterId, type BestiaryEntry } from "../../shared/config/game-data-catalog";
import { EnemyInspectionOverlay } from "../../shared/ui/inspection/enemy-inspection-overlay";
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
  const isBestiary = collectionTab === "bestiary";
  const referenceTileWidth = isBestiary ? COLLECTION_BESTIARY_REFERENCE_WIDTH : COLLECTION_CARD_REFERENCE_WIDTH;
  const maxColumns = isBestiary ? COLLECTION_BESTIARY_MAX_COLUMNS : COLLECTION_CARD_MAX_COLUMNS;
  const { onContainer, onMeasure, pageSize, columns, gridStyle } = useAdaptiveGrid(
    referenceTileWidth,
    maxColumns,
    maxColumns,
  );
  const returnFocusRef = useRef<HTMLElement | null>(null);

  function restoreMenuMusic() {
    endBossPreview();
  }

  function handlePageChange(page: number) {
    onPageChange(collectionTab, page);
  }
  const { page: activePage, totalPages } = useControlledPagination({
    page: collectionPages[collectionTab] ?? 0,
    pageSize,
    itemCount: getCollectionLibraryLength(collectionTab),
    onPageChange: handlePageChange,
    context: collectionTab,
  });

  const inspectionKey = `${collectionTab}-${activePage}`;
  const [inspection, setInspection] = useState<{ key: string; entry: BestiaryEntry | null }>({
    key: inspectionKey,
    entry: null,
  });
  if (inspection.key !== inspectionKey) setInspection({ key: inspectionKey, entry: null });
  const inspectedEnemy = inspection.key === inspectionKey ? inspection.entry : null;

  useEffect(() => {
    restoreMenuMusic();
  }, [collectionTab, activePage]);

  const handleEnemyActivate = useCallback(
    (enemyId: string, trigger: HTMLButtonElement) => {
      if (collectionTab !== "bestiary") return;
      const enemy = enemyById[enemyId];
      if (enemy && encounteredEnemyIds.includes(enemyId)) {
        returnFocusRef.current = trigger;
        setInspection({ key: inspectionKey, entry: enemy });
      }
      const musicKey = getBossMusicKey(enemyId);
      if (!musicKey) return;
      previewBossMusic(musicKey);
    },
    [collectionTab, encounteredEnemyIds, inspectionKey],
  );

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
              gridStyle={gridStyle}
              bondedCompanions={bondedCompanions}
              onEnemyActivate={handleEnemyActivate}
              inspectionOpen={inspectedEnemy !== null}
            />
          </div>
          <div className="flex flex-wrap items-center justify-center">
            <CollectionPagination page={activePage} totalPages={totalPages} onPageChange={handlePageChange} />
          </div>
        </div>
      </ScreenShell>
      <EnemyInspectionOverlay
        open={inspectedEnemy !== null}
        entry={inspectedEnemy ?? enemyById.skeleton}
        onClose={() => setInspection({ key: inspectionKey, entry: null })}
        returnFocusRef={returnFocusRef}
      />
    </PageLayout>
  );
}
