import type { Ref } from "react";
import { TooltipBody, TooltipHeader, TooltipPanel, type TooltipPlacement } from "./tooltip-panel";

export function LockedFeatureTooltip({
  title,
  message,
  panelRef,
  className,
  placement = "side-start",
  visible,
  width = "w-64",
}: {
  title: string;
  message: string;
  panelRef?: Ref<HTMLDivElement>;
  className?: string;
  placement?: TooltipPlacement;
  visible?: boolean;
  width?: string;
}) {
  return (
    <TooltipPanel
      width={width}
      placement={placement}
      {...(visible ? { visible } : {})}
      {...(panelRef ? { ref: panelRef } : {})}
      className={className ?? ""}
    >
      <TooltipHeader>{title}</TooltipHeader>
      <TooltipBody>
        <p>{message}</p>
      </TooltipBody>
    </TooltipPanel>
  );
}
