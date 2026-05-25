// Small display primitives for gold.
// Depends on Lucide icons and class-name utilities.
// Used by shop, rewards, and battle-adjacent screens.
import { Coins } from "lucide-react";

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
