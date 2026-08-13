// Shared purchasable shop tile chrome — media slot + buy / purchased affordance.
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

import { DisabledTooltip, GoldCost } from "./shared-ui";

export function PurchasableShopTile({
  media,
  price,
  gold,
  purchased,
  onBuy,
}: {
  media: ReactNode;
  price: number;
  gold: number;
  purchased: boolean;
  onBuy: () => void;
}) {
  if (purchased) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-shell-card border border-border/30 bg-card/30 p-4 text-center opacity-50">
        {media}
        <span className="text-xs font-semibold text-muted-foreground">Purchased</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-shell-card border border-border/70 bg-card/60 p-4 text-center">
      {media}
      <DisabledTooltip show={gold < price} message="Not Enough Gold">
        <Button size="lg" variant="outline" disabled={gold < price} onClick={onBuy}>
          Buy <GoldCost amount={price} />
        </Button>
      </DisabledTooltip>
    </div>
  );
}
