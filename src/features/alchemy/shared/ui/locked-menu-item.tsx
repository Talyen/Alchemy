import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { LockedFeatureTooltip } from "./tooltips/locked-feature-tooltip";
import { PortaledTooltip } from "./tooltips/portaled-tooltip";
import type { PortaledTooltipSide } from "./tooltips/portaled-tooltip-placement";
import { useHoverVisible } from "./use-hover-visible";
import { cn } from "@/lib/utils";
import { playUISound } from "@/lib/audio";

interface LockedMenuItemProps {
  title: string;
  message: ReactNode;
  locked: boolean;
  onSelect: () => void;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
  wrapperClassName?: string;
  tooltipPlacement?: PortaledTooltipSide;
  size?: "sm" | "default" | "lg";
  variant?: "outline" | "ghost";
}

export function LockedMenuItem({
  title,
  message,
  locked,
  onSelect,
  icon,
  children,
  className,
  wrapperClassName,
  tooltipPlacement = "side-end",
  size = "default",
  variant = "ghost",
}: LockedMenuItemProps) {
  const { wrapperRef, visible, onMouseEnter, onMouseLeave, onFocusCapture, onBlurCapture } = useHoverVisible({
    focusWithinGuard: true,
  });

  return (
    <div
      ref={wrapperRef}
      className="relative overflow-visible"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocusCapture={onFocusCapture}
      onBlurCapture={onBlurCapture}
    >
      <Button
        variant={variant}
        size={size}
        {...(wrapperClassName === undefined ? {} : { wrapperClassName })}
        className={cn(locked && "cursor-not-allowed opacity-50", className)}
        aria-disabled={locked}
        onClick={() => {
          if (locked) {
            playUISound("error");
          } else {
            onSelect();
          }
        }}
      >
        {icon}
        {children}
      </Button>
      {visible && locked && (
        <PortaledTooltip triggerRef={wrapperRef} visible placement={tooltipPlacement} className="text-left">
          <LockedFeatureTooltip title={title} message={message} />
        </PortaledTooltip>
      )}
    </div>
  );
}
