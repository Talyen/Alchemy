// Run victory screen — shown after defeating the Act III boss.
import { Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";

import { ScreenHeader } from "../ui/shared-ui";

export function RunVictoryScreen({
  herbGardenHerbs,
  hunterLodgeFood,
  onMainMenu,
}: {
  herbGardenHerbs: number;
  hunterLodgeFood: number;
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

      {herbGardenHerbs > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-600/40 bg-emerald-950/60 px-5 py-3 text-emerald-300">
          <Sprout className="h-5 w-5" />
          <span className="text-sm font-semibold">+{herbGardenHerbs} Herbs from Herb Garden</span>
        </div>
      )}
      {hunterLodgeFood > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-600/40 bg-amber-950/60 px-5 py-3 text-amber-300">
          <Sprout className="h-5 w-5" />
          <span className="text-sm font-semibold">+{hunterLodgeFood} Food from Hunter&apos;s Lodge</span>
        </div>
      )}

      <Button size="lg" className="min-w-44" onClick={onMainMenu}>
        Return to Main Menu
      </Button>
    </div>
  );
}
