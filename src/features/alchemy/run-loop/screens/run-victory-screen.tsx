// Run victory screen — shown after defeating the Act III boss.
import { Button } from "@/components/ui/button";
import type { TalentXP } from "@/lib/game-data";
import type { MaterialInventory } from "@/lib/homestead/types";
import { ScreenHeader } from "../../shared/ui/shared-ui";
import { RunEndProgressSection } from "./run-end-progress-section";

export function RunVictoryScreen({
  runEndTalentXP,
  talentXP,
  runEndMaterials,
  onMainMenu,
}: {
  runEndTalentXP: TalentXP;
  talentXP: TalentXP;
  runEndMaterials: MaterialInventory;
  onMainMenu: () => void;
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-4 py-6 text-center">
      <div>
        <ScreenHeader title="Victory" />
        <p className="mt-3 text-sm text-muted-foreground">
          The primordial evils have been vanquished. Alchemy is saved.
        </p>
      </div>

      <RunEndProgressSection runEndTalentXP={runEndTalentXP} talentXP={talentXP} runEndMaterials={runEndMaterials} />

      <Button size="lg" className="min-w-44" onClick={onMainMenu}>
        Return to Main Menu
      </Button>
    </div>
  );
}
