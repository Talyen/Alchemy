import { useGameTranslation } from "@/components/use-game-translation";

import { formatLargeAmount } from "@/lib/utils";
import { MATERIAL_IDS, materialLabels, type MaterialInventory } from "@/lib/homestead/types";
import { HomesteadResourceArtwork } from "../../../shared/ui/material-icons";

export function HomesteadWallet({ gold, inventory }: { gold: number; inventory: MaterialInventory }) {
  const i18n = useGameTranslation();
  return (
    <dl
      aria-label={i18n.text("ui.resource-wallet.1", "Resources")}
      className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-lg"
    >
      {(["gold", ...MATERIAL_IDS] as const).map((resource) => (
        <div key={resource} className="flex items-center gap-1.5">
          <dt>
            <HomesteadResourceArtwork resource={resource} size="md" className="h-8 w-8" alt="" />
            <span className="sr-only">
              {i18n.displayText(
                resource === "gold" ? i18n.text("ui.resource-wallet.d1", "Gold") : materialLabels[resource],
              )}
            </span>
          </dt>
          <dd className="font-medium text-foreground/80 tabular-nums">
            {formatLargeAmount(resource === "gold" ? gold : inventory[resource], i18n.locale)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
