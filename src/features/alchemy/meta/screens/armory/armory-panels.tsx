import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { Dices, Lock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { playUISound } from "@/lib/audio";
import { characters, characterArt, gearSlotBackgroundArt, type CharacterId } from "@/lib/game-data";
import {
  canSalvageGear,
  gearDefinitions,
  GEAR_FOOTPRINT,
  getGearInstanceTitle,
  INVENTORY_COLS,
  INVENTORY_VISIBLE_ROWS,
  isGearCompatibleWithSlot,
  type GearInstance,
  type GearLoadouts,
  type GearSlot,
  type PackedInventoryItem,
  type PackedCurrencyItem,
  type CraftingCurrencyId,
  canApplyCraftingCurrency,
  getCraftingCurrencyDefinition,
} from "@/lib/gear";
import { cn } from "@/lib/utils";
import { TiltSurface } from "../../../shared/ui/tilt-surface";
import { TooltipPanel, useTooltipViewportClamp } from "../../../shared/ui/tooltip-panel";
import { useInteractiveCard } from "../../../shared/ui/use-interactive-card";
import { GearTooltipContent, ARMORY_TOOLTIP_WIDTH } from "./gear-tooltip-content";
import type { GearDragOrigin, GearPointerEnd, GearPointerMove, GearPointerStart } from "./use-armory-gear-drag";
import type { CurrencyPointerEnd, CurrencyPointerMove, CurrencyPointerStart } from "./use-armory-currency-drag";
import { TooltipBody, TooltipHeader } from "../../../shared/ui/tooltip-panel";

export type { GearDragOrigin } from "./use-armory-gear-drag";

const SLOT_LABELS: Record<GearSlot, string> = {
  body: "Body",
  helm: "Helm",
  boots: "Boots",
  gloves: "Gloves",
  belt: "Belt",
  "main-hand": "Main Hand",
  "off-hand": "Off-Hand",
  "left-ring": "Left Ring",
  "right-ring": "Right Ring",
  amulet: "Amulet",
};

const EQUIP_SLOT_PLACEMENT: Record<GearSlot, { x: number; y: number }> = {
  helm: { x: 2, y: 0 },
  amulet: { x: 4, y: 0 },
  "left-ring": { x: 1, y: 1 },
  "right-ring": { x: 4, y: 1 },
  "main-hand": { x: 0, y: 2 },
  body: { x: 2, y: 2 },
  "off-hand": { x: 4, y: 2 },
  gloves: { x: 0, y: 5 },
  belt: { x: 2, y: 5 },
  boots: { x: 4, y: 5 },
};

const EQUIP_SLOTS = Object.keys(EQUIP_SLOT_PLACEMENT) as GearSlot[];

const CURRENCY_TILE_STYLES: Record<CraftingCurrencyId, { className: string; glowClassName: string }> = {
  "discordant-dice": {
    className: "border-violet-400/45 text-violet-100 hover:border-violet-300/80",
    glowClassName: "bg-violet-500/20",
  },
  "sprig-of-growth": {
    className: "border-emerald-400/45 text-emerald-100 hover:border-emerald-300/80",
    glowClassName: "bg-emerald-500/20",
  },
  voidstone: {
    className: "border-slate-300/45 text-slate-100 hover:border-slate-200/80",
    glowClassName: "bg-slate-300/20",
  },
  "ascension-seal": {
    className: "border-amber-300/50 text-amber-100 hover:border-amber-200/80",
    glowClassName: "bg-amber-400/20",
  },
  "severance-maw": {
    className: "border-red-400/45 text-red-100 hover:border-red-300/80",
    glowClassName: "bg-red-500/20",
  },
  "smiths-whetstone": {
    className: "border-stone-300/50 text-stone-100 hover:border-stone-200/80",
    glowClassName: "bg-stone-300/20",
  },
};

function equipmentSlotStyle(slot: GearSlot): CSSProperties {
  const { x, y } = EQUIP_SLOT_PLACEMENT[slot];
  const { w, h } = GEAR_FOOTPRINT[slot];
  return {
    left: `calc(${x} * (var(--armory-cell-size) + var(--armory-board-gap)))`,
    top: `calc(${y} * (var(--armory-cell-size) + var(--armory-board-gap)))`,
    width: `calc(${w} * var(--armory-cell-size) + ${w - 1} * var(--armory-board-gap))`,
    height: `calc(${h} * var(--armory-cell-size) + ${h - 1} * var(--armory-board-gap))`,
  };
}

function packedItemStyle({ col, row, w, h }: { col: number; row: number; w: number; h: number }): CSSProperties {
  return {
    left: `calc(${col - 1} * (var(--armory-cell-size) + var(--armory-board-gap)))`,
    top: `calc(${row - 1} * (var(--armory-cell-size) + var(--armory-board-gap)))`,
    width: `calc(${w} * var(--armory-cell-size) + ${w - 1} * var(--armory-board-gap))`,
    height: `calc(${h} * var(--armory-cell-size) + ${h - 1} * var(--armory-board-gap))`,
  };
}

function dismissWhenFocusLeaves(event: FocusEvent<HTMLDivElement>, dismiss: () => void) {
  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) dismiss();
}

export const CharacterAndEquipmentPanel = memo(function CharacterAndEquipmentPanel({
  characterId,
  locked,
  loadout,
  inventoryById,
  editable,
  requiredCharacterId,
  draggedGear,
  secondaryDragInstanceId = null,
  isDraggingActive,
  salvageMode,
  activeCurrencyId,
  onGearPointerStart,
  onGearPointerMove,
  onGearPointerEnd,
  onGearDoubleClick,
  onSalvage,
  onApplyCurrency,
}: {
  characterId: CharacterId;
  locked: boolean;
  loadout: GearLoadouts[CharacterId];
  inventoryById: Map<string, GearInstance>;
  editable: boolean;
  requiredCharacterId: CharacterId | null;
  draggedGear?: GearInstance | null;
  secondaryDragInstanceId?: string | null;
  isDraggingActive: boolean;
  salvageMode: boolean;
  activeCurrencyId: CraftingCurrencyId | null;
  onGearPointerStart: GearPointerStart;
  onGearPointerMove: GearPointerMove;
  onGearPointerEnd: GearPointerEnd;
  onGearDoubleClick: (instance: GearInstance, origin: GearDragOrigin, rect: DOMRect) => void;
  onSalvage: (instance: GearInstance) => void;
  onApplyCurrency: (instance: GearInstance) => void;
}) {
  const { onHoverStart, shimmerActive, shimmerToken } = useInteractiveCard("armory", characterId);

  useEffect(() => {
    onHoverStart();
  }, [characterId, onHoverStart]);

  return (
    <section
      data-testid="armory-left-panel"
      className="alchemy-shell relative flex min-w-0 flex-col md:flex-row items-center justify-center gap-6 rounded-shell-dialog border border-border/80 p-5"
    >
      <div data-testid="armory-character-panel" className="flex min-w-0 flex-col items-center justify-center px-4 py-2">
        <h2 className="text-center font-display text-lg text-amber-100">{characters[characterId].name}</h2>
        <TiltSurface
          testId="armory-character-art-container"
          tiltEnabled={!locked}
          className={cn(
            "relative mt-3 aspect-[3/4] shrink-0 overflow-hidden rounded-shell-hero bg-black",
            "armory-character-art-container",
          )}
          shimmerActive={locked ? false : shimmerActive}
          shimmerToken={locked ? undefined : shimmerToken}
          shimmerRounded="rounded-shell-hero"
          onMouseEnter={onHoverStart}
        >
          <img
            src={characterArt[characterId]}
            alt={characters[characterId].name}
            className={cn("h-full w-full object-cover", locked && "grayscale opacity-40")}
          />
        </TiltSurface>
      </div>

      <div data-testid="armory-equipment-panel" className="relative flex min-w-0 flex-col items-center p-2">
        <h2 className="text-center font-display text-lg text-amber-100">Equipment</h2>
        <div data-testid="armory-equipment-board" className="armory-equipment-board relative mt-4 aspect-[6/7]">
          {EQUIP_SLOTS.map((slot) => {
            const instanceId = loadout[slot];
            return (
              <div key={slot} className="absolute min-h-0 min-w-0" style={equipmentSlotStyle(slot)}>
                <SlotButton
                  slot={slot}
                  instance={instanceId ? inventoryById.get(instanceId) : undefined}
                  editable={editable}
                  draggedGear={draggedGear}
                  secondaryDragInstanceId={secondaryDragInstanceId}
                  isDraggingActive={isDraggingActive}
                  salvageMode={salvageMode}
                  activeCurrencyId={activeCurrencyId}
                  onGearPointerStart={onGearPointerStart}
                  onGearPointerMove={onGearPointerMove}
                  onGearPointerEnd={onGearPointerEnd}
                  onGearDoubleClick={onGearDoubleClick}
                  onSalvage={() =>
                    instanceId && inventoryById.get(instanceId) && onSalvage(inventoryById.get(instanceId)!)
                  }
                  onApplyCurrency={() =>
                    instanceId && inventoryById.get(instanceId) && onApplyCurrency(inventoryById.get(instanceId)!)
                  }
                />
              </div>
            );
          })}
        </div>
      </div>

      {locked && requiredCharacterId ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center rounded-shell-dialog bg-black/70 p-5">
          <div className="max-w-xs text-center">
            <Lock className="mx-auto h-8 w-8" />
            <p className="mt-2 font-semibold">Finish a Run as the {characters[requiredCharacterId].name} to unlock</p>
          </div>
        </div>
      ) : null}
    </section>
  );
});

export const InventoryPanel = memo(function InventoryPanel({
  packedItems,
  packedCurrencies,
  occupiedRows,
  editable,
  draggedInstanceId,
  draggedCurrencyId = null,
  secondaryDragInstanceId = null,
  isDraggingActive,
  isAnimating,
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
}: {
  packedItems: PackedInventoryItem<GearInstance>[];
  packedCurrencies: PackedCurrencyItem[];
  occupiedRows: number;
  editable: boolean;
  draggedInstanceId: string | null;
  draggedCurrencyId?: CraftingCurrencyId | null;
  secondaryDragInstanceId?: string | null;
  isDraggingActive: boolean;
  isAnimating: boolean;
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
}) {
  const dragRef = useRef<{ pointerId: number; startY: number; startScrollTop: number; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [suppressingInteraction, setSuppressingInteraction] = useState(false);
  const [dragSequence, setDragSequence] = useState(0);
  const renderedRows = Math.max(INVENTORY_VISIBLE_ROWS, occupiedRows);
  const canScroll = renderedRows > INVENTORY_VISIBLE_ROWS;
  const inventory = packedItems.map(({ item }) => item);

  useEffect(() => {
    if (!salvageMode) return;
    suppressClickRef.current = false;
    setSuppressingInteraction(false);
  }, [salvageMode]);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!canScroll || salvageMode || activeCurrencyId || event.pointerType === "touch" || event.button !== 0) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startScrollTop: event.currentTarget.scrollTop,
      moved: false,
    };
    setDragging(true);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaY = event.clientY - drag.startY;
    if (Math.abs(deltaY) > 4 && !drag.moved) {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      drag.moved = true;
      suppressClickRef.current = true;
      setSuppressingInteraction(true);
      setDragSequence((current) => current + 1);
    }
    event.currentTarget.scrollTop = drag.startScrollTop - deltaY;
  }

  function finishDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    setDragging(false);
    if (drag.moved) {
      window.setTimeout(() => {
        suppressClickRef.current = false;
        setSuppressingInteraction(false);
      }, 150);
    }
  }

  return (
    <section
      data-testid="armory-inventory-panel"
      className="armory-inventory-panel alchemy-shell relative flex min-w-0 flex-col items-center rounded-shell-dialog border border-border/80 p-4"
    >
      <h2 className="text-center font-display text-lg text-amber-100">Inventory</h2>
      <div className="absolute right-4 top-3 isolate flex items-center gap-1.5">
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
          disabled={!hasSalvageableGear}
          className={cn(
            "h-8 w-8 border-red-950/60 text-red-400/65 hover:border-red-900/70 hover:bg-red-950/25 hover:text-red-300 disabled:border-border/40 disabled:text-muted-foreground/45 cursor-pointer",
            salvageMode && "border-red-700/70 bg-red-950/35 text-red-300",
          )}
          aria-label={salvageMode ? "Cancel salvage" : "Salvage Gear"}
          aria-pressed={salvageMode}
          onClick={onToggleSalvageMode}
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
          canScroll && !salvageMode && !activeCurrencyId ? "overflow-y-auto" : "overflow-y-hidden",
          canScroll && !salvageMode && !activeCurrencyId && "cursor-grab",
          dragging && "cursor-grabbing",
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
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
                secondaryDragging={secondaryDragInstanceId === item.instanceId}
                isAnimating={isAnimating}
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
              />
            ))}
            {packedCurrencies.map((placement) => (
              <CraftingCurrencyTile
                key={placement.currencyId}
                currencyId={placement.currencyId}
                count={craftingCurrencies[placement.currencyId] ?? 0}
                placement={placement}
                editable={editable}
                active={activeCurrencyId === placement.currencyId}
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

const CraftingCurrencyTile = memo(function CraftingCurrencyTile({
  currencyId,
  count,
  placement,
  editable,
  active,
  dragging,
  interactionSuppressed,
  targetingMode,
  onSelect,
  onCurrencyPointerStart,
  onCurrencyPointerMove,
  onCurrencyPointerEnd,
}: {
  currencyId: CraftingCurrencyId;
  count: number;
  placement: { col: number; row: number; w: 1; h: 1 };
  editable: boolean;
  active: boolean;
  dragging: boolean;
  interactionSuppressed: boolean;
  targetingMode: boolean;
  onSelect: () => void;
  onCurrencyPointerStart: CurrencyPointerStart;
  onCurrencyPointerMove: CurrencyPointerMove;
  onCurrencyPointerEnd: CurrencyPointerEnd;
}) {
  const tileRef = useRef<HTMLDivElement>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipAnchor, setTooltipAnchor] = useState<{ centerX: number; top: number; bottom: number } | null>(null);
  const definition = getCraftingCurrencyDefinition(currencyId);
  const style = CURRENCY_TILE_STYLES[currencyId];

  useLayoutEffect(() => {
    if (showTooltip && tileRef.current) {
      const rect = tileRef.current.getBoundingClientRect();
      setTooltipAnchor({
        centerX: (rect.left + rect.right) / 2,
        top: rect.top,
        bottom: rect.bottom,
      });
    }
  }, [showTooltip, placement.col, placement.row, dragging]);

  const placeBelow = tooltipAnchor ? tooltipAnchor.top < 320 : false;
  const tooltipStyle: CSSProperties | undefined = tooltipAnchor
    ? {
        left: `clamp(152px, ${tooltipAnchor.centerX}px, calc(100vw - 152px))`,
        top: placeBelow ? tooltipAnchor.bottom + 8 : "auto",
        bottom: placeBelow ? "auto" : window.innerHeight - tooltipAnchor.top + 8,
      }
    : undefined;

  const openTooltip = useCallback(() => {
    const rect = tileRef.current?.getBoundingClientRect();
    if (rect) setTooltipAnchor({ centerX: (rect.left + rect.right) / 2, top: rect.top, bottom: rect.bottom });
    setShowTooltip(true);
  }, []);

  const closeTooltip = useCallback(() => {
    setShowTooltip(false);
    setTooltipAnchor(null);
  }, []);

  return (
    <div
      ref={tileRef}
      className={cn(
        "absolute z-10 min-h-0 min-w-0 overflow-hidden rounded-xl",
        targetingMode ? "cursor-default" : "cursor-grab active:cursor-grabbing",
        dragging ? "opacity-0" : "transition-[transform] duration-150",
        editable && !targetingMode && "cursor-grab active:cursor-grabbing",
      )}
      style={packedItemStyle(placement)}
      data-testid="armory-crafting-currency"
      data-currency-id={currencyId}
      aria-label={`Use ${definition.displayName}`}
      onContextMenu={(event) => {
        event.preventDefault();
        if (!editable) return;
        onSelect();
      }}
      onDoubleClick={() => editable && onSelect()}
      onMouseEnter={() => {
        if (!targetingMode && !interactionSuppressed) {
          playUISound("buttonHover");
          openTooltip();
        }
      }}
      onMouseLeave={closeTooltip}
      onFocus={() => {
        if (!targetingMode && !interactionSuppressed) openTooltip();
      }}
      onBlur={closeTooltip}
      onPointerDown={(event) => {
        if (!editable || targetingMode || event.button !== 0 || interactionSuppressed) return;
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        onCurrencyPointerStart(
          currencyId,
          { kind: "inventory", placement: { col: placement.col, row: placement.row } },
          event.currentTarget.getBoundingClientRect(),
          { x: event.clientX, y: event.clientY },
          event.pointerId,
        );
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        event.stopPropagation();
        onCurrencyPointerMove({ x: event.clientX, y: event.clientY }, event.pointerId);
      }}
      onPointerUp={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        event.stopPropagation();
        event.currentTarget.releasePointerCapture(event.pointerId);
        onCurrencyPointerEnd({ x: event.clientX, y: event.clientY }, event.pointerId);
      }}
      onPointerCancel={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        event.currentTarget.releasePointerCapture(event.pointerId);
        onCurrencyPointerEnd({ x: event.clientX, y: event.clientY }, event.pointerId, true);
      }}
    >
      <div
        className={cn(
          "group relative h-full w-full overflow-hidden rounded-xl border bg-black transition-[box-shadow,transform] active:scale-95",
          "disabled:cursor-not-allowed disabled:opacity-40",
          style.className,
          active && "shadow-[0_0_0_2px_rgba(251,191,36,0.75),0_0_18px_rgba(251,191,36,0.25)]",
        )}
      >
        <span className="absolute inset-0 bg-black" aria-hidden />
        <img src={definition.art} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <span className={cn("absolute inset-0", style.glowClassName)} aria-hidden />
        <span className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-white/10" aria-hidden />
        <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 text-[10px] font-bold leading-none text-stone-100">
          {count}
        </span>
      </div>
      {showTooltip && tooltipAnchor
        ? createPortal(
            <TooltipPanel
              width={ARMORY_TOOLTIP_WIDTH}
              visible
              flip={placeBelow}
              className="armory-inventory-tooltip pointer-events-none fixed bottom-auto top-auto z-[100] mb-0 mt-0 !shadow-none"
              style={tooltipStyle}
            >
              <div className="w-max">
                <TooltipHeader>
                  <span className="whitespace-nowrap">{definition.displayName}</span>
                </TooltipHeader>
                <TooltipBody>
                  <p className="whitespace-nowrap">{definition.tooltipEffect}</p>
                </TooltipBody>
              </div>
            </TooltipPanel>,
            document.body,
          )
        : null}
    </div>
  );
});

const SlotButton = memo(function SlotButton({
  slot,
  instance,
  editable,
  draggedGear,
  secondaryDragInstanceId = null,
  isDraggingActive,
  salvageMode,
  activeCurrencyId,
  onGearPointerStart,
  onGearPointerMove,
  onGearPointerEnd,
  onGearDoubleClick,
  onSalvage,
  onApplyCurrency,
}: {
  slot: GearSlot;
  instance: GearInstance | undefined;
  editable: boolean;
  draggedGear: GearInstance | null | undefined;
  secondaryDragInstanceId?: string | null;
  isDraggingActive: boolean;
  salvageMode: boolean;
  activeCurrencyId: CraftingCurrencyId | null;
  onGearPointerStart: GearPointerStart;
  onGearPointerMove: GearPointerMove;
  onGearPointerEnd: GearPointerEnd;
  onGearDoubleClick: (instance: GearInstance, origin: GearDragOrigin, rect: DOMRect) => void;
  onSalvage: () => void;
  onApplyCurrency: () => void;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const { ref, flip, dx } = useTooltipViewportClamp(8, showTooltip);
  const definition = instance ? gearDefinitions[instance.definitionId] : undefined;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDraggingActive && containerRef.current?.matches(":hover")) {
      if (instance) {
        setShowTooltip(true);
      }
    }
  }, [isDraggingActive, instance]);

  const isCompatible =
    isDraggingActive && draggedGear
      ? (() => {
          const draggedDefinition = gearDefinitions[draggedGear.definitionId];
          return draggedDefinition ? isGearCompatibleWithSlot(draggedDefinition, slot) : false;
        })()
      : false;
  const canCraft = activeCurrencyId && instance ? canApplyCraftingCurrency(activeCurrencyId, instance) : false;
  const handleMouseEnter = () => {
    if (instance) playUISound("buttonHover");
    if (!salvageMode && !activeCurrencyId) setShowTooltip(true);
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative h-full w-full overflow-hidden rounded-xl transition-[box-shadow] duration-150",
        salvageMode || activeCurrencyId ? "cursor-default" : "cursor-grab active:cursor-grabbing",
        isCompatible && "shadow-[0_0_0_1px_rgba(134,239,172,0.38),0_0_10px_rgba(34,197,94,0.16)]",
        salvageMode && instance && "ring-inset ring-1 ring-red-400/25 hover:ring-red-300/60",
        activeCurrencyId &&
          instance &&
          canCraft &&
          "ring-2 ring-emerald-400/40 bg-emerald-950/10 hover:ring-emerald-400/80 hover:bg-emerald-950/20",
        activeCurrencyId && instance && !canCraft && "ring-2 ring-red-500/30 bg-red-950/15 opacity-60",
      )}
      aria-label={`${SLOT_LABELS[slot]} equipment slot`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={(event) => dismissWhenFocusLeaves(event, handleMouseLeave)}
      onPointerDown={(event) => {
        if (!editable || !instance || salvageMode || activeCurrencyId || event.button !== 0 || isDraggingActive) return;
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        onGearPointerStart(
          instance,
          { kind: "equipment", slot },
          event.currentTarget.getBoundingClientRect(),
          { x: event.clientX, y: event.clientY },
          event.pointerId,
        );
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        event.stopPropagation();
        onGearPointerMove({ x: event.clientX, y: event.clientY }, event.pointerId);
      }}
      onPointerUp={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        event.stopPropagation();
        event.currentTarget.releasePointerCapture(event.pointerId);
        onGearPointerEnd({ x: event.clientX, y: event.clientY }, event.pointerId);
      }}
      onPointerCancel={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        event.currentTarget.releasePointerCapture(event.pointerId);
        onGearPointerEnd({ x: event.clientX, y: event.clientY }, event.pointerId, true);
      }}
      onDoubleClick={(event) => {
        if (editable && instance && !salvageMode && !activeCurrencyId)
          onGearDoubleClick(instance, { kind: "equipment", slot }, event.currentTarget.getBoundingClientRect());
      }}
      onClick={(event) => {
        if (!editable || !instance) return;
        if (salvageMode) {
          event.stopPropagation();
          onSalvage();
        } else if (activeCurrencyId) {
          event.stopPropagation();
          onApplyCurrency();
        }
      }}
      data-testid="armory-equipment-slot"
      data-slot={slot}
    >
      <div
        className={cn(
          "relative h-full w-full overflow-hidden rounded-xl",
          instance !== undefined &&
            (draggedGear?.instanceId === instance.instanceId || secondaryDragInstanceId === instance.instanceId) &&
            "opacity-0",
        )}
      >
        <img
          src={gearSlotBackgroundArt[slot]}
          alt=""
          data-testid="armory-slot-background"
          className="absolute inset-0 h-full w-full object-cover brightness-[0.65]"
        />
        {definition?.art ? (
          <img
            src={definition.art}
            alt=""
            className="absolute -inset-px z-10 h-[calc(100%+2px)] w-[calc(100%+2px)] max-w-none object-cover"
          />
        ) : null}
      </div>
      {showTooltip && definition && !isDraggingActive && !salvageMode && !activeCurrencyId ? (
        <TooltipPanel
          width={ARMORY_TOOLTIP_WIDTH}
          ref={ref}
          visible
          flip={flip}
          className="pointer-events-none z-[80] !shadow-none"
          style={dx !== 0 ? { marginLeft: dx } : undefined}
        >
          <GearTooltipContent definition={definition} {...(instance ? { instance } : {})} />
        </TooltipPanel>
      ) : null}
    </div>
  );
});

const InventoryGearTile = memo(function InventoryGearTile({
  instance,
  placement,
  inventory,
  editable,
  salvageMode,
  activeCurrencyId,
  dragging,
  secondaryDragging,
  isAnimating,
  interactionSuppressed,
  hasActiveDrag,
  dragSequence,
  shouldSuppressClick,
  onSalvage,
  onApplyCurrency,
  onGearPointerStart,
  onGearPointerMove,
  onGearPointerEnd,
  onGearDoubleClick,
}: {
  instance: GearInstance;
  placement: { col: number; row: number; w: number; h: number };
  inventory: GearInstance[];
  editable: boolean;
  salvageMode: boolean;
  activeCurrencyId: CraftingCurrencyId | null;
  dragging: boolean;
  secondaryDragging: boolean;
  isAnimating: boolean;
  interactionSuppressed: boolean;
  hasActiveDrag: boolean;
  dragSequence: number;
  shouldSuppressClick: () => boolean;
  onSalvage: () => void;
  onApplyCurrency: () => void;
  onGearPointerStart: GearPointerStart;
  onGearPointerMove: GearPointerMove;
  onGearPointerEnd: GearPointerEnd;
  onGearDoubleClick: (instance: GearInstance, origin: GearDragOrigin, rect: DOMRect) => void;
}) {
  const [tooltipSequence, setTooltipSequence] = useState<number | null>(null);
  const tileRef = useRef<HTMLDivElement>(null);
  const [tooltipAnchor, setTooltipAnchor] = useState<{ centerX: number; top: number; bottom: number } | null>(null);
  const definition = gearDefinitions[instance.definitionId];
  const showTooltip = tooltipSequence === dragSequence && !interactionSuppressed;

  const prevAffixesRef = useRef(instance.affixes);
  const prevDefRef = useRef(instance.definitionId);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (prevAffixesRef.current !== instance.affixes || prevDefRef.current !== instance.definitionId) {
      prevAffixesRef.current = instance.affixes;
      prevDefRef.current = instance.definitionId;
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 550);
      return () => clearTimeout(timer);
    }
  }, [instance]);

  const openTooltip = useCallback(() => {
    const rect = tileRef.current?.getBoundingClientRect();
    if (rect) setTooltipAnchor({ centerX: (rect.left + rect.right) / 2, top: rect.top, bottom: rect.bottom });
    setTooltipSequence(dragSequence);
  }, [dragSequence]);

  const closeTooltip = useCallback(() => {
    setTooltipSequence(null);
    setTooltipAnchor(null);
  }, []);

  // Trigger tooltip immediately on drop if mouse is hovering
  useEffect(() => {
    if (!hasActiveDrag && tileRef.current?.matches(":hover")) {
      if (!salvageMode && !activeCurrencyId && !shouldSuppressClick()) {
        openTooltip();
      }
    } else {
      closeTooltip();
    }
  }, [activeCurrencyId, closeTooltip, hasActiveDrag, openTooltip, salvageMode, shouldSuppressClick]);

  // Recalculate bounding rect dynamically when showing tooltip or layout changes
  useLayoutEffect(() => {
    if (showTooltip && tileRef.current) {
      const rect = tileRef.current.getBoundingClientRect();
      setTooltipAnchor({
        centerX: (rect.left + rect.right) / 2,
        top: rect.top,
        bottom: rect.bottom,
      });
    }
  }, [showTooltip, placement.col, placement.row, dragging, isAnimating]);

  const placeBelow = tooltipAnchor ? tooltipAnchor.top < 320 : false;
  const tooltipStyle: CSSProperties | undefined = tooltipAnchor
    ? {
        left: `clamp(152px, ${tooltipAnchor.centerX}px, calc(100vw - 152px))`,
        top: placeBelow ? tooltipAnchor.bottom + 8 : "auto",
        bottom: placeBelow ? "auto" : window.innerHeight - tooltipAnchor.top + 8,
      }
    : undefined;

  const handleMouseEnter = () => {
    if (!salvageMode && !activeCurrencyId && !shouldSuppressClick()) {
      playUISound("buttonHover");
      openTooltip();
    }
  };

  const handleMouseLeave = () => {
    closeTooltip();
  };

  const handleFocus = () => {
    if (!salvageMode && !activeCurrencyId && !shouldSuppressClick()) openTooltip();
  };

  const handleBlur = () => {
    closeTooltip();
  };

  if (!definition) {
    return null;
  }

  const canSalvage = canSalvageGear(inventory, instance.instanceId);
  const canCraft = activeCurrencyId ? canApplyCraftingCurrency(activeCurrencyId, instance) : false;
  const targetingMode = salvageMode || activeCurrencyId;
  const isSalvageTarget = salvageMode && canSalvage;
  const isCurrencyTarget = !!activeCurrencyId;

  return (
    <div
      ref={tileRef}
      className={cn(
        "armory-salvage-tile absolute z-10 min-h-0 min-w-0 overflow-hidden rounded-xl",
        targetingMode ? "cursor-default" : "cursor-grab active:cursor-grabbing bg-background/60",
        dragging || secondaryDragging ? "opacity-0" : "transition-[transform] duration-150",
        isSalvageTarget && "ring-inset ring-1 ring-red-400/25 hover:ring-red-300/60",
        salvageMode && !canSalvage && "ring-inset ring-1 ring-red-400/10",
        activeCurrencyId &&
          canCraft &&
          "ring-2 ring-emerald-400/40 bg-emerald-950/10 hover:ring-emerald-400/80 hover:bg-emerald-950/20",
        activeCurrencyId && !canCraft && "ring-2 ring-red-500/30 bg-red-950/15 opacity-60",
      )}
      style={packedItemStyle(placement)}
      role={editable && (isSalvageTarget || isCurrencyTarget) ? "button" : undefined}
      tabIndex={editable && (isSalvageTarget || isCurrencyTarget) ? 0 : undefined}
      aria-label={
        isSalvageTarget
          ? `Salvage ${getGearInstanceTitle(instance)}`
          : isCurrencyTarget
            ? `Apply ${getCraftingCurrencyDefinition(activeCurrencyId).displayName} to ${getGearInstanceTitle(instance)}`
            : undefined
      }
      onClick={(event) => {
        if (!editable) return;
        if (shouldSuppressClick()) return;
        if (isSalvageTarget) {
          event.stopPropagation();
          onSalvage();
        } else if (activeCurrencyId) {
          event.stopPropagation();
          onApplyCurrency();
        }
      }}
      onKeyDown={(event) => {
        if (!editable) return;
        if (event.key === "Enter" || event.key === " ") {
          if (isSalvageTarget) {
            event.preventDefault();
            onSalvage();
          } else if (activeCurrencyId) {
            event.preventDefault();
            onApplyCurrency();
          }
        }
      }}
      onPointerDown={(event) => {
        if (!editable || targetingMode || event.button !== 0 || interactionSuppressed) return;
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        onGearPointerStart(
          instance,
          { kind: "inventory", placement: { col: placement.col, row: placement.row } },
          event.currentTarget.getBoundingClientRect(),
          { x: event.clientX, y: event.clientY },
          event.pointerId,
        );
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        event.stopPropagation();
        onGearPointerMove({ x: event.clientX, y: event.clientY }, event.pointerId);
      }}
      onPointerUp={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        event.stopPropagation();
        event.currentTarget.releasePointerCapture(event.pointerId);
        onGearPointerEnd({ x: event.clientX, y: event.clientY }, event.pointerId);
      }}
      onPointerCancel={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        event.currentTarget.releasePointerCapture(event.pointerId);
        onGearPointerEnd({ x: event.clientX, y: event.clientY }, event.pointerId, true);
      }}
      onDoubleClick={(event) => {
        if (!editable || targetingMode) return;
        onGearDoubleClick(
          instance,
          { kind: "inventory", placement: { col: placement.col, row: placement.row } },
          event.currentTarget.getBoundingClientRect(),
        );
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      data-testid="armory-inventory-item"
      data-gear-title={getGearInstanceTitle(instance)}
    >
      <img
        src={definition.art}
        alt=""
        className="absolute -inset-px h-[calc(100%+2px)] w-[calc(100%+2px)] max-w-none object-cover"
      />
      {flash ? <div className="absolute inset-0 pointer-events-none rounded-xl craft-flash-overlay z-30" /> : null}
      {showTooltip && tooltipAnchor
        ? createPortal(
            <TooltipPanel
              width={ARMORY_TOOLTIP_WIDTH}
              visible
              flip={placeBelow}
              className="armory-inventory-tooltip pointer-events-none fixed bottom-auto top-auto z-[100] mb-0 mt-0 !shadow-none"
              style={tooltipStyle}
            >
              <GearTooltipContent definition={definition} instance={instance} />
            </TooltipPanel>,
            document.body,
          )
        : null}
    </div>
  );
});
