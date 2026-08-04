// Keyword label/icon renderer shared by cards, talents, characters, and status popups.
// Depends on keyword metadata, icon config, and class-name utilities.
// Keep this small so keyword visual language stays consistent across the game UI.
import type { KeywordId } from "@/lib/game-data";
import { keywordDefinitions } from "@/features/alchemy/shared/config/game-data-catalog";
import { cn } from "@/lib/utils";

import { keywordIcons } from "../config";
import { TooltipBody, TooltipPanel, useTooltipViewportClamp } from "./tooltip-panel";

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
  const { ref, flip, dx } = useTooltipViewportClamp(8, keywordId);

  const def = keywordDefinitions[keywordId];
  const Icon = keywordIcons[keywordId];
  if (!def) return keywordId;

  const tag = (
    <span
      className={cn(
        "inline-flex items-baseline gap-1 text-sm leading-none font-semibold",
        def.colorClass,
        pill && "character-keyword-pill-tint rounded-full px-3 py-1 text-xs",
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
      <TooltipPanel
        ref={ref}
        flip={flip}
        style={dx !== 0 ? { marginLeft: dx } : undefined}
        className="pointer-events-none opacity-0 group-hover/keyword:opacity-100"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <KeywordTag keywordId={keywordId} showIcon />
        </span>
        <TooltipBody>{def.description}</TooltipBody>
      </TooltipPanel>
    </span>
  );
}
