import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { LockedFeatureTooltip } from "./locked-feature-tooltip";
import { PortaledTooltip } from "./portaled-tooltip";
import type { PortaledTooltipSide } from "./portaled-tooltip-placement";
import { useHoverVisible } from "./use-hover-visible";
import { cn } from "@/lib/utils";
import { playUISound } from "@/lib/audio";

interface LockedMenuItemProps {
  title: string;
  message: string;
  locked: boolean;
  onSelect: () => void;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
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
  tooltipPlacement = "side-end",
  size = "default",
  variant = "ghost",
}: LockedMenuItemProps) {
  const { triggerRef, visible, onMouseEnter, onMouseLeave } = useHoverVisible<HTMLDivElement>();

  return (
    <div ref={triggerRef} className="relative overflow-visible" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <Button
        variant={variant}
        size={size}
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
        <PortaledTooltip triggerRef={triggerRef} visible placement={tooltipPlacement} className="text-left">
          <LockedFeatureTooltip title={title} message={message} />
        </PortaledTooltip>
      )}
    </div>
  );
}
