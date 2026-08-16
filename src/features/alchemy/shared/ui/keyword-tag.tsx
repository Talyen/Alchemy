// Keyword label/icon renderer shared by cards, talents, characters, and status popups.
// Depends on keyword metadata, icon config, and class-name utilities.
// Keep this small so keyword visual language stays consistent across the game UI.
import type { KeywordId } from "@/lib/game-data";
import { keywordDefinitions } from "@/features/alchemy/shared/config/game-data-catalog";
import { cn } from "@/lib/utils";

import { keywordIcons, tooltipHeaderClass } from "../config";
import { PortaledTooltip } from "./portaled-tooltip";
import { TooltipBody } from "./tooltip-panel";
import { useHoverVisible } from "./use-hover-visible";

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
  const { triggerRef, visible, onMouseEnter, onMouseLeave, onFocusCapture, onBlurCapture } =
    useHoverVisible<HTMLSpanElement>();

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
    <span
      ref={triggerRef}
      className="relative inline-flex items-center"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocusCapture={onFocusCapture}
      onBlurCapture={onBlurCapture}
    >
      <span className="cursor-help">{tag}</span>
      <PortaledTooltip triggerRef={triggerRef} visible={visible}>
        <span className={cn("flex items-center gap-2", tooltipHeaderClass)}>
          <KeywordTag keywordId={keywordId} className="text-sm sm:text-base" showIcon />
        </span>
        <TooltipBody>{def.description}</TooltipBody>
      </PortaledTooltip>
    </span>
  );
}
