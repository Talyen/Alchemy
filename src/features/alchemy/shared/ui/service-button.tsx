import type { ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { GoldCost } from "./display-elements";
import { DisabledTooltip } from "./disabled-tooltip";

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
