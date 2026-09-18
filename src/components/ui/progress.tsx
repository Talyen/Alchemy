import { type CSSProperties, type HTMLAttributes, type Ref } from "react";

import { clamp } from "@/lib/math";
import { cn } from "@/lib/utils";

interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  value?: number;
  size?: "sm" | "md";
  color?: string;
  /**
   * Extra fill styling (e.g. transitions, backgroundColor). `width` is owned
   * by `value` and cannot be overridden here.
   */
  fillStyle?: Omit<CSSProperties, "width">;
  ref?: Ref<HTMLDivElement>;
}

// Callers must provide an accessible name (aria-label/aria-labelledby):
// a bare progressbar has no text content for assistive tech to announce.
function Progress({ className, value, size = "md", color, fillStyle, ref, ...props }: ProgressProps) {
  const height = size === "sm" ? "h-1" : "h-4";
  const trackColor = size === "sm" ? "bg-muted" : "bg-secondary";
  const fillColor = color ?? "bg-primary";

  const progressPercent = clamp(Number.isFinite(value) ? (value as number) : 0, 0, 100);

  return (
    <div
      ref={ref}
      role="progressbar"
      aria-valuenow={Math.round(progressPercent)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("relative w-full overflow-hidden rounded-full", height, trackColor, className)}
      {...props}
    >
      <div
        className={cn("h-full rounded-full transition-all duration-300 ease-out", fillColor)}
        style={{ ...fillStyle, width: `${progressPercent}%` }}
      />
    </div>
  );
}

export { Progress };
