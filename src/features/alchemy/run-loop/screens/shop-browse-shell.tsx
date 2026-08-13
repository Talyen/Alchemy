// Shared shop browse chrome — header, gold, offerings grid, services, leave.
// Mode slots (remove / mix / reveal) stay as children outside ShopBrowseOfferings.
import type { ReactNode } from "react";

import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BUTTON_WIDTH_ACTION } from "@/features/alchemy/shared/config";
import { cn } from "@/lib/utils";

import { GoldDisplay, ScreenHeader, ServiceButton } from "../../shared/ui/shared-ui";
import { FadeSlot } from "../../shared/ui/fade-slot";

export function ShopBrowseShell({
  title,
  gold,
  showGold = true,
  children,
}: {
  title: string;
  gold: number;
  showGold?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 overflow-y-auto px-4 py-6 text-center">
      <ScreenHeader title={title} />
      {showGold ? (
        <GoldDisplay gold={gold} />
      ) : (
        <div className="invisible" aria-hidden="true">
          <GoldDisplay gold={gold} />
        </div>
      )}
      {children}
    </div>
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
      <FadeSlot swapKey={swapKey} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
