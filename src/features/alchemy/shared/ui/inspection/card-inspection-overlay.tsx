import type { RefObject } from "react";
import { Layers } from "lucide-react";
import type { BattleCard, CardDescriptionContext } from "@/lib/game-data";
import { cn } from "@/lib/utils";
import type { CardInspectionView } from "../../types";
import { InspectionCardGrid, InspectionEmptyState, InspectionOverlayShell } from "./inspection-content";
import { useHeldWhile } from "../use-fade";

const LABELS: Record<CardInspectionView, string> = { deck: "Deck", draw: "Draw Pile", discard: "Discard Pile" };

const EMPTY_LABELS: Record<CardInspectionView, string> = {
  deck: "Empty Deck",
  draw: "Empty Draw Pile",
  discard: "Empty Discard Pile",
};

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
    <InspectionOverlayShell
      open={props.open}
      escapeId="card-inspection"
      testId="card-inspection-overlay"
      title={LABELS[heldSelected]}
      closeLabel="Close card inspection"
      onClose={props.onClose}
      returnFocusRef={props.returnFocusRef}
      overlayClassName={cn(
        "card-inspection-overlay flex items-center justify-center p-6",
        cards.length === 0 && "card-inspection-overlay-empty",
      )}
    >
      {cards.length === 0 ? (
        <InspectionEmptyState icon={Layers} label={EMPTY_LABELS[heldSelected]} />
      ) : (
        <InspectionCardGrid
          cards={cards}
          descriptionContext={props.descriptionContext}
          resetKey={`${heldSelected}:${props.open}`}
        />
      )}
    </InspectionOverlayShell>
  );
}
