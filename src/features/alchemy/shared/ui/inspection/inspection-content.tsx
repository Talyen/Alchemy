import { useId, useMemo, useState, type ReactNode, type RefObject } from "react";
import { X, type LucideIcon } from "lucide-react";
import { ChromeIconButton } from "../chrome-icon-button";
import { getCardKeywords, type BattleCard } from "../../config/game-data-catalog";
import type { CardDescriptionContext } from "@/lib/game-data";
import { viewCardWidthClass } from "../../config/layout";
import { getInspectionKeywordShineColors } from "../../config/shine-palettes";
import { BattleCardButton } from "../card-button";
import { getCardDisplayTitle } from "../card-description-ui";
import { CardSelectionGrid } from "../card-selection-grid";
import { sortInspectionCards } from "./card-inspection-sort";
import { useDialogFocus } from "../use-dialog-focus";
import { ModalOverlayShell } from "../modal-overlay-shell";

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

export function InspectionEmptyState({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      className="flex min-h-40 shrink-0 items-center justify-center text-muted-foreground"
    >
      <Icon aria-hidden="true" className="h-12 w-12" />
    </div>
  );
}

export function InspectionOverlayShell({
  open,
  escapeId,
  testId,
  title,
  closeLabel,
  onClose,
  returnFocusRef,
  overlayClassName,
  children,
}: {
  open: boolean;
  escapeId: string;
  testId: string;
  title: string;
  closeLabel: string;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null> | undefined;
  overlayClassName?: string;
  children: ReactNode;
}) {
  return (
    <ModalOverlayShell
      open={open}
      escapeId={escapeId}
      onClose={onClose}
      dismissOnBackdrop
      zIndex={85}
      testId={testId}
      className={overlayClassName ?? "flex items-center justify-center p-6"}
    >
      <InspectionPanel title={title} closeLabel={closeLabel} onClose={onClose} returnFocusRef={returnFocusRef}>
        {children}
      </InspectionPanel>
    </ModalOverlayShell>
  );
}

function InspectionPanel({
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
        <ChromeIconButton
          className="absolute top-0 right-0"
          aria-label={closeLabel}
          data-dialog-initial-focus
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </ChromeIconButton>
      </div>
      {children}
    </div>
  );
}
