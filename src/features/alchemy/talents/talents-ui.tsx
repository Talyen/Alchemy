// Talent UI primitives — keyword progress card, talent counter display.
// Depends on game-data keywords, shine-border, and keyword-tag components.
import { type KeywordId, keywordDefinitions } from "@/lib/game-data";
import { cn } from "@/lib/utils";
import { ShineBorder } from "@/components/ui/shine-border";
import { KeywordTag } from "../ui/keyword-tag";
import { PressableMotion } from "../ui/pressable-motion";

function ringClass(isSelected: boolean, hasUnspent: boolean): string {
  if (isSelected && hasUnspent) return "ring-0";
  if (isSelected) return "";
  return "ring-border/30 hover:ring-border/50";
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
  const def = keywordDefinitions[keywordId];
  const shineColors = def?.shineColors ?? ["#fcd34d", "#d97706", "#fcd34d"];

  return (
    <PressableMotion>
      <button
        type="button"
        className={cn(
          "relative inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-sm font-semibold text-foreground ring-1 ring-offset-1 ring-offset-card transition-all duration-200",
          ringClass(isSelected, hasUnspent),
        )}
        style={isSelected && !hasUnspent ? ({ "--tw-ring-color": shineColors[0] } as React.CSSProperties) : undefined}
        onClick={onClick}
      >
        {hasUnspent && (
          <ShineBorder
            shineColor={shineColors}
            borderWidth={isSelected ? 3 : 1}
            duration={8}
            className="rounded-full z-10"
          />
        )}
        <KeywordTag keywordId={keywordId} />
      </button>
    </PressableMotion>
  );
}
