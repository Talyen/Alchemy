// Shared paginated card-selection layout for deck pickers.
// Depends on battle card data, collection sizing, and pagination controls.
// Used by corruption, card removal, and potion-mixing flows so selection rows cap at four centered cards.
import type { ReactNode } from "react";

import type { BattleCard } from "@/lib/game-data";

import { PaginationControls, StaggerGroup, StaggerItem } from "./shared-ui";

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
  stagger = true,
}: {
  items: CardSelectionGridItem[];
  page: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  renderItem: (item: CardSelectionGridItem, visualIndex: number) => ReactNode;
  emptyMessage?: string;
  paginationSize?: "sm" | "default";
  paginationReserveSpace?: boolean;
  stagger?: boolean;
}) {
  // The original deck index travels with each item so paginated/filtered pickers still mutate the correct slot.
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = items.slice(safePage * pageSize, (safePage + 1) * pageSize);
  const rows = Array.from(
    { length: Math.ceil(pageItems.length / CARD_SELECTION_GRID_CONFIG.cardsPerRow) },
    (_, rowIndex) =>
      pageItems.slice(
        rowIndex * CARD_SELECTION_GRID_CONFIG.cardsPerRow,
        rowIndex * CARD_SELECTION_GRID_CONFIG.cardsPerRow + CARD_SELECTION_GRID_CONFIG.cardsPerRow,
      ),
  );

  return (
    <div>
      <StaggerGroup
        swapKey={safePage}
        animate={false}
        className="mx-auto flex max-w-[calc(4*31.78cqh+3*1.2rem)] flex-col gap-y-6"
        data-testid="card-selection-grid"
      >
        {rows.map((rowItems, rowIndex) => (
          <div key={`row-${rowIndex}`} className="flex justify-center gap-x-4">
            {rowItems.map((item, columnIndex) => {
              const visualIndex = rowIndex * CARD_SELECTION_GRID_CONFIG.cardsPerRow + columnIndex;
              const cell = <div className="flex justify-center">{renderItem(item, visualIndex)}</div>;
              return stagger ? (
                <StaggerItem key={`${item.card.id}-${item.index}`} index={visualIndex}>
                  {cell}
                </StaggerItem>
              ) : (
                <div key={`${item.card.id}-${item.index}`}>{cell}</div>
              );
            })}
          </div>
        ))}
      </StaggerGroup>
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
