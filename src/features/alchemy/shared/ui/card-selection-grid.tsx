import { anchoredPage, useAdaptiveGrid } from "./adaptive-grid";
import { GridMeasurement } from "./grid-measurement";
import { useState, type ReactNode } from "react";

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
  const pageSize = fixedPageSize ?? adaptivePageSize;
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
    <div ref={onContainer} className="relative w-full">
      <GridMeasurement onMeasure={onMeasure} referenceTileWidth={referenceTileWidth} />
      <FadeSlot swapKey={safePage} className="mx-auto flex w-full flex-col gap-y-6" data-testid="card-selection-grid">
        {rows.map((rowItems, rowIndex) => (
          <div key={`row-${rowIndex}`} className="flex justify-center gap-x-4">
            {rowItems.map((item, columnIndex) => {
              const visualIndex = rowIndex * columns + columnIndex;
              return (
                <div key={`${item.card.id}-${item.index}`} className="flex justify-center">
                  {renderItem(item, visualIndex)}
                </div>
              );
            })}
          </div>
        ))}
      </FadeSlot>
      {pageItems.length === 0 && emptyMessage ? (
        <p className="mt-4 text-sm text-muted-foreground">{emptyMessage}</p>
      ) : null}
      <div className="flex justify-center">
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
