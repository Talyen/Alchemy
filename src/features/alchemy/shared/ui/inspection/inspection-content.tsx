import { useId, useMemo, useState, type ReactNode, type RefObject } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCardKeywords, type BattleCard } from "../../config/game-data-catalog";
import type { CardDescriptionContext } from "@/lib/game-data";
import { getInspectionKeywordShineColors, viewCardWidthClass } from "../../config";
import { BattleCardButton } from "../card-button";
import { getCardDisplayTitle } from "../card-description-ui";
import { CardSelectionGrid } from "../card-selection-grid";
import { sortInspectionCards } from "./card-inspection-sort";
import { useDialogFocus } from "../use-dialog-focus";

export function InspectionCardGrid({
  cards,
  descriptionContext,
  resetKey,
  sort = true,
}: {
  cards: readonly BattleCard[];
  descriptionContext: CardDescriptionContext;
  resetKey: string;
  sort?: boolean;
}) {
  const [pagination, setPagination] = useState({ key: resetKey, page: 0 });
  if (pagination.key !== resetKey) setPagination({ key: resetKey, page: 0 });
  const items = useMemo(
    () => (sort ? sortInspectionCards(cards) : cards).map((card, index) => ({ card, index })),
    [cards, sort],
  );
  return (
    <CardSelectionGrid
      items={items}
      page={pagination.key === resetKey ? pagination.page : 0}
      onPageChange={(page) => setPagination({ key: resetKey, page })}
      renderItem={({ card }) => (
        <div className={viewCardWidthClass}>
          <BattleCardButton
            card={card}
            ariaLabel={getCardDisplayTitle(card)}
            shimmerActive={false}
            shimmerToken={undefined}
            className={viewCardWidthClass}
            descriptionContext={descriptionContext}
            shineColor={getInspectionKeywordShineColors(getCardKeywords(card))}
          />
        </div>
      )}
    />
  );
}

export function InspectionPanel({
  title,
  closeLabel,
  onClose,
  returnFocusRef,
  children,
}: {
  title: string;
  closeLabel: string;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null> | undefined;
  children: ReactNode;
}) {
  const titleId = useId();
  const { panelRef, handleKeyDown } = useDialogFocus(returnFocusRef);
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Modal contains keyboard focus and stops backdrop clicks
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      onClick={(event) => event.stopPropagation()}
      className="alchemy-shell relative flex max-h-full w-fit max-w-[min(100%,72rem)] flex-col overflow-y-auto rounded-shell-screen border border-border/80 p-6"
    >
      <div className="relative mb-3 flex min-h-11 shrink-0 items-center justify-center px-14">
        <h2 id={titleId} className="text-center font-sans text-3xl">
          {title}
        </h2>
        <Button
          variant="outline"
          size="icon"
          className="absolute top-0 right-0 h-11 w-11"
          aria-label={closeLabel}
          data-dialog-initial-focus
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
      {children}
    </div>
  );
}
