import { createElement, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { Lock } from "lucide-react";

import { ShineBorder } from "@/components/ui/shine-border";
import {
  cardInteractiveGlowClass,
  cardShineFrameClass,
  getKeywordShineColors,
  getTalentIcon,
} from "@/features/alchemy/shared/config";
import { TALENT_UNLOCK_ANIMATION_MS } from "@/lib/game-constants";
import { keywordDefinitions, isTalentPlaceholder, TALENT_ROW_SIZES } from "@/lib/game-data";
import type { TalentDefinition } from "@/lib/game-data";
import { cn } from "@/lib/utils";
import { renderColoredKeywords } from "../../shared/ui/card-description-ui";
import { TalentUnlockBurst } from "./talent-unlock-burst";
import { chunkIntoRows } from "./talent-layout";

export interface TalentLayoutProps {
  allTalents: TalentDefinition[];
  unlockedIds: string[];

  allocatableIds: Set<string>;
  hasUnspentPoints: boolean;
  onUnlock?: ((talentId: string) => void) | undefined;
  onUnlockBegin?: ((talentId: string) => void) | undefined;
  onHoverTalent?: ((talent: TalentDefinition | null) => void) | undefined;
}

function chunkRows(talents: TalentDefinition[]): TalentDefinition[][] {
  return chunkIntoRows(talents, TALENT_ROW_SIZES);
}

function TalentCard({
  talent,
  isUnlocked,
  isAllocatable,
  canAfford,
  isUnlocking,
  onUnlock,
  onHoverTalent,
}: {
  talent: TalentDefinition;
  isUnlocked: boolean;
  isAllocatable: boolean;
  canAfford: boolean;
  isUnlocking: boolean;
  onUnlock: ((talentId: string) => void) | undefined;
  onHoverTalent?: ((talent: TalentDefinition | null) => void) | undefined;
}) {
  const def = keywordDefinitions[talent.keywordId];
  const shineColors = getKeywordShineColors(talent.keywordId);
  const accentColor = shineColors[0];
  const isPlaceholder = isTalentPlaceholder(talent);
  const interactive = isAllocatable && canAfford && !isUnlocking;
  const showShine = interactive;
  const isLockedLook = !isUnlocked && !interactive && !isUnlocking;

  const style = accentColor ? ({ "--talent-accent": accentColor } as CSSProperties) : undefined;

  return (
    <div
      role={interactive ? "button" : undefined}
      onClick={interactive ? () => onUnlock?.(talent.id) : undefined}
      onMouseEnter={() => onHoverTalent?.(talent)}
      onMouseLeave={() => onHoverTalent?.(null)}
      onFocus={() => onHoverTalent?.(talent)}
      onBlur={() => onHoverTalent?.(null)}
      className={cn(
        "talent-node relative h-[10.5rem] w-[20.5rem] shrink-0 rounded-lg bg-stone-900",
        showShine && "talent-card-available",
        !isPlaceholder && cardInteractiveGlowClass,
        !isPlaceholder && cardShineFrameClass,
        isLockedLook && "talent-hover-scale-only",
        interactive && "cursor-pointer",
      )}
      style={style}
    >
      <TalentUnlockBurst active={isUnlocking} colors={shineColors} />
      <div
        className={cn(
          "talent-card-face relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-lg border-2 px-5 py-4 text-center transition-all duration-300 ease-[var(--ease-out-expo)] outline-none select-none",
          isUnlocked || isUnlocking
            ? "talent-card-unlocked bg-stone-900"
            : isPlaceholder
              ? "talent-card-placeholder border-dashed border-border/30 bg-stone-950"
              : interactive
                ? "border-transparent bg-stone-900 shadow-[0_4px_14px_rgba(0,0,0,0.4)]"
                : "border-border/30 bg-stone-950",
        )}
      >
        <div className={cn("flex flex-col items-center justify-center gap-1.5", isLockedLook && "opacity-50")}>
          <div className="flex items-center justify-center gap-2">
            <span className={cn(isPlaceholder ? "text-muted-foreground" : def?.colorClass)}>
              {isPlaceholder
                ? createElement(Lock, { className: "h-7 w-7 sm:h-8 sm:w-8" })
                : createElement(getTalentIcon(talent), { className: "h-7 w-7 sm:h-8 sm:w-8" })}
            </span>
            <span
              className={cn(
                "max-w-[15rem] truncate text-xl font-bold sm:text-2xl",
                isPlaceholder ? "text-muted-foreground" : def?.colorClass,
              )}
            >
              {isPlaceholder ? "Coming Soon" : (talent.name ?? "Talent")}
            </span>
          </div>
          {isPlaceholder ? null : (
            <p className="mt-1 text-base leading-snug text-balance text-foreground/90 sm:text-lg">
              {renderColoredKeywords(talent.description)}
            </p>
          )}
        </div>
      </div>
      {showShine ? (
        <ShineBorder shineColor={shineColors} borderWidth={2} duration={8} className="z-10 rounded-lg" />
      ) : null}
    </div>
  );
}

export function TalentTree({
  allTalents,
  unlockedIds,
  allocatableIds,
  hasUnspentPoints,
  onUnlock,
  onUnlockBegin,
  onHoverTalent,
}: TalentLayoutProps) {
  const [unlockingTalentId, setUnlockingTalentId] = useState<string | null>(null);
  const unlockTimerRef = useRef<number | null>(null);
  const unlockingTalentIdRef = useRef<string | null>(null);
  const rows = useMemo(() => chunkRows(allTalents), [allTalents]);

  useEffect(() => {
    return () => {
      unlockingTalentIdRef.current = null;
      if (unlockTimerRef.current !== null) {
        window.clearTimeout(unlockTimerRef.current);
      }
    };
  }, []);

  const handleUnlock = useCallback(
    (talentId: string) => {
      if (!onUnlock) return;
      if (!hasUnspentPoints) return;
      if (unlockedIds.includes(talentId) || !allocatableIds.has(talentId)) return;
      if (unlockingTalentIdRef.current === talentId) return;

      unlockingTalentIdRef.current = talentId;
      onUnlockBegin?.(talentId);
      setUnlockingTalentId(talentId);
      onUnlock(talentId);

      if (unlockTimerRef.current !== null) {
        window.clearTimeout(unlockTimerRef.current);
      }
      unlockTimerRef.current = window.setTimeout(() => {
        unlockingTalentIdRef.current = null;
        setUnlockingTalentId(null);
        unlockTimerRef.current = null;
      }, TALENT_UNLOCK_ANIMATION_MS);
    },
    [allocatableIds, hasUnspentPoints, onUnlock, onUnlockBegin, unlockedIds],
  );

  if (allTalents.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No talents available.</p>;
  }

  return (
    <div className="mx-auto flex w-full flex-col items-center gap-3.5 sm:gap-4">
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="flex items-center justify-center gap-3.5 sm:gap-4">
          {row.map((talent) => {
            if (!talent) return null;
            return (
              <TalentCard
                key={talent.id}
                talent={talent}
                isUnlocked={unlockedIds.includes(talent.id)}
                isAllocatable={allocatableIds.has(talent.id)}
                canAfford={hasUnspentPoints}
                isUnlocking={unlockingTalentId === talent.id}
                onUnlock={handleUnlock}
                onHoverTalent={onHoverTalent}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
