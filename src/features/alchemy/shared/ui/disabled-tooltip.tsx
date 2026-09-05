import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { tooltipBodyClass } from "../config";
import { PortaledTooltip } from "./portaled-tooltip";
import { useHoverVisible } from "./use-hover-visible";
import { renderUnlockMessage } from "./unlock-text";

export function DisabledTooltip({
  show,
  message,
  children,
}: {
  show: boolean;
  message: ReactNode;
  children: ReactNode;
}) {
  const { triggerRef, visible, onMouseEnter, onMouseLeave } = useHoverVisible();

  return (
    <div ref={triggerRef} className="relative" {...(show ? { onMouseEnter, onMouseLeave } : {})}>
      {children}
      {show ? (
        <PortaledTooltip triggerRef={triggerRef} visible={visible} className="whitespace-nowrap">
          <p className={cn(tooltipBodyClass, "mt-0 space-y-0 leading-none text-foreground")}>
            {typeof message === "string" ? renderUnlockMessage(message) : message}
          </p>
        </PortaledTooltip>
      ) : null}
    </div>
  );
}
