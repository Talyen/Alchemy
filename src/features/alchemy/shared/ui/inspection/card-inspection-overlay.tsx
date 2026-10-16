import { useGameTranslation } from "@/components/use-game-translation";

import type { RefObject } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Layers } from "lucide-react";
import type { BattleCard, CardDescriptionContext } from "@/lib/game-data";
import { cn } from "@/lib/utils";
import type { CardInspectionView } from "../../types";
import { InspectionCardGrid, InspectionEmptyState, InspectionOverlayShell } from "./inspection-content";
import { TabBar } from "../tab-bar";
import { useHeldWhile } from "../use-fade";

const LABELS: Record<CardInspectionView, string> = { deck: "Deck", draw: "Draw", discard: "Discard" };

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
  onSelect: (view: CardInspectionView) => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

export function CardInspectionOverlay(props: CardInspectionOverlayProps) {
  const i18n = useGameTranslation();
  const heldSelected = useHeldWhile(props.open, props.selected ?? "deck");
  const collection = props.collections.find((entry) => entry.id === heldSelected) ?? props.collections[0];
  const cards = collection?.cards ?? [];
  return (
    <InspectionOverlayShell
      open={props.open}
      escapeId="card-inspection"
      testId="card-inspection-overlay"
      title={i18n.text("ui.card-inspection-overlay.1", "Deck")}
      header={
        props.collections.length > 1 ? (
          <TabBar
            tabs={props.collections.map(({ id, cards: collectionCards }) => ({
              id,
              label: LABELS[id],
              ariaLabel: `${LABELS[id]} · ${collectionCards.length} cards`,
              icon: id === "draw" ? ArrowUpFromLine : id === "discard" ? ArrowDownToLine : Layers,
            }))}
            activeTab={heldSelected}
            onSelectTab={props.onSelect}
            className="card-inspection-tabs"
          />
        ) : undefined
      }
      closeLabel={i18n.text("ui.card-inspection-overlay.attr1", "Close card inspection")}
      onClose={props.onClose}
      returnFocusRef={props.returnFocusRef}
      overlayClassName={cn(
        "card-inspection-overlay flex items-center justify-center p-6",
        props.collections.length > 1 && "card-inspection-overlay-tabs",
        cards.length === 0 && "card-inspection-overlay-empty",
      )}
    >
      {cards.length === 0 ? (
        <InspectionEmptyState icon={Layers} label={i18n.displayText(EMPTY_LABELS[heldSelected])} />
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
