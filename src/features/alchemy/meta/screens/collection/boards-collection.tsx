import { GameMessage } from "@/components/localization";
import { useGameTranslation } from "@/components/use-game-translation";
import { useEffect, useRef, useState, type RefObject } from "react";
import { endBossPreview } from "@/lib/audio";
import { Lock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShineBorder } from "@/components/ui/shine-border";
import { boardArt } from "../../../shared/config/game-data-catalog";
import { boardCatalog, BOARD_REWARD_ROOM_THRESHOLD, type BoardSelection } from "@/lib/boards/catalog";
import { cn } from "@/lib/utils";
import type { CollectionTab } from "../../../shared/types";
import {
  cardInteractiveGlowClass,
  collectionShellWidthClass,
  lockedHoverPreviewClass,
  SHINE_PALETTES,
} from "../../../shared/config";
import { useControlledPagination } from "../../../shared/ui/use-pagination";
import { FadeSlot } from "../../../shared/ui/use-fade";
import { Surface } from "../../../shared/ui/surface";
import { useInteractiveCard } from "../../../shared/ui/use-interactive-card";
import { ChromeIconButton } from "../../../shared/ui/chrome-icon-button";
import { ModalOverlayShell } from "../../../shared/ui/modal-overlay-shell";
import { useDialogFocus } from "../../../shared/ui/use-dialog-focus";
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
  const i18n = useGameTranslation();
  const hover = useInteractiveCard("collection-board", entry.kind === "board" ? entry.id : entry.kind);
  return (
    <Surface
      as="button"
      ariaLabel={i18n.displayText(
        entry.kind === "board"
          ? i18n.text("ui.boards-collection.d1", "Inspect {{value0}}{{value1}}", {
              value0: i18n.displayText(entry.title),
              value1: i18n.displayText(owned ? "" : " (Locked)"),
            })
          : entry.title,
      )}
      ariaCurrent={selected ? "true" : undefined}
      selected={selected}
      shimmerActive={hover.shimmerActive}
      shimmerToken={hover.shimmerToken}
      onMouseEnter={hover.onHoverStart}
      onMouseLeave={hover.onHoverEnd}
      onFocus={hover.onHoverStart}
      onBlur={hover.onHoverEnd}
      onClick={(event) => onActivate(event.currentTarget)}
      className={cn(
        "group card-art-frame card-interactive-no-glow w-full rounded-shell-tooltip border border-border/80 bg-black/30 shadow-md outline-none",
        cardInteractiveGlowClass,
        hover.isHovered && "card-art-shine",
      )}
      overlay={
        hover.isHovered ? <ShineBorder shineColor={SHINE_PALETTES.gold} borderWidth={3} className="z-20" /> : null
      }
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
            {i18n.displayText(entry.title)}
          </span>
        )}
      </div>
    </Surface>
  );
}

function BoardPreview({
  board,
  owned,
  returnFocusRef,
  onUseBoard,
  onClose,
}: {
  board: { id: string; title: string };
  owned: boolean;
  returnFocusRef: RefObject<HTMLElement | null>;
  onUseBoard: () => void;
  onClose: () => void;
}) {
  const i18n = useGameTranslation();
  const { panelRef, handleKeyDown } = useDialogFocus(returnFocusRef);
  return (
    <ModalOverlayShell
      open
      escapeId="board-inspection"
      testId="board-inspection-overlay"
      zIndex={85}
      dim={false}
      onClose={onClose}
    >
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- dialog owns keyboard focus containment */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={i18n.displayText(board.title)}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="relative h-full w-full overflow-hidden bg-black"
      >
        <img
          src={boardArt[board.id]?.full}
          alt={i18n.displayText(board.title)}
          decoding="async"
          className="absolute inset-0 h-full w-full object-fill"
        />
        <ChromeIconButton
          className="absolute top-4 right-4 bg-black/70 text-gold-pale"
          aria-label={i18n.text("ui.boards-collection.1", "Close board inspection")}
          data-dialog-initial-focus
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </ChromeIconButton>
        <div className="absolute inset-x-0 top-2/3 bottom-0 flex items-center justify-center p-5">
          {owned ? (
            <Button variant="primary" size="lg" className="min-w-56" onClick={onUseBoard}>
              {i18n.text("ui.boards-collection.2", "Use Board")}
            </Button>
          ) : (
            <p className="max-w-xl rounded-xl bg-black/70 p-4 text-center text-gold-pale">
              <GameMessage
                id="ui.boards-collection.s1"
                defaultValue="Finish a run after completing <part0/> rooms to collect a new board."
                parts={{ part0: i18n.displayText(BOARD_REWARD_ROOM_THRESHOLD) }}
              />
            </p>
          )}
        </div>
      </div>
    </ModalOverlayShell>
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
  const i18n = useGameTranslation();
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
        <ScreenHeaderRow title={i18n.text("ui.boards-collection.5", "Collection")} onBack={onBack} onMenu={onMenu} />
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
        <BoardPreview
          board={inspected}
          owned={owned}
          returnFocusRef={returnFocusRef}
          onClose={() => setInspectedId(null)}
          onUseBoard={() => {
            if (onSelectBoard({ kind: "board", boardId: inspected.id })) setInspectedId(null);
          }}
        />
      ) : null}
    </PageLayout>
  );
}
