// Animated shine-border overlay for highlighting interactive elements (corruption, heroes).
// Depends on tailwind-merge for class composition. Used by destination choices and hero cards.
import type { CSSProperties, HTMLAttributes } from "react";

import { keywordDefinitions } from "@/lib/game-data";
import { cn } from "@/lib/utils";

function colorWithAlpha(color: string, alpha: number): string {
  if (color.startsWith("var(")) {
    return `color-mix(in srgb, ${color} ${alpha * 100}%, transparent)`;
  }
  if (color.startsWith("#")) {
    const clean = color.replace("#", "");
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  if (color.startsWith("hsl(")) {
    const inner = color.slice(4, -1);
    return `hsla(${inner} / ${alpha})`;
  }
  return `rgba(0,0,0,0)`;
}

interface ShineBorderProps extends HTMLAttributes<HTMLDivElement> {
  borderWidth?: number;
  duration?: number;
  shineColor?: string | readonly string[];
}

export function ShineBorder({
  borderWidth = 1,
  duration = 14,
  shineColor = keywordDefinitions.physical.shineColors,
  className,
  style,
  ...props
}: ShineBorderProps) {
  const colors: readonly string[] = Array.isArray(shineColor) ? shineColor : [shineColor];
  const safeColors = colors.length > 0 ? colors : ["transparent"];
  const firstColor = safeColors[0] ?? "transparent";
  const fade = colorWithAlpha(firstColor, 0.5);

  return (
    <div
      style={
        {
          "--border-width": `${borderWidth}px`,
          "--duration": `${duration}s`,
          backgroundImage: `radial-gradient(${fade},${fade}, ${safeColors.join(",")},${fade},${fade})`,
          backgroundSize: "300% 300%",
          mask: `linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)`,
          WebkitMask: `linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)`,
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          padding: "var(--border-width)",
          ...style,
        } as CSSProperties
      }
      className={cn(
        "pointer-events-none absolute inset-0 animate-shine rounded-[inherit] will-change-[background-position]",
        className,
      )}
      {...props}
    />
  );
}
