// Shop/service action buttons with disabled explanatory tooltips.
// Depends on the shared Button primitive, gold display element, and tooltip panel.
// Used by merchant, alchemist, and service-like destination screens.
import type { ComponentType, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { tooltipBodyClass } from "../config";
import { GoldCost } from "./display-elements";
import { PortaledTooltip } from "./portaled-tooltip";
import { useHoverVisible } from "./use-hover-visible";

export function DisabledTooltip({ show, message, children }: { show: boolean; message: string; children: ReactNode }) {
  const { triggerRef, visible, onMouseEnter, onMouseLeave } = useHoverVisible<HTMLDivElement>();
  // The wrapper renders unconditionally so children keep the same DOM/stacking
  // context whether or not the tooltip is armed.
  return (
    <div ref={triggerRef} className="relative" {...(show ? { onMouseEnter, onMouseLeave } : {})}>
      {children}
      {show ? (
        <PortaledTooltip triggerRef={triggerRef} visible={visible} className="whitespace-nowrap">
          <p className={cn(tooltipBodyClass, "mt-0 space-y-0 leading-none text-foreground")}>{message}</p>
        </PortaledTooltip>
      ) : null}
    </div>
  );
}

export function ServiceButton({
  icon: Icon,
  label,
  cost,
  disabled,
  disabledMessage,
  used,
  soldOutText,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  cost: number;
  disabled: boolean;
  disabledMessage: string;
  used: boolean;
  soldOutText: string;
  onClick: () => void;
}) {
  if (used) {
    return (
      <Button size="lg" variant="outline" disabled className="text-muted-foreground/40">
        {soldOutText}
      </Button>
    );
  }
  return (
    <DisabledTooltip show={disabled} message={disabledMessage}>
      <Button size="lg" variant="outline" disabled={disabled} onClick={onClick}>
        <Icon className="h-7 w-7" />
        <span className="font-normal">{label}</span>
        <GoldCost amount={cost} />
      </Button>
    </DisabledTooltip>
  );
}
