import type { ElementType, ReactNode } from "react";

import { ShineBorder } from "@/components/ui/shine-border";
import { CHIP_BUTTON_CLASS, BUTTON_SHAPE } from "@/features/alchemy/shared/config";
import { cn } from "@/lib/utils";

interface ChoiceButtonProps {
  label: ReactNode;
  icon?: ElementType;
  accentClassName?: string;
  shineColor?: string | readonly string[] | null;
  onClick: () => void;
  className?: string;
}

export function ChoiceButton({
  label,
  icon: Icon,
  accentClassName,
  shineColor = null,
  onClick,
  className,
}: ChoiceButtonProps) {
  const useShineBorder = shineColor !== null && shineColor !== undefined;

  return (
    <div className={cn("relative", BUTTON_SHAPE, className)}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "relative justify-center font-semibold",
          CHIP_BUTTON_CLASS,
          "min-w-56 active:bg-muted active:brightness-100",
          accentClassName,
        )}
      >
        {Icon ? <Icon className="h-7 w-7" /> : null}
        <span className="leading-none">{label}</span>
      </button>
      {useShineBorder ? (
        <ShineBorder shineColor={shineColor} borderWidth={1} duration={8} className={BUTTON_SHAPE} />
      ) : null}
    </div>
  );
}
