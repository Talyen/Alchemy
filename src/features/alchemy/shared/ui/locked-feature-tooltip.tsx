import { Lock } from "lucide-react";
import { tooltipChipIconClass } from "../config";
import { TooltipBody, TooltipHeader } from "./tooltip-panel";

export function LockedFeatureTooltip({ title, message }: { title: string; message: string }) {
  return (
    <>
      <TooltipHeader>
        <span className="inline-flex items-center gap-1.5 align-middle">
          <Lock className={tooltipChipIconClass} />
          {title}
        </span>
      </TooltipHeader>
      <TooltipBody>
        <p>{message}</p>
      </TooltipBody>
    </>
  );
}
