import { cn, formatLargeAmount } from "@/lib/utils";
import { GoldPill, HomesteadResourceArtwork } from "./material-icons";

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

export function GoldCost({ amount }: { amount: number }) {
  return (
    <span className="flex items-center gap-1 text-base text-yellow-300">
      <CurrencyAmount amount={amount} />
    </span>
  );
}

export function GoldDisplay({ gold }: { gold: number }) {
  return (
    <div data-testid="run-gold">
      <GoldPill amount={gold} />
    </div>
  );
}
