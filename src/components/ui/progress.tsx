import { type CSSProperties, type HTMLAttributes, type Ref } from "react";

import { clamp, cn } from "@/lib/utils";

interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  value?: number;
  size?: "sm" | "md";
  color?: string;
  fillStyle?: CSSProperties;
  ref?: Ref<HTMLDivElement>;
}

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
        className={cn("h-full w-full flex-1 rounded-full transition-all duration-300 ease-out", fillColor)}
        style={{ width: `${progressPercent}%`, ...fillStyle }}
      />
    </div>
  );
}

export { Progress };
