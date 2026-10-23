import { useGameTranslation } from "@/components/use-game-translation";
import { text as gameText } from "@/lib/localization/runtime";
import type { ReactNode } from "react";

import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { GoldDisplay } from "../../shared/ui/display-elements";
import { ServiceButton } from "../shop/ui/service-button";
import { TitledScreenShell } from "../../shared/ui/layout-components";
import { FadeSlot } from "../../shared/ui/use-fade";

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
  useGameTranslation();
  return (
    <TitledScreenShell title={title} headerActions={showGold ? <GoldDisplay gold={gold} /> : null}>
      <div className={cn("flex flex-col items-center gap-6 text-center", showGold && "mt-6")}>{children}</div>
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
  const i18n = useGameTranslation();
  return (
    <div className="flex flex-col items-center gap-6">
      <FadeSlot swapKey={swapKey} className="grid grid-cols-1 gap-8 sm:grid-cols-3">
        {children}
      </FadeSlot>
      {services ? <div className={cn("flex flex-wrap justify-center gap-3", serviceClassName)}>{services}</div> : null}
      <Button size="lg" variant="outline" wrapperClassName="mt-2" className="min-w-56" onClick={onLeave}>
        {i18n.text("ui.shop-browse-shell.1", "Leave")}
      </Button>
    </div>
  );
}

export function RefreshShopServiceButton({
  gold,
  refreshesLeft,
  refreshPrice,
  onRefresh,
  label = gameText("ui.shop-browse-shell.default-label", "Refresh"),
}: {
  gold: number;
  refreshesLeft: number;
  refreshPrice: number;
  onRefresh: () => void;
  label?: string;
}) {
  const i18n = useGameTranslation();
  return (
    <ServiceButton
      icon={RefreshCw}
      label={label}
      cost={refreshPrice}
      disabled={refreshesLeft <= 0 || gold < refreshPrice}
      disabledMessage={i18n.text("ui.shop-browse-shell.attr1", "Not Enough Gold")}
      used={refreshesLeft <= 0}
      soldOutText={i18n.text("shop.service-sold-out", "{{label}} - Sold Out", { label: label })}
      onClick={onRefresh}
    />
  );
}
