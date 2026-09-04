import { Button } from "@/components/ui/button";
import {
  BUTTON_WIDTH_ACTION,
  bodyTextClass,
  DEATHS_DOOR_PLASMA_PAIR,
  getPlasmaColorPair,
  getPlasmaKeywordsForCharacter,
} from "@/features/alchemy/shared/config";
import type { CharacterId, TalentXP } from "@/lib/game-data";
import type { RunObtainedItem } from "@/lib/active-run-session";
import type { MaterialInventory } from "@/lib/homestead/types";
import { cn } from "@/lib/utils";
import { TitledScreenShell } from "../../shared/ui/shared-ui";
import { usePlasmaBaseline } from "../../shared/ui/use-plasma-source";
import { RunEndProgressSection } from "./run-end-progress-section";

export function RunEndScreen({
  title,
  subtitle,
  outcome,
  characterId,
  runEndTalentXP,
  talentXP,
  runEndMaterials,
  runEndItems,
  onContinue,
}: {
  title: string;
  subtitle: string;
  outcome: "victory" | "defeat";
  characterId: CharacterId;
  runEndTalentXP: TalentXP;
  talentXP: TalentXP;
  runEndMaterials: MaterialInventory;
  runEndItems: readonly RunObtainedItem[];
  onContinue: () => void;
}) {
  const plasmaColorPair =
    outcome === "defeat" ? DEATHS_DOOR_PLASMA_PAIR : getPlasmaColorPair(getPlasmaKeywordsForCharacter(characterId));
  usePlasmaBaseline(plasmaColorPair);

  return (
    <TitledScreenShell title={title} maxWidthClass="max-w-7xl">
      <div className="mt-6 flex flex-col items-center gap-8 text-center">
        <p className={cn(bodyTextClass, "text-xl")}>{subtitle}</p>

        <RunEndProgressSection
          runEndTalentXP={runEndTalentXP}
          talentXP={talentXP}
          runEndMaterials={runEndMaterials}
          runEndItems={runEndItems}
        />

        <Button size="lg" variant="primary" className={BUTTON_WIDTH_ACTION} onClick={onContinue}>
          Continue
        </Button>
      </div>
    </TitledScreenShell>
  );
}
