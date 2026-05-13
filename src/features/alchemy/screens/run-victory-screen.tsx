// Run victory screen — shown after defeating the Act III boss.
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MATERIAL_IDS, materialLabels, type MaterialInventory } from "@/lib/homestead/types";

import { ScreenHeader } from "../ui/shared-ui";
import { matIconMap, matPillStyle, matTextColor } from "../ui/material-icons";

export function RunVictoryScreen({
  runEndMaterials,
  onMainMenu,
}: {
  runEndMaterials: MaterialInventory;
  onMainMenu: () => void;
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-4 py-6 text-center">
      <div>
        <ScreenHeader title="Victory" />
        <p className="mt-3 text-lg text-muted-foreground">
          The primordial evils have been vanquished. Alchemy is saved.
        </p>
      </div>

      {MATERIAL_IDS.filter((mat) => runEndMaterials[mat] > 0).length > 0 && (
        <div className="flex flex-col items-center gap-2">
          {MATERIAL_IDS.filter((mat) => runEndMaterials[mat] > 0).map((mat) => (
            <span key={mat} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
              Found
              <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold", matPillStyle[mat], matTextColor[mat])}>
                {matIconMap[mat]}
                {runEndMaterials[mat]} {materialLabels[mat]}
              </span>
            </span>
          ))}
        </div>
      )}

      <Button size="lg" className="min-w-44" onClick={onMainMenu}>
        Return to Main Menu
      </Button>
    </div>
  );
}
