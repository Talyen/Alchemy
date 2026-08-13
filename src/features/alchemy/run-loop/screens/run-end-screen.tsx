// Shared run-end shell for victory and defeat — title, subtitle, progress, continue.
import { Button } from "@/components/ui/button";
import { BUTTON_WIDTH_ACTION, bodyTextClass } from "@/features/alchemy/shared/config";
import type { TalentXP } from "@/lib/game-data";
import type { MaterialInventory } from "@/lib/homestead/types";
import { TitledScreenShell } from "../../shared/ui/shared-ui";
import { RunEndProgressSection } from "./run-end-progress-section";

export function RunEndScreen({
  title,
  subtitle,
  runEndTalentXP,
  talentXP,
  runEndMaterials,
  onContinue,
  onOpenMenu,
}: {
  title: string;
  subtitle: string;
  runEndTalentXP: TalentXP;
  talentXP: TalentXP;
  runEndMaterials: MaterialInventory;
  onContinue: () => void;
  onOpenMenu: (rect?: DOMRect) => void;
}) {
  return (
    <TitledScreenShell title={title} onOpenMenu={onOpenMenu} menuLabel={`Open ${title.toLowerCase()} menu`}>
      <div className="mt-6 flex flex-col items-center gap-6 text-center">
        <p className={bodyTextClass}>{subtitle}</p>

        <RunEndProgressSection runEndTalentXP={runEndTalentXP} talentXP={talentXP} runEndMaterials={runEndMaterials} />

        <Button size="lg" variant="primary" className={BUTTON_WIDTH_ACTION} onClick={onContinue}>
          Continue
        </Button>
      </div>
    </TitledScreenShell>
  );
}
