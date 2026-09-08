import { sortInspectionCards } from "./card-inspection-sort";
import { useId, useMemo, useState, type RefObject } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BattleCard, CardDescriptionContext } from "@/lib/game-data";
import type { CardInspectionView } from "../types";
import { viewCardWidthClass } from "../config";
import { BattleCardButton } from "./card-button";
import { getCardDisplayTitle } from "./card-description-ui";
import { CardSelectionGrid } from "./card-selection-grid";
import { ModalOverlayShell } from "./modal-overlay-shell";
import { useDialogFocus } from "./use-dialog-focus";
import { useHeldWhile } from "./use-fade";

const LABELS: Record<CardInspectionView, string> = { deck: "Deck", draw: "Draw Pile", discard: "Discard Pile" };

export interface CardInspectionCollection {
  id: CardInspectionView;
  cards: readonly BattleCard[];
}

function InspectionGrid({
  cards,
  descriptionContext,
  resetKey,
}: {
  cards: readonly BattleCard[];
  descriptionContext: CardDescriptionContext;
  resetKey: string;
}) {
  const [pagination, setPagination] = useState({ key: resetKey, page: 0 });
  if (pagination.key !== resetKey) setPagination({ key: resetKey, page: 0 });
  const items = useMemo(() => sortInspectionCards(cards).map((card, index) => ({ card, index })), [cards]);
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
          />
        </div>
      )}
    />
  );
}

function InspectionPanel({
  collections,
  selected,
  onClose,
  descriptionContext,
  returnFocusRef,
  open,
}: CardInspectionOverlayProps & { selected: CardInspectionView }) {
  const titleId = useId();
  const { panelRef, handleKeyDown } = useDialogFocus(returnFocusRef);
  const collection = collections.find((entry) => entry.id === selected) ?? collections[0];
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
          {LABELS[selected]}
        </h2>
        <Button
          variant="outline"
          size="icon"
          className="absolute top-0 right-0 h-11 w-11"
          aria-label="Close card inspection"
          data-dialog-initial-focus
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
      <InspectionGrid
        cards={collection?.cards ?? []}
        descriptionContext={descriptionContext}
        resetKey={`${selected}:${open}`}
      />
    </div>
  );
}

interface CardInspectionOverlayProps {
  open: boolean;
  selected: CardInspectionView | null;
  collections: CardInspectionCollection[];
  descriptionContext: CardDescriptionContext;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

export function CardInspectionOverlay(props: CardInspectionOverlayProps) {
  const heldSelected = useHeldWhile(props.open, props.selected ?? "deck");
  return (
    <ModalOverlayShell
      open={props.open}
      escapeId="card-inspection"
      onClose={props.onClose}
      dismissOnBackdrop
      zIndex={85}
      testId="card-inspection-overlay"
      className="flex items-center justify-center p-6"
    >
      <InspectionPanel {...props} selected={heldSelected} />
    </ModalOverlayShell>
  );
}
