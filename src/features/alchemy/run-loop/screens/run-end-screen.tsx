// Shared run-end shell for victory and defeat — title, subtitle, progress, continue.
import { Button } from "@/components/ui/button";
import { BUTTON_WIDTH_ACTION } from "@/features/alchemy/shared/config";
import type { TalentXP } from "@/lib/game-data";
import type { MaterialInventory } from "@/lib/homestead/types";
import { ScreenHeader } from "../../shared/ui/shared-ui";
import { RunEndProgressSection } from "./run-end-progress-section";

export function RunEndScreen({
  title,
  subtitle,
  runEndTalentXP,
  talentXP,
  runEndMaterials,
  onContinue,
}: {
  title: string;
  subtitle: string;
  runEndTalentXP: TalentXP;
  talentXP: TalentXP;
  runEndMaterials: MaterialInventory;
  onContinue: () => void;
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-4 py-6 text-center">
      <div>
        <ScreenHeader title={title} />
        <p className="mt-3 text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <RunEndProgressSection runEndTalentXP={runEndTalentXP} talentXP={talentXP} runEndMaterials={runEndMaterials} />

      <Button size="lg" variant="primary" className={BUTTON_WIDTH_ACTION} onClick={onContinue}>
        Continue
      </Button>
    </div>
  );
}
