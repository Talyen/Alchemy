// Shop/service action buttons with disabled explanatory tooltips.
// Depends on the shared Button primitive, gold display element, and tooltip panel.
// Used by merchant, alchemist, and service-like destination screens.
import type { ComponentType, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { GoldCost } from "./display-elements";
import { TooltipPanel } from "./tooltip-panel";

export function DisabledTooltip({ show, message, children }: { show: boolean; message: string; children: ReactNode }) {
  if (!show) return <>{children}</>;
  return (
    <div className="group relative">
      {children}
      <TooltipPanel width="w-auto" className="pointer-events-none whitespace-nowrap opacity-0 group-hover:opacity-100">
        <p className="text-xs leading-none text-foreground">{message}</p>
      </TooltipPanel>
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
      <Button variant="outline" disabled className="text-muted-foreground/40">
        {soldOutText}
      </Button>
    );
  }
  return (
    <DisabledTooltip show={disabled} message={disabledMessage}>
      <Button variant="outline" disabled={disabled} onClick={onClick}>
        <Icon className="h-4 w-4" />
        <span className="text-sm font-normal">{label}</span>
        <GoldCost amount={cost} />
      </Button>
    </DisabledTooltip>
  );
}
