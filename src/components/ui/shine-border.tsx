import type { CSSProperties, HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

interface ShineBorderProps extends HTMLAttributes<HTMLDivElement> {
  borderWidth?: number;
  duration?: number;
  shineColor: string | readonly string[];
}

export function ShineBorder({
  borderWidth = 1,
  duration = 14,
  shineColor,
  className,
  style,
  ...props
}: ShineBorderProps) {
  const colors: readonly string[] = Array.isArray(shineColor) ? shineColor : [shineColor];
  const safeColors = colors.length > 0 ? colors : ["#000000"];
  const firstColor = safeColors[0] ?? "#000000";

  return (
    <div
      style={
        {
          "--border-width": `${borderWidth}px`,
          "--duration": `${duration}s`,
          backgroundColor: firstColor,
          backgroundImage: `radial-gradient(${safeColors.join(",")})`,
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
        "shine-border pointer-events-none absolute animate-shine overflow-hidden rounded-[inherit]",
        className,
      )}
      {...props}
    />
  );
}
