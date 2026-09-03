import { cn } from "@/lib/utils";
import type { CraftingCurrencyDefinition } from "@/lib/gear";
import { PortaledTooltip } from "../../../../shared/ui/portaled-tooltip";
import { TooltipBody, TooltipHeader } from "../../../../shared/ui/tooltip-panel";
import { useHoverVisible } from "../../../../shared/ui/use-hover-visible";
import { surfaceSelectedRingClass } from "../../../../shared/config";

const CURRENCY_COUNT_LABEL_CLASS =
  "absolute top-1.5 left-1.5 text-sm font-bold leading-none text-stone-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]";

const ARMORY_CURRENCY_TOOLTIP_CLASS = "armory-inventory-tooltip !shadow-none";

export function CurrencyChip({
  currency,
  count,
  size = "md",
  armed = false,
  disabled = false,
  showDescription = false,
  countPrefix = "",
  testId = "armory-crafting-currency",
  ariaLabel,
  onSelect,
}: {
  currency: CraftingCurrencyDefinition;
  count: number;
  size?: "md" | "sm";
  armed?: boolean;
  disabled?: boolean;
  showDescription?: boolean;
  countPrefix?: string;
  testId?: string;
  ariaLabel?: string;
  onSelect?: () => void;
}) {
  const { triggerRef, visible, onMouseEnter, onMouseLeave, onFocusCapture, onBlurCapture } =
    useHoverVisible<HTMLButtonElement>();
  const interactive = Boolean(onSelect);
  return (
    <>
      <PortaledTooltip triggerRef={triggerRef} visible={visible} className={ARMORY_CURRENCY_TOOLTIP_CLASS}>
        <TooltipHeader>{currency.displayName}</TooltipHeader>
        <TooltipBody>
          <p className="text-pretty">{currency.tooltipEffect}</p>
          {showDescription ? <p className="mt-2 text-pretty">{currency.description}</p> : null}
        </TooltipBody>
      </PortaledTooltip>
      <button
        ref={triggerRef}
        type="button"
        data-testid={testId}
        data-currency-id={currency.id}
        aria-label={ariaLabel ?? currency.displayName}
        aria-pressed={interactive ? armed : undefined}
        disabled={interactive ? disabled : undefined}
        className={cn(
          "relative overflow-hidden rounded-xl border border-border/80 bg-black",
          size === "md" ? "h-20 w-20" : "h-16 w-16",
          armed && surfaceSelectedRingClass,
          disabled && "cursor-default opacity-50",
        )}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onFocusCapture={onFocusCapture}
        onBlurCapture={onBlurCapture}
        onClick={
          onSelect
            ? (event) => {
                event.stopPropagation();
                if (disabled) return;
                onSelect();
              }
            : undefined
        }
      >
        <img src={currency.art} alt="" className="h-full w-full object-cover" />
        <span className={CURRENCY_COUNT_LABEL_CLASS}>
          {countPrefix}
          {count}
        </span>
      </button>
    </>
  );
}
