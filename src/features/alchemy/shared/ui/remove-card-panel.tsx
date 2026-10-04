import { useMemo, useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { type BattleCard } from "@/lib/game-data";
import { cn } from "@/lib/utils";

import { CardSelectionGrid } from "./cards/card-selection-grid";
import { getCardInspectionShineColors } from "../config";
import { GoldCost } from "./display-elements";
import { SelectableCard } from "./cards/selectable-card";
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
  fitHeight = false,
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
  fitHeight?: boolean;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [selectionDeck, setSelectionDeck] = useState(runDeck);
  const [selectionNotice, setSelectionNotice] = useState("");
  if (selectionDeck !== runDeck) {
    setSelectionDeck(runDeck);
    setSelectedIndex(null);
    setPage(0);
    setSelectionNotice("Your deck changed. Choose a card to remove again.");
  }
  const items = useMemo(() => runDeck.map((card, index) => ({ card, index })), [runDeck]);
  const hasCost = gold !== undefined && removePrice !== undefined;
  const canAfford = !hasCost || gold >= removePrice;
  const confirmDisabled = selectedIndex === null || !runDeck[selectedIndex] || !canAfford;

  useCaptureEscapeCancel(escapeCancels ? onCancel : undefined);

  function handleConfirm() {
    if (confirmDisabled || selectedIndex === null) return;
    onConfirm(selectedIndex);
  }

  return (
    <div className={cn(fitHeight ? "flex min-h-0 flex-1 flex-col gap-3" : compact ? "space-y-3" : "space-y-6")}>
      {intro}
      {selectionNotice && <p role="status">{selectionNotice}</p>}
      <CardSelectionGrid
        fitHeight={fitHeight}
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
            shineColor={getCardInspectionShineColors(card)}
            onSelect={() => {
              setSelectedIndex(index);
              setSelectionNotice("");
            }}
          />
        )}
      />
      <div className={cn("flex shrink-0 justify-center gap-3", !compact && !fitHeight && "mt-5")}>
        {onCancel ? (
          <Button size="lg" variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
        ) : null}
        <Button size="lg" variant="primary" disabled={confirmDisabled} onClick={handleConfirm}>
          <Trash2 className="h-7 w-7" /> {fitHeight ? "Remove" : "Remove Card"}
          {removePrice !== undefined && <GoldCost amount={removePrice} affordable={canAfford} />}
        </Button>
      </div>
    </div>
  );
}
