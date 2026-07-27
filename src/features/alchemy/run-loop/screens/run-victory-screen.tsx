// Run victory screen — shown after defeating the Act III boss.
import type { TalentXP } from "@/lib/game-data";
import type { MaterialInventory } from "@/lib/homestead/types";
import { RunEndScreen } from "./run-end-screen";

export function RunVictoryScreen({
  runEndTalentXP,
  talentXP,
  runEndMaterials,
  onContinue,
}: {
  runEndTalentXP: TalentXP;
  talentXP: TalentXP;
  runEndMaterials: MaterialInventory;
  onContinue: () => void;
}) {
  return (
    <RunEndScreen
      title="Victory"
      subtitle="The primordial evils have been vanquished. Alchemy is saved."
      runEndTalentXP={runEndTalentXP}
      talentXP={talentXP}
      runEndMaterials={runEndMaterials}
      onContinue={onContinue}
    />
  );
}
