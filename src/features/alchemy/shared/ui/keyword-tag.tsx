import { Fragment } from "react";
import type { KeywordId } from "@/lib/game-data";
import { keywordDefinitions } from "@/features/alchemy/shared/config/game-data-catalog";
import { ShineBorder } from "@/components/ui/shine-border";
import { useReducedMotionPreference } from "@/components/ui/use-reduced-motion-preference";
import { cn } from "@/lib/utils";

import { getPlasmaColorPair, getKeywordShineColors, keywordIcons, tooltipHeaderClass } from "../config";
import { tokenizeDescription } from "../utils/string";
import { PortaledTooltip } from "./tooltips/portaled-tooltip";
import { TooltipBody } from "./tooltips/tooltip-panel";
import { useHoverVisible } from "./use-hover-visible";

export interface KeywordTagProps {
  keywordId: KeywordId;
  pill?: boolean;
  choice?: boolean;
  showIcon?: boolean;
  className?: string;
  showTooltip?: boolean;
  onSelect?: () => void;
  disabled?: boolean;
  selected?: boolean;
}

export function KeywordTag({
  keywordId,
  pill = false,
  choice = false,
  showIcon = true,
  className,
  showTooltip = false,
  onSelect,
  disabled = false,
  selected,
}: KeywordTagProps) {
  const { triggerRef, visible, onMouseEnter, onMouseLeave, onFocusCapture, onBlurCapture } =
    useHoverVisible<HTMLButtonElement>();

  const reducedMotion = useReducedMotionPreference();
  const def = keywordDefinitions[keywordId];
  const Icon = keywordIcons[keywordId];
  if (!def) return keywordId;

  const tag = (
    <span
      className={cn(
        "inline-flex items-baseline gap-1 text-sm leading-none font-semibold",
        def.colorClass,
        pill && !choice && "character-keyword-pill-tint items-center rounded-full px-2.5 py-1 text-xs",
        choice && "items-center gap-3 px-6 py-4 text-lg",
        className,
      )}
    >
      {showIcon ? (
        <Icon
          strokeWidth={2.5}
          className={cn(
            "relative top-[0.15em] h-[1em] w-[1em] shrink-0",
            pill && "top-0 h-3 w-3",
            choice && "top-0 h-6 w-6",
          )}
          aria-hidden="true"
        />
      ) : null}
      {def.label}
    </span>
  );

  if (!showTooltip && !onSelect) return tag;

  return (
    <button
      ref={triggerRef}
      type="button"
      className={cn(
        "relative inline-flex items-center",
        (pill || choice) && "rounded-full",
        choice && ["transmutation-keyword-choice", def.colorClass],
        selected && !choice && "ring-2 ring-current",
      )}
      aria-label={onSelect ? `Choose ${def.label}` : `Inspect ${def.label} keyword`}
      aria-pressed={onSelect ? selected : undefined}
      disabled={disabled}
      onClick={onSelect}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocusCapture={onFocusCapture}
      onBlurCapture={onBlurCapture}
    >
      <span className={onSelect ? undefined : "cursor-help"}>{tag}</span>
      {choice && selected && !reducedMotion ? (
        <ShineBorder shineColor={getKeywordShineColors(keywordId)} borderWidth={2} duration={8} />
      ) : null}
      <PortaledTooltip
        triggerRef={triggerRef}
        visible={showTooltip && visible}
        plasmaColorPair={getPlasmaColorPair([keywordId])}
      >
        <span className={cn("flex items-center gap-2", tooltipHeaderClass)}>
          <KeywordTag keywordId={keywordId} className="text-sm sm:text-base" showIcon />
        </span>
        <TooltipBody>
          {tokenizeDescription(def.description).map((part, index) =>
            part.keywordId ? (
              <span key={index} className={cn(keywordDefinitions[part.keywordId]?.colorClass, "font-semibold")}>
                {part.text}
              </span>
            ) : (
              <Fragment key={index}>{part.text}</Fragment>
            ),
          )}
        </TooltipBody>
      </PortaledTooltip>
    </button>
  );
}
