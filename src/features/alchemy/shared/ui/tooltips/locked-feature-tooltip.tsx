import { useGameTranslation } from "@/components/use-game-translation";
import { displayText } from "@/lib/localization/runtime";
import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { tooltipChipIconClass } from "../../config/typography";
import { TooltipBody, TooltipHeader } from "./tooltip-panel";
import { renderUnlockNode } from "../unlock-text";

export function LockedFeatureTooltip({ title, message }: { title: string; message: ReactNode }) {
  useGameTranslation();
  return (
    <>
      <TooltipHeader>
        <span className="inline-flex items-center gap-1.5 align-middle">
          <Lock className={tooltipChipIconClass} />
          {title}
        </span>
      </TooltipHeader>
      <TooltipBody>
        <p>{displayText(renderUnlockNode(message))}</p>
      </TooltipBody>
    </>
  );
}
