import { useGameTranslation } from "@/components/use-game-translation";

import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { getKeywordShineColors } from "@/features/alchemy/shared/config";
import { TALENT_ROW_SIZES, chunkIntoRows } from "@/lib/game-data";
import type { TalentDefinition } from "@/lib/game-data";
import { cn } from "@/lib/utils";
import { TalentNodeFace, TALENT_NODE_UNLOCK_MS } from "./talent-node-face";

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
  const shineColors = getKeywordShineColors(talent.keywordId);
  const accentColor = shineColors[0];
  const interactive = isAllocatable && canAfford && !isUnlocking;
  const nodeState = isUnlocking ? "unlocking" : isUnlocked ? "unlocked" : interactive ? "available" : "locked";

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
        "talent-node relative flex min-h-[calc(13.5*var(--content-rem,1rem))] w-[calc(20.5*var(--content-rem,1rem))] shrink-0 rounded-lg",
        interactive && "cursor-pointer",
      )}
      style={style}
      data-node-state={nodeState}
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
      <TalentNodeFace talent={talent} title={i18n.displayText(talent.name ?? "Talent")} state={nodeState} />
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
      }, TALENT_NODE_UNLOCK_MS);
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
