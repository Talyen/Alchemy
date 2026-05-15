// Difficulty selection screen shown after choosing a hero, before the run begins.
// Depends on character game data, difficulty definitions, keyword tags, shared UI, and hover effects.
import { Fragment, useState, type CSSProperties } from "react";
import { Swords } from "lucide-react";

import { Button } from "@/components/ui/button";
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

import { ShineBorder } from "@/components/ui/shine-border";
import { KeywordToken } from "../ui/card-ui";
import { KeywordTag } from "../ui/keyword-tag";
import { ScreenHeader, ShimmerOverlay } from "../ui/shared-ui";
import { useShimmerController } from "../hooks";
import { clearTiltFromEvent, setTiltFromEvent, tokenizeDescription } from "../utils";
import { battleCardWidthClass, cardSurfaceClass, popupClassName, staticCardTransform } from "../config";

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
  const bonusLine = difficultyId === "difficulty-2" ? "10% Bonus XP" : difficultyId === "difficulty-3" ? "20% Bonus XP" : "";
  const fullDescription = description + (bonusLine ? "\n" + bonusLine : "");
  const showTilt = !locked;
  const diffArt = difficultyId === "difficulty-1" ? difficulty1Art : difficultyId === "difficulty-2" ? difficulty2Art : difficulty3Art;

  return (
    <div className="relative group flex flex-col items-center">
      <div
        className={cn(
          "relative flex flex-col items-center gap-3 rounded-[26px] border border-border/60 bg-card/60 px-4 pb-6 pt-5 text-center transition-all",
          locked && "grayscale border-muted/40",
          !locked && "cursor-pointer",
        )}
        onClick={!locked ? () => onSelect(difficultyId) : undefined}
      >
        {isSelected && (
          <ShineBorder
            shineColor={["#450a0a", "#ef4444", "#991b1b", "#7f1d1d"]}
            borderWidth={2}
            duration={8}
            className="z-10"
          />
        )}
        {showTilt ? (
          <div className={cn("tilt-surface relative overflow-hidden rounded-[22px] aspect-[5/6]", battleCardWidthClass)} style={{ "--card-base-transform": staticCardTransform } as CSSProperties} onMouseMove={setTiltFromEvent} onMouseEnter={() => onHoverShimmer(difficultyId)} onMouseLeave={clearTiltFromEvent}>
            <ShimmerOverlay active={isShimmer} token={shimmerToken} rounded="rounded-[22px]" />
            <img
              src={diffArt}
              alt={name}
              className={cn(cardSurfaceClass, "w-full rounded-[22px] object-cover")}
            />
            {completed && (
              <div className="absolute right-2 top-2 rounded-md bg-emerald-600/90 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-emerald-100">
                Completed
              </div>
            )}
          </div>
        ) : (
          <div className={cn("relative overflow-hidden rounded-[22px] aspect-[5/6]", battleCardWidthClass)}>
            <img
              src={diffArt}
              alt={name}
              className={cn(cardSurfaceClass, "w-full rounded-[22px] object-cover", "grayscale")}
            />
            <div className="absolute inset-0 flex items-center justify-center rounded-[22px] bg-black/60">
              <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Locked</span>
            </div>
          </div>
        )}
        <p className={cn("text-[16px]", locked && "text-muted-foreground")}>{name}</p>
        <div className="flex flex-col justify-center min-h-[60px]">
            <p className="text-center text-[13px] leading-relaxed text-muted-foreground max-w-[220px]">
            {renderDescription(fullDescription)}
          </p>
        </div>
      </div>

      {locked && (
        <div className={cn(popupClassName, "hover-popup-panel pointer-events-none opacity-0 group-hover:opacity-100")}>
          <p className="text-xs leading-normal text-muted-foreground">Clear Previous Difficulty to Unlock</p>
        </div>
      )}
    </div>
  );
}

export function DifficultySelectScreen({
  characterId,
  completedDifficulties,
  onSelect,
  onBack,
}: {
  characterId: CharacterId;
  completedDifficulties: DifficultyId[];
  onSelect: (difficultyId: DifficultyId) => void;
  onBack: () => void;
}) {
  const [selectedDifficultyId, setSelectedDifficultyId] = useState<DifficultyId | null>(null);
  const config = difficultyConfigs[characterId];
  const char = characters[characterId];
  const art = characterArt[char.id];
  const { shimmerState, maybeTriggerShimmer } = useShimmerController();

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

      <div className="flex flex-wrap items-start justify-center gap-6">
        <div className="flex flex-col items-center gap-3 rounded-[26px] border border-border/60 bg-card/60 px-4 pb-6 pt-5">
          <div className={cn("tilt-surface relative overflow-hidden rounded-[22px] aspect-[3/4]", battleCardWidthClass)} style={{ "--card-base-transform": staticCardTransform } as CSSProperties} onMouseMove={setTiltFromEvent} onMouseEnter={() => maybeTriggerShimmer("character")} onMouseLeave={clearTiltFromEvent}>
            <ShimmerOverlay active={shimmerState?.cardId === "character"} token={shimmerState?.token} rounded="rounded-[22px]" />
            <img
              src={art}
              alt={char.name}
              className={cn(cardSurfaceClass, "w-full rounded-[22px] object-cover")}
            />
          </div>
          <p className="text-[22px] text-foreground">{char.name}</p>
          <div className="flex flex-wrap justify-center gap-1">
            {char.keywords.map((kw) => (
              <KeywordTag key={kw} keywordId={kw} pill showTooltip />
            ))}
          </div>
        </div>

        <div className="hidden lg:flex flex-col items-center self-stretch shrink-0">
          <div className="flex-1 w-px bg-gradient-to-b from-transparent via-amber-100/75 to-transparent" />
          <Swords className="h-4 w-4 text-amber-100/75 my-1" aria-hidden="true" />
          <div className="flex-1 w-px bg-gradient-to-b from-transparent via-amber-100/75 to-transparent" />
        </div>

        <div className="flex flex-wrap items-start justify-center gap-6">
          {config.difficulties.map((d) => (
            <DifficultyCard
              key={d.id}
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
          ))}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-center gap-4">
        <Button size="lg" variant="outline" className="w-40" onClick={onBack}>
          Back
        </Button>
        <Button size="lg" className="w-40" disabled={!canPlay} onClick={handlePlay}>
          <Swords className="mr-2 h-4 w-4" aria-hidden="true" />
          Play
        </Button>
      </div>
    </div>
  );
}
