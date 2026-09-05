import { useMemo, useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { BattleCard } from "@/lib/game-data";
import { cn } from "@/lib/utils";

import { CardSelectionGrid } from "./card-selection-grid";
import { GoldCost } from "./display-elements";
import { SelectableCard } from "./selectable-card";
import { useCaptureEscapeCancel } from "./use-modal-escape-dismiss";

export function RemoveCardPanel({
  runDeck,
  intro,
  gold,
  removePrice,
  onConfirm,
  onCancel,
  cancelLabel = "Cancel",
  escapeCancels = true,
  compact = false,
}: {
  runDeck: BattleCard[];
  intro?: ReactNode;
  gold?: number;
  removePrice?: number;
  onConfirm: (index: number) => void;
  onCancel?: () => void;
  cancelLabel?: string;

  escapeCancels?: boolean;
  compact?: boolean;
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
    <div className={cn(compact ? "space-y-3" : "space-y-6")}>
      {intro}
      <CardSelectionGrid
        items={items}
        page={page}
        onPageChange={setPage}
        selectedIndex={selectedIndex ?? -1}
        paginationSize="default"
        paginationReserveSpace={!compact}
        renderItem={({ card, index }) => (
          <SelectableCard
            card={card}
            chrome="shop"
            isSelected={selectedIndex === index}
            onSelect={() => setSelectedIndex(index)}
          />
        )}
      />
      <div className={cn("flex justify-center gap-3", !compact && "mt-5")}>
        {onCancel ? (
          <Button size="lg" variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
        ) : null}
        <Button size="lg" variant="outline" disabled={confirmDisabled} onClick={handleConfirm}>
          <Trash2 className="h-7 w-7" /> Remove Card{removePrice !== undefined && <GoldCost amount={removePrice} />}
        </Button>
      </div>
    </div>
  );
}
