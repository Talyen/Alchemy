// Interactive talent tree — keyword-level XP progress, unlock buttons, and reveal animations.
// Depends on game-data keywords, shared UI primitives, and talent XP math.
import { useState, useEffect, Fragment } from "react";
import { motion } from "motion/react";
import { type KeywordId, keywordDefinitions } from "@/lib/game-data";
import { cn } from "@/lib/utils";
import { tokenizeDescription } from "../utils";
import type { TalentDefinition } from "@/lib/game-data";
import { ShineBorder } from "@/components/ui/shine-border";
import { KeywordToken } from "../ui/card-ui";

export interface TalentLayoutProps {
  unlockedTalents: TalentDefinition[];
  allTalents: TalentDefinition[];
  choices: TalentDefinition[] | null;
  onUnlock?: (talentId: string) => void;
}

function renderDescription(description: string) {
  const parts = tokenizeDescription(description);
  return parts.map((part, i) => {
    if (part.keywordId) {
      return <KeywordToken key={i} keywordId={part.keywordId} matchedText={part.text} />;
    }
    return <Fragment key={i}>{part.text}</Fragment>;
  });
}

function useRevealState() {
  const [revealingId, setRevealingId] = useState<string | null>(null);
  useEffect(() => {
    if (revealingId) {
      const timer = setTimeout(() => setRevealingId(null), 1500);
      return () => clearTimeout(timer);
    }
  }, [revealingId]);
  return { revealingId, setRevealingId };
}

function gridRows(talents: TalentDefinition[]) {
  const rows: TalentDefinition[][] = [];
  let idx = 0;
  for (const size of [1, 2, 3, 4]) {
    if (idx >= talents.length) break;
    rows.push(talents.slice(idx, idx + size));
    idx += size;
  }
  return rows;
}

function AnimatedChars({ description }: { description: string }) {
  const parts = tokenizeDescription(description);
  const chars: Array<{ char: string; className: string | undefined }> = [];
  for (const part of parts) {
    const kwDef = part.keywordId ? keywordDefinitions[part.keywordId as KeywordId] : undefined;
    for (const char of part.text) {
      chars.push({ char, className: kwDef?.colorClass });
    }
  }

  return (
    <motion.span
      initial="hidden"
      animate="show"
      style={{ whiteSpace: "pre-wrap" }}
      variants={{
        hidden: { opacity: 1 },
        show: { opacity: 1, transition: { staggerChildren: 0.02 } },
      }}
    >
      {chars.map((c, i) => (
        <motion.span
          key={i}
          className={cn(c.className)}
          variants={{
            hidden: { opacity: 0, filter: "blur(8px)", scale: 1.15 },
            show: { opacity: 1, filter: "blur(0px)", scale: 1, transition: { duration: 0.2 } },
          }}
        >
          {c.char}
        </motion.span>
      ))}
    </motion.span>
  );
}

function TalentNode({
  talent,
  isUnlocked,
  isChoice,
  revealingId,
  onUnlock,
}: {
  talent: TalentDefinition;
  isUnlocked: boolean;
  isChoice: boolean;
  revealingId: string | null;
  onUnlock: ((talentId: string) => void) | undefined;
}) {
  const def = keywordDefinitions[talent.keywordId];
  const bColor = def?.borderClass ?? "border-border/60";
  const shineColors = def?.shineColors ?? ["#fcd34d", "#d97706", "#fcd34d"];
  const baseColor = shineColors[0];

  return (
    <div className="relative">
      {isChoice && (
        <ShineBorder shineColor={shineColors} borderWidth={3} duration={8} className="rounded-[14px] z-10" />
      )}
      {isUnlocked ? (
        <div
          className={cn(
            "flex w-[168px] items-center justify-center rounded-[14px] border-2 px-3 py-3 text-xs font-bold leading-snug text-center min-h-[6rem] bg-popover text-muted-foreground",
          )}
          style={{ borderColor: `${baseColor}33` }}
        >
          {revealingId === talent.id ? (
            <AnimatedChars description={talent.description} />
          ) : (
            <span>{renderDescription(talent.description)}</span>
          )}
        </div>
      ) : isChoice ? (
        <button
          type="button"
          onClick={() => {
            onUnlock?.(talent.id);
          }}
          className={cn(
            "relative flex w-[168px] cursor-pointer items-center justify-center rounded-[14px] border-2 bg-popover px-3 py-3 text-xs font-bold leading-snug text-center min-h-[6rem] transition-all",
            bColor,
          )}
          style={{ boxShadow: `0 0 18px 4px ${baseColor}40` }}
        >
          <span className="animate-unlock-text-pulse text-muted-foreground">Unlock Talent</span>
        </button>
      ) : (
        <div
          className={cn(
            "relative flex w-[168px] items-center justify-center rounded-[14px] border border-dashed px-3 py-3 text-xs font-bold leading-snug text-center min-h-[6rem] text-muted-foreground bg-popover",
          )}
          style={{ borderColor: `${baseColor}33` }}
        >
          <span>Undiscovered</span>
        </div>
      )}
    </div>
  );
}

const TIER_LABELS = ["Beginner", "Adept", "Expert", "Master"];

function TalentTierRow({
  talents,
  tierIndex,
  unlockedIds,
  choiceIds,
  revealingId,
  onUnlock,
}: {
  talents: TalentDefinition[];
  tierIndex: number;
  unlockedIds: Set<string>;
  choiceIds: Set<string>;
  revealingId: string | null;
  onUnlock: ((talentId: string) => void) | undefined;
}) {
  const kwColor =
    talents.length > 0 ? (keywordDefinitions[talents[0].keywordId]?.shineColors?.[0] ?? "#fcd34d") : "#fcd34d";

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="flex w-full items-center gap-3" style={{ maxWidth: 320 }}>
        <div
          className="h-px flex-1"
          style={{ background: `linear-gradient(to right, transparent, ${kwColor}33, transparent)` }}
        />
        <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: `${kwColor}99` }}>
          {TIER_LABELS[tierIndex]}
        </span>
        <div
          className="h-px flex-1"
          style={{ background: `linear-gradient(to right, transparent, ${kwColor}33, transparent)` }}
        />
      </div>
      <div className="flex justify-center gap-3">
        {talents.map((talent) => (
          <TalentNode
            key={talent.id}
            talent={talent}
            isUnlocked={unlockedIds.has(talent.id)}
            isChoice={choiceIds.has(talent.id)}
            revealingId={revealingId}
            onUnlock={onUnlock}
          />
        ))}
      </div>
    </div>
  );
}

export function TalentTree({ unlockedTalents, allTalents, choices, onUnlock }: TalentLayoutProps) {
  const { revealingId, setRevealingId } = useRevealState();
  const unlockedIds = new Set(unlockedTalents.map((t) => t.id));
  const choiceIds = new Set(choices?.map((c) => c.id) ?? []);
  const rows = gridRows(allTalents);

  if (allTalents.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No talents available.</p>;
  }

  function handleNodeUnlock(talentId: string) {
    setRevealingId(talentId);
    onUnlock?.(talentId);
  }

  return (
    <div className="flex flex-col items-center gap-5">
      {rows.map((row, ri) => (
        <TalentTierRow
          key={ri}
          talents={row}
          tierIndex={ri}
          unlockedIds={unlockedIds}
          choiceIds={choiceIds}
          revealingId={revealingId}
          onUnlock={handleNodeUnlock}
        />
      ))}
    </div>
  );
}
