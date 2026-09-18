import type { CSSProperties, HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

interface ShineBorderProps extends HTMLAttributes<HTMLDivElement> {
  glow?: boolean;
  borderWidth?: number;
  duration?: number;
  shineColor: string | readonly string[];
}

// Decorative frame: parent must be `relative` with a rounded corner for
// `absolute` + `rounded-[inherit]` to resolve. Renders nothing semantic, so
// it is hidden from assistive tech.
const NEUTRAL_SHINE_FALLBACK = ["#cbd5e1", "#64748b", "#cbd5e1"] as const;

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
  // Empty palettes fall back to the shared neutral shine instead of black so
  // a missing keyword palette degrades to the resting border treatment.
  const safeColors: readonly string[] = colors.length > 0 ? colors : NEUTRAL_SHINE_FALLBACK;
  const firstColor = safeColors[0] ?? NEUTRAL_SHINE_FALLBACK[0];
  const gradientStops = safeColors.length === 1 ? `${safeColors[0]}, ${safeColors[0]}` : safeColors.join(",");

  return (
    <div
      aria-hidden="true"
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
          // Paint-layer transition for border-width changes; the outer
          // .shine-border rule owns box-shadow/filter/opacity instead.
          transition: "padding 200ms ease-out",
        }}
      />
    </div>
  );
}
