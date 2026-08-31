import { Fragment, useState } from "react";
import { Swords } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  characters,
  characterArt,
  difficultyConfigs,
  isDifficultyUnlocked,
  type CharacterId,
  type DifficultyId,
} from "@/lib/game-data";
import difficulty1Art from "@/assets/optimized/difficulty-1.webp";
import difficulty2Art from "@/assets/optimized/difficulty-2.webp";
import difficulty3Art from "@/assets/optimized/difficulty-3.webp";

import { KeywordToken, renderTokenizedDescription } from "../../shared/ui/card-description-ui";
import { KeywordTag } from "../../shared/ui/keyword-tag";
import { ActionButtonRow, TitledScreenShell } from "../../shared/ui/shared-ui";
import { Surface } from "../../shared/ui/surface";
import {
  cardInteractiveGlowClass,
  cardSurfaceClass,
  bodyTextClass,
  chooserHeroArtWidthClass,
  chooserHeroPaddedRowShellWidthClass,
  chooserHeroPaddedTileClass,
  chooserLockedSurfaceClass,
  chooserRowGapClass,
  sectionTitleClass,
  surfaceSelectedRingClass,
} from "@/features/alchemy/shared/config";
import { PortaledTooltip } from "../../shared/ui/portaled-tooltip";
import { TooltipBody } from "../../shared/ui/tooltip-panel";
import { useHoverVisible } from "../../shared/ui/use-hover-visible";
import { useInteractiveCard } from "../../shared/ui/use-interactive-card";

const DIFFICULTY_CONFIG = {
  XP_BONUSES: {
    "difficulty-2": "20% Bonus XP",
    "difficulty-3": "40% Bonus XP",
  } as Partial<Record<DifficultyId, string>>,
} as const;

const DIFFICULTY_ART: Record<DifficultyId, string> = {
  "difficulty-1": difficulty1Art,
  "difficulty-2": difficulty2Art,
  "difficulty-3": difficulty3Art,
};

function renderDescription(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {renderTokenizedDescription(line, {
        renderKeyword: (partText, keywordId, key) => (
          <KeywordToken key={key} keywordId={keywordId} matchedText={partText} />
        ),
        renderPlain: (partText, key) => <span key={key}>{partText}</span>,
      })}
    </Fragment>
  ));
}

function DifficultyCard({
  difficultyId,
  name,
  description,
  completed,
  locked,
  isSelected,
  onSelect,
}: {
  difficultyId: DifficultyId;
  name: string;
  description: string;
  completed: boolean;
  locked: boolean;
  isSelected: boolean;
  onSelect: (id: DifficultyId) => void;
}) {
  const bonusLine = DIFFICULTY_CONFIG.XP_BONUSES[difficultyId] ?? "";
  const fullDescription = description + (bonusLine ? "\n" + bonusLine : "");
  const showUnlockedArt = !locked;
  const diffArt = DIFFICULTY_ART[difficultyId] ?? difficulty3Art;
  const { triggerRef, visible, onMouseEnter, onMouseLeave } = useHoverVisible<HTMLDivElement>();
  const { shimmerActive, shimmerToken, onHoverStart } = useInteractiveCard("difficulty-select", difficultyId);

  return (
    <div
      ref={triggerRef}
      className={cn(chooserHeroPaddedTileClass, "flex flex-col items-center")}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <button
        type="button"
        disabled={locked}
        aria-label={name}
        aria-pressed={isSelected}
        onClick={() => onSelect(difficultyId)}
        className={cn(
          "group relative flex h-full w-full min-w-0 flex-col items-center gap-3 rounded-shell-dialog border border-border/60 bg-card/60 px-4 pt-5 pb-6 text-center shadow-md transition-all disabled:cursor-default",
          !locked && cardInteractiveGlowClass,
          locked && chooserLockedSurfaceClass,
          isSelected && surfaceSelectedRingClass,
        )}
      >
        {showUnlockedArt ? (
          <Surface
            className={cn("relative aspect-[5/6] overflow-hidden rounded-shell-panel", chooserHeroArtWidthClass)}
            shimmerActive={shimmerActive}
            shimmerToken={shimmerToken}
            shimmerRounded="rounded-shell-panel"
            onMouseEnter={onHoverStart}
          >
            <img src={diffArt} alt="" className={cn(cardSurfaceClass, "w-full rounded-shell-panel object-cover")} />
            {completed && (
              <div className="absolute top-2 right-2 rounded-md bg-emerald-600/90 px-2 py-0.5 text-xs font-bold tracking-wide text-emerald-100 uppercase">
                Completed
              </div>
            )}
          </Surface>
        ) : (
          <div className={cn("relative aspect-[5/6] overflow-hidden rounded-shell-panel", chooserHeroArtWidthClass)}>
            <img
              src={diffArt}
              alt=""
              className={cn(cardSurfaceClass, "w-full rounded-shell-panel object-cover", "grayscale")}
            />
            <div className="absolute inset-0 flex items-center justify-center rounded-shell-panel bg-black/60">
              <span className="text-sm font-bold tracking-wider text-muted-foreground uppercase">Locked</span>
            </div>
          </div>
        )}
        <p className={cn("font-sans", sectionTitleClass, locked && "text-muted-foreground")}>{name}</p>
        <div className="flex min-h-[6.67cqh] w-full flex-col justify-center">
          <div className={cn("w-full text-center", bodyTextClass)}>{renderDescription(fullDescription)}</div>
        </div>
      </button>

      {locked && (
        <PortaledTooltip triggerRef={triggerRef} visible={visible}>
          <TooltipBody>
            <p>Clear Previous Difficulty to Unlock</p>
          </TooltipBody>
        </PortaledTooltip>
      )}
    </div>
  );
}

export function DifficultySelectScreen({
  characterId,
  selectedDifficulty,
  completedDifficulties,
  onSelect,
  onBack,
  onOpenMenu,
}: {
  characterId: CharacterId;
  selectedDifficulty: DifficultyId | null;
  completedDifficulties: DifficultyId[];
  onSelect: (difficultyId: DifficultyId) => void;
  onBack: () => void;
  onOpenMenu: (rect?: DOMRect) => void;
}) {
  const [selectedDifficultyId, setSelectedDifficultyId] = useState<DifficultyId | null>(selectedDifficulty);
  const config = difficultyConfigs[characterId];
  const char = characters[characterId];
  const art = characterArt[char.id];

  const canPlay = selectedDifficultyId !== null && isDifficultyUnlocked(selectedDifficultyId, completedDifficulties);
  const characterShimmer = useInteractiveCard("difficulty-select", "character");

  function handlePlay() {
    if (canPlay) onSelect(selectedDifficultyId);
  }

  function handleSelectDifficulty(difficultyId: DifficultyId) {
    if (isDifficultyUnlocked(difficultyId, completedDifficulties)) {
      setSelectedDifficultyId(difficultyId);
    }
  }

  return (
    <TitledScreenShell
      title={config.headerTitle}
      onOpenMenu={onOpenMenu}
      menuLabel="Open difficulty select menu"
      maxWidthClass={chooserHeroPaddedRowShellWidthClass}
    >
      <div className={cn("mt-6 flex w-full flex-nowrap items-stretch justify-center", chooserRowGapClass)}>
        <div
          className={cn(
            chooserHeroPaddedTileClass,
            "flex flex-col items-center gap-3 rounded-shell-dialog border border-border/60 bg-card/60 px-4 pt-5 pb-6",
          )}
        >
          <Surface
            className={cn("relative aspect-[3/4] overflow-hidden rounded-shell-panel", chooserHeroArtWidthClass)}
            shimmerActive={characterShimmer.shimmerActive}
            shimmerToken={characterShimmer.shimmerToken}
            shimmerRounded="rounded-shell-panel"
            onMouseEnter={characterShimmer.onHoverStart}
          >
            <img
              src={art}
              alt={char.name}
              className={cn(cardSurfaceClass, "h-full w-full rounded-shell-panel object-cover")}
            />
          </Surface>
          <p className={cn("font-sans", sectionTitleClass)}>{char.name}</p>
          <div className="flex flex-wrap justify-center gap-1">
            {char.keywords.map((kw) => (
              <KeywordTag key={kw} keywordId={kw} pill showTooltip />
            ))}
          </div>
        </div>

        <div className="hidden w-4 shrink-0 flex-col items-center self-stretch lg:flex">
          <div className="w-px flex-1 bg-gradient-to-b from-transparent via-amber-100/75 to-transparent" />
          <Swords className="my-1 h-4 w-4 text-amber-100/75" />
          <div className="w-px flex-1 bg-gradient-to-b from-transparent via-amber-100/75 to-transparent" />
        </div>

        {config.difficulties.map((d) => (
          <DifficultyCard
            key={d.id}
            difficultyId={d.id}
            name={d.name}
            description={d.description}
            completed={completedDifficulties.includes(d.id)}
            locked={!isDifficultyUnlocked(d.id, completedDifficulties)}
            isSelected={selectedDifficultyId === d.id}
            onSelect={handleSelectDifficulty}
          />
        ))}
      </div>

      <ActionButtonRow
        className="mt-6"
        width="dialog"
        secondary={{ label: "Back", onClick: onBack }}
        primary={{
          label: (
            <>
              <Swords className="h-4 w-4" />
              Play
            </>
          ),
          disabled: !canPlay,
          onClick: handlePlay,
        }}
      />
    </TitledScreenShell>
  );
}
