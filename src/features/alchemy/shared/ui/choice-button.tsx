import type { ElementType, ReactNode } from "react";

import { ShineBorder } from "@/components/ui/shine-border";
import { CHIP_BUTTON_CLASS, BUTTON_SHAPE } from "@/features/alchemy/shared/config";
import { cn } from "@/lib/utils";
import { PressableMotion } from "./pressable-motion";

type ChoiceButtonProps = {
  label: ReactNode;
  icon?: ElementType;
  accentClassName?: string;
  shineColor?: string | readonly string[] | null;
  onClick: () => void;
  className?: string;
};

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
      <PressableMotion className="inline-block">
        <button
          type="button"
          onClick={onClick}
          className={cn(
            "relative justify-start text-left font-semibold",
            CHIP_BUTTON_CLASS,
            "active:bg-muted active:brightness-100",
            accentClassName,
          )}
        >
          {Icon ? <Icon className="h-4 w-4" /> : null}
          <span className="leading-none">{label}</span>
        </button>
      </PressableMotion>
      {useShineBorder ? (
        <ShineBorder shineColor={shineColor} borderWidth={1} duration={8} className={BUTTON_SHAPE} />
      ) : null}
    </div>
  );
}
