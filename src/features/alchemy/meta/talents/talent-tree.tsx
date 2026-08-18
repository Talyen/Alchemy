// Interactive talent grid — stacked rows of [1, 2, 3, 4] rectangular nodes in pool order.
// A row unlocks once every real talent in the rows above it is unlocked; any real
// talent on an unlocked row can be allocated with an unspent point. Placeholder
// nodes render as inert "Coming Soon" cards and never participate in progression.
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { Lock } from "lucide-react";

import { ShineBorder } from "@/components/ui/shine-border";
import {
  cardInteractiveGlowClass,
  cardShineFrameClass,
  getKeywordShineColors,
  keywordIcons,
} from "@/features/alchemy/shared/config";
import { TALENT_UNLOCK_ANIMATION_MS } from "@/lib/game-constants";
import { keywordDefinitions, isTalentPlaceholder, TALENT_ROW_SIZES } from "@/lib/game-data";
import type { TalentDefinition } from "@/lib/game-data";
import { cn } from "@/lib/utils";
import { tokenizeDescription } from "../../shared/utils";
import { TalentUnlockBurst } from "./talent-unlock-burst";

export interface TalentLayoutProps {
  allTalents: TalentDefinition[];
  unlockedIds: string[];
  /** Real talents on an unlocked row that have not been allocated yet. */
  allocatableIds: Set<string>;
  hasUnspentPoints: boolean;
  onUnlock?: (talentId: string) => void;
  onUnlockBegin?: (talentId: string) => void;
}

function chunkRows(talents: TalentDefinition[]): TalentDefinition[][] {
  const rows: TalentDefinition[][] = [];
  let index = 0;
  for (const size of TALENT_ROW_SIZES) {
    rows.push(talents.slice(index, index + size));
    index += size;
  }
  return rows;
}

function TalentDescription({ description }: { description: string }) {
  const parts = tokenizeDescription(description);
  return (
    <>
      {parts.map((part, i) =>
        part.keywordId ? (
          <span key={i} className={cn(keywordDefinitions[part.keywordId]?.colorClass, "font-semibold")}>
            {part.text}
          </span>
        ) : (
          <Fragment key={i}>{part.text}</Fragment>
        ),
      )}
    </>
  );
}

function TalentCard({
  talent,
  isUnlocked,
  isAllocatable,
  canAfford,
  isUnlocking,
  onUnlock,
}: {
  talent: TalentDefinition;
  isUnlocked: boolean;
  isAllocatable: boolean;
  canAfford: boolean;
  isUnlocking: boolean;
  onUnlock: ((talentId: string) => void) | undefined;
}) {
  const def = keywordDefinitions[talent.keywordId];
  const shineColors = getKeywordShineColors(talent.keywordId);
  const accentColor = shineColors[0];
  const Icon = talent.icon ?? keywordIcons[talent.keywordId];
  const isPlaceholder = isTalentPlaceholder(talent);
  const interactive = isAllocatable && canAfford && !isUnlocking;
  const showShine = interactive;
  const isLockedLook = !isUnlocked && !interactive && !isUnlocking;

  const handleKeyDown = interactive
    ? (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onUnlock?.(talent.id);
        }
      }
    : undefined;

  const ariaLabel = interactive
    ? `Unlock talent: ${talent.name ? `${talent.name} — ` : ""}${talent.description}`
    : undefined;

  const style = accentColor ? ({ "--talent-accent": accentColor } as CSSProperties) : undefined;

  const card = (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? () => onUnlock?.(talent.id) : undefined}
      onKeyDown={handleKeyDown}
      className={cn(
        "talent-node relative h-[10.5rem] w-[20.5rem] shrink-0 rounded-lg bg-stone-900",
        showShine && "talent-card-available",
        !isPlaceholder && cardInteractiveGlowClass,
        !isPlaceholder && cardShineFrameClass,
        isLockedLook && "talent-hover-scale-only",
        interactive && "cursor-pointer",
      )}
      style={style}
      aria-label={ariaLabel}
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
              {isPlaceholder ? <Lock className="h-7 w-7 sm:h-8 sm:w-8" /> : <Icon className="h-7 w-7 sm:h-8 sm:w-8" />}
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
              <TalentDescription description={talent.description} />
            </p>
          )}
        </div>
      </div>
      {showShine ? (
        <ShineBorder shineColor={shineColors} borderWidth={2} duration={8} className="z-10 rounded-lg" />
      ) : null}
    </div>
  );

  return card;
}

export function TalentTree({
  allTalents,
  unlockedIds,
  allocatableIds,
  hasUnspentPoints,
  onUnlock,
  onUnlockBegin,
}: TalentLayoutProps) {
  const [unlockingTalentId, setUnlockingTalentId] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const unlockTimerRef = useRef<number | null>(null);
  const rows = useMemo(() => chunkRows(allTalents), [allTalents]);

  const activeUnlockingId = unlockingTalentId && unlockedIds.includes(unlockingTalentId) ? unlockingTalentId : null;

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (unlockTimerRef.current !== null) {
        window.clearTimeout(unlockTimerRef.current);
      }
    };
  }, []);

  const handleUnlock = useCallback(
    (talentId: string) => {
      if (!onUnlock || unlockingTalentId) return;

      onUnlockBegin?.(talentId);
      setUnlockingTalentId(talentId);
      onUnlock(talentId);

      if (unlockTimerRef.current !== null) {
        window.clearTimeout(unlockTimerRef.current);
      }
      unlockTimerRef.current = window.setTimeout(() => {
        if (!mountedRef.current) return;
        setUnlockingTalentId(null);
        unlockTimerRef.current = null;
      }, TALENT_UNLOCK_ANIMATION_MS);
    },
    [onUnlock, onUnlockBegin, unlockingTalentId],
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
                isUnlocking={activeUnlockingId === talent.id}
                onUnlock={handleUnlock}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
