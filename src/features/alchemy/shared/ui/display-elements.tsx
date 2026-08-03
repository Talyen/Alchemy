// Small display primitives for gold.
// Depends on Lucide icons and class-name utilities.
// Used by shop, rewards, and battle-adjacent screens.
import { Coins } from "lucide-react";

export function GoldCost({ amount }: { amount: number }) {
  return (
    <span className="flex items-center gap-1 text-base text-yellow-300">
      <Coins className="h-4 w-4" />
      {amount}
    </span>
  );
}

export function GoldDisplay({ gold }: { gold: number }) {
  return (
    <p className="flex items-center gap-2 text-2xl font-medium text-yellow-300">
      <Coins className="h-7 w-7" />
      {gold} Gold
    </p>
  );
}
