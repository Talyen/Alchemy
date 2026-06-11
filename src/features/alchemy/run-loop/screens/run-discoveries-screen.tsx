// Post-run discoveries screen — batched card-back pack opens for new collection entries.
import { useMemo, useState } from "react";

import { buildDiscoveryPackPlan } from "@/lib/discoveries";
import type { DiscoveryPackBatch } from "@/lib/discoveries";

import { collectionShellWidthClass, discoveryScreenStackHeightClass } from "../../shared/config";
import { DiscoveryPack } from "../../shared/ui/discovery-pack";
import { ScreenHeader } from "../../shared/ui/shared-ui";
import { cn } from "@/lib/utils";

export function RunDiscoveriesScreen({
  runEndDiscoveredCardIds,
  runEndDiscoveredTrinketIds,
  onContinue,
}: {
  runEndDiscoveredCardIds: string[];
  runEndDiscoveredTrinketIds: string[];
  onContinue: () => void;
}) {
  const packs = useMemo(
    () => buildDiscoveryPackPlan(runEndDiscoveredCardIds, runEndDiscoveredTrinketIds),
    [runEndDiscoveredCardIds, runEndDiscoveredTrinketIds],
  );
  const [batchKind, setBatchKind] = useState<DiscoveryPackBatch["kind"]>("cards");

  return (
    <div className="flex h-full w-full flex-col items-center justify-center py-6 text-center">
      <div
        className={cn(
          "flex flex-col items-center justify-between gap-6 px-7",
          collectionShellWidthClass,
          discoveryScreenStackHeightClass,
        )}
      >
        <div className="flex h-[5.5rem] w-full shrink-0 flex-col items-center">
          <ScreenHeader title="Discoveries" />
          <p className="mt-3 text-sm text-muted-foreground">New cards and trinkets added to your collection</p>
          <p className="mt-1 min-h-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {batchKind === "trinkets" ? "Trinkets" : "\u00a0"}
          </p>
        </div>

        {packs.length > 0 ? (
          <DiscoveryPack packs={packs} onBatchChange={({ kind }) => setBatchKind(kind)} onContinue={onContinue} />
        ) : null}
      </div>
    </div>
  );
}
