// Shared run-end shell for victory and defeat — title, subtitle, progress, continue.
import { Button } from "@/components/ui/button";
import { BUTTON_WIDTH_ACTION, bodyTextClass } from "@/features/alchemy/shared/config";
import type { TalentXP } from "@/lib/game-data";
import type { RunObtainedItem } from "@/lib/active-run-session";
import type { MaterialInventory } from "@/lib/homestead/types";
import { cn } from "@/lib/utils";
import { TitledScreenShell } from "../../shared/ui/shared-ui";
import { RunEndProgressSection } from "./run-end-progress-section";

export function RunEndScreen({
  title,
  subtitle,
  runEndTalentXP,
  talentXP,
  runEndMaterials,
  runEndItems,
  onContinue,
  onOpenMenu,
}: {
  title: string;
  subtitle: string;
  runEndTalentXP: TalentXP;
  talentXP: TalentXP;
  runEndMaterials: MaterialInventory;
  runEndItems: readonly RunObtainedItem[];
  onContinue: () => void;
  onOpenMenu: (rect?: DOMRect) => void;
}) {
  return (
    <TitledScreenShell
      title={title}
      onOpenMenu={onOpenMenu}
      menuLabel={`Open ${title.toLowerCase()} menu`}
      maxWidthClass="max-w-7xl"
    >
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
