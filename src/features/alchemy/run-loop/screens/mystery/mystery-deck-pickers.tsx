import { useGameTranslation } from "@/components/use-game-translation";
import { text as gameText } from "@/lib/localization/runtime";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { type BattleCard } from "@/lib/game-data";

import { CardSelectionGrid } from "../../../shared/ui/cards/card-selection-grid";
import { SelectableCard } from "../../../shared/ui/cards/selectable-card";
import { bodyTextClass, getCardInspectionShineColors } from "@/features/alchemy/shared/config";

export function CardChoicePicker({ choices, onSelect }: { choices: BattleCard[]; onSelect: (cardId: string) => void }) {
  useGameTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const items = choices.map((card, index) => ({ card, index }));

  return (
    <div className="space-y-6 text-center">
      <p className={bodyTextClass}>
        {gameText("ui.mystery-deck-pickers.1", "Select one of the scrolls to add to your deck")}
      </p>
      <CardSelectionGrid
        items={items}
        page={0}
        onPageChange={() => {}}
        pageSize={choices.length}
        renderItem={({ card }) => (
          <SelectableCard
            card={card}
            chrome="deck"
            isSelected={selectedId === card.id}
            isHovered={hoveredId === card.id}
            onHoverStart={() => setHoveredId(card.id)}
            onHoverEnd={() => setHoveredId(null)}
            shineColor={getCardInspectionShineColors(card)}
            onSelect={() => setSelectedId(card.id)}
          />
        )}
      />
      <div className="flex justify-center gap-4">
        <Button size="lg" disabled={selectedId === null} onClick={() => selectedId !== null && onSelect(selectedId)}>
          {gameText("ui.mystery-deck-pickers.2", "Add Card")}
        </Button>
      </div>
    </div>
  );
}
