import { useGameTranslation } from "@/components/use-game-translation";

import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { TooltipBody, TooltipHeader } from "./tooltip-panel";
import { renderUnlockNode } from "../unlock-text";

export function LockedFeatureTooltip({ title, message }: { title: string; message: ReactNode }) {
  const i18n = useGameTranslation();
  return (
    <>
      <TooltipHeader>
        <span className="inline-flex items-center gap-1.5 align-middle">
          <Lock />
          {title}
        </span>
      </TooltipHeader>
      <TooltipBody>
        <p>{i18n.displayText(i18n.read(() => renderUnlockNode(message)))}</p>
      </TooltipBody>
    </>
  );
}
