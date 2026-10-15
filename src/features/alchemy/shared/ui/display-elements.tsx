import { useGameTranslation } from "@/components/use-game-translation";
import { text as gameText, displayText } from "@/lib/localization/runtime";
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
  useGameTranslation();
  return (
    <>
      <HomesteadResourceArtwork
        resource="gold"
        size="md"
        className={iconClassName}
        alt={displayText(suffix ? "" : gameText("ui.display-elements.d1", "Gold"))}
      />
      <span className={cn("tabular-nums", className)}>
        {displayText(formatLargeAmount(amount))}
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
  useGameTranslation();
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
      aria-label={gameText("ui.display-elements.1", "Gold: {{value0}}", { value0: gold })}
      role="img"
      data-testid={testId}
    >
      <HomesteadResourceArtwork resource="gold" size="md" alt="" />
      <span>{displayText(formatLargeAmount(gold))}</span>
    </div>
  );
}
