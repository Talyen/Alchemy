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
import { Lock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { playUISound } from "@/lib/audio";
import { characters, characterArt, type CharacterId } from "@/lib/game-data";
import {
  canSalvageGear,
  GEAR_FOOTPRINT,
  INVENTORY_COLS,
  INVENTORY_VISIBLE_ROWS,
  isGearCompatibleWithSlot,
  resolveGearDefinition,
  type GearInstance,
  type GearLoadouts,
  type GearSlot,
  type PackedInventoryItem,
} from "@/lib/gear";
import { cn } from "@/lib/utils";
import { TiltSurface } from "../../../shared/ui/tilt-surface";
import { TooltipPanel, useTooltipViewportClamp } from "../../../shared/ui/tooltip-panel";
import { useInteractiveCard } from "../../../shared/ui/use-interactive-card";
import { GearTooltipContent } from "./gear-tooltip-content";
import type { GearDragOrigin, GearPointerEnd, GearPointerMove, GearPointerStart } from "./types";

export type { GearDragOrigin } from "./types";

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
  isDraggingActive,
  onGearPointerStart,
  onGearPointerMove,
  onGearPointerEnd,
  onGearDoubleClick,
}: {
  characterId: CharacterId;
  locked: boolean;
  loadout: GearLoadouts[CharacterId];
  inventoryById: Map<string, GearInstance>;
  editable: boolean;
  requiredCharacterId: CharacterId | null;
  draggedGear?: GearInstance | null;
  isDraggingActive: boolean;
  onGearPointerStart: GearPointerStart;
  onGearPointerMove: GearPointerMove;
  onGearPointerEnd: GearPointerEnd;
  onGearDoubleClick: (instance: GearInstance, origin: GearDragOrigin, rect: DOMRect) => void;
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
                  isDraggingActive={isDraggingActive}
                  onGearPointerStart={onGearPointerStart}
                  onGearPointerMove={onGearPointerMove}
                  onGearPointerEnd={onGearPointerEnd}
                  onGearDoubleClick={onGearDoubleClick}
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
  occupiedRows,
  loadouts,
  editable,
  browseOnly,
  draggedInstanceId,
  isDraggingActive,
  isAnimating,
  boardRef,
  onSalvage,
  onGearPointerStart,
  onGearPointerMove,
  onGearPointerEnd,
  onGearDoubleClick,
}: {
  packedItems: PackedInventoryItem<GearInstance>[];
  occupiedRows: number;
  loadouts: GearLoadouts;
  editable: boolean;
  browseOnly: boolean;
  draggedInstanceId: string | null;
  isDraggingActive: boolean;
  isAnimating: boolean;
  boardRef: RefObject<HTMLDivElement | null>;
  onSalvage: (instance: GearInstance) => void;
  onGearPointerStart: GearPointerStart;
  onGearPointerMove: GearPointerMove;
  onGearPointerEnd: GearPointerEnd;
  onGearDoubleClick: (instance: GearInstance, origin: GearDragOrigin, rect: DOMRect) => void;
}) {
  const dragRef = useRef<{ pointerId: number; startY: number; startScrollTop: number; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [suppressingInteraction, setSuppressingInteraction] = useState(false);
  const [dragSequence, setDragSequence] = useState(0);
  const [salvageMode, setSalvageMode] = useState(false);
  const [salvagePointer, setSalvagePointer] = useState<{ x: number; y: number } | null>(null);
  const renderedRows = Math.max(INVENTORY_VISIBLE_ROWS, occupiedRows);
  const canScroll = occupiedRows > INVENTORY_VISIBLE_ROWS;
  const hasSalvageableGear = !browseOnly && packedItems.some(({ item }) => canSalvageGear(loadouts, item.instanceId));

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!canScroll || event.pointerType === "touch" || event.button !== 0) return;
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
      onPointerMove={(event) => salvageMode && setSalvagePointer({ x: event.clientX, y: event.clientY })}
      onPointerLeave={() => setSalvagePointer(null)}
    >
      <h2 className="text-center font-display text-lg text-amber-100">Inventory</h2>
      <Button
        size="icon"
        variant="outline"
        disabled={!hasSalvageableGear}
        className={cn(
          "absolute right-4 top-3 h-8 w-8 border-red-950/60 text-red-400/65 hover:border-red-900/70 hover:bg-red-950/25 hover:text-red-300 disabled:border-border/40 disabled:text-muted-foreground/45",
          salvageMode && "border-red-700/70 bg-red-950/35 text-red-300",
        )}
        aria-label={salvageMode ? "Cancel salvage" : "Salvage Gear"}
        aria-pressed={salvageMode}
        onClick={() => setSalvageMode((current) => !current)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
      <div
        ref={boardRef}
        data-testid="armory-inventory-board"
        data-scrollable={canScroll ? "true" : "false"}
        className={cn(
          "armory-inventory-board relative mt-4 overflow-x-hidden overscroll-contain touch-pan-y select-none",
          canScroll ? "overflow-y-auto" : "overflow-y-hidden",
          canScroll && "cursor-grab",
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
                loadouts={loadouts}
                editable={editable}
                salvageMode={salvageMode}
                dragging={draggedInstanceId === item.instanceId}
                isAnimating={isAnimating}
                interactionSuppressed={dragging || suppressingInteraction || isDraggingActive}
                hasActiveDrag={isDraggingActive}
                dragSequence={dragSequence}
                shouldSuppressClick={() => suppressClickRef.current}
                onSalvage={() => {
                  setSalvageMode(false);
                  setSalvagePointer(null);
                  onSalvage(item);
                }}
                onGearPointerStart={onGearPointerStart}
                onGearPointerMove={onGearPointerMove}
                onGearPointerEnd={onGearPointerEnd}
                onGearDoubleClick={onGearDoubleClick}
              />
            ))}
          </div>
        </div>
      </div>
      {salvageMode && salvagePointer
        ? createPortal(
            <Trash2
              className="pointer-events-none fixed z-[130] h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-red-300 drop-shadow-[0_2px_5px_rgba(0,0,0,0.9)]"
              style={{ left: salvagePointer.x, top: salvagePointer.y }}
            />,
            document.body,
          )
        : null}
    </section>
  );
});

const SlotButton = memo(function SlotButton({
  slot,
  instance,
  editable,
  draggedGear,
  isDraggingActive,
  onGearPointerStart,
  onGearPointerMove,
  onGearPointerEnd,
  onGearDoubleClick,
}: {
  slot: GearSlot;
  instance: GearInstance | undefined;
  editable: boolean;
  draggedGear: GearInstance | null | undefined;
  isDraggingActive: boolean;
  onGearPointerStart: GearPointerStart;
  onGearPointerMove: GearPointerMove;
  onGearPointerEnd: GearPointerEnd;
  onGearDoubleClick: (instance: GearInstance, origin: GearDragOrigin, rect: DOMRect) => void;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const { ref, flip, dx } = useTooltipViewportClamp(8, showTooltip);
  const definition = instance ? resolveGearDefinition(instance.definitionId) : undefined;
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
          const draggedDefinition = resolveGearDefinition(draggedGear.definitionId);
          return draggedDefinition ? isGearCompatibleWithSlot(draggedDefinition, slot) : false;
        })()
      : false;
  const handleMouseEnter = () => {
    if (instance) playUISound("buttonHover");
    setShowTooltip(true);
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative h-full w-full cursor-grab rounded-xl transition-[box-shadow] duration-150 active:cursor-grabbing",
        isCompatible && "shadow-[0_0_0_1px_rgba(134,239,172,0.38),0_0_10px_rgba(34,197,94,0.16)]",
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={(event) => dismissWhenFocusLeaves(event, handleMouseLeave)}
      onPointerDown={(event) => {
        if (!editable || !instance || event.button !== 0 || isDraggingActive) return;
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
        if (editable && instance)
          onGearDoubleClick(instance, { kind: "equipment", slot }, event.currentTarget.getBoundingClientRect());
      }}
      data-testid="armory-equipment-slot"
      data-slot={slot}
    >
      <TiltSurface
        className="relative h-full w-full overflow-hidden rounded-xl bg-background/75"
        tiltEnabled={false}
        dragging={instance !== undefined && draggedGear?.instanceId === instance.instanceId}
      >
        {definition?.art ? (
          <img
            src={definition.art}
            alt=""
            className="absolute -inset-px h-[calc(100%+2px)] w-[calc(100%+2px)] max-w-none object-cover"
          />
        ) : null}
        {definition ? null : (
          <span className="relative z-10 flex h-full items-center justify-center px-1 text-center text-xs font-semibold leading-tight text-amber-100/45">
            {SLOT_LABELS[slot]}
          </span>
        )}
      </TiltSurface>
      {showTooltip && definition && !isDraggingActive ? (
        <TooltipPanel
          width="w-72"
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
  loadouts,
  editable,
  salvageMode,
  dragging,
  isAnimating,
  interactionSuppressed,
  hasActiveDrag,
  dragSequence,
  shouldSuppressClick,
  onSalvage,
  onGearPointerStart,
  onGearPointerMove,
  onGearPointerEnd,
  onGearDoubleClick,
}: {
  instance: GearInstance;
  placement: { col: number; row: number; w: number; h: number };
  loadouts: GearLoadouts;
  editable: boolean;
  salvageMode: boolean;
  dragging: boolean;
  isAnimating: boolean;
  interactionSuppressed: boolean;
  hasActiveDrag: boolean;
  dragSequence: number;
  shouldSuppressClick: () => boolean;
  onSalvage: () => void;
  onGearPointerStart: GearPointerStart;
  onGearPointerMove: GearPointerMove;
  onGearPointerEnd: GearPointerEnd;
  onGearDoubleClick: (instance: GearInstance, origin: GearDragOrigin, rect: DOMRect) => void;
}) {
  const [tooltipSequence, setTooltipSequence] = useState<number | null>(null);
  const tileRef = useRef<HTMLDivElement>(null);
  const [tooltipAnchor, setTooltipAnchor] = useState<{ centerX: number; top: number; bottom: number } | null>(null);
  const definition = resolveGearDefinition(instance.definitionId);
  const showTooltip = tooltipSequence === dragSequence && !interactionSuppressed;

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
      if (!salvageMode && !shouldSuppressClick()) {
        openTooltip();
      }
    } else {
      closeTooltip();
    }
  }, [closeTooltip, hasActiveDrag, openTooltip, salvageMode, shouldSuppressClick]);

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
    if (!salvageMode && !shouldSuppressClick()) {
      playUISound("buttonHover");
      openTooltip();
    }
  };

  const handleMouseLeave = () => {
    closeTooltip();
  };

  const handleFocus = () => {
    if (!salvageMode && !shouldSuppressClick()) openTooltip();
  };

  const handleBlur = () => {
    closeTooltip();
  };

  if (!definition) {
    return null;
  }

  return (
    <div
      ref={tileRef}
      className={cn(
        "absolute z-10 min-h-0 min-w-0 cursor-grab active:cursor-grabbing",
        dragging ? "opacity-0" : "transition-[transform] duration-150",
      )}
      style={packedItemStyle(placement)}
      onPointerDown={(event) => {
        if (!editable || salvageMode || event.button !== 0 || interactionSuppressed) return;
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
        if (!editable || salvageMode) return;
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
      data-gear-title={definition.title}
    >
      <div
        role={salvageMode ? "button" : undefined}
        tabIndex={salvageMode ? 0 : undefined}
        className="relative h-full w-full overflow-hidden rounded-xl bg-background/60 group"
        onClick={() => {
          if (shouldSuppressClick()) return;
          if (salvageMode && canSalvageGear(loadouts, instance.instanceId)) onSalvage();
        }}
        onKeyDown={(event) => {
          if (salvageMode && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            if (canSalvageGear(loadouts, instance.instanceId)) onSalvage();
          }
        }}
        aria-label={salvageMode ? `Salvage ${definition.title}` : undefined}
      >
        <img
          src={definition.art}
          alt=""
          className="absolute -inset-px h-[calc(100%+2px)] w-[calc(100%+2px)] max-w-none object-cover"
        />
        {salvageMode ? (
          <div className="absolute inset-0 pointer-events-none rounded-xl ring-inset ring-1 ring-red-400/25 group-hover:ring-red-300/60" />
        ) : null}
      </div>
      {showTooltip && tooltipAnchor
        ? createPortal(
            <TooltipPanel
              width="w-72"
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
