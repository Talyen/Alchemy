// Shared card-removal panel used by merchant shop and mystery event screens.
import { useMemo, useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SELECTION_GRID_PAGE_SIZE } from "@/lib/game-constants";
import type { BattleCard } from "@/lib/game-data";

import { CardSelectionGrid } from "./card-selection-grid";
import { GoldCost, StaggerGroup } from "./shared-ui";
import { SelectableShopCard } from "./shop-card-item";

export function RemoveCardPanel({
  runDeck,
  intro,
  gold,
  removePrice,
  onConfirm,
  onCancel,
}: {
  runDeck: BattleCard[];
  intro: ReactNode;
  gold?: number;
  removePrice?: number;
  onConfirm: (index: number) => void;
  onCancel?: () => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const items = useMemo(() => runDeck.map((card, index) => ({ card, index })), [runDeck]);
  const hasCost = gold !== undefined && removePrice !== undefined;
  const confirmDisabled = selectedIndex === null || (hasCost && gold < removePrice);

  function handleConfirm() {
    if (selectedIndex === null) return;
    onConfirm(selectedIndex);
  }

  return (
    <StaggerGroup className="space-y-6">
      {intro}
      <CardSelectionGrid
        items={items}
        page={page}
        onPageChange={setPage}
        pageSize={SELECTION_GRID_PAGE_SIZE}
        paginationSize="default"
        paginationReserveSpace
        renderItem={({ card, index }) => (
          <SelectableShopCard
            card={card}
            isSelected={selectedIndex === index}
            onSelect={() => setSelectedIndex(index)}
          />
        )}
      />
      <div className="mt-5 flex justify-center gap-3">
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button variant="outline" disabled={confirmDisabled} onClick={handleConfirm}>
          <Trash2 className="h-4 w-4" /> Remove Card{removePrice !== undefined && <GoldCost amount={removePrice} />}
        </Button>
      </div>
    </StaggerGroup>
  );
}
