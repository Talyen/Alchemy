// Hero selection screen with character art, keyword previews, tilt, and shimmer feedback.
// Depends on character game data, shared alchemy UI, and hover shimmer hooks.
// Used when beginning a fresh run before destination routing starts.
import { useState } from "react";

import { cn } from "@/lib/utils";
import { characters, characterArt, characterUnlockRequirements, type CharacterId } from "@/lib/game-data";

import { KeywordTag } from "../../shared/ui/keyword-tag";
import { ScreenHeader, ActionButtonRow, StaggerGroup, StaggerItem } from "../../shared/ui/shared-ui";
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

function CharacterCard({
  id,
  isSelected,
  isShimmer,
  shimmerToken,
  onSelect,
  onHoverShimmer,
  isLocked,
  unlockRequirementText,
}: {
  id: CharacterId;
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
    <div className="flex flex-col items-center gap-3">
      <div className={cn("relative", charCardWidthClass)}>
        <TiltSurface
          as="button"
          ariaLabel={isLocked ? `${char.name} (Locked)` : `Select ${char.name}`}
          tiltEnabled={!isLocked}
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
                <p>{unlockRequirementText}</p>
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

      <StaggerGroup className="grid grid-cols-2 justify-items-center gap-x-8 gap-y-6 sm:grid-cols-4">
        {charIds.map((id, index) => {
          const req = characterUnlockRequirements[id];
          const isLocked = req.requiredChar !== null && !finishedRunCharacters.includes(req.requiredChar);
          const unlockRequirementText = isLocked ? `Finish a Run as the ${req.requiredName} to unlock` : "";

          return (
            <StaggerItem key={id} index={index}>
              <CharacterCard
                id={id}
                isSelected={selectedId === id}
                isShimmer={shimmerState?.cardId === id}
                shimmerToken={shimmerState?.token}
                onSelect={setSelectedId}
                onHoverShimmer={maybeTriggerShimmer}
                isLocked={isLocked}
                unlockRequirementText={unlockRequirementText}
              />
            </StaggerItem>
          );
        })}
      </StaggerGroup>

      <ActionButtonRow
        width="dialog"
        secondary={{ label: "Back", onClick: onBack }}
        primary={{
          label: "Continue",
          disabled: !selectedChar,
          onClick: () => {
            if (selectedChar) onConfirm(selectedChar.id);
          },
        }}
      />
    </div>
  );
}
