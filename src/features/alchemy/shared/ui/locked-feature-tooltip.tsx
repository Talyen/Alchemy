import { Lock } from "lucide-react";
import { TooltipBody, TooltipHeader } from "./tooltip-panel";

export function LockedFeatureTooltip({ title, message }: { title: string; message: string }) {
  return (
    <>
      <TooltipHeader>
        <span className="inline-flex items-center gap-1.5 align-middle">
          <Lock className="h-4 w-4" />
          {title}
        </span>
      </TooltipHeader>
      <TooltipBody>
        <p>{message}</p>
      </TooltipBody>
    </>
  );
}
