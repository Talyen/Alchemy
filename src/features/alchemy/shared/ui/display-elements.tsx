// Small display primitives for gold.
import { Coins } from "lucide-react";

import { cn, formatLargeAmount } from "@/lib/utils";

/**
 * Coins icon + tabular-nums amount. Owns only the pair itself — callers supply
 * the surrounding layout, typography, and icon sizing chrome.
 */
export function CurrencyAmount({
  amount,
  suffix = "",
  iconClassName,
  className,
}: {
  amount: number;
  suffix?: string;
  iconClassName?: string | undefined;
  className?: string | undefined;
}) {
  return (
    <>
      <Coins className={cn("h-4 w-4 shrink-0", iconClassName)} />
      <span className={cn("tabular-nums", className)}>
        {formatLargeAmount(amount)}
        {suffix}
      </span>
    </>
  );
}

export function GoldCost({ amount }: { amount: number }) {
  return (
    <span className="flex items-center gap-1 text-base text-yellow-300">
      <CurrencyAmount amount={amount} />
    </span>
  );
}

export function GoldDisplay({ gold }: { gold: number }) {
  return (
    <p className="flex items-center gap-2 text-2xl font-medium text-yellow-300">
      <CurrencyAmount amount={gold} suffix=" Gold" iconClassName="h-7 w-7" />
    </p>
  );
}
