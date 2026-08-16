// Cycles a shine overlay through a color list by interpolating CSS color stops.
import { useId, useMemo, type CSSProperties } from "react";

import { ShineBorder } from "@/components/ui/shine-border";

interface CyclingShineBorderProps {
  colors: readonly string[];
  borderWidth?: number;
  duration?: number;
  intervalMs: number;
  className?: string;
}

const CYCLE_SHINE_VAR = "--cycle-shine";

export function buildShineColorCycleKeyframes(animationName: string, colors: readonly string[]): string {
  const first = colors[0];
  if (!first) return "";

  const frames = colors.map((color, index) => {
    const percent = (index / colors.length) * 100;
    return `${percent}% { ${CYCLE_SHINE_VAR}: ${color}; }`;
  });
  frames.push(`100% { ${CYCLE_SHINE_VAR}: ${first}; }`);
  return `@keyframes ${animationName} {\n  ${frames.join("\n  ")}\n}`;
}

export function CyclingShineBorder({
  colors,
  borderWidth = 1,
  duration = 14,
  intervalMs,
  className,
}: CyclingShineBorderProps) {
  const reactId = useId().replace(/:/g, "");
  const animationName = `alchemy-shine-cycle-${reactId}`;
  const firstColor = colors[0];
  const keyframes = useMemo(() => buildShineColorCycleKeyframes(animationName, colors), [animationName, colors]);
  const cycleDurationMs = Math.max(1, colors.length) * intervalMs;

  if (!firstColor || !keyframes) return null;

  return (
    <>
      <style>{keyframes}</style>
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
    </>
  );
}
