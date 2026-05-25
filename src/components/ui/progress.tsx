// Styled progress bar primitive with size and color variants.
// Depends only on React and class-name utilities.
// Used by health, XP, and other meter displays.
import { forwardRef, type CSSProperties, type HTMLAttributes } from "react";

import { clampProgressPercent } from "@/lib/ui/progress";
import { cn } from "@/lib/utils";

interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  value?: number;
  size?: "sm" | "md";
  color?: string;
  fillStyle?: CSSProperties;
}

const Progress = forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, size = "md", color, fillStyle, ...props }, ref) => {
    const height = size === "sm" ? "h-1" : "h-4";
    const trackColor = size === "sm" ? "bg-muted" : "bg-secondary";
    const fillColor = color ?? "bg-primary";

    return (
      <div
        ref={ref}
        className={cn("relative w-full overflow-hidden rounded-full", height, trackColor, className)}
        {...props}
      >
        <div
          className={cn("h-full w-full flex-1 rounded-full transition-all duration-300 ease-out", fillColor)}
          style={{ width: `${clampProgressPercent(value)}%`, ...fillStyle }}
        />
      </div>
    );
  },
);
Progress.displayName = "Progress";

export { Progress };
