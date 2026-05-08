// Talent UI widgets for selecting pending unlocks and reviewing unlocked nodes.
import { useState, useEffect, Fragment } from "react";
import type { KeywordId } from "@/lib/game-data";
import { keywordDefinitions } from "@/lib/game-data";
import { cn } from "@/lib/utils";
import { KeywordTag } from "./keyword-tag";
import { tokenizeDescription } from "../utils";
import type { TalentDefinition } from "../talent-pool";

const keywordBorderClasses: Record<KeywordId, string> = {
  physical: "border-slate-300",
  stun: "border-amber-300",
  block: "border-sky-300",
  forge: "border-yellow-300",
  armor: "border-yellow-200",
  health: "border-rose-400",
  burn: "border-orange-400",
  gold: "border-yellow-300",
  holy: "border-amber-200",
  wish: "border-fuchsia-300",
  ailment: "border-violet-300",
  consume: "border-zinc-300",
  poison: "border-lime-300",
  bleed: "border-red-400",
  leech: "border-pink-300",
  freeze: "border-cyan-300",
  mana: "border-sky-400",
  nature: "border-green-700",
  companion: "border-[#a36a32]",
  trap: "border-stone-300",
};

function renderDescription(description: string) {
  const parts = tokenizeDescription(description);
  return parts.map((part, i) => {
    if (part.keywordId) {
      return (
        <span key={i} className={keywordDefinitions[part.keywordId]?.colorClass}>
          {part.text}
        </span>
      );
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
                const borderClass = keywordBorderClasses[talent.keywordId] ?? "border-border/60";

                if (isUnlocked) {
                  return (
                    <div key={talent.id}
                      className={cn(
                        "flex w-[155px] items-center justify-center rounded-[12px] border bg-black px-3 py-3 text-sm font-semibold leading-snug min-h-[5rem] text-center",
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
                        "talent-choice-pending flex w-[155px] items-center justify-center rounded-[12px] border bg-black px-3 py-3 text-sm font-semibold leading-snug min-h-[5rem] text-center transition-all",
                        borderClass,
                      )}
                    >
                      <span className="animate-unlock-text-pulse text-amber-300">
                        Unlock Talent
                      </span>
                    </button>
                  );
                }

                return (
                  <div key={talent.id}
                    className={cn(
                      "flex w-[155px] items-center justify-center rounded-[12px] border border-dashed px-3 py-3 text-sm font-semibold leading-snug min-h-[5rem] text-center",
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
  return (
    <button
      type="button"
      className={cn(
        "relative rounded-full border px-3 py-1.5 text-sm font-semibold inline-flex items-center gap-1.5 transition-transform active:scale-95",
        isSelected
          ? "border-primary bg-primary/20 text-primary"
          : "border-border/80 bg-card text-foreground",
        hasUnspent && "shadow-[0_0_6px_2px_rgba(251,191,36,0.15)]",
      )}
      onClick={onClick}
    >
      <KeywordTag keywordId={keywordId} />
      {hasUnspent ? <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-400/40 ring-1 ring-background" /> : null}
    </button>
  );
}
