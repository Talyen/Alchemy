import type { RefObject } from "react";
import type { BattleCard, CardDescriptionContext } from "@/lib/game-data";
import { cn } from "@/lib/utils";
import type { CardInspectionView } from "../types";
import { InspectionCardGrid, InspectionPanel } from "./inspection-content";
import { ModalOverlayShell } from "./modal-overlay-shell";
import { useHeldWhile } from "./use-fade";

const LABELS: Record<CardInspectionView, string> = { deck: "Deck", draw: "Draw Pile", discard: "Discard Pile" };

export interface CardInspectionCollection {
  id: CardInspectionView;
  cards: readonly BattleCard[];
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
  const collection = props.collections.find((entry) => entry.id === heldSelected) ?? props.collections[0];
  const cards = collection?.cards ?? [];
  return (
    <ModalOverlayShell
      open={props.open}
      escapeId="card-inspection"
      onClose={props.onClose}
      dismissOnBackdrop
      zIndex={85}
      testId="card-inspection-overlay"
      className={cn(
        "card-inspection-overlay flex items-center justify-center p-6",
        cards.length === 0 && "card-inspection-overlay-empty",
      )}
    >
      <InspectionPanel
        title={LABELS[heldSelected]}
        closeLabel="Close card inspection"
        onClose={props.onClose}
        returnFocusRef={props.returnFocusRef}
      >
        {cards.length === 0 ? (
          <p className="flex min-h-40 shrink-0 items-center justify-center text-sm text-muted-foreground">Empty</p>
        ) : (
          <InspectionCardGrid
            cards={cards}
            descriptionContext={props.descriptionContext}
            resetKey={`${heldSelected}:${props.open}`}
          />
        )}
      </InspectionPanel>
    </ModalOverlayShell>
  );
}
