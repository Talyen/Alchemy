// Talent Overview Grid — keyword portrait tiles with unspent-point dots and tree navigation.
import { memo, useMemo } from "react";

import {
  countImplementedTalents,
  getTalentKeywordProgress,
  keywordDefinitions,
  talentArt,
  type KeywordId,
  type TalentXP,
  type UnlockedTalents,
} from "@/lib/game-data";
import { cn } from "@/lib/utils";
import { cardInteractiveGlowClass, cardSurfaceClass } from "../../shared/config";

import { TiltSurface } from "../../shared/ui/tilt-surface";
import { useInteractiveCard } from "../../shared/ui/use-interactive-card";

const OVERVIEW_ROW_SIZE = 7;

interface TalentPortraitCardProps {
  keywordId: KeywordId;
  talentXP: TalentXP;
  unlockedTalents: UnlockedTalents;
  onSelectKeyword: (keywordId: KeywordId) => void;
}

const TalentPortraitCard = memo(function TalentPortraitCard({
  keywordId,
  talentXP,
  unlockedTalents,
  onSelectKeyword,
}: TalentPortraitCardProps) {
  const definition = keywordDefinitions[keywordId];
  const art = talentArt[keywordId];
  const unlockedCount = (unlockedTalents[keywordId] ?? []).length;
  const progress = getTalentKeywordProgress(
    talentXP[keywordId] ?? 0,
    unlockedCount,
    countImplementedTalents(keywordId),
  );

  const { onHoverStart, onHoverEnd, shimmerActive, shimmerToken } = useInteractiveCard("talent-overview", keywordId);

  if (!definition || !art) return null;

  return (
    <div className="relative flex flex-col items-center">
      <button
        type="button"
        aria-label={`Select ${definition.label} Talents`}
        onMouseEnter={onHoverStart}
        onMouseLeave={onHoverEnd}
        onFocus={onHoverStart}
        onBlur={onHoverEnd}
        onClick={() => {
          onSelectKeyword(keywordId);
        }}
        className="group relative flex cursor-pointer flex-col items-center focus:outline-none"
      >
        <TiltSurface
          as="div"
          shimmerActive={shimmerActive}
          shimmerToken={shimmerToken}
          shimmerRounded="rounded-shell-hero"
          className={cn(
            cardSurfaceClass,
            "aspect-[3/4] w-[clamp(13cqh,15.2cqh,19.5cqh)] max-w-44 border border-border/80 shadow-md",
            cardInteractiveGlowClass,
          )}
        >
          <img
            src={art}
            alt={definition.label}
            className="pointer-events-none h-full w-full rounded-shell-hero object-cover select-none"
            draggable={false}
          />
        </TiltSurface>

        <div className="mt-1.5 flex max-w-full items-center justify-center gap-2.5">
          <span className="truncate text-center font-sans text-base font-bold tracking-wide text-foreground/90 transition-colors group-hover:text-amber-300 group-focus:text-amber-300 sm:text-lg">
            {definition.label}
          </span>
          {progress.hasUnspent ? (
            <span
              className="pointer-events-none h-2 w-2 shrink-0 rounded-full bg-red-500/70 select-none"
              aria-label="Unspent talent points available"
            />
          ) : null}
        </div>
      </button>
    </div>
  );
});

export interface TalentOverviewGridProps {
  keywordIds: KeywordId[];
  talentXP: TalentXP;
  unlockedTalents: UnlockedTalents;
  onSelectKeyword: (keywordId: KeywordId) => void;
}

function layoutKeywordRows(keywordIds: KeywordId[]): KeywordId[][] {
  const rows: KeywordId[][] = [];
  for (let i = 0; i < keywordIds.length; i += OVERVIEW_ROW_SIZE) {
    rows.push(keywordIds.slice(i, i + OVERVIEW_ROW_SIZE));
  }
  return rows;
}

export function TalentOverviewGrid({
  keywordIds,
  talentXP,
  unlockedTalents,
  onSelectKeyword,
}: TalentOverviewGridProps) {
  const rows = useMemo(() => layoutKeywordRows(keywordIds), [keywordIds]);

  return (
    <div className="flex w-full flex-col items-center justify-center gap-y-3 sm:gap-y-3.5">
      {rows.map((rowKeywords, rowIndex) => (
        <div key={rowIndex} className="flex flex-wrap items-center justify-center gap-3 sm:gap-3.5 md:gap-4">
          {rowKeywords.map((kw) => (
            <TalentPortraitCard
              key={kw}
              keywordId={kw}
              talentXP={talentXP}
              unlockedTalents={unlockedTalents}
              onSelectKeyword={onSelectKeyword}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
