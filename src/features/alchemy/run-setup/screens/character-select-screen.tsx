// Hero selection screen with character art, keyword previews, tilt, and shimmer feedback.
// Depends on character game data, shared alchemy UI, and hover shimmer hooks.
// Used when beginning a fresh run before destination routing starts.
import { useState } from "react";
import type { CSSProperties } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { characters, characterArt, type CharacterId } from "@/lib/game-data";

import { KeywordTag } from "../../shared/ui/keyword-tag";
import { ScreenHeader } from "../../shared/ui/shared-ui";
import { TiltSurface } from "../../shared/ui/tilt-surface";
import {
  TooltipBody,
  TooltipHeader,
  TooltipPanel,
  TooltipSubheader,
  useTooltipFlip,
} from "../../shared/ui/tooltip-panel";
import { cardSurfaceClass } from "@/features/alchemy/shared/config";
import { useUiStore } from "../../shared/stores/ui-store";
import { useAppStore } from "../../shared/stores/app-store";
import { playUISound } from "@/lib/audio";

const charCardWidthClass = "w-[clamp(18vh,20.5vh,28vh)]";

const CHARACTER_UNLOCK_REQS: Record<CharacterId, { requiredChar: CharacterId | null; requiredName: string }> = {
  knight: { requiredChar: null, requiredName: "" },
  rogue: { requiredChar: "knight", requiredName: "Knight" },
  wizard: { requiredChar: "rogue", requiredName: "Rogue" },
  ranger: { requiredChar: "wizard", requiredName: "Wizard" },
  alchemist: { requiredChar: "ranger", requiredName: "Ranger" },
  warlock: { requiredChar: "alchemist", requiredName: "Alchemist" },
  druid: { requiredChar: "warlock", requiredName: "Warlock" },
  wildcard: { requiredChar: "druid", requiredName: "Druid" },
};

function CharacterCard({
  id,
  index,
  isSelected,
  isShimmer,
  shimmerToken,
  onSelect,
  onHoverShimmer,
  isLocked,
  unlockRequirementText,
}: {
  id: CharacterId;
  index: number;
  isSelected: boolean;
  isShimmer: boolean;
  shimmerToken: number | undefined;
  onSelect: (id: CharacterId) => void;
  onHoverShimmer: (id: CharacterId) => void;
  isLocked: boolean;
  unlockRequirementText: string;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const { ref: tooltipRef, flip } = useTooltipFlip(showTooltip);
  const char = characters[id];
  const art = characterArt[char.id];

  return (
    <div
      className="stagger-item flex flex-col items-center gap-3"
      style={{ "--stagger-index": index } as CSSProperties}
    >
      <div className={cn("relative", charCardWidthClass)}>
        <TiltSurface
          as="button"
          ariaLabel={isLocked ? `${char.name} (Locked)` : `Select ${char.name}`}
          className="relative w-full rounded-shell-tooltip"
          shimmerActive={isLocked ? false : isShimmer}
          shimmerToken={isLocked ? undefined : shimmerToken}
          shimmerRounded="rounded-shell-tooltip"
          selected={isSelected}
          onClick={() => {
            if (isLocked) {
              playUISound("error");
            } else {
              onSelect(id);
            }
          }}
          onMouseEnter={() => {
            if (!isLocked) onHoverShimmer(id);
            setShowTooltip(true);
          }}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <img
            src={art}
            alt={char.name}
            className={cn(
              cardSurfaceClass,
              "w-full rounded-shell-tooltip aspect-[3/4]",
              isLocked && "opacity-45 grayscale-[50%]",
            )}
          />
        </TiltSurface>
        {showTooltip ? (
          <TooltipPanel width="w-80" ref={tooltipRef} visible flip={flip}>
            <TooltipHeader>{char.name}</TooltipHeader>

            {isLocked ? (
              <TooltipBody>
                <p className="text-red-400 font-semibold">{unlockRequirementText}</p>
              </TooltipBody>
            ) : (
              <>
                <TooltipBody>
                  <p>{char.description}</p>
                </TooltipBody>

                {char.startingDeck.length > 0 ? (
                  <>
                    <TooltipSubheader>Starting Deck</TooltipSubheader>
                    <TooltipBody>
                      <p>{char.startingDeck.map((c) => c.title).join(", ")}</p>
                    </TooltipBody>
                  </>
                ) : (
                  <>
                    <TooltipSubheader>Draft a Deck</TooltipSubheader>
                    <TooltipBody>
                      <p>Choose your own fate</p>
                    </TooltipBody>
                  </>
                )}

                {char.keywords.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {char.keywords.map((kw) => (
                      <KeywordTag key={kw} keywordId={kw} pill />
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 flex">
                    <span className="character-keyword-pill-tint inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold leading-none text-amber-100/90">
                      All Keywords
                    </span>
                  </div>
                )}
              </>
            )}
          </TooltipPanel>
        ) : null}
      </div>
      <p
        className={cn("font-display text-lg font-bold text-amber-100/90 mt-1", isLocked && "text-muted-foreground/60")}
      >
        {char.name}
      </p>
    </div>
  );
}

export function CharacterSelectScreen({
  onConfirm,
  onBack,
}: {
  onConfirm: (characterId: CharacterId) => void;
  onBack: () => void;
}) {
  const [selectedId, setSelectedId] = useState<CharacterId | null>(null);
  const shimmerState = useUiStore((s) => s.shimmerState);
  const maybeTriggerShimmer = useUiStore((s) => s.maybeTriggerShimmer);
  const finishedRunCharacters = useAppStore((s) => s.finishedRunCharacters);

  const charIds = Object.keys(characters) as CharacterId[];
  const selectedChar = selectedId ? characters[selectedId] : null;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-4 py-4 text-center">
      <ScreenHeader title="Choose Your Hero" />

      <div className="grid grid-cols-2 justify-items-center gap-x-8 gap-y-6 sm:grid-cols-4">
        {charIds.map((id, index) => {
          const req = CHARACTER_UNLOCK_REQS[id];
          const isLocked = req.requiredChar !== null && !finishedRunCharacters.includes(req.requiredChar);
          const unlockRequirementText = isLocked ? `Finish a Run as the ${req.requiredName} to unlock` : "";

          return (
            <CharacterCard
              key={id}
              id={id}
              index={index}
              isSelected={selectedId === id}
              isShimmer={shimmerState?.cardId === id}
              shimmerToken={shimmerState?.token}
              onSelect={setSelectedId}
              onHoverShimmer={maybeTriggerShimmer}
              isLocked={isLocked}
              unlockRequirementText={unlockRequirementText}
            />
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-4">
        <div className="flex gap-4">
          <Button size="lg" variant="outline" className="w-40" onClick={onBack}>
            Back
          </Button>
          <Button
            size="lg"
            className="w-40"
            disabled={!selectedChar}
            onClick={() => {
              if (selectedChar) onConfirm(selectedChar.id);
            }}
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
