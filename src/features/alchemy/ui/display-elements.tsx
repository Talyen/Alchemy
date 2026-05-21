// Small display primitives for gold and percentage bars.
// Depends on Lucide icons, shared progress math, and class-name utilities.
// Used by shop, rewards, and battle-adjacent screens.
import type { CSSProperties } from "react";
import { Coins } from "lucide-react";
import { clampProgressPercent } from "@/lib/ui/progress";
import { cn } from "@/lib/utils";

export function ProgressBar({
  value,
  color = "bg-primary",
  className,
  style,
}: {
  value: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const safeValue = clampProgressPercent(value);

  return (
    <div className={cn("h-1 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div className={cn("h-full rounded-full", color)} style={{ width: `${safeValue}%`, ...style }} />
    </div>
  );
}

export function GoldCost({ amount }: { amount: number }) {
  return (
    <span className="flex items-center gap-1 text-xs text-yellow-300">
      <Coins className="h-3 w-3" />
      {amount}
    </span>
  );
}

export function GoldDisplay({ gold }: { gold: number }) {
  return (
    <p className="flex items-center gap-2 text-lg font-medium text-yellow-300">
      <Coins className="h-5 w-5" />
      {gold} Gold
    </p>
  );
}
