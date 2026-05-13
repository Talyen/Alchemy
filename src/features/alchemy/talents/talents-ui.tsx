import { type KeywordId, keywordDefinitions } from "@/lib/game-data";
import { cn } from "@/lib/utils";
import { ShineBorder } from "@/components/ui/shine-border";
import { KeywordTag } from "../ui/keyword-tag";

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
    <button
      type="button"
      className={cn(
        "relative rounded-full border px-3 py-1.5 text-sm font-semibold inline-flex items-center gap-1.5 transition-transform active:scale-95",
        isSelected
          ? "border-primary bg-primary/20 text-primary"
          : "border-border/80 bg-card text-foreground",
      )}
      onClick={onClick}
    >
      {hasUnspent && (
        <ShineBorder
          shineColor={shineColors}
          borderWidth={1}
          duration={8}
          className="rounded-full z-10"
        />
      )}
      <KeywordTag keywordId={keywordId} />
    </button>
  );
}