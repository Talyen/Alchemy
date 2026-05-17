// Styled progress bar primitive with transform-based fill.
// Depends only on React and class-name utilities.
// Used by health, XP, and other meter displays.
import { forwardRef, type HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  value?: number;
}

const Progress = forwardRef<HTMLDivElement, ProgressProps>(({ className, value, ...props }, ref) => (
  <div ref={ref} className={cn("relative h-4 w-full overflow-hidden rounded-full bg-secondary", className)} {...props}>
    <div
      className="h-full w-full flex-1 bg-primary transition-transform duration-300 ease-out"
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </div>
));
Progress.displayName = "Progress";

export { Progress };
