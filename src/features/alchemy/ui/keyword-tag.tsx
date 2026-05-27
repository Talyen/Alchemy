// Keyword label/icon renderer shared by cards, talents, characters, and status popups.
// Depends on keyword metadata, icon config, and class-name utilities.
// Keep this small so keyword visual language stays consistent across the game UI.
import type { KeywordId } from "@/lib/game-data";
import { keywordDefinitions } from "@/lib/game-data";
import { cn } from "@/lib/utils";

import { keywordIcons } from "../config";
import { TooltipPanel } from "./tooltip-panel";

export function KeywordTag({
  keywordId,
  pill = false,
  showIcon = true,
  className,
  showTooltip = false,
}: {
  keywordId: KeywordId;
  pill?: boolean;
  showIcon?: boolean;
  className?: string;
  showTooltip?: boolean;
}) {
  const def = keywordDefinitions[keywordId];
  const Icon = keywordIcons[keywordId];
  if (!def) return keywordId;

  const tag = (
    <span
      className={cn(
        "inline-flex items-baseline gap-1 font-semibold text-sm leading-none",
        def.colorClass,
        pill && "character-keyword-pill-tint rounded-full px-2.5 py-1",
        className,
      )}
    >
      {showIcon ? (
        <Icon className={cn("relative top-[0.15em] h-[1em] w-[1em] shrink-0", pill && "top-0 h-3 w-3")} />
      ) : null}
      {def.label}
    </span>
  );

  if (!showTooltip) return tag;

  return (
    <span className="group/keyword relative inline-flex items-center">
      <span className="cursor-help">{tag}</span>
      <TooltipPanel className="pointer-events-none opacity-0 group-hover/keyword:opacity-100">
        <span className="flex items-center gap-2 text-base">
          <KeywordTag keywordId={keywordId} showIcon />
        </span>
        <span className="mt-2 block text-sm leading-6 text-muted-foreground">{def.description}</span>
      </TooltipPanel>
    </span>
  );
}
