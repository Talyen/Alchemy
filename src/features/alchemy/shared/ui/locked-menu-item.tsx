import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { LockedFeatureTooltip } from "./locked-feature-tooltip";
import { tooltipSideAnchorClass, useTooltipSidePlacement } from "./tooltip-panel";
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
  tooltipPlacement?: "side-start" | "side-end";
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
  const [showTooltip, setShowTooltip] = useState(false);
  const { ref: tooltipRef, placement } = useTooltipSidePlacement(tooltipPlacement, showTooltip);

  return (
    <div
      className="relative overflow-visible"
      onMouseEnter={() => locked && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <Button
        variant={variant}
        size={size}
        className={cn(locked && "cursor-not-allowed opacity-50", className)}
        {...(locked ? { hoverSound: false as const } : {})}
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
      {showTooltip && locked && (
        <LockedFeatureTooltip
          title={title}
          message={message}
          panelRef={tooltipRef}
          visible
          placement={placement}
          className={cn(tooltipSideAnchorClass(placement), "z-[130] text-left")}
        />
      )}
    </div>
  );
}
