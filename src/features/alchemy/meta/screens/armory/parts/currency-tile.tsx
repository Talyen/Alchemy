import { memo, useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getCraftingCurrencyDefinition, type CraftingCurrencyId } from "@/lib/gear";
import { playUISound } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { TooltipBody, TooltipHeader, TooltipPanel } from "../../../../shared/ui/tooltip-panel";
import { useArmoryPortaledTooltipPlacement } from "../armory-tooltip-placement";
import { ARMORY_TOOLTIP_WIDTH } from "../gear-tooltip-content";
import { packedItemStyle } from "./grid-styles";
import type { CurrencyPointerEnd, CurrencyPointerMove, CurrencyPointerStart } from "../use-armory-currency-drag";

export const CraftingCurrencyTile = memo(function CraftingCurrencyTile({
  currencyId,
  count,
  placement,
  editable,
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
  const definition = getCraftingCurrencyDefinition(currencyId);

  const { tooltipRef, placeBelow, tooltipStyle } = useArmoryPortaledTooltipPlacement(tileRef, showTooltip);

  const openTooltip = useCallback(() => {
    setShowTooltip(true);
  }, []);

  const closeTooltip = useCallback(() => {
    setShowTooltip(false);
  }, []);

  return (
    <div
      ref={tileRef}
      className={cn(
        "absolute z-10 min-h-0 min-w-0 overflow-hidden rounded-xl",
        targetingMode ? "cursor-default" : "cursor-grab active:cursor-grabbing",
        dragging ? "opacity-0" : "",
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
        closeTooltip();
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
        event.stopPropagation();
        event.currentTarget.releasePointerCapture(event.pointerId);
        onCurrencyPointerEnd({ x: event.clientX, y: event.clientY }, event.pointerId, true);
      }}
    >
      <div
        className={cn(
          "group relative h-full w-full overflow-hidden rounded-xl border border-stone-500/40 bg-black",
          "disabled:cursor-not-allowed disabled:opacity-40",
        )}
      >
        <span className="absolute inset-0 bg-black" aria-hidden />
        <img src={definition.art} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <span className="absolute top-1 left-1 text-xs font-bold leading-none text-stone-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
          {count}
        </span>
      </div>
      {showTooltip
        ? createPortal(
            <TooltipPanel
              ref={tooltipRef}
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
