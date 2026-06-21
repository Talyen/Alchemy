import { memo, type RefObject } from "react";
import { ArrowDownUp, Dices, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  INVENTORY_COLS,
  INVENTORY_VISIBLE_ROWS,
  type CraftingCurrencyId,
  type GearInstance,
  type PackedCurrencyItem,
  type PackedInventoryItem,
} from "@/lib/gear";
import { cn } from "@/lib/utils";
import { CraftingCurrencyTile } from "./parts/currency-tile";
import { InventoryGearTile } from "./parts/inventory-tile";
import { packedItemStyle } from "./parts/grid-styles";
import { useInventoryScrollDrag } from "./use-inventory-scroll-drag";
import type { GearDragOrigin, GearPointerEnd, GearPointerMove, GearPointerStart } from "./use-armory-gear-drag";
import type { CurrencyPointerEnd, CurrencyPointerMove, CurrencyPointerStart } from "./use-armory-currency-drag";

export const InventoryPanel = memo(function InventoryPanel({
  packedItems,
  packedCurrencies,
  occupiedRows,
  editable,
  draggedInstanceId,
  draggedCurrencyId = null,
  secondaryDragInstanceIds = [] as string[],
  isDraggingActive,
  boardRef,
  salvageMode,
  activeCurrencyId,
  onSalvage,
  onToggleSalvageMode,
  hasSalvageableGear,
  onSelectCurrency,
  onSpawnDevGear,
  onGearPointerStart,
  onGearPointerMove,
  onGearPointerEnd,
  onGearDoubleClick,
  onCurrencyPointerStart,
  onCurrencyPointerMove,
  onCurrencyPointerEnd,
  craftingCurrencies,
  onApplyCurrency,
  onAbortGearDrag,
  onTransferRequest,
  onSortBoard,
}: {
  packedItems: PackedInventoryItem[];
  packedCurrencies: PackedCurrencyItem[];
  occupiedRows: number;
  editable: boolean;
  draggedInstanceId: string | null;
  draggedCurrencyId?: CraftingCurrencyId | null;
  secondaryDragInstanceIds?: string[];
  isDraggingActive: boolean;
  boardRef: RefObject<HTMLDivElement | null>;
  salvageMode: boolean;
  activeCurrencyId: CraftingCurrencyId | null;
  onSalvage: (instance: GearInstance) => void;
  onToggleSalvageMode: () => void;
  hasSalvageableGear: boolean;
  onSelectCurrency: (currencyId: CraftingCurrencyId) => void;
  onSpawnDevGear?: () => void;
  onGearPointerStart: GearPointerStart;
  onGearPointerMove: GearPointerMove;
  onGearPointerEnd: GearPointerEnd;
  onGearDoubleClick: (instance: GearInstance, origin: GearDragOrigin, rect: DOMRect) => void;
  onCurrencyPointerStart: CurrencyPointerStart;
  onCurrencyPointerMove: CurrencyPointerMove;
  onCurrencyPointerEnd: CurrencyPointerEnd;
  craftingCurrencies: Record<CraftingCurrencyId, number>;
  onApplyCurrency: (instance: GearInstance) => void;
  onAbortGearDrag: (instanceId: string) => void;
  onTransferRequest?: (instance: GearInstance, anchor: { x: number; y: number }) => void;
  onSortBoard?: () => void;
}) {
  const renderedRows = Math.max(INVENTORY_VISIBLE_ROWS, occupiedRows);
  const canScroll = renderedRows > INVENTORY_VISIBLE_ROWS;
  const inventory = packedItems.map(({ item }) => item);
  const {
    suppressClickRef,
    dragging,
    suppressingInteraction,
    dragSequence,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
  } = useInventoryScrollDrag({ canScroll, salvageMode, activeCurrencyId });

  return (
    <section
      data-testid="armory-inventory-panel"
      className="armory-inventory-panel alchemy-shell relative flex min-w-0 flex-col items-center rounded-shell-dialog border border-border/80 p-4"
    >
      <h2 className="text-center font-sans text-lg text-amber-100">Inventory</h2>
      <div className="absolute right-4 top-3 z-20 isolate flex items-center gap-1.5">
        {import.meta.env.DEV && onSpawnDevGear ? (
          <Button
            type="button"
            size="icon"
            variant="outline"
            hoverSound={false}
            className="h-8 w-8 border-amber-600/50 text-amber-200/80 hover:border-amber-500/70 hover:bg-amber-950/25 hover:text-amber-100 cursor-pointer"
            aria-label="Spawn random gear"
            onClick={onSpawnDevGear}
          >
            <Dices className="h-3.5 w-3.5" />
          </Button>
        ) : null}
        <Button
          type="button"
          size="icon"
          variant="outline"
          disabled={!editable || (packedItems.length === 0 && packedCurrencies.length === 0)}
          data-testid="armory-sort-button"
          className="h-8 w-8 border-border/60 text-muted-foreground/70 hover:border-amber-500/50 hover:bg-amber-950/20 hover:text-amber-200 disabled:border-border/40 disabled:text-muted-foreground/45 cursor-pointer"
          aria-label="Sort inventory"
          onClick={(event) => {
            event.stopPropagation();
            onSortBoard?.();
          }}
        >
          <ArrowDownUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          disabled={!hasSalvageableGear}
          data-testid="armory-salvage-toggle"
          className={cn(
            "h-8 w-8 border-red-950/60 text-red-400/65 hover:border-red-900/70 hover:bg-red-950/25 hover:text-red-300 disabled:border-border/40 disabled:text-muted-foreground/45 cursor-pointer",
            salvageMode && "border-red-700/70 bg-red-950/35 text-red-300",
          )}
          aria-label={salvageMode ? "Cancel salvage" : "Salvage Gear"}
          aria-pressed={salvageMode}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
            onToggleSalvageMode();
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div
        ref={boardRef}
        data-testid="armory-inventory-board"
        data-scrollable={canScroll ? "true" : "false"}
        className={cn(
          "armory-inventory-board relative mt-4 overflow-x-hidden overscroll-contain touch-pan-y select-none",
          canScroll ? "overflow-y-auto" : "overflow-y-hidden",
          dragging && "cursor-grabbing",
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <div
          className="relative"
          style={{
            height: `calc(${renderedRows} * var(--armory-cell-size) + ${renderedRows - 1} * var(--armory-board-gap))`,
          }}
        >
          <div
            data-armory-grid-metric="cell"
            className="pointer-events-none invisible absolute"
            style={packedItemStyle({ col: 1, row: 1, w: 1, h: 1 })}
            aria-hidden
          />
          <div
            data-armory-grid-metric="stride"
            className="pointer-events-none invisible absolute"
            style={packedItemStyle({ col: 2, row: 1, w: 1, h: 1 })}
            aria-hidden
          />
          <div className="absolute inset-0" aria-hidden>
            {Array.from({ length: INVENTORY_COLS * renderedRows }, (_, index) => {
              const rIdx = Math.floor(index / INVENTORY_COLS);
              const cIdx = index % INVENTORY_COLS;
              return (
                <div
                  key={index}
                  data-armory-inventory-cell={`${cIdx + 1}-${rIdx + 1}`}
                  className="absolute bg-background/10 rounded-xl"
                  style={{
                    ...packedItemStyle({ col: cIdx + 1, row: rIdx + 1, w: 1, h: 1 }),
                    boxShadow: "inset 0 0 0 1px rgba(255, 253, 245, 0.06)",
                  }}
                />
              );
            })}
          </div>
          <div className="absolute inset-0">
            {packedItems.map(({ item, col, row, w, h }) => (
              <InventoryGearTile
                key={item.instanceId}
                instance={item}
                placement={{ col, row, w, h }}
                inventory={inventory}
                editable={editable}
                salvageMode={salvageMode}
                activeCurrencyId={activeCurrencyId}
                dragging={draggedInstanceId === item.instanceId}
                secondaryDragging={secondaryDragInstanceIds.includes(item.instanceId)}
                interactionSuppressed={dragging || suppressingInteraction || isDraggingActive}
                hasActiveDrag={isDraggingActive}
                dragSequence={dragSequence}
                shouldSuppressClick={() => suppressClickRef.current}
                onSalvage={() => onSalvage(item)}
                onApplyCurrency={() => onApplyCurrency(item)}
                onGearPointerStart={onGearPointerStart}
                onGearPointerMove={onGearPointerMove}
                onGearPointerEnd={onGearPointerEnd}
                onGearDoubleClick={onGearDoubleClick}
                onAbortGearDrag={onAbortGearDrag}
                onTransferRequest={onTransferRequest}
              />
            ))}
            {packedCurrencies.map((placement) => (
              <CraftingCurrencyTile
                key={placement.currencyId}
                currencyId={placement.currencyId}
                count={craftingCurrencies[placement.currencyId] ?? 0}
                placement={placement}
                editable={editable}
                dragging={draggedCurrencyId === placement.currencyId}
                interactionSuppressed={dragging || suppressingInteraction || isDraggingActive}
                targetingMode={salvageMode || !!activeCurrencyId}
                onSelect={() => onSelectCurrency(placement.currencyId)}
                onCurrencyPointerStart={onCurrencyPointerStart}
                onCurrencyPointerMove={onCurrencyPointerMove}
                onCurrencyPointerEnd={onCurrencyPointerEnd}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
});
