// Interactive talent grid — stacked rows of [1, 2, 3, 4] rectangular nodes in pool order.
// A row unlocks once every real talent in the rows above it is unlocked; any real
// talent on an unlocked row can be allocated with an unspent point. Placeholder
// nodes render as inert "Coming Soon" cards and never participate in progression.
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { Lock } from "lucide-react";

import { ShineBorder } from "@/components/ui/shine-border";
import { getKeywordShineColors, keywordIcons } from "@/features/alchemy/shared/config";
import { TALENT_UNLOCK_ANIMATION_MS } from "@/lib/game-constants";
import { keywordDefinitions, isTalentPlaceholder } from "@/lib/game-data";
import type { TalentDefinition } from "@/lib/game-data";
import { delay } from "@/lib/animation/game-timer";
import { cn } from "@/lib/utils";
import { tokenizeDescription } from "../../shared/utils";
import { PressableSound } from "../../shared/ui/pressable-sound";
import { TalentUnlockBurst } from "./talent-unlock-burst";

const ROW_SIZES = [1, 2, 3, 4] as const;

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
  for (const size of ROW_SIZES) {
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
        "talent-node relative w-full min-w-64 rounded-lg",
        showShine && "talent-card-available",
        interactive && "cursor-pointer",
        isAllocatable && !canAfford && "opacity-60",
        !isAllocatable && !isUnlocked && "opacity-40",
      )}
      style={style}
      aria-label={ariaLabel}
    >
      {showShine ? <ShineBorder shineColor={shineColors} borderWidth={2} duration={8} className="rounded-lg" /> : null}
      <TalentUnlockBurst active={isUnlocking} colors={shineColors} />
      <div
        className={cn(
          "talent-card-face relative flex min-h-44 w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border-2 px-4 py-3.5 text-center transition-[border-color] duration-500 ease-[var(--ease-out-expo)] outline-none select-none",
          interactive && "border-transparent",
          (isUnlocked || isUnlocking) && "talent-card-unlocked",
          isPlaceholder && "talent-card-placeholder",
          !showShine && !isUnlocked && !isPlaceholder && "border-border/60",
        )}
      >
        <div className="flex items-center justify-center gap-2">
          <span className={cn(isPlaceholder ? "text-muted-foreground" : def?.colorClass)}>
            {isPlaceholder ? <Lock className="h-8 w-8" /> : <Icon className="h-8 w-8" />}
          </span>
          <span className={cn("text-2xl font-bold", isPlaceholder ? "text-muted-foreground" : def?.colorClass)}>
            {isPlaceholder ? "Coming Soon" : (talent.name ?? "Talent")}
          </span>
        </div>
        {isPlaceholder ? null : (
          <p className="text-lg leading-snug text-foreground/90">
            <TalentDescription description={talent.description} />
          </p>
        )}
      </div>
    </div>
  );

  return (
    <PressableSound className="flex w-full" hoverSound={interactive ? "buttonHover" : false}>
      {card}
    </PressableSound>
  );
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
  const rows = useMemo(() => chunkRows(allTalents), [allTalents]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleUnlock = useCallback(
    async (talentId: string) => {
      if (!onUnlock || unlockingTalentId) return;

      onUnlockBegin?.(talentId);
      setUnlockingTalentId(talentId);
      onUnlock(talentId);

      await delay(TALENT_UNLOCK_ANIMATION_MS);
      if (!mountedRef.current) return;
      setUnlockingTalentId(null);
    },
    [onUnlock, onUnlockBegin, unlockingTalentId],
  );

  if (allTalents.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No talents available.</p>;
  }

  return (
    <div className="mx-auto flex w-full flex-col gap-4 px-2">
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="flex w-full items-stretch justify-center gap-4">
          {row.map((talent) => {
            if (!talent) return null;
            return (
              <div key={talent.id} className={cn("flex flex-1", row.length === 1 && "max-w-2xl")}>
                <TalentCard
                  talent={talent}
                  isUnlocked={unlockedIds.includes(talent.id)}
                  isAllocatable={allocatableIds.has(talent.id)}
                  canAfford={hasUnspentPoints}
                  isUnlocking={unlockingTalentId === talent.id}
                  onUnlock={() => void handleUnlock(talent.id)}
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
