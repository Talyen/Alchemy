// Styled progress bar primitive with size and color variants.
// Depends only on React and class-name utilities.
// Used by health, XP, and other meter displays.
import { type CSSProperties, type HTMLAttributes, type Ref } from "react";

import { clamp, cn } from "@/lib/utils";

interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  value?: number;
  size?: "sm" | "md";
  color?: string;
  fillStyle?: CSSProperties;
  ref?: Ref<HTMLDivElement>;
}

const Progress = ({ className, value, size = "md", color, fillStyle, ref, ...props }: ProgressProps) => {
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
        style={{ width: `${clamp(Number.isNaN(value) ? 0 : (value ?? 0), 0, 100)}%`, ...fillStyle }}
      />
    </div>
  );
};

export { Progress };
