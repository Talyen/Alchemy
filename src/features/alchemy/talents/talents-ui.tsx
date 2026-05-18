// Talent UI primitives — keyword progress card, talent counter display.
// Depends on game-data keywords, shine-border, and keyword-tag components.
import { type KeywordId, keywordDefinitions } from "@/lib/game-data";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
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
    <motion.span
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 15 }}
    >
      <button
        type="button"
        className={cn(
          "relative rounded-full border px-3 py-1.5 text-sm font-semibold inline-flex items-center gap-1.5",
          isSelected ? "border-primary bg-primary/20 text-primary" : "border-border/80 bg-card text-foreground",
        )}
        onClick={onClick}
      >
        {hasUnspent && (
          <ShineBorder shineColor={shineColors} borderWidth={1} duration={8} className="rounded-full z-10" />
        )}
        <KeywordTag keywordId={keywordId} />
      </button>
    </motion.span>
  );
}
