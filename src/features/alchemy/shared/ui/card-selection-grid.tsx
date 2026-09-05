import { cn } from "@/lib/utils";

import { anchoredPage, useAdaptiveGrid } from "./adaptive-grid";
import { GridMeasurement } from "./grid-measurement";
import { useLayoutEffect, useState, type ReactNode } from "react";

import type { BattleCard } from "@/lib/game-data";

import { FadeSlot } from "./use-fade";
import { PaginationControls } from "./navigation";
import { paginateRows } from "./use-paginated-rows";

export interface CardSelectionGridItem {
  card: BattleCard;
  index: number;
}

export function CardSelectionGrid({
  items,
  fitHeight = false,
  page,
  onPageChange,
  pageSize: fixedPageSize,
  selectedIndex = -1,
  renderItem,
  emptyMessage,
  paginationSize = "sm",
  paginationReserveSpace = false,
}: {
  items: CardSelectionGridItem[];
  fitHeight?: boolean;
  page: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  selectedIndex?: number;
  renderItem: (item: CardSelectionGridItem, visualIndex: number) => ReactNode;
  emptyMessage?: string;
  paginationSize?: "sm" | "default";
  paginationReserveSpace?: boolean;
}) {
  const {
    onContainer,
    onMeasure,
    referenceTileWidth,
    pageSize: adaptivePageSize,
    columns,
  } = useAdaptiveGrid(230.472, 4, 8, 16);
  const [cardArea, setCardArea] = useState<HTMLDivElement | null>(null);
  const [firstTile, setFirstTile] = useState<HTMLDivElement | null>(null);
  const [rowCount, setRowCount] = useState(1);
  useLayoutEffect(() => {
    if (!fitHeight || !cardArea || !firstTile) return;
    const update = () => {
      const style = getComputedStyle(cardArea);
      const gap = parseFloat(style.rowGap) || 0;
      const height = cardArea.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      setRowCount(height >= firstTile.offsetHeight * 2 + gap ? 2 : 1);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(cardArea);
    observer.observe(firstTile);
    return () => observer.disconnect();
  }, [fitHeight, cardArea, firstTile]);
  const pageSize = fixedPageSize ?? (fitHeight ? columns * rowCount : adaptivePageSize);
  const [paging, setPaging] = useState({ externalPage: page, page, pageSize: pageSize });
  let currentPage = paging.page;
  if (paging.externalPage !== page || paging.pageSize !== pageSize) {
    currentPage =
      paging.externalPage !== page
        ? page
        : anchoredPage(paging.page, paging.pageSize, pageSize, items.length, selectedIndex);
    setPaging({ externalPage: page, page: currentPage, pageSize: pageSize });
  }
  function changePage(nextPage: number) {
    setPaging({ externalPage: nextPage, page: nextPage, pageSize: pageSize });
    onPageChange(nextPage);
  }
  const { page: safePage, pageItems, rows, totalPages } = paginateRows(items, currentPage, pageSize, columns);

  return (
    <div ref={onContainer} className={cn("relative w-full", fitHeight && "flex min-h-0 flex-1 flex-col")}>
      <GridMeasurement onMeasure={onMeasure} referenceTileWidth={referenceTileWidth} />
      <div ref={setCardArea} className={cn(fitHeight && "min-h-0 flex-1 gap-y-6 overflow-auto py-3")}>
        <FadeSlot swapKey={safePage} className="mx-auto flex w-full flex-col gap-y-6" data-testid="card-selection-grid">
          {rows.map((rowItems, rowIndex) => (
            <div key={`row-${rowIndex}`} className="flex justify-center gap-x-4">
              {rowItems.map((item, columnIndex) => {
                const visualIndex = rowIndex * columns + columnIndex;
                return (
                  <div
                    ref={visualIndex === 0 ? setFirstTile : undefined}
                    key={`${item.card.id}-${item.index}`}
                    className="flex justify-center"
                  >
                    {renderItem(item, visualIndex)}
                  </div>
                );
              })}
            </div>
          ))}
        </FadeSlot>
      </div>
      {pageItems.length === 0 && emptyMessage ? (
        <p className="mt-4 text-sm text-muted-foreground">{emptyMessage}</p>
      ) : null}
      <div className="flex shrink-0 justify-center">
        <PaginationControls
          page={safePage}
          totalPages={totalPages}
          onPageChange={changePage}
          size={paginationSize}
          reserveSpace={paginationReserveSpace}
        />
      </div>
    </div>
  );
}
