import { formatLargeAmount } from "@/lib/utils";
import { MATERIAL_IDS, materialLabels, type MaterialInventory } from "@/lib/homestead/types";
import { HomesteadResourceArtwork } from "../../../shared/ui/material-icons";

export function HomesteadWallet({ gold, inventory }: { gold: number; inventory: MaterialInventory }) {
  return (
    <dl aria-label="Resources" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-lg">
      {(["gold", ...MATERIAL_IDS] as const).map((resource) => (
        <div key={resource} className="flex items-center gap-1.5">
          <dt>
            <HomesteadResourceArtwork resource={resource} size="md" className="h-8 w-8" alt="" />
            <span className="sr-only">{resource === "gold" ? "Gold" : materialLabels[resource]}</span>
          </dt>
          <dd className="font-medium text-foreground/80 tabular-nums">
            {formatLargeAmount(resource === "gold" ? gold : inventory[resource])}
          </dd>
        </div>
      ))}
    </dl>
  );
}
