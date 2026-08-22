// Shared shop browse chrome — header, gold, offerings grid, services, leave.
// Mode slots (remove / mix / reveal) stay as children outside ShopBrowseOfferings.
import type { ReactNode } from "react";

import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BUTTON_WIDTH_ACTION } from "@/features/alchemy/shared/config";
import { cn } from "@/lib/utils";

import { GoldDisplay, ServiceButton, TitledScreenShell } from "../../shared/ui/shared-ui";
import { FadeSlot } from "../../shared/ui/fade-slot";

export function ShopBrowseShell({
  title,
  gold,
  showGold = true,
  onOpenMenu,
  children,
}: {
  title: string;
  gold: number;
  showGold?: boolean;
  onOpenMenu: (rect?: DOMRect) => void;
  children: ReactNode;
}) {
  return (
    <TitledScreenShell title={title} onOpenMenu={onOpenMenu} menuLabel={`Open ${title} menu`}>
      <div className="mt-6 flex flex-col items-center gap-6 text-center">
        {showGold ? (
          <GoldDisplay gold={gold} />
        ) : (
          <div className="invisible">
            <GoldDisplay gold={gold} />
          </div>
        )}
        {children}
      </div>
    </TitledScreenShell>
  );
}

export function ShopBrowseOfferings({
  swapKey,
  children,
  services,
  onLeave,
  serviceClassName,
}: {
  swapKey: string;
  children: ReactNode;
  services?: ReactNode;
  onLeave: () => void;
  serviceClassName?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-6">
      <FadeSlot swapKey={swapKey} className="grid grid-cols-1 gap-8 sm:grid-cols-3">
        {children}
      </FadeSlot>
      {services ? <div className={cn("flex flex-wrap justify-center gap-3", serviceClassName)}>{services}</div> : null}
      <Button size="lg" variant="primary" className={cn("mt-2", BUTTON_WIDTH_ACTION)} onClick={onLeave}>
        Leave
      </Button>
    </div>
  );
}

export function RefreshShopServiceButton({
  gold,
  refreshesLeft,
  refreshPrice,
  onRefresh,
  label = "Refresh",
}: {
  gold: number;
  refreshesLeft: number;
  refreshPrice: number;
  onRefresh: () => void;
  label?: string;
}) {
  return (
    <ServiceButton
      icon={RefreshCw}
      label={label}
      cost={refreshPrice}
      disabled={refreshesLeft <= 0 || gold < refreshPrice}
      disabledMessage="Not Enough Gold"
      used={refreshesLeft <= 0}
      soldOutText={`${label} — Sold Out`}
      onClick={onRefresh}
    />
  );
}
