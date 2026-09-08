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
      fitHeight
      page={pagination.key === resetKey ? pagination.page : 0}
      onPageChange={(page) => setPagination({ key: resetKey, page })}
      emptyMessage="No cards here."
      paginationReserveSpace
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
          <p className="mt-2 text-center text-sm font-semibold">{getCardDisplayTitle(card)}</p>
        </div>
      )}
    />
  );
}

function InspectionPanel({
  collections,
  selected,
  onSelect,
  onClose,
  descriptionContext,
  returnFocusRef,
  open,
}: CardInspectionOverlayProps & { selected: CardInspectionView }) {
  const titleId = useId();
  const descriptionId = useId();
  const { panelRef, handleKeyDown } = useDialogFocus(returnFocusRef);
  const collection = collections.find((entry) => entry.id === selected) ?? collections[0];
  const inCombat = collections.length > 1;
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Modal contains keyboard focus and stops backdrop clicks
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      onClick={(event) => event.stopPropagation()}
      className="alchemy-shell relative flex h-[92cqh] w-full max-w-6xl flex-col rounded-shell-screen border border-border/80 p-6"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 id={titleId} className="font-sans text-3xl">
          {LABELS[selected]} · {collection?.cards.length ?? 0} cards
        </h2>
        <Button
          variant="outline"
          size="icon"
          className="h-11 w-11"
          aria-label="Close card inspection"
          data-dialog-initial-focus
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
      {inCombat ? (
        <div className="mt-4 flex justify-center gap-3" role="group" aria-label="Card collections">
          {collections.map((entry) => (
            <Button
              key={entry.id}
              size="sm"
              variant={entry.id === selected ? "primary" : "outline"}
              aria-pressed={entry.id === selected}
              onClick={() => onSelect(entry.id)}
            >
              {LABELS[entry.id]} · {entry.cards.length}
            </Button>
          ))}
        </div>
      ) : null}
      <p id={descriptionId} className="my-3 text-center text-sm text-muted-foreground">
        {selected === "deck"
          ? inCombat
            ? "Your run’s deck, including cards Consumed this battle. Battle-only cards appear in their current piles."
            : "Your run’s deck."
          : "Shown alphabetically, not in draw order."}
      </p>
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
  onSelect: (view: CardInspectionView) => void;
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
