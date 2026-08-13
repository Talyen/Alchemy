// Deck and library card pickers for mystery choose/remove effects.
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { type BattleCard } from "@/lib/game-data";

import { CardSelectionGrid, type CardSelectionGridItem } from "../../../shared/ui/card-selection-grid";
import { SelectableShopCard } from "../../../shared/ui/shop-card-item";
import { ScreenHeader } from "../../../shared/ui/shared-ui";
import { bodyTextClass } from "@/features/alchemy/shared/config";

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
  return (
    <div className="space-y-6 text-center">
      {intro}
      <CardSelectionGrid
        items={items}
        page={page}
        onPageChange={onPageChange}
        pageSize={pageSize}
        renderItem={renderItem}
      />
      <div className="flex justify-center gap-4">
        <Button size="lg" disabled={confirmDisabled} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
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
          <p className={bodyTextClass}>Select one of the scrolls to add to your deck</p>
        </>
      }
      items={items}
      page={0}
      onPageChange={() => {}}
      pageSize={choices.length}
      renderItem={({ card }, _visualIndex) => (
        <SelectableShopCard
          card={card}
          chrome="deck"
          isSelected={selectedId === card.id}
          isHovered={hoveredId === card.id}
          onHoverStart={() => setHoveredId(card.id)}
          onHoverEnd={() => setHoveredId(null)}
          onSelect={() => setSelectedId(card.id)}
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
