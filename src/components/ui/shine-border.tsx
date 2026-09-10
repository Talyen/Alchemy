import type { CSSProperties, HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

interface ShineBorderProps extends HTMLAttributes<HTMLDivElement> {
  glow?: boolean;
  borderWidth?: number;
  duration?: number;
  shineColor: string | readonly string[];
}

export function ShineBorder({
  glow = false,
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
  const gradientStops = safeColors.length === 1 ? `${safeColors[0]}, ${safeColors[0]}` : safeColors.join(",");

  return (
    <div
      style={
        {
          "--border-width": `${borderWidth}px`,
          "--duration": `${duration}s`,
          "--shine-glow-color": firstColor,
          ...style,
        } as CSSProperties
      }
      data-glow={glow ? "true" : undefined}
      className={cn("shine-border pointer-events-none absolute animate-shine rounded-[inherit]", className)}
      {...props}
    >
      <div
        className="shine-border-paint absolute inset-0 overflow-hidden rounded-[inherit]"
        style={{
          backgroundColor: firstColor,
          backgroundImage: `radial-gradient(${gradientStops})`,
          backgroundSize: "300% 300%",
          mask: `linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)`,
          WebkitMask: `linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)`,
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          padding: "var(--border-width)",
          backgroundPosition: "inherit",
          transition: "padding 200ms ease-out",
        }}
      />
    </div>
  );
}
