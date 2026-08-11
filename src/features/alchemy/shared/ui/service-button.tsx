// Shop/service action buttons with disabled explanatory tooltips.
// Depends on the shared Button primitive, gold display element, and tooltip panel.
// Used by merchant, alchemist, and service-like destination screens.
import type { ComponentType, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { GoldCost } from "./display-elements";
import { PortaledTooltip } from "./portaled-tooltip";
import { useHoverVisible } from "./use-hover-visible";

export function DisabledTooltip({ show, message, children }: { show: boolean; message: string; children: ReactNode }) {
  const { triggerRef, visible, onMouseEnter, onMouseLeave } = useHoverVisible<HTMLDivElement>();
  if (!show) return <>{children}</>;
  return (
    <div ref={triggerRef} className="relative" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      {children}
      <PortaledTooltip triggerRef={triggerRef} visible={visible} width="w-auto" className="whitespace-nowrap">
        <p className="text-base leading-none text-foreground">{message}</p>
      </PortaledTooltip>
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
