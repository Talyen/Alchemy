// Game over screen — shows defeat message and talent XP earned this run.
import type { TalentXP } from "@/lib/game-data";
import type { MaterialInventory } from "@/lib/homestead/types";
import { RunEndScreen } from "./run-end-screen";

export function GameOverScreen({
  runEndTalentXP,
  talentXP,
  runEndMaterials,
  onContinue,
  onOpenMenu,
}: {
  runEndTalentXP: TalentXP;
  talentXP: TalentXP;
  runEndMaterials: MaterialInventory;
  onContinue: () => void;
  onOpenMenu: (rect?: DOMRect) => void;
}) {
  return (
    <RunEndScreen
      title="Defeat"
      subtitle="Your run has ended."
      runEndTalentXP={runEndTalentXP}
      talentXP={talentXP}
      runEndMaterials={runEndMaterials}
      onContinue={onContinue}
      onOpenMenu={onOpenMenu}
    />
  );
}
