// Talent UI primitives — keyword progress card, talent counter display.
// Depends on game-data keywords, shine-border, and keyword-tag components.
import { useState } from "react";
import type { KeywordId } from "@/lib/game-data";
import { cn } from "@/lib/utils";
import { ShineBorder } from "@/components/ui/shine-border";
import {
  BUTTON_HOVER_SECONDARY,
  BUTTON_HOVER_TRANSITION,
  BUTTON_PRESS,
  BUTTON_SHAPE,
  BUTTON_SURFACE_NEUTRAL,
  getKeywordShineColors,
} from "@/features/alchemy/shared/config";
import { KeywordTag } from "../../shared/ui/keyword-tag";
import { PressableSound } from "../../shared/ui/pressable-sound";

function ringClass(isSelected: boolean, hasUnspent: boolean): string {
  if (isSelected && hasUnspent) return "ring-0";
  if (isSelected) return "";
  return "ring-border/30";
}

export function TalentKeywordButton({
  keywordId,
  hasUnspent,
  isSelected,
  onClick,
}: {
  keywordId: KeywordId;
  hasUnspent: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  const shineColors = getKeywordShineColors(keywordId);
  const [isHovered, setIsHovered] = useState(false);

  const ringStyle: React.CSSProperties | undefined =
    isSelected && !hasUnspent
      ? ({ "--tw-ring-color": shineColors[0] } as React.CSSProperties)
      : !isSelected && isHovered
        ? ({ "--tw-ring-color": `${shineColors[0]}80` } as React.CSSProperties)
        : undefined;

  return (
    <PressableSound>
      <button
        type="button"
        className={cn(
          "relative inline-flex items-center gap-2 px-4 py-2.5 text-base font-semibold text-foreground transition-all duration-200",
          BUTTON_SHAPE,
          BUTTON_SURFACE_NEUTRAL,
          BUTTON_HOVER_TRANSITION,
          BUTTON_HOVER_SECONDARY,
          BUTTON_PRESS,
          "active:bg-muted active:brightness-100",
          ringClass(isSelected, hasUnspent),
        )}
        style={ringStyle}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={onClick}
      >
        {hasUnspent && (
          <ShineBorder
            shineColor={shineColors}
            borderWidth={isSelected ? 2 : 1}
            duration={8}
            className={cn(BUTTON_SHAPE, "z-10")}
          />
        )}
        <KeywordTag keywordId={keywordId} className="text-base" />
      </button>
    </PressableSound>
  );
}
