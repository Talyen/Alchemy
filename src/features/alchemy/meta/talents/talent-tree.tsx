// Interactive talent grid — stacked rows of [1, 2, 3, 4] rectangular nodes in pool order.
// A row unlocks once every real talent in the rows above it is unlocked; any real
// talent on an unlocked row can be allocated with an unspent point. Placeholder
// nodes render as inert "Coming Soon" cards and never participate in progression.
import { Fragment, useCallback, useMemo, useState, type CSSProperties } from "react";

import { Lock } from "lucide-react";
import { keywordDefinitions, isTalentPlaceholder } from "@/lib/game-data";
import { cn } from "@/lib/utils";
import type { TalentDefinition } from "@/lib/game-data";
import { getKeywordShineColors, keywordIcons } from "@/features/alchemy/shared/config";
import { tokenizeDescription } from "../../shared/utils";
import { PressableSound } from "../../shared/ui/pressable-sound";
import { TALENT_UNLOCK_ANIMATION_MS, TALENT_UNLOCK_SETTLE_MS } from "@/lib/game-constants";
import { delay } from "@/lib/animation/game-timer";

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
  isSettling,
  onUnlock,
}: {
  talent: TalentDefinition;
  isUnlocked: boolean;
  isAllocatable: boolean;
  canAfford: boolean;
  isUnlocking: boolean;
  isSettling: boolean;
  onUnlock: ((talentId: string) => void) | undefined;
}) {
  const def = keywordDefinitions[talent.keywordId];
  const accentColor = getKeywordShineColors(talent.keywordId)[0];
  const Icon = talent.icon ?? keywordIcons[talent.keywordId];
  const isPlaceholder = isTalentPlaceholder(talent);
  const interactive = isAllocatable && canAfford && !isUnlocking;

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

  const className = cn(
    "relative flex w-full flex-col gap-1 rounded-lg border-2 px-3 py-2.5 text-left transition-[filter,box-shadow,border-color] duration-200 outline-none select-none",
    interactive && "talent-card-available cursor-pointer hover:brightness-110 active:brightness-95",
    isUnlocking && "talent-node-unlocking",
    isSettling && "talent-node-unlocked-settle",
    isUnlocked && "talent-card-unlocked",
    isPlaceholder && "talent-card-placeholder",
    !interactive && !isUnlocked && !isPlaceholder && "border-border/60",
    isAllocatable && !canAfford && "opacity-60",
    !isAllocatable && !isUnlocked && !isPlaceholder && "opacity-40",
  );

  const style = accentColor ? ({ "--talent-accent": accentColor } as CSSProperties) : undefined;

  const card = (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? () => onUnlock?.(talent.id) : undefined}
      onKeyDown={handleKeyDown}
      className={className}
      style={style}
      aria-label={ariaLabel}
    >
      <div className="flex items-center gap-2">
        <span className={cn(isPlaceholder ? "text-muted-foreground" : def?.colorClass)}>
          {isPlaceholder ? <Lock className="h-4 w-4" /> : <Icon className="h-5 w-5" />}
        </span>
        <span className={cn("text-base font-bold", isUnlocked && def?.colorClass)}>
          {isPlaceholder ? "Coming Soon" : (talent.name ?? "Talent")}
        </span>
      </div>
      {isPlaceholder ? null : (
        <p className="text-sm leading-snug text-foreground/90">
          <TalentDescription description={talent.description} />
        </p>
      )}
    </div>
  );

  return interactive ? <PressableSound className="flex w-full">{card}</PressableSound> : card;
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
  const [settlingTalentId, setSettlingTalentId] = useState<string | null>(null);
  const rows = useMemo(() => chunkRows(allTalents), [allTalents]);

  const handleUnlock = useCallback(
    async (talentId: string) => {
      if (!onUnlock || unlockingTalentId) return;

      onUnlockBegin?.(talentId);
      setUnlockingTalentId(talentId);

      await delay(TALENT_UNLOCK_ANIMATION_MS);
      onUnlock(talentId);
      setUnlockingTalentId(null);
      setSettlingTalentId(talentId);

      await delay(TALENT_UNLOCK_SETTLE_MS);
      setSettlingTalentId((current) => (current === talentId ? null : current));
    },
    [onUnlock, onUnlockBegin, unlockingTalentId],
  );

  if (allTalents.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No talents available.</p>;
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-1">
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="flex w-full items-stretch justify-center gap-3">
          {row.map((talent) => {
            if (!talent) return null;
            return (
              <div key={talent.id} className={cn("flex flex-1", row.length === 1 && "max-w-md")}>
                <TalentCard
                  talent={talent}
                  isUnlocked={unlockedIds.includes(talent.id)}
                  isAllocatable={allocatableIds.has(talent.id)}
                  canAfford={hasUnspentPoints}
                  isUnlocking={unlockingTalentId === talent.id}
                  isSettling={settlingTalentId === talent.id}
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
