// Shared tooltip copy for the Knight-run gate on the talents menu entry.
import type { Ref } from "react";
import { TooltipBody, TooltipHeader, TooltipPanel, type TooltipPlacement } from "../../shared/ui/tooltip-panel";

export function TalentsLockedTooltip({
  panelRef,
  className,
  placement = "side-start",
  visible,
}: {
  panelRef?: Ref<HTMLDivElement>;
  className?: string;
  placement?: TooltipPlacement;
  visible?: boolean;
}) {
  return (
    <TooltipPanel
      width="w-64"
      placement={placement}
      {...(visible ? { visible } : {})}
      {...(panelRef ? { ref: panelRef } : {})}
      className={className ?? ""}
    >
      <TooltipHeader>Talents Locked</TooltipHeader>
      <TooltipBody>
        <p className="text-red-400 font-semibold">Finish a Run as the Knight to unlock</p>
      </TooltipBody>
    </TooltipPanel>
  );
}
