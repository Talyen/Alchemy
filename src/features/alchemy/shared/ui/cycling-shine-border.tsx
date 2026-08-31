import { useInsertionEffect, useMemo, type CSSProperties } from "react";

import { ShineBorder } from "@/components/ui/shine-border";
import { CYCLE_SHINE_VAR, ensureShineCycleKeyframes, getShineCycleAnimationName } from "./cycling-shine-keyframes";

interface CyclingShineBorderProps {
  colors: readonly string[];
  borderWidth?: number;
  duration?: number;
  intervalMs: number;
  className?: string;
}

export function CyclingShineBorder({
  colors,
  borderWidth = 1,
  duration = 14,
  intervalMs,
  className,
}: CyclingShineBorderProps) {
  const animationName = useMemo(() => getShineCycleAnimationName(colors), [colors]);
  const firstColor = colors[0];
  const cycleDurationMs = Math.max(1, colors.length) * intervalMs;

  useInsertionEffect(() => {
    ensureShineCycleKeyframes(animationName, colors);
  }, [animationName, colors]);

  if (!firstColor) return null;

  return (
    <ShineBorder
      shineColor={`var(${CYCLE_SHINE_VAR})`}
      borderWidth={borderWidth}
      duration={duration}
      style={
        {
          [CYCLE_SHINE_VAR]: firstColor,
          animation: `shine ${duration}s linear infinite, ${animationName} ${cycleDurationMs}ms linear infinite`,
        } as CSSProperties
      }
      {...(className === undefined ? {} : { className })}
    />
  );
}
