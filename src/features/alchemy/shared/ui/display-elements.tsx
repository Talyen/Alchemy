import { useState } from "react";

import { cardHoverScaleClass } from "@/features/alchemy/shared/config";
import { cn, formatLargeAmount } from "@/lib/utils";
import { HomesteadResourceArtwork } from "./material-icons";

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
      <HomesteadResourceArtwork resource="gold" size="md" className={iconClassName} alt={suffix ? "" : "Gold"} />
      <span className={cn("tabular-nums", className)}>
        {formatLargeAmount(amount)}
        {suffix}
      </span>
    </>
  );
}

export function GoldCost({
  amount,
  affordable = true,
  className,
}: {
  amount: number;
  affordable?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xl leading-none font-semibold tabular-nums",
        affordable ? "text-amber-200" : "text-muted-foreground",
        className,
      )}
    >
      <CurrencyAmount amount={amount} />
    </span>
  );
}

export function GoldDisplay({
  gold,
  testId = "run-gold",
  className,
}: {
  gold: number;
  testId?: string;
  className?: string;
}) {
  const [previousGold, setPreviousGold] = useState(gold);
  const [increaseToken, setIncreaseToken] = useState(0);
  if (gold !== previousGold) {
    setPreviousGold(gold);
    if (gold > previousGold) setIncreaseToken((token) => token + 1);
  }

  return (
    <div
      key={increaseToken}
      className={cn(
        "flex h-11 shrink-0 items-center gap-1.5 rounded-md px-2 text-xl font-semibold text-amber-200 tabular-nums",
        cardHoverScaleClass,
        increaseToken > 0 && "battle-gold-increase",
        className,
      )}
      aria-label={`Gold: ${gold}`}
      role="img"
      data-testid={testId}
    >
      <HomesteadResourceArtwork resource="gold" size="md" alt="" />
      <span>{formatLargeAmount(gold)}</span>
    </div>
  );
}
