import { useEffect, useRef, useState } from "react";
import { endBossPreview } from "@/lib/audio";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShineBorder } from "@/components/ui/shine-border";
import { boardArt } from "../../../shared/config/game-data-catalog";
import { boardCatalog, BOARD_REWARD_ROOM_THRESHOLD, type BoardSelection } from "@/lib/boards/catalog";
import { cn } from "@/lib/utils";
import type { CollectionTab } from "../../../shared/types";
import { collectionShellWidthClass, lockedHoverPreviewClass } from "../../../shared/config";
import { useAdaptiveGrid } from "../../../shared/ui/adaptive-grid";
import { GridMeasurement } from "../../../shared/ui/grid-measurement";
import { useControlledPagination } from "../../../shared/ui/use-pagination";
import { FadeSlot } from "../../../shared/ui/use-fade";
import { Surface } from "../../../shared/ui/surface";
import { useInteractiveCard } from "../../../shared/ui/use-interactive-card";
import { InspectionOverlayShell } from "../../../shared/ui/inspection/inspection-content";
import { PageLayout, ScreenHeaderRow, ScreenShell } from "../../../shared/ui/layout-components";
import { CollectionTabs, CollectionPagination } from "./collection-ui";
import { CollectionContentLayout } from "./collection-content-layout";

const BOARD_TILE_WIDTH = 340;

function BoardTile({
  id,
  title,
  owned,
  selected,
  onInspect,
}: {
  id: string;
  title: string;
  owned: boolean;
  selected: boolean;
  onInspect: (id: string, trigger: HTMLButtonElement) => void;
}) {
  const hover = useInteractiveCard("collection-board", id);
  return (
    <div className="flex flex-col items-center gap-2">
      <Surface
        as="button"
        ariaLabel={`Inspect ${title}${owned ? "" : " (Locked)"}`}
        ariaCurrent={selected ? "true" : undefined}
        selected={selected}
        shimmerActive={hover.shimmerActive}
        shimmerToken={hover.shimmerToken}
        onMouseEnter={hover.onHoverStart}
        onMouseLeave={hover.onHoverEnd}
        onFocus={hover.onHoverStart}
        onBlur={hover.onHoverEnd}
        onClick={(event) => onInspect(id, event.currentTarget)}
        className="group w-full rounded-shell-tooltip border border-border/80 shadow-md"
        overlay={hover.isHovered ? <ShineBorder shineColor={[]} borderWidth={2} className="z-20" /> : null}
      >
        <img
          src={boardArt[id]?.thumbnail}
          alt=""
          decoding="async"
          className={cn("aspect-[43/24] w-full object-contain", !owned && lockedHoverPreviewClass)}
        />
      </Surface>
      <div className="flex min-h-7 items-center justify-center gap-2 text-center text-lg text-gold-pale">
        {!owned ? <Lock aria-label="Locked" className="h-4 w-4 shrink-0" /> : null}
        <span>{title}</span>
        {selected ? <span className="text-sm text-muted-foreground">Selected</span> : null}
      </div>
    </div>
  );
}

export function BoardsCollection({
  collectedBoardIds,
  boardSelection,
  onSelectBoard,
  collectionPages,
  onPageChange,
  onSelectTab,
  onBack,
  onMenu,
}: {
  collectedBoardIds: string[];
  boardSelection: BoardSelection;
  onSelectBoard: (selection: BoardSelection) => boolean;
  collectionPages: Record<CollectionTab, number>;
  onPageChange: (tab: CollectionTab, page: number) => void;
  onSelectTab: (tab: CollectionTab) => void;
  onBack?: (() => void) | undefined;
  onMenu?: ((rect: DOMRect) => void) | undefined;
}) {
  useEffect(() => {
    endBossPreview();
  }, []);
  const { onContainer, onMeasure, pageSize, gridStyle } = useAdaptiveGrid(BOARD_TILE_WIDTH, 3, 3);
  const changePage = (page: number) => onPageChange("boards", page);
  const { page, totalPages } = useControlledPagination({
    page: collectionPages.boards,
    pageSize,
    itemCount: boardCatalog.length,
    onPageChange: changePage,
    context: "boards",
  });
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const inspected = boardCatalog.find((board) => board.id === inspectedId);
  const selectedId = boardSelection.kind === "board" ? boardSelection.boardId : null;
  const selectedTitle = boardCatalog.find((board) => board.id === selectedId)?.title;
  const owned = inspected ? collectedBoardIds.includes(inspected.id) : false;
  return (
    <PageLayout>
      <ScreenShell maxWidthClass={collectionShellWidthClass}>
        <ScreenHeaderRow title="Collection" onBack={onBack} onMenu={onMenu} />
        <CollectionTabs collectionTab="boards" onSelectTab={onSelectTab} />
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <Button
            aria-pressed={boardSelection.kind === "none"}
            variant={boardSelection.kind === "none" ? "primary" : "outline"}
            onClick={() => onSelectBoard({ kind: "none" })}
          >
            None
          </Button>
          <Button
            aria-pressed={boardSelection.kind === "random"}
            variant={boardSelection.kind === "random" ? "primary" : "outline"}
            onClick={() => onSelectBoard({ kind: "random" })}
          >
            Random Collected
          </Button>
          <span className="text-muted-foreground">
            {selectedTitle ? `Selected: ${selectedTitle} · ` : ""}
            {collectedBoardIds.length}/{boardCatalog.length} collected
          </span>
        </div>
        <CollectionContentLayout
          rowsHeight={BOARD_TILE_WIDTH * (24 / 43) * 2 + 104}
          pagination={
            totalPages > 1 ? (
              <CollectionPagination page={page} totalPages={totalPages} onPageChange={changePage} />
            ) : null
          }
        >
          <div ref={onContainer} className="relative w-full">
            <GridMeasurement onMeasure={onMeasure} referenceTileWidth={BOARD_TILE_WIDTH} />
            <FadeSlot swapKey={page} className="w-full">
              <div className="grid gap-x-5 gap-y-6" style={gridStyle}>
                {boardCatalog.slice(page * pageSize, (page + 1) * pageSize).map((board) => (
                  <BoardTile
                    key={board.id}
                    {...board}
                    owned={collectedBoardIds.includes(board.id)}
                    selected={selectedId === board.id}
                    onInspect={(id, trigger) => {
                      returnFocusRef.current = trigger;
                      setInspectedId(id);
                    }}
                  />
                ))}
              </div>
            </FadeSlot>
          </div>
        </CollectionContentLayout>
      </ScreenShell>
      {inspected ? (
        <InspectionOverlayShell
          open
          escapeId="board-inspection"
          testId="board-inspection-overlay"
          title={inspected.title}
          closeLabel="Close board inspection"
          returnFocusRef={returnFocusRef}
          onClose={() => setInspectedId(null)}
        >
          <img
            src={boardArt[inspected.id]?.full}
            alt={inspected.title}
            decoding="async"
            className="max-h-[55vh] w-full rounded-shell-tooltip object-contain"
          />
          <div className="mt-4 flex justify-center">
            {owned ? (
              <Button
                variant="primary"
                disabled={selectedId === inspected.id}
                onClick={() => {
                  if (onSelectBoard({ kind: "board", boardId: inspected.id })) setInspectedId(null);
                }}
              >
                {selectedId === inspected.id ? "Selected" : "Use Board"}
              </Button>
            ) : (
              <p className="text-muted-foreground">
                Finish a run after completing {BOARD_REWARD_ROOM_THRESHOLD} rooms to collect a new board.
              </p>
            )}
          </div>
        </InspectionOverlayShell>
      ) : null}
    </PageLayout>
  );
}
