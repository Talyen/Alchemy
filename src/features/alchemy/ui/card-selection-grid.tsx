// Shared paginated card-selection layout for deck pickers.
// Depends on battle card data, BlurFade reveal wrappers, collection sizing, and pagination controls.
// Used by corruption, card removal, and potion-mixing flows so selection rows cap at four centered cards.
import type { ReactNode } from "react";

import { BlurFade } from "@/components/ui/blur-fade";
import type { BattleCard } from "@/lib/game-data";
import { ANIMATION_STAGGER_UNIT } from "@/lib/game-constants";

import { PaginationControls } from "./shared-ui";

export type CardSelectionGridItem = {
  card: BattleCard;
  index: number;
};

export function CardSelectionGrid({ items, page, onPageChange, pageSize, revealDelay = 0, renderItem, emptyMessage, paginationSize = "sm", paginationReserveSpace = false }: { items: CardSelectionGridItem[]; page: number; onPageChange: (page: number) => void; pageSize: number; revealDelay?: number | undefined; renderItem: (item: CardSelectionGridItem, visualIndex: number) => ReactNode; emptyMessage?: string; paginationSize?: "sm" | "default"; paginationReserveSpace?: boolean }) {
  // The original deck index travels with each item so paginated/filtered pickers still mutate the correct slot.
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = items.slice(safePage * pageSize, (safePage + 1) * pageSize);

  return (
    <div>
      <div className="mx-auto flex max-w-[calc(4*228px+3*1rem)] flex-wrap justify-center gap-x-4 gap-y-5" data-testid="card-selection-grid">
        {pageItems.map((item, visualIndex) => (
          <BlurFade key={`${item.card.id}-${item.index}`} delay={revealDelay + visualIndex * ANIMATION_STAGGER_UNIT} direction="up" offset={6}>
            {renderItem(item, visualIndex)}
          </BlurFade>
        ))}
      </div>
      {pageItems.length === 0 && emptyMessage ? <p className="mt-4 text-sm text-muted-foreground">{emptyMessage}</p> : null}
      <div className="flex justify-center">
        <PaginationControls page={safePage} totalPages={totalPages} onPageChange={onPageChange} size={paginationSize} reserveSpace={paginationReserveSpace} />
      </div>
    </div>
  );
}
