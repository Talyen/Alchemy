// Talent UI widgets for selecting pending unlocks and reviewing unlocked nodes.
import { useState, useEffect, Fragment } from "react";
import { type KeywordId, keywordDefinitions } from "@/lib/game-data";
import { cn } from "@/lib/utils";
import { ShineBorder } from "@/components/ui/shine-border";
import { KeywordTag } from "./keyword-tag";
import { KeywordToken } from "./card-ui";
import { tokenizeDescription } from "../utils";
import type { TalentDefinition } from "../talent-pool";

function renderDescription(description: string) {
  const parts = tokenizeDescription(description);
  return parts.map((part, i) => {
    if (part.keywordId) {
      return <KeywordToken key={i} keywordId={part.keywordId} matchedText={part.text} />;
    }
    return <Fragment key={i}>{part.text}</Fragment>;
  });
}

export function TalentList({
  unlockedTalents,
  allTalents,
  choices,
  onUnlock,
}: {
  unlockedTalents: TalentDefinition[];
  allTalents: TalentDefinition[];
  choices?: TalentDefinition[] | null;
  onUnlock?: (talentId: string) => void;
}) {
  const [revealingId, setRevealingId] = useState<string | null>(null);
  const unlockedIds = new Set(unlockedTalents.map((t) => t.id));
  const choiceIds = new Set(choices?.map((c) => c.id) ?? []);

  useEffect(() => {
    if (revealingId) {
      const timer = setTimeout(() => setRevealingId(null), 400);
      return () => clearTimeout(timer);
    }
  }, [revealingId]);

  function handleChoiceClick(talentId: string) {
    setRevealingId(talentId);
    onUnlock?.(talentId);
  }

  return (
    <div>
      {allTalents.length > 0 ? (
        <div className="flex flex-col items-center gap-2">
          {[[0, 1], [1, 2], [3, 3], [6, 4]].map(([start, count]) => (
            <div key={start} className="flex justify-center gap-2">
              {allTalents.slice(start, start + count).map((talent) => {
                const isUnlocked = unlockedIds.has(talent.id);
                const isChoice = choiceIds.has(talent.id);
                const borderClass = keywordDefinitions[talent.keywordId]?.borderClass ?? "border-border/60";

                if (isUnlocked) {
                  return (
                    <div key={talent.id}
                      className={cn(
                        "flex w-[186px] items-center justify-center rounded-[12px] border bg-black px-3 py-3 text-sm font-semibold leading-snug min-h-[6rem] text-center",
                        `${borderClass}/30`,
                        revealingId === talent.id && "animate-talent-reveal",
                      )}
                    >
                      <span>{renderDescription(talent.description)}</span>
                    </div>
                  );
                }

                if (isChoice) {
                  return (
                    <button key={talent.id} type="button"
                      onClick={() => handleChoiceClick(talent.id)}
                      className={cn(
                        "talent-choice-pending flex w-[186px] items-center justify-center rounded-[12px] border bg-black px-3 py-3 text-sm font-semibold leading-snug min-h-[6rem] text-center transition-all",
                        borderClass,
                      )}
                    >
                      <span className={cn("animate-unlock-text-pulse", keywordDefinitions[talent.keywordId]?.colorClass ?? "text-amber-300")}>
                        Unlock Talent
                      </span>
                    </button>
                  );
                }

                return (
                  <div key={talent.id}
                    className={cn(
                      "flex w-[186px] items-center justify-center rounded-[12px] border border-dashed px-3 py-3 text-sm font-semibold leading-snug min-h-[6rem] text-center",
                      "border-border/10 bg-black/25 text-muted-foreground/30",
                    )}
                  >
                    <span>Undiscovered</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No talents available.
        </p>
      )}
    </div>
  );
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
