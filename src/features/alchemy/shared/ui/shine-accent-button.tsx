import { useState, type ElementType, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { ShineBorder } from "@/components/ui/shine-border";
import { getPlasmaColorPairFromColors } from "@/features/alchemy/shared/config";
import { cn } from "@/lib/utils";
import { usePlasmaInteraction } from "./use-plasma-source";

type ShineAccentButtonWidth = "menu" | "dialog" | "action" | "full";

// Width classes live with the single wrapper that uses them. The Button
// primitive owns its own rounded-xl; this wrapper repeats the literal so
// src/components/ui never imports @/features (boundary rule).
const SHINE_ACCENT_BUTTON_WIDTH_CLASS: Record<ShineAccentButtonWidth, string> = {
  menu: "w-[calc(19.2*var(--content-rem,1rem))]",
  dialog: "w-56",
  action: "min-w-56",
  full: "w-full",
};

interface ShineAccentButtonProps {
  children: ReactNode;
  icon?: ElementType;
  accentClassName?: string;
  shineColor: string | readonly string[];
  disabled?: boolean;
  width?: ShineAccentButtonWidth;
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
  const [active, setActive] = useState(false);
  const colors = typeof shineColor === "string" ? [shineColor] : shineColor;
  usePlasmaInteraction(getPlasmaColorPairFromColors(colors), active && !disabled);

  return (
    <div
      className={cn("relative", "rounded-xl", disabled && "opacity-50", className)}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onFocusCapture={() => setActive(true)}
      onBlurCapture={() => setActive(false)}
    >
      <Button
        size="lg"
        variant="outline"
        className={cn("gap-2 disabled:opacity-100", accentClassName, SHINE_ACCENT_BUTTON_WIDTH_CLASS[width])}
        disabled={disabled}
        onClick={onClick}
      >
        {Icon ? <Icon className="h-7 w-7" /> : null}
        {children}
      </Button>
      {!disabled ? <ShineBorder shineColor={shineColor} borderWidth={1} duration={8} className="rounded-xl" /> : null}
    </div>
  );
}
