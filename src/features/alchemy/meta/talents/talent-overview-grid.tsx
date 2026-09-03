import { memo, useMemo } from "react";

import { chunkIntoRows, keywordDefinitions, talentArt, type KeywordId } from "@/lib/game-data";
import { cn } from "@/lib/utils";
import { cardInteractiveGlowClass, cardSurfaceClass } from "../../shared/config";

import { Surface } from "../../shared/ui/surface";
import { useInteractiveCard } from "../../shared/ui/use-interactive-card";

const OVERVIEW_ROW_SIZE = 7;

interface TalentPortraitCardProps {
  keywordId: KeywordId;
  hasUnspent: boolean;
  onSelectKeyword: (keywordId: KeywordId) => void;
  onHoverKeyword?: ((keywordId: KeywordId | null) => void) | undefined;
}

const TalentPortraitCard = memo(function TalentPortraitCard({
  keywordId,
  hasUnspent,
  onSelectKeyword,
  onHoverKeyword,
}: TalentPortraitCardProps) {
  const definition = keywordDefinitions[keywordId];
  const art = talentArt[keywordId];

  const { onHoverStart, onHoverEnd, shimmerActive, shimmerToken } = useInteractiveCard("talent-overview", keywordId);

  if (!definition || !art) return null;

  return (
    <div className="relative flex flex-col items-center">
      <button
        type="button"
        aria-label={`Select ${definition.label} Talents`}
        onMouseEnter={() => {
          onHoverStart();
          onHoverKeyword?.(keywordId);
        }}
        onMouseLeave={() => {
          onHoverEnd();
          onHoverKeyword?.(null);
        }}
        onFocus={() => {
          onHoverStart();
          onHoverKeyword?.(keywordId);
        }}
        onBlur={() => {
          onHoverEnd();
          onHoverKeyword?.(null);
        }}
        onClick={() => {
          onSelectKeyword(keywordId);
        }}
        className="group relative flex cursor-pointer flex-col items-center focus:outline-none"
      >
        <Surface
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
        </Surface>

        <div className="mt-1.5 flex max-w-full items-center justify-center gap-2.5">
          <span className="truncate text-center font-sans text-base font-bold tracking-wide text-foreground/90 transition-colors group-hover:text-amber-300 sm:text-lg">
            {definition.label}
          </span>
          {hasUnspent ? (
            <span className="pointer-events-none h-2 w-2 shrink-0 rounded-full bg-red-500/70 select-none" />
          ) : null}
        </div>
      </button>
    </div>
  );
});

export interface TalentOverviewGridProps {
  keywordIds: KeywordId[];
  unspentByKeyword: ReadonlyMap<KeywordId, boolean>;
  onSelectKeyword: (keywordId: KeywordId) => void;
  onHoverKeyword?: ((keywordId: KeywordId | null) => void) | undefined;
}

export function TalentOverviewGrid({
  keywordIds,
  unspentByKeyword,
  onSelectKeyword,
  onHoverKeyword,
}: TalentOverviewGridProps) {
  const rows = useMemo(() => chunkIntoRows(keywordIds, OVERVIEW_ROW_SIZE), [keywordIds]);

  return (
    <div className="flex w-full flex-col items-center justify-center gap-y-3 sm:gap-y-3.5">
      {rows.map((rowKeywords, rowIndex) => (
        <div key={rowIndex} className="flex flex-wrap items-center justify-center gap-3 sm:gap-3.5 md:gap-4">
          {rowKeywords.map((kw) => (
            <TalentPortraitCard
              key={kw}
              keywordId={kw}
              hasUnspent={unspentByKeyword.get(kw) ?? false}
              onSelectKeyword={onSelectKeyword}
              onHoverKeyword={onHoverKeyword}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
