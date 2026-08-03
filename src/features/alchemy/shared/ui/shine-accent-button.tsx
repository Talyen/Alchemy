import type { ElementType, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { ShineBorder } from "@/components/ui/shine-border";
import { BUTTON_SHAPE, BUTTON_WIDTH_TIER_CLASS, type ButtonWidthTier } from "@/features/alchemy/shared/config";
import { cn } from "@/lib/utils";

interface ShineAccentButtonProps {
  children: ReactNode;
  icon?: ElementType;
  accentClassName?: string;
  shineColor: string | readonly string[];
  disabled?: boolean;
  width?: ButtonWidthTier;
  className?: string;
  onClick: () => void;
}

export function ShineAccentButton({
  children,
  icon: Icon,
  accentClassName,
  shineColor,
  disabled = false,
  width = "full",
  className,
  onClick,
}: ShineAccentButtonProps) {
  return (
    <div className={cn("relative", BUTTON_SHAPE, disabled && "opacity-50", className)}>
      <Button
        size="lg"
        variant="outline"
        className={cn("gap-2 disabled:opacity-100", accentClassName, BUTTON_WIDTH_TIER_CLASS[width])}
        disabled={disabled}
        onClick={onClick}
      >
        {Icon ? <Icon className="h-7 w-7" /> : null}
        {children}
      </Button>
      {!disabled ? <ShineBorder shineColor={shineColor} borderWidth={1} duration={8} className={BUTTON_SHAPE} /> : null}
    </div>
  );
}
