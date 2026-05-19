// Shared paginated card-selection layout for deck pickers.
// Depends on battle card data, collection sizing, and pagination controls.
// Used by corruption, card removal, and potion-mixing flows so selection rows cap at four centered cards.
import type { ReactNode } from "react";

import type { BattleCard } from "@/lib/game-data";

import { PaginationControls } from "./shared-ui";

export type CardSelectionGridItem = {
  card: BattleCard;
  index: number;
};

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
  // The original deck index travels with each item so paginated/filtered pickers still mutate the correct slot.
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = items.slice(safePage * pageSize, (safePage + 1) * pageSize);
  const rows = Array.from({ length: Math.ceil(pageItems.length / 4) }, (_, rowIndex) =>
    pageItems.slice(rowIndex * 4, rowIndex * 4 + 4),
  );

  return (
    <div>
      <div className="mx-auto flex max-w-[calc(4*26.48cqh+3*1rem)] flex-col gap-y-5" data-testid="card-selection-grid">
        {rows.map((rowItems, rowIndex) => (
          <div key={`row-${rowIndex}`} className="flex justify-center gap-x-4">
            {rowItems.map((item, columnIndex) => {
              const visualIndex = rowIndex * 4 + columnIndex;
              return (
                <div key={`${item.card.id}-${item.index}`} className="flex justify-center">
                  {renderItem(item, visualIndex)}
                </div>
              );
            })}
          </div>
        ))}
      </div>
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
