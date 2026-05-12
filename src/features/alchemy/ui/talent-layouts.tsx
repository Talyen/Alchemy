// Talent tree layout — shine-border cards with tier dividers, animated character
// reveal, and keyword-colored interactive states.

import { useState, useEffect, Fragment } from "react";
import { motion } from "motion/react";
import type { KeywordId } from "@/lib/game-data";
import { keywordDefinitions } from "@/lib/game-data";
import { cn } from "@/lib/utils";
import { tokenizeDescription } from "../utils";
import type { TalentDefinition } from "../talent-pool";
import { ShineBorder } from "@/components/ui/shine-border";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface TalentLayoutProps {
  unlockedTalents: TalentDefinition[];
  allTalents: TalentDefinition[];
  choices: TalentDefinition[] | null;
  onUnlock?: (talentId: string) => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

const keywordBorderClasses: Record<KeywordId, string> = {
  physical: "border-slate-300",   stun: "border-amber-300",
  block: "border-sky-300",        forge: "border-yellow-300",
  armor: "border-yellow-200",     health: "border-rose-400",
  burn: "border-orange-400",      gold: "border-yellow-300",
  holy: "border-amber-200",       wish: "border-fuchsia-300",
  ailment: "border-violet-300",   consume: "border-zinc-300",
  poison: "border-lime-300",      bleed: "border-red-400",
  leech: "border-pink-300",       freeze: "border-cyan-300",
  mana: "border-sky-400",         nature: "border-green-700",
  companion: "border-[#a36a32]",  trap: "border-stone-300",
};

const keywordShineColors: Record<string, string[]> = {
  physical:   ["#cbd5e1", "#94a3b8", "#cbd5e1"],
  stun:       ["#fcd34d", "#d97706", "#fcd34d"],
  block:      ["#7dd3fc", "#0ea5e9", "#7dd3fc"],
  forge:      ["#fde047", "#ca8a04", "#fde047"],
  armor:      ["#fef08a", "#eab308", "#fef08a"],
  health:     ["#fb7185", "#e11d48", "#fb7185"],
  burn:       ["#fb923c", "#ea580c", "#fb923c"],
  gold:       ["#fde047", "#ca8a04", "#fde047"],
  holy:       ["#fde68a", "#d97706", "#fde68a"],
  wish:       ["#f0abfc", "#c026d3", "#f0abfc"],
  ailment:    ["#c4b5fd", "#7c3aed", "#c4b5fd"],
  consume:    ["#d4d4d8", "#52525b", "#d4d4d8"],
  poison:     ["#bef264", "#65a30d", "#bef264"],
  bleed:      ["#f87171", "#dc2626", "#f87171"],
  leech:      ["#f9a8d4", "#db2777", "#f9a8d4"],
  freeze:     ["#67e8f9", "#06b6d4", "#67e8f9"],
  mana:       ["#38bdf8", "#0284c7", "#38bdf8"],
  nature:     ["#4ade80", "#166534", "#4ade80"],
  companion:  ["#a36a32", "#6b4226", "#a36a32"],
  trap:       ["#d6d3d1", "#78716c", "#d6d3d1"],
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

// Animated character-by-character reveal preserving keyword color spans.
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

// ─── Shine Border Layout ────────────────────────────────────────────────────────

export function TalentLayout({ unlockedTalents, allTalents, choices, onUnlock }: TalentLayoutProps) {
  const { revealingId, setRevealingId } = useRevealState();
  const unlockedIds = new Set(unlockedTalents.map((t) => t.id));
  const choiceIds = new Set(choices?.map((c) => c.id) ?? []);
  const rows = gridRows(allTalents);
  const tierLabels = ["Beginner", "Adept", "Expert", "Master"];
  const kwColor = allTalents.length > 0
    ? (keywordShineColors[allTalents[0].keywordId]?.[0] ?? "#fcd34d")
    : "#fcd34d";

  if (allTalents.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No talents available.</p>;
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {rows.map((row, ri) => (
        <div key={ri} className="flex w-full flex-col items-center gap-2">
          <div className="flex w-full items-center gap-3" style={{ maxWidth: 320 }}>
            <div className="h-px flex-1" style={{ background: `linear-gradient(to right, transparent, ${kwColor}33, transparent)` }} />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: `${kwColor}99` }}>{tierLabels[ri]}</span>
            <div className="h-px flex-1" style={{ background: `linear-gradient(to right, transparent, ${kwColor}33, transparent)` }} />
          </div>
          <div className="flex justify-center gap-3">
            {row.map((talent) => {
              const isUnlocked = unlockedIds.has(talent.id);
              const isChoice = choiceIds.has(talent.id);
              const bColor = keywordBorderClasses[talent.keywordId] ?? "border-border/60";
              const shineColors = keywordShineColors[talent.keywordId] ?? ["#fcd34d", "#d97706", "#fcd34d"];
              const baseColor = shineColors[0];

              return (
                <div key={talent.id} className="relative">
                  {isChoice && (
                    <ShineBorder
                      shineColor={shineColors}
                      borderWidth={3}
                      duration={8}
                      className="rounded-[14px] z-10"
                    />
                  )}
                  {isUnlocked ? (
                    <div
                      className={cn(
                        "flex w-[140px] items-center justify-center rounded-[14px] border-2 px-3 py-3 text-[12px] font-bold leading-snug text-center min-h-[5rem] bg-popover text-muted-foreground",
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
                    <button type="button" onClick={() => { setRevealingId(talent.id); onUnlock?.(talent.id); }}
                      className={cn(
                        "relative flex w-[140px] cursor-pointer items-center justify-center rounded-[14px] border-2 bg-popover px-3 py-3 text-[12px] font-bold leading-snug text-center min-h-[5rem] transition-all",
                        bColor
                      )}
                      style={{ boxShadow: `0 0 18px 4px ${baseColor}40` }}
                    >
                      <span className="animate-unlock-text-pulse text-muted-foreground">Unlock Talent</span>
                    </button>
                  ) : (
                    <div className={cn(
                      "relative flex w-[140px] items-center justify-center rounded-[14px] border border-dashed px-3 py-3 text-[12px] font-bold leading-snug text-center min-h-[5rem] text-muted-foreground bg-popover",
                    )}
                      style={{ borderColor: `${baseColor}33` }}>
                      <span>Undiscovered</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
