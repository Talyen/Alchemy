import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { tooltipBodyClass } from "../../config/typography";
import { PortaledTooltip } from "./portaled-tooltip";
import { useHoverVisible } from "../use-hover-visible";
import { renderUnlockNode } from "../unlock-text";

export function DisabledTooltip({
  show,
  message,
  children,
}: {
  show: boolean;
  message: ReactNode;
  children: ReactNode;
}) {
  const {
    wrapperRef: triggerRef,
    visible,
    onMouseEnter,
    onMouseLeave,
    onFocusCapture,
    onBlurCapture,
  } = useHoverVisible({
    focusWithinGuard: true,
  });

  return (
    <div
      ref={triggerRef}
      className="relative"
      {...(show
        ? {
            role: "group",
            tabIndex: 0,
            "aria-disabled": true,
            onMouseEnter,
            onMouseLeave,
            onFocusCapture,
            onBlurCapture,
          }
        : {})}
    >
      {children}
      {show ? (
        <PortaledTooltip triggerRef={triggerRef} visible={visible} className="whitespace-nowrap">
          <p className={cn(tooltipBodyClass, "mt-0 space-y-0 leading-none text-foreground")}>
            {renderUnlockNode(message)}
          </p>
        </PortaledTooltip>
      ) : null}
    </div>
  );
}
