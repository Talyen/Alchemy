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
import { useControlledPagination } from "../../../shared/ui/use-pagination";
import { FadeSlot } from "../../../shared/ui/use-fade";
import { Surface } from "../../../shared/ui/surface";
import { useInteractiveCard } from "../../../shared/ui/use-interactive-card";
import { InspectionOverlayShell } from "../../../shared/ui/inspection/inspection-content";
import { PageLayout, ScreenHeaderRow, ScreenShell } from "../../../shared/ui/layout-components";
import { CollectionTabs, CollectionPagination } from "./collection-ui";
import { CollectionContentLayout } from "./collection-content-layout";

const BOARD_PAGE_SIZE = 6;
type BoardEntry = { kind: "none" | "random"; title: string } | { kind: "board"; id: string; title: string };
const boardEntries: BoardEntry[] = [
  { kind: "none", title: "None" },
  { kind: "random", title: "Random" },
  ...boardCatalog.map((board) => ({ kind: "board" as const, id: board.id, title: board.title })),
];

function BoardTile({
  entry,
  owned,
  selected,
  onActivate,
}: {
  entry: BoardEntry;
  owned: boolean;
  selected: boolean;
  onActivate: (trigger: HTMLButtonElement) => void;
}) {
  const hover = useInteractiveCard("collection-board", entry.kind === "board" ? entry.id : entry.kind);
  return (
    <Surface
      as="button"
      ariaLabel={entry.kind === "board" ? `Inspect ${entry.title}${owned ? "" : " (Locked)"}` : entry.title}
      ariaCurrent={selected ? "true" : undefined}
      selected={selected}
      shimmerActive={hover.shimmerActive}
      shimmerToken={hover.shimmerToken}
      onMouseEnter={hover.onHoverStart}
      onMouseLeave={hover.onHoverEnd}
      onFocus={hover.onHoverStart}
      onBlur={hover.onHoverEnd}
      onClick={(event) => onActivate(event.currentTarget)}
      className="group w-full rounded-shell-tooltip border border-border/80 bg-black/30 shadow-md"
      overlay={hover.isHovered ? <ShineBorder shineColor={[]} borderWidth={2} className="z-20" /> : null}
    >
      <div className="relative aspect-[43/24] w-full">
        {entry.kind === "board" ? (
          <>
            <img
              src={boardArt[entry.id]?.thumbnail}
              alt=""
              decoding="async"
              className={cn("h-full w-full object-contain", !owned && lockedHoverPreviewClass)}
            />
            {!owned ? (
              <span
                className="absolute right-2 bottom-2 rounded-full bg-black/70 p-2 text-gold-pale"
                aria-hidden="true"
              >
                <Lock className="h-4 w-4" />
              </span>
            ) : null}
          </>
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-2xl text-gold-pale">
            {entry.title}
          </span>
        )}
      </div>
    </Surface>
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
  const changePage = (page: number) => onPageChange("boards", page);
  const { page, totalPages } = useControlledPagination({
    page: collectionPages.boards,
    pageSize: BOARD_PAGE_SIZE,
    itemCount: boardEntries.length,
    onPageChange: changePage,
    context: "boards",
  });
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const inspected = boardCatalog.find((board) => board.id === inspectedId);
  const selectedId = boardSelection.kind === "board" ? boardSelection.boardId : null;
  const owned = inspected ? collectedBoardIds.includes(inspected.id) : false;
  return (
    <PageLayout>
      <ScreenShell maxWidthClass={collectionShellWidthClass}>
        <ScreenHeaderRow title="Collection" onBack={onBack} onMenu={onMenu} />
        <CollectionTabs collectionTab="boards" onSelectTab={onSelectTab} />
        <CollectionContentLayout
          pagination={
            totalPages > 1 ? (
              <CollectionPagination page={page} totalPages={totalPages} onPageChange={changePage} />
            ) : null
          }
        >
          <FadeSlot swapKey={page} className="w-full">
            <div className="flex w-full flex-wrap justify-center gap-x-5 gap-y-6">
              {boardEntries.slice(page * BOARD_PAGE_SIZE, (page + 1) * BOARD_PAGE_SIZE).map((entry) => (
                <div
                  key={entry.kind === "board" ? entry.id : entry.kind}
                  className="min-w-0 shrink-0"
                  style={{ width: "calc((100% - 2.5 * var(--content-rem, 1rem)) / 3)" }}
                >
                  <BoardTile
                    entry={entry}
                    owned={entry.kind !== "board" || collectedBoardIds.includes(entry.id)}
                    selected={entry.kind === "board" ? selectedId === entry.id : boardSelection.kind === entry.kind}
                    onActivate={(trigger) => {
                      if (entry.kind === "board") {
                        returnFocusRef.current = trigger;
                        setInspectedId(entry.id);
                      } else {
                        onSelectBoard({ kind: entry.kind });
                      }
                    }}
                  />
                </div>
              ))}
            </div>
          </FadeSlot>
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
