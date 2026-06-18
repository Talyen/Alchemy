// Difficulty selection screen shown after choosing a hero, before the run begins.
// Depends on character game data, difficulty definitions, keyword tags, shared UI, and hover effects.
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

import { KeywordToken } from "../../shared/ui/card-description-ui";
import { KeywordTag } from "../../shared/ui/keyword-tag";
import { PressableMotion } from "../../shared/ui/pressable-motion";
import { ScreenHeader, ActionButtonRow, StaggerGroup, StaggerItem } from "../../shared/ui/shared-ui";
import { TiltSurface } from "../../shared/ui/tilt-surface";
import { tokenizeDescription } from "../../shared/utils";
import { battleCardWidthClass, cardSurfaceClass } from "@/features/alchemy/shared/config";
import { TooltipPanel } from "../../shared/ui/tooltip-panel";
import { useUiStore } from "../../shared/stores/ui-store";

const DIFFICULTY_CONFIG = {
  XP_BONUSES: {
    "difficulty-2": "20% Bonus XP",
    "difficulty-3": "40% Bonus XP",
  } as Record<string, string>,
} as const;

function renderDescription(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    const parts = tokenizeDescription(line);
    return (
      <Fragment key={i}>
        {i > 0 && <br />}
        {parts.map((part, j) =>
          part.keywordId ? (
            <KeywordToken key={j} keywordId={part.keywordId} matchedText={part.text} />
          ) : (
            <span key={j}>{part.text}</span>
          ),
        )}
      </Fragment>
    );
  });
}

function DifficultyCard({
  difficultyId,
  name,
  description,
  completed,
  locked,
  isSelected,
  isShimmer,
  shimmerToken,
  onHoverShimmer,
  onSelect,
}: {
  difficultyId: DifficultyId;
  name: string;
  description: string;
  completed: boolean;
  locked: boolean;
  isSelected: boolean;
  isShimmer: boolean;
  shimmerToken: number | undefined;
  onHoverShimmer: (id: DifficultyId) => void;
  onSelect: (id: DifficultyId) => void;
}) {
  const bonusLine = DIFFICULTY_CONFIG.XP_BONUSES[difficultyId] ?? "";
  const fullDescription = description + (bonusLine ? "\n" + bonusLine : "");
  const showTilt = !locked;
  const diffArt =
    difficultyId === "difficulty-1"
      ? difficulty1Art
      : difficultyId === "difficulty-2"
        ? difficulty2Art
        : difficulty3Art;

  return (
    <div className="relative group flex flex-col items-center">
      <PressableMotion {...(locked ? { hoverSound: false as const } : {})}>
        <button
          type="button"
          disabled={locked}
          aria-label={name}
          aria-pressed={isSelected}
          onClick={() => onSelect(difficultyId)}
          className={cn(
            "relative flex flex-col items-center gap-3 rounded-shell-dialog border border-border/60 bg-card/60 px-4 pb-6 pt-5 text-center transition-all disabled:cursor-default",
            locked && "grayscale border-muted/40",
            isSelected && "ring-2 ring-primary",
          )}
        >
          {showTilt ? (
            <TiltSurface
              className={cn("relative overflow-hidden rounded-shell-panel aspect-[5/6]", battleCardWidthClass)}
              shimmerActive={isShimmer}
              shimmerToken={shimmerToken}
              shimmerRounded="rounded-shell-panel"
              onMouseEnter={() => onHoverShimmer(difficultyId)}
            >
              <img src={diffArt} alt="" className={cn(cardSurfaceClass, "w-full rounded-shell-panel object-cover")} />
              {completed && (
                <div className="absolute right-2 top-2 rounded-md bg-emerald-600/90 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-emerald-100">
                  Completed
                </div>
              )}
            </TiltSurface>
          ) : (
            <div className={cn("relative overflow-hidden rounded-shell-panel aspect-[5/6]", battleCardWidthClass)}>
              <img
                src={diffArt}
                alt=""
                className={cn(cardSurfaceClass, "w-full rounded-shell-panel object-cover", "grayscale")}
              />
              <div className="absolute inset-0 flex items-center justify-center rounded-shell-panel bg-black/60">
                <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Locked</span>
              </div>
            </div>
          )}
          <p className={cn("font-display text-base font-bold text-amber-100/75", locked && "text-muted-foreground")}>
            {name}
          </p>
          <div className="flex flex-col justify-center min-h-[5.56cqh]">
            <div className="text-center text-sm leading-relaxed text-muted-foreground max-w-[20.37cqh]">
              {renderDescription(fullDescription)}
            </div>
          </div>
        </button>
      </PressableMotion>

      {locked && (
        <TooltipPanel className="pointer-events-none opacity-0 group-hover:opacity-100">
          <p className="text-sm leading-6 text-muted-foreground">Clear Previous Difficulty to Unlock</p>
        </TooltipPanel>
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
}: {
  characterId: CharacterId;
  selectedDifficulty: DifficultyId | null;
  completedDifficulties: DifficultyId[];
  onSelect: (difficultyId: DifficultyId) => void;
  onBack: () => void;
}) {
  const [selectedDifficultyId, setSelectedDifficultyId] = useState<DifficultyId | null>(selectedDifficulty);
  const config = difficultyConfigs[characterId];
  const char = characters[characterId];
  const art = characterArt[char.id];
  const shimmerState = useUiStore((s) => s.shimmerState);
  const maybeTriggerShimmer = useUiStore((s) => s.maybeTriggerShimmer);

  const canPlay = selectedDifficultyId !== null && isDifficultyUnlocked(selectedDifficultyId, completedDifficulties);

  function handlePlay() {
    if (canPlay) onSelect(selectedDifficultyId);
  }

  function handleSelectDifficulty(difficultyId: DifficultyId) {
    if (isDifficultyUnlocked(difficultyId, completedDifficulties)) {
      setSelectedDifficultyId(difficultyId);
    }
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-4 py-6 text-center">
      <ScreenHeader title={config.headerTitle} />

      <StaggerGroup className="flex flex-wrap items-start justify-center gap-6">
        <StaggerItem
          index={0}
          className="flex flex-col items-center gap-3 rounded-shell-dialog border border-border/60 bg-card/60 px-4 pb-6 pt-5"
        >
          <TiltSurface
            className={cn("relative overflow-hidden rounded-shell-panel aspect-[3/4]", battleCardWidthClass)}
            shimmerActive={shimmerState?.cardId === "character"}
            shimmerToken={shimmerState?.token}
            shimmerRounded="rounded-shell-panel"
            onMouseEnter={() => maybeTriggerShimmer("character")}
          >
            <img
              src={art}
              alt={char.name}
              className={cn(cardSurfaceClass, "w-full h-full rounded-shell-panel object-cover")}
            />
          </TiltSurface>
          <p className="font-display text-base font-bold text-amber-100/75">{char.name}</p>
          <div className="flex flex-wrap justify-center gap-1">
            {char.keywords.map((kw) => (
              <KeywordTag key={kw} keywordId={kw} pill showTooltip />
            ))}
          </div>
        </StaggerItem>

        <StaggerItem index={1} className="hidden lg:flex flex-col items-center self-stretch shrink-0">
          <div className="flex-1 w-px bg-gradient-to-b from-transparent via-amber-100/75 to-transparent" />
          <Swords className="h-4 w-4 text-amber-100/75 my-1" aria-hidden="true" />
          <div className="flex-1 w-px bg-gradient-to-b from-transparent via-amber-100/75 to-transparent" />
        </StaggerItem>

        <div className="flex flex-wrap items-start justify-center gap-6">
          {config.difficulties.map((d, index) => (
            <StaggerItem key={d.id} index={index + 2}>
              <DifficultyCard
                difficultyId={d.id}
                name={d.name}
                description={d.description}
                completed={completedDifficulties.includes(d.id)}
                locked={!isDifficultyUnlocked(d.id, completedDifficulties)}
                isSelected={selectedDifficultyId === d.id}
                isShimmer={shimmerState?.cardId === d.id}
                shimmerToken={shimmerState?.token}
                onHoverShimmer={maybeTriggerShimmer}
                onSelect={handleSelectDifficulty}
              />
            </StaggerItem>
          ))}
        </div>
      </StaggerGroup>

      <ActionButtonRow
        className="mt-6"
        width="dialog"
        secondary={{ label: "Back", onClick: onBack }}
        primary={{
          label: (
            <>
              <Swords className="h-4 w-4" aria-hidden="true" />
              Play
            </>
          ),
          disabled: !canPlay,
          onClick: handlePlay,
        }}
      />
    </div>
  );
}
