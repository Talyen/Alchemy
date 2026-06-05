// Talent UI primitives — keyword progress card, talent counter display.
// Depends on game-data keywords, shine-border, and keyword-tag components.
import { useState } from "react";
import type { KeywordId } from "@/lib/game-data";
import { cn } from "@/lib/utils";
import { ShineBorder } from "@/components/ui/shine-border";
import { getKeywordShineColors } from "@/features/alchemy/shared/config";
import { KeywordTag } from "../../shared/ui/keyword-tag";
import { PressableMotion } from "../../shared/ui/pressable-motion";

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
    <PressableMotion disableHoverScale>
      <button
        type="button"
        className={cn(
          "relative inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-sm font-semibold text-foreground ring-1 ring-offset-1 ring-offset-card transition-all duration-200",
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
            className="rounded-full z-10"
          />
        )}
        <KeywordTag keywordId={keywordId} />
      </button>
    </PressableMotion>
  );
}
