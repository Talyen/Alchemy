// Deck and library card pickers for mystery choose/remove effects.
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { type BattleCard } from "@/lib/game-data";
import { cn } from "@/lib/utils";

import { viewCardWidthClass } from "@/features/alchemy/shared/config";
import { CardSelectionGrid, type CardSelectionGridItem } from "../../../shared/ui/card-selection-grid";
import { BattleCardButton } from "../../../shared/ui/card-button";
import { CardTitle, getCardDisplayTitle } from "../../../shared/ui/card-description-ui";
import { ScreenHeader, StaggerGroup, StaggerItem } from "../../../shared/ui/shared-ui";

function DeckCardSelectionFlow({
  intro,
  items,
  page,
  onPageChange,
  pageSize,
  renderItem,
  confirmLabel,
  confirmDisabled,
  onConfirm,
}: {
  intro: ReactNode;
  items: CardSelectionGridItem[];
  page: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  renderItem: (item: CardSelectionGridItem, visualIndex: number) => ReactNode;
  confirmLabel: string;
  confirmDisabled: boolean;
  onConfirm: () => void;
}) {
  const confirmStaggerIndex = Math.min(items.length, pageSize) + 1;

  return (
    <StaggerGroup className="space-y-6 text-center">
      <StaggerItem index={0}>{intro}</StaggerItem>
      <CardSelectionGrid
        items={items}
        page={page}
        onPageChange={onPageChange}
        pageSize={pageSize}
        renderItem={renderItem}
      />
      <StaggerItem index={confirmStaggerIndex} className="flex justify-center gap-4">
        <Button size="lg" disabled={confirmDisabled} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </StaggerItem>
    </StaggerGroup>
  );
}

function SelectableCardTile({
  card,
  isSelected,
  onClick,
  showTitle = false,
  isHovered,
  onHoverStart,
  onHoverEnd,
}: {
  card: BattleCard;
  isSelected: boolean;
  onClick: () => void;
  showTitle?: boolean;
  isHovered?: boolean;
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
}) {
  const hovered = isHovered ?? isSelected;
  const button = (
    <BattleCardButton
      card={card}
      hovered={hovered}
      onHoverStart={onHoverStart ?? (() => {})}
      onHoverEnd={onHoverEnd ?? (() => {})}
      onClick={onClick}
      ariaLabel={`Select ${getCardDisplayTitle(card)}`}
      shimmerActive={false}
      shimmerToken={undefined}
      className={viewCardWidthClass}
      selected={isSelected}
    />
  );

  if (!showTitle) return button;

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border-2 p-2 transition-colors",
        isSelected ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-transparent hover:border-border",
      )}
    >
      {button}
      <p className="text-sm font-semibold text-foreground">
        <CardTitle card={card} />
      </p>
    </div>
  );
}

export function CardChoicePicker({ choices, onSelect }: { choices: BattleCard[]; onSelect: (cardId: string) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const items = choices.map((card, index) => ({ card, index }));

  return (
    <DeckCardSelectionFlow
      intro={
        <>
          <ScreenHeader title="Choose a Card" />
          <p className="text-base text-muted-foreground">Select one of the scrolls to add to your deck</p>
        </>
      }
      items={items}
      page={0}
      onPageChange={() => {}}
      pageSize={choices.length}
      renderItem={({ card }, _visualIndex) => (
        <SelectableCardTile
          card={card}
          isSelected={selectedId === card.id}
          isHovered={hoveredId === card.id}
          onHoverStart={() => setHoveredId(card.id)}
          onHoverEnd={() => setHoveredId(null)}
          onClick={() => setSelectedId(card.id)}
        />
      )}
      confirmLabel="Add Card"
      confirmDisabled={selectedId === null}
      onConfirm={() => {
        if (selectedId !== null) onSelect(selectedId);
      }}
    />
  );
}
