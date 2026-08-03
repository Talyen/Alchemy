// Shared card-removal panel used by merchant, mystery, and wildwood screens.
import { useMemo, useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SELECTION_GRID_PAGE_SIZE } from "@/lib/game-constants";
import type { BattleCard } from "@/lib/game-data";

import { CardSelectionGrid } from "./card-selection-grid";
import { GoldCost, StaggerGroup } from "./shared-ui";
import { SelectableShopCard } from "./shop-card-item";
import { useCaptureEscapeCancel } from "./use-capture-escape-cancel";

export function RemoveCardPanel({
  runDeck,
  intro,
  gold,
  removePrice,
  onConfirm,
  onCancel,
  cancelLabel = "Cancel",
  escapeCancels = true,
}: {
  runDeck: BattleCard[];
  intro: ReactNode;
  gold?: number;
  removePrice?: number;
  onConfirm: (index: number) => void;
  onCancel?: () => void;
  cancelLabel?: string;
  /** When false, Escape does not invoke onCancel (pause menu remains reachable). */
  escapeCancels?: boolean;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const items = useMemo(() => runDeck.map((card, index) => ({ card, index })), [runDeck]);
  const hasCost = gold !== undefined && removePrice !== undefined;
  const confirmDisabled = selectedIndex === null || (hasCost && gold < removePrice);

  useCaptureEscapeCancel(escapeCancels ? onCancel : undefined);

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
        {onCancel ? (
          <Button size="lg" variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
        ) : null}
        <Button size="lg" variant="outline" disabled={confirmDisabled} onClick={handleConfirm}>
          <Trash2 className="h-7 w-7" /> Remove Card{removePrice !== undefined && <GoldCost amount={removePrice} />}
        </Button>
      </div>
    </StaggerGroup>
  );
}
