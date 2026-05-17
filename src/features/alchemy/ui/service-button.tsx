import type { ComponentType, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { GoldCost } from "./display-elements";

export function DisabledTooltip({ show, message, children }: { show: boolean; message: string; children: ReactNode }) {
  if (!show) return <>{children}</>;
  return (
    <div className="relative group">
      {children}
      <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-md bg-black/90 px-3 py-1.5 text-xs text-white opacity-0 transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100">
        {message}
      </div>
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
