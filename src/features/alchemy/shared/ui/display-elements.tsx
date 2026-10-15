import { useGameTranslation } from "@/components/use-game-translation";

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
  const i18n = useGameTranslation();
  return (
    <>
      <HomesteadResourceArtwork
        resource="gold"
        size="md"
        className={iconClassName}
        alt={i18n.displayText(suffix ? "" : i18n.text("ui.display-elements.d1", "Gold"))}
      />
      <span className={cn("tabular-nums", className)}>
        {i18n.displayText(formatLargeAmount(amount))}
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
  useGameTranslation();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xl leading-none font-semibold tabular-nums",
        affordable ? "text-gold-pale" : "text-muted-foreground",
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
  const i18n = useGameTranslation();
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
        "flex h-11 shrink-0 items-center gap-1.5 rounded-md px-2 text-xl font-semibold text-gold-pale tabular-nums",
        cardHoverScaleClass,
        increaseToken > 0 && "battle-gold-increase",
        className,
      )}
      aria-label={i18n.text("ui.display-elements.1", "Gold: {{value0}}", { value0: gold })}
      role="img"
      data-testid={testId}
    >
      <HomesteadResourceArtwork resource="gold" size="md" alt="" />
      <span>{i18n.displayText(formatLargeAmount(gold))}</span>
    </div>
  );
}
