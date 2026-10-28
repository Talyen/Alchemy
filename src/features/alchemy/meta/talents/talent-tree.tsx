import { useGameTranslation } from "@/components/use-game-translation";

import { createElement, memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { ShineBorder } from "@/components/ui/shine-border";
import {
  cardInteractiveGlowClass,
  cardShineFrameClass,
  getKeywordShineColors,
  getTalentIcon,
} from "@/features/alchemy/shared/config";
import { TALENT_UNLOCK_ANIMATION_MS } from "@/lib/game-constants";
import { keywordDefinitions, TALENT_ROW_SIZES, chunkIntoRows } from "@/lib/game-data";
import type { TalentDefinition } from "@/lib/game-data";
import { cn } from "@/lib/utils";
import { renderColoredKeywords } from "../../shared/ui/cards/card-description-ui";
import { TalentUnlockBurst } from "./talent-unlock-burst";

export interface TalentTreeProps {
  allTalents: TalentDefinition[];
  unlockedIds: string[];

  allocatableIds: Set<string>;
  hasUnspentPoints: boolean;
  onUnlock?: ((talentId: string) => void) | undefined;
  onUnlockBegin?: ((talentId: string) => void) | undefined;
  onHoverTalent?: ((talent: TalentDefinition | null) => void) | undefined;
  className?: string | undefined;
}

const TalentCard = memo(function TalentCard({
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
  const i18n = useGameTranslation();
  const def = keywordDefinitions[talent.keywordId];
  const shineColors = getKeywordShineColors(talent.keywordId);
  const accentColor = shineColors[0];
  const interactive = isAllocatable && canAfford && !isUnlocking;
  const showShine = interactive;
  const isLockedLook = !isUnlocked && !interactive && !isUnlocking;

  const style = accentColor ? ({ "--talent-accent": accentColor } as CSSProperties) : undefined;

  return (
    <button
      type="button"
      aria-disabled={!interactive}
      onClick={interactive ? () => onUnlock?.(talent.id) : undefined}
      onMouseEnter={() => {
        onHoverTalent?.(talent);
      }}
      onMouseLeave={() => {
        onHoverTalent?.(null);
      }}
      onFocus={() => {
        onHoverTalent?.(talent);
      }}
      onBlur={() => {
        onHoverTalent?.(null);
      }}
      className={cn(
        "talent-node relative flex min-h-[calc(10.5*var(--content-rem,1rem))] w-[calc(20.5*var(--content-rem,1rem))] shrink-0 rounded-lg bg-stone-900",
        showShine && "talent-card-available",
        cardInteractiveGlowClass,
        cardShineFrameClass,
        isLockedLook && "talent-hover-scale-only",
        interactive && "cursor-pointer",
      )}
      style={style}
    >
      <span className="sr-only">
        {i18n.displayText(
          isUnlocked
            ? i18n.text("ui.talent-tree.d1", "Unlocked")
            : isUnlocking
              ? i18n.text("ui.talent-tree.d2", "Unlocking")
              : interactive
                ? i18n.text("ui.talent-tree.d3", "Available to unlock")
                : i18n.text("ui.talent-tree.d4", "Locked"),
        )}
      </span>
      <TalentUnlockBurst active={isUnlocking} colors={shineColors} />
      <div
        className={cn(
          "talent-card-face relative flex w-full flex-1 flex-col items-center justify-center overflow-hidden rounded-lg border-2 px-5 py-4 text-center transition-all duration-300 ease-[var(--ease-out-expo)] outline-none select-none",
          isUnlocked || isUnlocking
            ? "talent-card-unlocked bg-stone-900"
            : interactive
              ? "border-transparent bg-stone-950 shadow-[0_4px_14px_rgba(0,0,0,0.4)]"
              : "border-border/30 bg-stone-950",
        )}
      >
        <div
          className={cn(
            "flex flex-col items-center justify-center gap-1.5",
            isLockedLook ? "opacity-50" : interactive ? "opacity-80" : undefined,
          )}
        >
          <div className="flex max-w-full items-center justify-center gap-2">
            <span className={cn("shrink-0", def?.colorClass)}>
              {i18n.displayText(createElement(getTalentIcon(talent), { className: "h-7 w-7 sm:h-8 sm:w-8" }))}
            </span>
            <span
              className={cn(
                "max-w-[calc(15*var(--content-rem,1rem))] min-w-0 text-xl leading-tight font-bold [overflow-wrap:anywhere] hyphens-auto sm:text-2xl",
                def?.colorClass,
              )}
            >
              {i18n.displayText(talent.name ?? "Talent")}
            </span>
          </div>
          <p className="mt-1 text-base leading-snug text-balance text-foreground/90 sm:text-lg">
            {i18n.displayText(i18n.read(() => renderColoredKeywords(talent.description)))}
          </p>
        </div>
      </div>
      {showShine ? (
        <ShineBorder shineColor={shineColors} borderWidth={2} duration={8} className="z-10 rounded-lg" />
      ) : null}
    </button>
  );
});

export function TalentTree({
  allTalents,
  unlockedIds,
  allocatableIds,
  hasUnspentPoints,
  onUnlock,
  onUnlockBegin,
  onHoverTalent,
  className,
}: TalentTreeProps) {
  const i18n = useGameTranslation();
  const [unlockingTalentId, setUnlockingTalentId] = useState<string | null>(null);
  const unlockTimerRef = useRef<number | null>(null);
  const unlockingTalentIdRef = useRef<string | null>(null);
  const rows = useMemo(() => chunkIntoRows(allTalents, TALENT_ROW_SIZES), [allTalents]);
  const unlockedSet = useMemo(() => new Set(unlockedIds), [unlockedIds]);

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
      if (unlockedSet.has(talentId) || !allocatableIds.has(talentId)) return;
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
    [allocatableIds, hasUnspentPoints, onUnlock, onUnlockBegin, unlockedSet],
  );

  if (allTalents.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        {i18n.text("ui.talent-tree.1", "No talents available.")}
      </p>
    );
  }

  return (
    <div className={cn("mx-auto flex w-full flex-col items-center gap-3.5 sm:gap-4", className)}>
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="flex items-stretch justify-center gap-3.5 sm:gap-4">
          {row.map((talent) => {
            if (!talent) return null;
            return (
              <TalentCard
                key={talent.id}
                talent={talent}
                isUnlocked={unlockedSet.has(talent.id)}
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
