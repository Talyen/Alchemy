import type { ReactNode } from "react";

import type { BattleCard } from "@/lib/game-data";

import { FadeSlot } from "./fade-slot";
import { PaginationControls } from "./navigation";
import { paginateRows } from "./use-paginated-rows";

const CARD_SELECTION_GRID_CONFIG = {
  cardsPerRow: 4,
} as const;

export interface CardSelectionGridItem {
  card: BattleCard;
  index: number;
}

export function CardSelectionGrid({
  items,
  page,
  onPageChange,
  pageSize,
  renderItem,
  emptyMessage,
  paginationSize = "sm",
  paginationReserveSpace = false,
}: {
  items: CardSelectionGridItem[];
  page: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  renderItem: (item: CardSelectionGridItem, visualIndex: number) => ReactNode;
  emptyMessage?: string;
  paginationSize?: "sm" | "default";
  paginationReserveSpace?: boolean;
}) {
  const {
    page: safePage,
    pageItems,
    rows,
    totalPages,
  } = paginateRows(items, page, pageSize, CARD_SELECTION_GRID_CONFIG.cardsPerRow);

  return (
    <div>
      <FadeSlot
        swapKey={safePage}
        className="mx-auto flex max-w-[calc(4*31.78cqh+3*1.2rem)] flex-col gap-y-6"
        data-testid="card-selection-grid"
      >
        {rows.map((rowItems, rowIndex) => (
          <div key={`row-${rowIndex}`} className="flex justify-center gap-x-4">
            {rowItems.map((item, columnIndex) => {
              const visualIndex = rowIndex * CARD_SELECTION_GRID_CONFIG.cardsPerRow + columnIndex;
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
          onPageChange={onPageChange}
          size={paginationSize}
          reserveSpace={paginationReserveSpace}
        />
      </div>
    </div>
  );
}
