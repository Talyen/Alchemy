import { Fragment, type ReactNode } from "react";
import { useChangeToken } from "../../../../shared/ui/use-change-token";
import { cn } from "@/lib/utils";
import type { CraftingCurrencyDefinition } from "@/lib/gear";
import { PortaledTooltip } from "../../../../shared/ui/tooltips/portaled-tooltip";
import { TooltipBody, TooltipHeader } from "../../../../shared/ui/tooltips/tooltip-panel";
import { useHoverVisible } from "../../../../shared/ui/use-hover-visible";
import { surfaceSelectedRingClass } from "../../../../shared/config";

function renderBoldSegments(text: string): ReactNode {
  return text.split(/\*\*(.+?)\*\*/g).map((part, index) =>
    index % 2 === 1 ? (
      <strong key={index} className="font-semibold text-foreground">
        {part}
      </strong>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    ),
  );
}

export function CurrencyChip({
  currency,
  count,
  armed = false,
  disabled = false,
  showDescription = false,
  testId = "armory-crafting-currency",
  ariaLabel,
  onSelect,
}: {
  currency: CraftingCurrencyDefinition;
  count: number;
  armed?: boolean;
  disabled?: boolean;
  showDescription?: boolean;
  testId?: string;
  ariaLabel?: string;
  onSelect?: () => void;
}) {
  const { triggerRef, visible, onMouseEnter, onMouseLeave, onFocusCapture, onBlurCapture } = useHoverVisible();
  const countToken = useChangeToken(count);
  const label = `${ariaLabel ?? currency.displayName}, ${count}${onSelect ? " available" : ""}`;
  const className = cn(
    "armory-currency-art relative block overflow-hidden rounded-xl border border-border/80 bg-black",
    armed && surfaceSelectedRingClass,
    disabled && "opacity-50",
  );
  const content = (
    <>
      <img src={currency.art} alt="" className="h-full w-full object-cover" />
      <span
        key={countToken}
        className={cn(
          "absolute top-1.5 left-1.5 text-sm leading-none font-bold text-stone-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]",
          countToken > 0 && "armory-count-feedback",
        )}
      >
        {count}
      </span>
    </>
  );
  return (
    <div
      ref={triggerRef}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocusCapture={onFocusCapture}
      onBlurCapture={onBlurCapture}
    >
      <PortaledTooltip triggerRef={triggerRef} visible={visible} className="armory-inventory-tooltip !shadow-none">
        <TooltipHeader>{currency.displayName}</TooltipHeader>
        <TooltipBody>
          <p>{renderBoldSegments(currency.tooltipEffect)}</p>
          {showDescription ? <p className="mt-2">{currency.description}</p> : null}
          {disabled && count > 0 ? <p className="mt-2">Crafting is unavailable.</p> : null}
        </TooltipBody>
      </PortaledTooltip>
      {onSelect ? (
        <button
          type="button"
          data-testid={testId}
          data-currency-id={currency.id}
          aria-label={label}
          aria-pressed={armed}
          aria-disabled={disabled}
          className={className}
          onClick={(event) => {
            event.stopPropagation();
            if (!disabled) onSelect();
          }}
        >
          {content}
        </button>
      ) : (
        <div
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Reward descriptions must be available on keyboard focus without implying an action
          tabIndex={0}
          role="group"
          data-testid={testId}
          data-currency-id={currency.id}
          aria-label={label}
          className={className}
        >
          {content}
        </div>
      )}
    </div>
  );
}
